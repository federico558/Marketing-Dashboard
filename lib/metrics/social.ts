import { withCache, cacheKey } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { rangeKey } from "@/lib/dates";
import {
  fetchWindsorRows,
  safeRate,
  sumBy,
  toNumber,
  toString,
} from "./helpers";
import type {
  SocialChannelStats,
  SocialMetrics,
  SocialPost,
  TrendPoint,
} from "./types";

function emptyChannel(): SocialChannelStats {
  return {
    totalImpressions: 0,
    totalEngagement: 0,
    avgEngagementRate: 0,
    posts: [],
    connected: false,
  };
}

function linkedinPost(r: Record<string, unknown>): SocialPost {
  const impressions = toNumber(r.impressions);
  const engagement =
    toNumber(r.likes) + toNumber(r.comments) + toNumber(r.shares);
  return {
    network: "linkedin",
    date: toString(r.date),
    text: toString(r.post_text).slice(0, 140),
    impressions,
    engagement,
    engagementRate: toNumber(r.engagement_rate) || safeRate(engagement, impressions),
  };
}

function instagramPost(r: Record<string, unknown>): SocialPost {
  const impressions = toNumber(r.impressions);
  const engagement =
    toNumber(r.likes) + toNumber(r.comments) + toNumber(r.saves);
  return {
    network: "instagram",
    date: toString(r.date),
    text: toString(r.caption).slice(0, 140),
    impressions,
    engagement,
    engagementRate: toNumber(r.engagement_rate) || safeRate(engagement, impressions),
  };
}

function channelFromPosts(posts: SocialPost[], connected: boolean): SocialChannelStats {
  const totalImpressions = sumBy(posts, (p) => p.impressions);
  const totalEngagement = sumBy(posts, (p) => p.engagement);
  const avgEngagementRate = posts.length
    ? sumBy(posts, (p) => p.engagementRate) / posts.length
    : 0;
  return {
    totalImpressions,
    totalEngagement,
    avgEngagementRate,
    posts: posts
      .slice()
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10),
    connected,
  };
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
    const [liRows, igRows] = await Promise.all([
      fetchWindsorRows(userId, "LINKEDIN", range),
      fetchWindsorRows(userId, "INSTAGRAM", range),
    ]);

    const liConnected = liRows !== null;
    const igConnected = igRows !== null;

    const linkedinPosts = (liRows ?? []).map(linkedinPost);
    const instagramPosts = (igRows ?? []).map(instagramPost);

    const linkedin = liConnected ? channelFromPosts(linkedinPosts, true) : emptyChannel();
    const instagram = igConnected
      ? channelFromPosts(instagramPosts, true)
      : emptyChannel();

    const trendMap = new Map<string, TrendPoint>();
    for (const p of linkedinPosts) {
      if (!p.date) continue;
      const cur = trendMap.get(p.date) ?? {
        date: p.date,
        linkedin: 0,
        instagram: 0,
      };
      cur.linkedin = (cur.linkedin as number) + p.impressions;
      trendMap.set(p.date, cur);
    }
    for (const p of instagramPosts) {
      if (!p.date) continue;
      const cur = trendMap.get(p.date) ?? {
        date: p.date,
        linkedin: 0,
        instagram: 0,
      };
      cur.instagram = (cur.instagram as number) + p.impressions;
      trendMap.set(p.date, cur);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    );

    return { linkedin, instagram, trend };
  });
}
