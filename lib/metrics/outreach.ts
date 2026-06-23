import { withCache, cacheKey } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { formatRangeISO, previousRange, rangeKey } from "@/lib/dates";
import { fetchLemlistRows } from "@/lib/lemlist/client";
import { fetchSmartleadRows } from "@/lib/smartlead/client";
import { getConnection, safeRate, sumBy } from "./helpers";
import type { OutreachChannelStats, OutreachMetrics, TrendPoint } from "./types";

interface DayRow {
  date: string;
  sent: number;
  opens: number;
  replies: number;
}

interface ChannelTotals {
  sent: number;
  opens: number;
  replies: number;
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function totalsToStats(
  t: ChannelTotals,
  prev: ChannelTotals,
  connected: boolean,
): OutreachChannelStats {
  const openRate = safeRate(t.opens, t.sent);
  const replyRate = safeRate(t.replies, t.sent);
  const prevOpenRate = safeRate(prev.opens, prev.sent);
  const prevReplyRate = safeRate(prev.replies, prev.sent);
  return {
    sent: t.sent,
    sentChange: pctChange(t.sent, prev.sent),
    opens: t.opens,
    opensChange: pctChange(t.opens, prev.opens),
    replies: t.replies,
    repliesChange: pctChange(t.replies, prev.replies),
    openRate,
    openRateChange: pctChange(openRate, prevOpenRate),
    replyRate,
    replyRateChange: pctChange(replyRate, prevReplyRate),
    connected,
  };
}

function totals(rows: DayRow[]): ChannelTotals {
  return {
    sent: sumBy(rows, (r) => r.sent),
    opens: sumBy(rows, (r) => r.opens),
    replies: sumBy(rows, (r) => r.replies),
  };
}

const ZERO_TOTALS: ChannelTotals = { sent: 0, opens: 0, replies: 0 };

async function loadRows(
  provider: "LEMLIST" | "SMARTLEAD",
  from: string,
  to: string,
): Promise<DayRow[] | null> {
  const conn = await getConnection(provider);
  if (!conn || conn.status !== "CONNECTED") return null;
  try {
    if (provider === "LEMLIST") return await fetchLemlistRows(conn, from, to);
    return await fetchSmartleadRows(conn, from, to);
  } catch (e) {
    console.error(`[metrics] ${provider} fetch failed`, e);
    return null;
  }
}

export async function getOutreachMetrics(
  range: DateRange,
): Promise<OutreachMetrics> {
  const key = cacheKey(["provider", "outreach", "range", rangeKey(range)]);
  return withCache(key, async () => {
    const current = formatRangeISO(range);
    const previous = formatRangeISO(previousRange(range));
    const [lemRows, slRows, lemPrev, slPrev] = await Promise.all([
      loadRows("LEMLIST", current.from, current.to),
      loadRows("SMARTLEAD", current.from, current.to),
      loadRows("LEMLIST", previous.from, previous.to),
      loadRows("SMARTLEAD", previous.from, previous.to),
    ]);

    const lemConnected = lemRows !== null;
    const slConnected = slRows !== null;
    const lemTotals = totals(lemRows ?? []);
    const slTotals = totals(slRows ?? []);
    const lemPrevTotals = totals(lemPrev ?? []);
    const slPrevTotals = totals(slPrev ?? []);
    const combined: ChannelTotals = {
      sent: lemTotals.sent + slTotals.sent,
      opens: lemTotals.opens + slTotals.opens,
      replies: lemTotals.replies + slTotals.replies,
    };
    const combinedPrev: ChannelTotals = {
      sent: lemPrevTotals.sent + slPrevTotals.sent,
      opens: lemPrevTotals.opens + slPrevTotals.opens,
      replies: lemPrevTotals.replies + slPrevTotals.replies,
    };

    const trendMap = new Map<string, TrendPoint>();
    for (const r of lemRows ?? []) {
      const cur = trendMap.get(r.date) ?? { date: r.date, sent: 0, replies: 0 };
      cur.sent = (cur.sent as number) + r.sent;
      cur.replies = (cur.replies as number) + r.replies;
      trendMap.set(r.date, cur);
    }
    for (const r of slRows ?? []) {
      const cur = trendMap.get(r.date) ?? { date: r.date, sent: 0, replies: 0 };
      cur.sent = (cur.sent as number) + r.sent;
      cur.replies = (cur.replies as number) + r.replies;
      trendMap.set(r.date, cur);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    );

    return {
      lemlist: totalsToStats(
        lemTotals,
        lemConnected ? lemPrevTotals : ZERO_TOTALS,
        lemConnected,
      ),
      smartlead: totalsToStats(
        slTotals,
        slConnected ? slPrevTotals : ZERO_TOTALS,
        slConnected,
      ),
      combined: totalsToStats(
        combined,
        combinedPrev,
        lemConnected || slConnected,
      ),
      trend,
    };
  });
}
