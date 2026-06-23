import type { Connection } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

const ENDPOINT = "https://graphql.buffer.com";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
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
    throw new Error(`Buffer GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("Buffer GraphQL returned no data");
  }
  return json.data;
}

export async function verifyBufferKey(apiKey: string): Promise<void> {
  try {
    await graphql<{ viewer?: { id?: string } }>(
      apiKey,
      "query { viewer { id } }",
    );
  } catch (e) {
    throw new Error(`Buffer key invalid: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

export interface BufferChannel {
  id: string;
  service: string;
  name: string;
}

interface PostNode {
  id: string;
  text?: string | null;
  sentAt?: string | null;
  channel?: { id?: string; service?: string; name?: string };
  metrics?: {
    impressions?: number | null;
    reach?: number | null;
    engagement?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    clicks?: number | null;
  };
}

const POSTS_QUERY = `
  query Posts($first: Int!, $after: String, $start: DateTime, $end: DateTime) {
    viewer {
      id
      posts(first: $first, after: $after, sentAfter: $start, sentBefore: $end) {
        edges {
          cursor
          node {
            id
            text
            sentAt
            channel { id service name }
            metrics {
              impressions
              reach
              engagement
              likes
              comments
              shares
              clicks
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

interface PostsResponse {
  viewer?: {
    posts?: {
      edges?: Array<{ cursor?: string; node?: PostNode }>;
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    };
  };
}

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

function normalizePost(node: PostNode): BufferPost {
  const m = node.metrics ?? {};
  const likes = num(m.likes);
  const comments = num(m.comments);
  const shares = num(m.shares);
  const engagement = num(m.engagement) || likes + comments + shares;
  return {
    id: node.id,
    text: (node.text ?? "").trim(),
    sentAt: node.sentAt ?? "",
    channelId: node.channel?.id ?? "",
    service: (node.channel?.service ?? "").toLowerCase(),
    channelName: node.channel?.name ?? "",
    impressions: num(m.impressions),
    reach: num(m.reach),
    engagement,
    likes,
    comments,
    shares,
    clicks: num(m.clicks),
  };
}

function isoOrPassthrough(d: string): string {
  if (d.length === 10) return `${d}T00:00:00Z`;
  return d;
}

export async function fetchBufferPosts(
  conn: Connection,
  from: string,
  to: string,
): Promise<BufferPost[]> {
  if (!conn.apiKeyEnc) throw new Error("Buffer connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const start = isoOrPassthrough(from);
  const end = isoOrPassthrough(`${to}T23:59:59Z`.slice(0, 19) + "Z");
  const posts: BufferPost[] = [];
  let cursor: string | null = null;
  const MAX_PAGES = 20;
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const data: PostsResponse = await graphql(apiKey, POSTS_QUERY, {
      first: 50,
      after: cursor,
      start,
      end,
    });
    const edges = data.viewer?.posts?.edges ?? [];
    for (const edge of edges) {
      if (edge.node) posts.push(normalizePost(edge.node));
    }
    const pageInfo = data.viewer?.posts?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }
  return posts;
}

export async function bufferDebug(
  apiKey: string,
  from: string,
  to: string,
): Promise<unknown> {
  const start = isoOrPassthrough(from);
  const end = isoOrPassthrough(`${to}T23:59:59Z`.slice(0, 19) + "Z");
  try {
    const viewer = await graphql<{ viewer?: unknown }>(
      apiKey,
      "query { viewer { id channels { id service name } } }",
    );
    let postsRaw: unknown = null;
    try {
      postsRaw = await graphql(apiKey, POSTS_QUERY, {
        first: 10,
        after: null,
        start,
        end,
      });
    } catch (e) {
      postsRaw = { error: e instanceof Error ? e.message : String(e) };
    }
    return { range: { start, end }, viewer, postsRaw };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
