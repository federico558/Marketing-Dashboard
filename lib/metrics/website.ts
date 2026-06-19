import { withCache, cacheKey } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { formatRangeISO, previousRange, rangeKey } from "@/lib/dates";
import { fetchGA4Breakdown, fetchGA4Rows } from "@/lib/google/ga4";
import { fetchGSCRows } from "@/lib/google/searchConsole";
import { avgBy, getConnection, safeRate, sumBy } from "./helpers";
import type { BreakdownRow, TrendPoint, WebsiteMetrics } from "./types";

const EMPTY_BREAKDOWNS: WebsiteMetrics["breakdowns"] = {
  byCountry: [],
  byPage: [],
  byChannel: [],
};

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
    const current = formatRangeISO(range);
    const previous = formatRangeISO(previousRange(range));
    const [ga4Conn, gscConn] = await Promise.all([
      getConnection(userId, "GA4"),
      getConnection(userId, "SEARCH_CONSOLE"),
    ]);

    const ga4Active = ga4Conn?.status === "CONNECTED";
    const gscActive = gscConn?.status === "CONNECTED";

    const [ga4Rows, gscRows, byCountry, byPage, byChannel] = await Promise.all([
      ga4Active && ga4Conn
        ? fetchGA4Rows(ga4Conn, current.from, current.to).catch((e) => {
            console.error("[metrics] GA4 rows failed", e);
            return null;
          })
        : Promise.resolve(null),
      gscActive && gscConn
        ? fetchGSCRows(gscConn, current.from, current.to).catch((e) => {
            console.error("[metrics] GSC fetch failed", e);
            return null;
          })
        : Promise.resolve(null),
      ga4Active && ga4Conn
        ? fetchGA4Breakdown(ga4Conn, current, previous, "country", "activeUsers").catch(
            (e) => {
              console.error("[metrics] GA4 by-country failed", e);
              return [] as BreakdownRow[];
            },
          )
        : Promise.resolve([] as BreakdownRow[]),
      ga4Active && ga4Conn
        ? fetchGA4Breakdown(
            ga4Conn,
            current,
            previous,
            "pageTitle",
            "screenPageViews",
          ).catch((e) => {
            console.error("[metrics] GA4 by-page failed", e);
            return [] as BreakdownRow[];
          })
        : Promise.resolve([] as BreakdownRow[]),
      ga4Active && ga4Conn
        ? fetchGA4Breakdown(
            ga4Conn,
            current,
            previous,
            "sessionDefaultChannelGroup",
            "sessions",
          ).catch((e) => {
            console.error("[metrics] GA4 by-channel failed", e);
            return [] as BreakdownRow[];
          })
        : Promise.resolve([] as BreakdownRow[]),
    ]);

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

    return {
      ga4,
      searchConsole,
      trend,
      breakdowns: ga4Connected
        ? { byCountry, byPage, byChannel }
        : EMPTY_BREAKDOWNS,
    };
  });
}
