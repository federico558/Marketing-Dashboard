import type { Connection } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

const ENDPOINT = "https://api.buffer.com";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphqlRaw<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResponse<T>> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Buffer GraphQL failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GraphQLResponse<T>;
}

async function graphql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const json = await graphqlRaw<T>(apiKey, query, variables);
  if (json.errors?.length) {
    throw new Error(
      `Buffer GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!json.data) {
    throw new Error("Buffer GraphQL returned no data");
  }
  return json.data;
}

function isInsightsScopeError(errors: Array<{ message: string }>): boolean {
  return errors.some((e) => /insights:read|Insufficient scope/i.test(e.message));
}

export async function verifyBufferKey(apiKey: string): Promise<void> {
  await graphql(apiKey, "query { account { organizations { id } } }");
}

interface OrganizationNode {
  id: string;
}

interface AccountResponse {
  account?: { organizations?: OrganizationNode[] };
}

async function listOrganizations(apiKey: string): Promise<string[]> {
  const data = await graphql<AccountResponse>(
    apiKey,
    "query { account { organizations { id } } }",
  );
  return (data.account?.organizations ?? []).map((o) => o.id);
}

interface PostMetric {
  name?: string;
  value?: number | string | null;
}

interface PostNode {
  id: string;
  text?: string | null;
  dueAt?: string | null;
  sentAt?: string | null;
  channelId?: string | null;
  channel?: {
    id?: string;
    service?: string;
    name?: string;
    displayName?: string;
  };
  metrics?: PostMetric[];
}

interface PostsResponse {
  posts?: {
    edges?: Array<{ cursor?: string; node?: PostNode }>;
    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
  };
}

const POSTS_QUERY = `
  query Posts($input: PostsInput!, $first: Int!, $after: String) {
    posts(input: $input, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          text
          dueAt
          sentAt
          channelId
          channel { id service name displayName }
          metrics { name value }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const POSTS_QUERY_NO_METRICS = `
  query Posts($input: PostsInput!, $first: Int!, $after: String) {
    posts(input: $input, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          text
          dueAt
          sentAt
          channelId
          channel { id service name displayName }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export interface BufferPost {
  id: string;
  text: string;
  sentAt: string;
  channelId: string;
  service: string;
  channelName: string;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function metricByName(metrics: PostMetric[] | undefined, names: string[]): number {
  if (!metrics) return 0;
  const lowered = names.map((n) => n.toLowerCase());
  for (const m of metrics) {
    if (!m.name) continue;
    if (lowered.includes(m.name.toLowerCase())) return num(m.value);
  }
  return 0;
}

function normalizePost(node: PostNode): BufferPost {
  const m = node.metrics ?? [];
  const likes = metricByName(m, ["likes", "likeCount", "reactions"]);
  const comments = metricByName(m, ["comments", "commentCount", "replies"]);
  const shares = metricByName(m, ["shares", "shareCount", "reposts", "retweets"]);
  const engagementFromBuffer = metricByName(m, [
    "engagement",
    "engagements",
    "totalEngagement",
  ]);
  const engagement = engagementFromBuffer || likes + comments + shares;
  return {
    id: node.id,
    text: (node.text ?? "").trim(),
    sentAt: node.sentAt ?? node.dueAt ?? "",
    channelId: node.channel?.id ?? node.channelId ?? "",
    service: (node.channel?.service ?? "").toLowerCase(),
    channelName: node.channel?.displayName ?? node.channel?.name ?? "",
    impressions: metricByName(m, ["impressions", "impressionCount", "views"]),
    reach: metricByName(m, ["reach", "uniqueImpressions", "uniqueViews"]),
    engagement,
    likes,
    comments,
    shares,
    clicks: metricByName(m, ["clicks", "clickCount", "linkClicks"]),
  };
}

function inRange(sentAt: string, fromMs: number, toMs: number): boolean {
  if (!sentAt) return false;
  const t = new Date(sentAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= fromMs && t <= toMs;
}

async function fetchPostsForOrganization(
  apiKey: string,
  organizationId: string,
  fromMs: number,
  toMs: number,
  useMetrics: boolean,
): Promise<{ posts: BufferPost[]; scopeError: boolean }> {
  const out: BufferPost[] = [];
  let cursor: string | null = null;
  let scopeError = false;
  const MAX_PAGES = 20;
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const json: GraphQLResponse<PostsResponse> = await graphqlRaw<PostsResponse>(
      apiKey,
      useMetrics ? POSTS_QUERY : POSTS_QUERY_NO_METRICS,
      {
        input: {
          organizationId,
          filter: { status: ["sent"] },
          sort: [{ field: "dueAt", direction: "desc" }],
        },
        first: 50,
        after: cursor,
      },
    );
    if (json.errors?.length) {
      if (useMetrics && isInsightsScopeError(json.errors)) {
        scopeError = true;
        break;
      }
      throw new Error(
        `Buffer GraphQL errors: ${json.errors.map((e: { message: string }) => e.message).join("; ")}`,
      );
    }
    const data: PostsResponse | undefined = json.data;
    if (!data) break;
    const edges = data.posts?.edges ?? [];
    let allTooOld = edges.length > 0;
    for (const edge of edges) {
      if (!edge.node) continue;
      const post = normalizePost(edge.node);
      if (post.sentAt) {
        const t = new Date(post.sentAt).getTime();
        if (Number.isFinite(t) && t >= fromMs) allTooOld = false;
      } else {
        allTooOld = false;
      }
      if (inRange(post.sentAt, fromMs, toMs)) out.push(post);
    }
    if (allTooOld) break;
    const pageInfo = data.posts?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }
  return { posts: out, scopeError };
}

export interface BufferFetchResult {
  posts: BufferPost[];
  metricsAvailable: boolean;
}

export async function fetchBufferPosts(
  conn: Connection,
  from: string,
  to: string,
): Promise<BufferFetchResult> {
  if (!conn.apiKeyEnc) throw new Error("Buffer connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime() + 86_400_000 - 1;
  const orgIds = await listOrganizations(apiKey);
  if (orgIds.length === 0) return { posts: [], metricsAvailable: true };
  const withMetrics = await Promise.all(
    orgIds.map((id) => fetchPostsForOrganization(apiKey, id, fromMs, toMs, true)),
  );
  if (withMetrics.some((r) => r.scopeError)) {
    const fallback = await Promise.all(
      orgIds.map((id) => fetchPostsForOrganization(apiKey, id, fromMs, toMs, false)),
    );
    return {
      posts: fallback.flatMap((r) => r.posts),
      metricsAvailable: false,
    };
  }
  return {
    posts: withMetrics.flatMap((r) => r.posts),
    metricsAvailable: true,
  };
}

export async function bufferDebug(
  apiKey: string,
  from: string,
  to: string,
): Promise<unknown> {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime() + 86_400_000 - 1;
  let account: unknown = null;
  try {
    account = await graphql(
      apiKey,
      "query { account { id organizations { id name } } }",
    );
  } catch (e) {
    account = { error: e instanceof Error ? e.message : String(e) };
  }
  const orgIds = (account as AccountResponse | null)?.account?.organizations?.map(
    (o) => o.id,
  ) ?? [];
  let postMetricSchema: unknown = null;
  try {
    postMetricSchema = await graphql(
      apiKey,
      `query { __type(name: "PostMetric") { name fields { name type { name kind ofType { name kind } } } } }`,
    );
  } catch (e) {
    postMetricSchema = { error: e instanceof Error ? e.message : String(e) };
  }
  let postsRaw: unknown = null;
  let postsNoMetricsRaw: unknown = null;
  if (orgIds[0]) {
    const variables = {
      input: {
        organizationId: orgIds[0],
        filter: { status: ["sent"] },
        sort: [{ field: "dueAt", direction: "desc" }],
      },
      first: 10,
      after: null,
    };
    const withMetrics = await graphqlRaw(apiKey, POSTS_QUERY, variables).catch(
      (e) => ({ error: e instanceof Error ? e.message : String(e) }),
    );
    postsRaw = withMetrics;
    const hasErrors =
      withMetrics &&
      typeof withMetrics === "object" &&
      "errors" in withMetrics &&
      Array.isArray((withMetrics as { errors?: unknown[] }).errors) &&
      ((withMetrics as { errors: Array<{ message: string }> }).errors).length > 0;
    if (hasErrors) {
      const errs = (withMetrics as { errors: Array<{ message: string }> }).errors;
      if (isInsightsScopeError(errs)) {
        postsNoMetricsRaw = await graphqlRaw(
          apiKey,
          POSTS_QUERY_NO_METRICS,
          variables,
        ).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
      }
    }
  }
  return {
    range: { from, to, fromMs, toMs },
    account,
    postMetricSchema,
    postsRaw,
    postsNoMetricsRaw,
  };
}
