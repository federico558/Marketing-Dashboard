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

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export async function getWebsiteMetrics(
  range: DateRange,
): Promise<WebsiteMetrics> {
  const key = cacheKey(["provider", "website", "range", rangeKey(range)]);
  return withCache(key, async () => {
    const current = formatRangeISO(range);
    const previous = formatRangeISO(previousRange(range));
    const [ga4Conn, gscConn] = await Promise.all([
      getConnection("GA4"),
      getConnection("SEARCH_CONSOLE"),
    ]);

    const ga4Active = ga4Conn?.status === "CONNECTED";
    const gscActive = gscConn?.status === "CONNECTED";

    const [
      ga4Rows,
      ga4PrevRows,
      gscRows,
      gscPrevRows,
      byCountry,
      byPage,
      byChannel,
    ] = await Promise.all([
      ga4Active && ga4Conn
        ? fetchGA4Rows(ga4Conn, current.from, current.to).catch((e) => {
            console.error("[metrics] GA4 rows failed", e);
            return null;
          })
        : Promise.resolve(null),
      ga4Active && ga4Conn
        ? fetchGA4Rows(ga4Conn, previous.from, previous.to).catch((e) => {
            console.error("[metrics] GA4 prev rows failed", e);
            return null;
          })
        : Promise.resolve(null),
      gscActive && gscConn
        ? fetchGSCRows(gscConn, current.from, current.to).catch((e) => {
            console.error("[metrics] GSC fetch failed", e);
            return null;
          })
        : Promise.resolve(null),
      gscActive && gscConn
        ? fetchGSCRows(gscConn, previous.from, previous.to).catch((e) => {
            console.error("[metrics] GSC prev fetch failed", e);
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

    const sessions = sumBy(ga4Rows ?? [], (r) => r.sessions);
    const users = sumBy(ga4Rows ?? [], (r) => r.users);
    const pageviews = sumBy(ga4Rows ?? [], (r) => r.pageviews);
    const avgSessionDuration = avgBy(ga4Rows ?? [], (r) => r.avgSessionDuration);
    const bounceRate = avgBy(ga4Rows ?? [], (r) => r.bounceRate);
    const engagementRate = avgBy(ga4Rows ?? [], (r) => r.engagementRate);

    const prevSessions = sumBy(ga4PrevRows ?? [], (r) => r.sessions);
    const prevUsers = sumBy(ga4PrevRows ?? [], (r) => r.users);
    const prevPageviews = sumBy(ga4PrevRows ?? [], (r) => r.pageviews);
    const prevAvgSessionDuration = avgBy(
      ga4PrevRows ?? [],
      (r) => r.avgSessionDuration,
    );
    const prevBounceRate = avgBy(ga4PrevRows ?? [], (r) => r.bounceRate);
    const prevEngagementRate = avgBy(ga4PrevRows ?? [], (r) => r.engagementRate);

    const ga4 = {
      sessions,
      sessionsChange: pctChange(sessions, prevSessions),
      users,
      usersChange: pctChange(users, prevUsers),
      pageviews,
      pageviewsChange: pctChange(pageviews, prevPageviews),
      avgSessionDuration,
      avgSessionDurationChange: pctChange(avgSessionDuration, prevAvgSessionDuration),
      bounceRate,
      bounceRateChange: pctChange(bounceRate, prevBounceRate),
      engagementRate,
      engagementRateChange: pctChange(engagementRate, prevEngagementRate),
      connected: ga4Connected,
    };

    const gscImpr = sumBy(gscRows ?? [], (r) => r.impressions);
    const gscClicks = sumBy(gscRows ?? [], (r) => r.clicks);
    const gscCtr = safeRate(gscClicks, gscImpr);
    const gscPosition = avgBy(gscRows ?? [], (r) => r.position);

    const prevImpr = sumBy(gscPrevRows ?? [], (r) => r.impressions);
    const prevClicks = sumBy(gscPrevRows ?? [], (r) => r.clicks);
    const prevCtr = safeRate(prevClicks, prevImpr);
    const prevPosition = avgBy(gscPrevRows ?? [], (r) => r.position);

    const searchConsole = {
      impressions: gscImpr,
      impressionsChange: pctChange(gscImpr, prevImpr),
      clicks: gscClicks,
      clicksChange: pctChange(gscClicks, prevClicks),
      ctr: gscCtr,
      ctrChange: pctChange(gscCtr, prevCtr),
      avgPosition: gscPosition,
      avgPositionChange: pctChange(gscPosition, prevPosition),
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
