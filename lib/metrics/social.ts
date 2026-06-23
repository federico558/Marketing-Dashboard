import { cacheKey, withCache } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { formatRangeISO, previousRange, rangeKey } from "@/lib/dates";
import { fetchBufferPosts, type BufferPost } from "@/lib/buffer/client";
import { getConnection, safeRate } from "./helpers";
import type {
  SocialChannelStats,
  SocialMetrics,
  SocialTopPost,
  TrendPoint,
} from "./types";

const SERVICE_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X",
  x: "X",
  tiktok: "TikTok",
  threads: "Threads",
  bluesky: "Bluesky",
  pinterest: "Pinterest",
  youtube: "YouTube",
  google_business: "Google Business",
  mastodon: "Mastodon",
};

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function emptyMetrics(connected: boolean): SocialMetrics {
  return { connected, channels: [], topPosts: [], trend: [] };
}

interface ChannelTotals {
  posts: number;
  impressions: number;
  reach: number;
  engagement: number;
}

function totalsByChannel(posts: BufferPost[]): Map<string, ChannelTotals & { channelName: string }> {
  const m = new Map<string, ChannelTotals & { channelName: string }>();
  for (const p of posts) {
    const key = p.service;
    const cur = m.get(key) ?? {
      posts: 0,
      impressions: 0,
      reach: 0,
      engagement: 0,
      channelName: SERVICE_LABEL[key] ?? p.channelName ?? key,
    };
    cur.posts += 1;
    cur.impressions += p.impressions;
    cur.reach += p.reach;
    cur.engagement += p.engagement;
    if (!cur.channelName && p.channelName) cur.channelName = p.channelName;
    m.set(key, cur);
  }
  return m;
}

export async function getSocialMetrics(
  userId: string,
  range: DateRange,
): Promise<SocialMetrics> {
  const key = cacheKey([
    "user",
    userId,
    "provider",
    "social",
    "range",
    rangeKey(range),
  ]);
  return withCache(key, userId, async () => {
    const conn = await getConnection(userId, "BUFFER");
    if (!conn || conn.status !== "CONNECTED") return emptyMetrics(false);

    const current = formatRangeISO(range);
    const previous = formatRangeISO(previousRange(range));
    const [curr, prev] = await Promise.all([
      fetchBufferPosts(conn, current.from, current.to).catch((e) => {
        console.error("[metrics] Buffer current failed", e);
        return null;
      }),
      fetchBufferPosts(conn, previous.from, previous.to).catch((e) => {
        console.error("[metrics] Buffer previous failed", e);
        return [] as BufferPost[];
      }),
    ]);

    if (!curr) return emptyMetrics(true);

    const currentByChannel = totalsByChannel(curr);
    const previousByChannel = totalsByChannel(prev ?? []);
    const channels: SocialChannelStats[] = Array.from(currentByChannel.entries())
      .map(([service, t]) => {
        const p = previousByChannel.get(service);
        const rate = safeRate(t.engagement, t.impressions);
        const prevRate = p ? safeRate(p.engagement, p.impressions) : 0;
        return {
          service,
          channelName: t.channelName,
          posts: t.posts,
          postsChange: p ? pctChange(t.posts, p.posts) : null,
          impressions: t.impressions,
          impressionsChange: p ? pctChange(t.impressions, p.impressions) : null,
          reach: t.reach,
          reachChange: p ? pctChange(t.reach, p.reach) : null,
          engagement: t.engagement,
          engagementChange: p ? pctChange(t.engagement, p.engagement) : null,
          engagementRate: rate,
          engagementRateChange: p ? pctChange(rate, prevRate) : null,
        };
      })
      .sort((a, b) => b.engagement - a.engagement);

    const topPosts: SocialTopPost[] = [...curr]
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        text: p.text || "(no caption)",
        service: p.service,
        channelName: SERVICE_LABEL[p.service] ?? p.channelName ?? p.service,
        sentAt: p.sentAt,
        impressions: p.impressions,
        engagement: p.engagement,
      }));

    const trendMap = new Map<string, TrendPoint>();
    for (const p of curr) {
      const date = (p.sentAt ?? "").slice(0, 10);
      if (!date) continue;
      const cur = trendMap.get(date) ?? { date, impressions: 0, engagement: 0 };
      cur.impressions = (cur.impressions as number) + p.impressions;
      cur.engagement = (cur.engagement as number) + p.engagement;
      trendMap.set(date, cur);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    );

    return { connected: true, channels, topPosts, trend };
  });
}
