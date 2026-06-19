import { withCache, cacheKey } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { formatRangeISO, rangeKey } from "@/lib/dates";
import { fetchLemlistRows } from "@/lib/lemlist/client";
import { fetchSmartleadRows } from "@/lib/smartlead/client";
import { getConnection, safeRate, sumBy } from "./helpers";
import type { OutreachMetrics, TrendPoint } from "./types";

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

function totalsToStats(t: ChannelTotals, connected: boolean) {
  return {
    sent: t.sent,
    opens: t.opens,
    replies: t.replies,
    openRate: safeRate(t.opens, t.sent),
    replyRate: safeRate(t.replies, t.sent),
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

export async function getOutreachMetrics(
  userId: string,
  range: DateRange,
): Promise<OutreachMetrics> {
  const key = cacheKey([
    "user",
    userId,
    "provider",
    "outreach",
    "range",
    rangeKey(range),
  ]);
  return withCache(key, userId, async () => {
    const { from, to } = formatRangeISO(range);
    const [lemConn, slConn] = await Promise.all([
      getConnection(userId, "LEMLIST"),
      getConnection(userId, "SMARTLEAD"),
    ]);

    const lemRows = lemConn?.status === "CONNECTED"
      ? await fetchLemlistRows(lemConn, from, to).catch((e) => {
          console.error("[metrics] Lemlist fetch failed", e);
          return null;
        })
      : null;
    const slRows = slConn?.status === "CONNECTED"
      ? await fetchSmartleadRows(slConn, from, to).catch((e) => {
          console.error("[metrics] Smartlead fetch failed", e);
          return null;
        })
      : null;

    const lemConnected = lemRows !== null;
    const slConnected = slRows !== null;
    const lemTotals = totals(lemRows ?? []);
    const slTotals = totals(slRows ?? []);
    const combined: ChannelTotals = {
      sent: lemTotals.sent + slTotals.sent,
      opens: lemTotals.opens + slTotals.opens,
      replies: lemTotals.replies + slTotals.replies,
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
      lemlist: totalsToStats(lemTotals, lemConnected),
      smartlead: totalsToStats(slTotals, slConnected),
      combined: totalsToStats(combined, lemConnected || slConnected),
      trend,
    };
  });
}
