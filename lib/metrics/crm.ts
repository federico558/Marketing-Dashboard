import { withCache, cacheKey } from "@/lib/cache";
import type { DateRange } from "@/lib/dates";
import { rangeKey } from "@/lib/dates";
import { fetchWindsorRows, sumBy, toNumber, toString } from "./helpers";
import type { CrmMetrics } from "./types";

function matches(value: string, ...keywords: string[]) {
  const v = value.toLowerCase();
  return keywords.some((k) => v.includes(k));
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
    const rows = await fetchWindsorRows(userId, "PIPEDRIVE", range);
    const connected = rows !== null;
    const data = rows ?? [];

    let mqls = 0;
    let sqls = 0;
    let meetings = 0;
    let deals = 0;
    let dealsValue = 0;

    for (const r of data) {
      const stage = toString(r.stage_name);
      const activity = toString(r.activity_type);
      const status = toString(r.deal_status);
      const count = toNumber(r.deal_count);
      const activityCount = toNumber(r.activity_count);
      const value = toNumber(r.deal_value);

      if (matches(stage, "mql", "marketing qualified")) mqls += count;
      if (matches(stage, "sql", "sales qualified")) sqls += count;
      if (matches(activity, "meeting", "call", "demo")) meetings += activityCount;
      if (matches(status, "won")) {
        deals += count;
        dealsValue += value;
      }
    }

    // Fallback: if no stage labels matched but there are rows, use simple aggregates
    if (connected && mqls === 0 && sqls === 0 && deals === 0) {
      const totalDeals = sumBy(data, (r) => toNumber(r.deal_count));
      const totalValue = sumBy(data, (r) => toNumber(r.deal_value));
      deals = totalDeals;
      dealsValue = totalValue;
    }

    return { mqls, sqls, meetings, deals, dealsValue, connected };
  });
}
