import { withCache, cacheKey } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { formatRangeISO, rangeKey } from "@/lib/dates";
import { fetchGA4Rows } from "@/lib/google/ga4";
import { fetchGSCRows } from "@/lib/google/searchConsole";
import { avgBy, getConnection, safeRate, sumBy } from "./helpers";
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
    const { from, to } = formatRangeISO(range);
    const [ga4Conn, gscConn] = await Promise.all([
      getConnection(userId, "GA4"),
      getConnection(userId, "SEARCH_CONSOLE"),
    ]);

    const ga4Rows = ga4Conn?.status === "CONNECTED"
      ? await fetchGA4Rows(ga4Conn, from, to).catch((e) => {
          console.error("[metrics] GA4 fetch failed", e);
          return null;
        })
      : null;
    const gscRows = gscConn?.status === "CONNECTED"
      ? await fetchGSCRows(gscConn, from, to).catch((e) => {
          console.error("[metrics] GSC fetch failed", e);
          return null;
        })
      : null;

    const ga4Connected = ga4Rows !== null;
    const gscConnected = gscRows !== null;

    const ga4 = {
      sessions: sumBy(ga4Rows ?? [], (r) => r.sessions),
      users: sumBy(ga4Rows ?? [], (r) => r.users),
      pageviews: sumBy(ga4Rows ?? [], (r) => r.pageviews),
      avgSessionDuration: avgBy(ga4Rows ?? [], (r) => r.avgSessionDuration),
      bounceRate: avgBy(ga4Rows ?? [], (r) => r.bounceRate),
      engagementRate: avgBy(ga4Rows ?? [], (r) => r.engagementRate),
      connected: ga4Connected,
    };

    const gscImpr = sumBy(gscRows ?? [], (r) => r.impressions);
    const gscClicks = sumBy(gscRows ?? [], (r) => r.clicks);
    const searchConsole = {
      impressions: gscImpr,
      clicks: gscClicks,
      ctr: safeRate(gscClicks, gscImpr),
      avgPosition: avgBy(gscRows ?? [], (r) => r.position),
      connected: gscConnected,
    };

    const trendMap = new Map<string, TrendPoint>();
    for (const r of ga4Rows ?? []) {
      const cur = trendMap.get(r.date) ?? { date: r.date, sessions: 0, clicks: 0 };
      cur.sessions = (cur.sessions as number) + r.sessions;
      trendMap.set(r.date, cur);
    }
    for (const r of gscRows ?? []) {
      const cur = trendMap.get(r.date) ?? { date: r.date, sessions: 0, clicks: 0 };
      cur.clicks = (cur.clicks as number) + r.clicks;
      trendMap.set(r.date, cur);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    );

    return { ga4, searchConsole, trend };
  });
}
