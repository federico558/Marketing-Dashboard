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
import type { OutreachMetrics, TrendPoint } from "./types";

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
    const [lemlistRows, smartleadRows] = await Promise.all([
      fetchWindsorRows(userId, "LEMLIST", range),
      fetchWindsorRows(userId, "SMARTLEAD", range),
    ]);

    const lemConnected = lemlistRows !== null;
    const slConnected = smartleadRows !== null;

    const lemTotals: ChannelTotals = {
      sent: sumBy(lemlistRows ?? [], (r) => toNumber(r.emails_sent)),
      opens: sumBy(lemlistRows ?? [], (r) => toNumber(r.emails_opened)),
      replies: sumBy(lemlistRows ?? [], (r) => toNumber(r.emails_replied)),
    };
    const slTotals: ChannelTotals = {
      sent: sumBy(smartleadRows ?? [], (r) => toNumber(r.sent_count)),
      opens: sumBy(smartleadRows ?? [], (r) => toNumber(r.open_count)),
      replies: sumBy(smartleadRows ?? [], (r) => toNumber(r.reply_count)),
    };
    const combined: ChannelTotals = {
      sent: lemTotals.sent + slTotals.sent,
      opens: lemTotals.opens + slTotals.opens,
      replies: lemTotals.replies + slTotals.replies,
    };

    const trendMap = new Map<string, TrendPoint>();
    for (const r of lemlistRows ?? []) {
      const d = toString(r.date);
      if (!d) continue;
      const cur = trendMap.get(d) ?? { date: d, sent: 0, replies: 0 };
      cur.sent = (cur.sent as number) + toNumber(r.emails_sent);
      cur.replies = (cur.replies as number) + toNumber(r.emails_replied);
      trendMap.set(d, cur);
    }
    for (const r of smartleadRows ?? []) {
      const d = toString(r.date);
      if (!d) continue;
      const cur = trendMap.get(d) ?? { date: d, sent: 0, replies: 0 };
      cur.sent = (cur.sent as number) + toNumber(r.sent_count);
      cur.replies = (cur.replies as number) + toNumber(r.reply_count);
      trendMap.set(d, cur);
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
