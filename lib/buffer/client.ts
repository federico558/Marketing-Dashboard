import type { Connection } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

const ENDPOINT = "https://api.buffer.com";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
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
  const json = (await res.json()) as GraphQLResponse<T>;
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
  metrics?: Record<string, number | null | undefined>;
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
          metrics
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

function pickMetric(
  metrics: Record<string, unknown> | undefined,
  keys: string[],
): number {
  if (!metrics) return 0;
  for (const k of keys) {
    if (k in metrics) return num(metrics[k]);
  }
  return 0;
}

function normalizePost(node: PostNode): BufferPost {
  const m = (node.metrics ?? {}) as Record<string, unknown>;
  const likes = pickMetric(m, ["likes", "likeCount", "reactions"]);
  const comments = pickMetric(m, ["comments", "commentCount", "replies"]);
  const shares = pickMetric(m, ["shares", "shareCount", "reposts", "retweets"]);
  const engagementFromBuffer = pickMetric(m, [
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
    impressions: pickMetric(m, ["impressions", "impressionCount", "views"]),
    reach: pickMetric(m, ["reach", "uniqueImpressions", "uniqueViews"]),
    engagement,
    likes,
    comments,
    shares,
    clicks: pickMetric(m, ["clicks", "clickCount", "linkClicks"]),
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
): Promise<BufferPost[]> {
  const out: BufferPost[] = [];
  let cursor: string | null = null;
  const MAX_PAGES = 20;
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const data: PostsResponse = await graphql(apiKey, POSTS_QUERY, {
      input: {
        organizationId,
        filter: { status: ["sent"] },
        sort: [{ field: "dueAt", direction: "DESC" }],
      },
      first: 50,
      after: cursor,
    });
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
  return out;
}

export async function fetchBufferPosts(
  conn: Connection,
  from: string,
  to: string,
): Promise<BufferPost[]> {
  if (!conn.apiKeyEnc) throw new Error("Buffer connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime() + 86_400_000 - 1;
  const orgIds = await listOrganizations(apiKey);
  if (orgIds.length === 0) return [];
  const perOrg = await Promise.all(
    orgIds.map((id) => fetchPostsForOrganization(apiKey, id, fromMs, toMs)),
  );
  return perOrg.flat();
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
  let postsRaw: unknown = null;
  if (orgIds[0]) {
    try {
      postsRaw = await graphql(apiKey, POSTS_QUERY, {
        input: {
          organizationId: orgIds[0],
          filter: { status: ["sent"] },
          sort: [{ field: "dueAt", direction: "DESC" }],
        },
        first: 10,
        after: null,
      });
    } catch (e) {
      postsRaw = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { range: { from, to, fromMs, toMs }, account, postsRaw };
}
