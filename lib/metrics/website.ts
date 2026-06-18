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
import type { TrendPoint, WebsiteMetrics } from "./types";

export async function getWebsiteMetrics(
  userId: string,
  range: DateRange,
): Promise<WebsiteMetrics> {
  const key = cacheKey([
    "user",
    userId,
    "provider",
    "website",
    "range",
    rangeKey(range),
  ]);
  return withCache(key, userId, async () => {
    const [ga4Rows, gscRows] = await Promise.all([
      fetchWindsorRows(userId, "GA4", range),
      fetchWindsorRows(userId, "SEARCH_CONSOLE", range),
    ]);

    const ga4Connected = ga4Rows !== null;
    const gscConnected = gscRows !== null;

    const ga4Sessions = sumBy(ga4Rows ?? [], (r) => toNumber(r.sessions));
    const ga4Users = sumBy(ga4Rows ?? [], (r) => toNumber(r.totalUsers));
    const ga4Pageviews = sumBy(ga4Rows ?? [], (r) =>
      toNumber(r.screenPageViews),
    );
    const ga4Duration = (ga4Rows ?? []).length
      ? sumBy(ga4Rows ?? [], (r) => toNumber(r.averageSessionDuration)) /
        (ga4Rows ?? []).length
      : 0;
    const ga4Bounce = (ga4Rows ?? []).length
      ? sumBy(ga4Rows ?? [], (r) => toNumber(r.bounceRate)) /
        (ga4Rows ?? []).length
      : 0;
    const ga4Engagement = (ga4Rows ?? []).length
      ? sumBy(ga4Rows ?? [], (r) => toNumber(r.engagementRate)) /
        (ga4Rows ?? []).length
      : 0;

    const gscImpr = sumBy(gscRows ?? [], (r) => toNumber(r.impressions));
    const gscClicks = sumBy(gscRows ?? [], (r) => toNumber(r.clicks));
    const gscCtr = safeRate(gscClicks, gscImpr);
    const gscPosition = (gscRows ?? []).length
      ? sumBy(gscRows ?? [], (r) => toNumber(r.position)) /
        (gscRows ?? []).length
      : 0;

    const trendMap = new Map<string, TrendPoint>();
    for (const r of ga4Rows ?? []) {
      const d = toString(r.date);
      if (!d) continue;
      const cur = trendMap.get(d) ?? { date: d, sessions: 0, clicks: 0 };
      cur.sessions = (cur.sessions as number) + toNumber(r.sessions);
      trendMap.set(d, cur);
    }
    for (const r of gscRows ?? []) {
      const d = toString(r.date);
      if (!d) continue;
      const cur = trendMap.get(d) ?? { date: d, sessions: 0, clicks: 0 };
      cur.clicks = (cur.clicks as number) + toNumber(r.clicks);
      trendMap.set(d, cur);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    );

    return {
      ga4: {
        sessions: ga4Sessions,
        users: ga4Users,
        pageviews: ga4Pageviews,
        avgSessionDuration: ga4Duration,
        bounceRate: ga4Bounce,
        engagementRate: ga4Engagement,
        connected: ga4Connected,
      },
      searchConsole: {
        impressions: gscImpr,
        clicks: gscClicks,
        ctr: gscCtr,
        avgPosition: gscPosition,
        connected: gscConnected,
      },
      trend,
    };
  });
}
