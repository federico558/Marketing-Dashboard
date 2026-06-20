import { cacheKey, withCache } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { formatRangeISO, previousRange, rangeKey } from "@/lib/dates";
import { fetchPipedriveRange } from "@/lib/pipedrive/client";
import { getConnection, safeRate } from "./helpers";
import type { CrmMetrics, TrendPoint } from "./types";

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function emptyMetrics(connected: boolean): CrmMetrics {
  return {
    dealsCreated: 0,
    dealsCreatedChange: null,
    dealsWon: 0,
    dealsWonChange: null,
    dealsWonValue: 0,
    dealsWonValueChange: null,
    dealsLost: 0,
    dealsLostChange: null,
    winRate: 0,
    winRateChange: null,
    openDeals: 0,
    openDealsValue: 0,
    mqls: 0,
    mqlsChange: null,
    mqlStageName: null,
    sqls: 0,
    sqlsChange: null,
    sqlStageName: null,
    qualifyingThreshold: null,
    trend: [],
    connected,
  };
}

export async function getCrmMetrics(
  userId: string,
  range: DateRange,
): Promise<CrmMetrics> {
  const key = cacheKey([
    "user",
    userId,
    "provider",
    "crm",
    "range",
    rangeKey(range),
  ]);
  return withCache(key, userId, async () => {
    const conn = await getConnection(userId, "PIPEDRIVE");
    if (!conn || conn.status !== "CONNECTED") return emptyMetrics(false);

    const current = formatRangeISO(range);
    const previous = formatRangeISO(previousRange(range));
    const [curr, prev] = await Promise.all([
      fetchPipedriveRange(conn, current.from, current.to).catch((e) => {
        console.error("[metrics] Pipedrive current failed", e);
        return null;
      }),
      fetchPipedriveRange(conn, previous.from, previous.to).catch((e) => {
        console.error("[metrics] Pipedrive previous failed", e);
        return null;
      }),
    ]);

    if (!curr) return emptyMetrics(true);

    const winRate = safeRate(curr.won.count, curr.won.count + curr.lost.count);
    const prevWinRate = prev
      ? safeRate(prev.won.count, prev.won.count + prev.lost.count)
      : 0;

    const trendMap = new Map<string, TrendPoint>();
    for (const r of curr.won.byDay) {
      const cur = trendMap.get(r.date) ?? { date: r.date, won: 0, value: 0 };
      cur.won = (cur.won as number) + r.count;
      cur.value = (cur.value as number) + r.value;
      trendMap.set(r.date, cur);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    );

    return {
      dealsCreated: curr.created.count,
      dealsCreatedChange: prev ? pctChange(curr.created.count, prev.created.count) : null,
      dealsWon: curr.won.count,
      dealsWonChange: prev ? pctChange(curr.won.count, prev.won.count) : null,
      dealsWonValue: curr.won.value,
      dealsWonValueChange: prev ? pctChange(curr.won.value, prev.won.value) : null,
      dealsLost: curr.lost.count,
      dealsLostChange: prev ? pctChange(curr.lost.count, prev.lost.count) : null,
      winRate,
      winRateChange: prev ? pctChange(winRate, prevWinRate) : null,
      openDeals: curr.openSnapshot.count,
      openDealsValue: curr.openSnapshot.value,
      mqls: curr.qualified.mqls,
      mqlsChange: prev ? pctChange(curr.qualified.mqls, prev.qualified.mqls) : null,
      mqlStageName: curr.qualified.mqlStageName,
      sqls: curr.qualified.sqls,
      sqlsChange: prev ? pctChange(curr.qualified.sqls, prev.qualified.sqls) : null,
      sqlStageName: curr.qualified.sqlStageName,
      qualifyingThreshold: curr.qualifyingThreshold,
      trend,
      connected: true,
    };
  });
}
