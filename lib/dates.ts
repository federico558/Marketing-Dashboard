import {
  endOfToday,
  format,
  startOfYear,
  subDays,
} from "date-fns";

export type DateRangePreset = "7d" | "30d" | "90d" | "ytd" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

export const DEFAULT_PRESET: DateRangePreset = "7d";

export function rangeFromPreset(preset: DateRangePreset, now = new Date()): DateRange {
  const to = endOfToday();
  switch (preset) {
    case "7d":
      return { from: subDays(to, 6), to, preset };
    case "30d":
      return { from: subDays(to, 29), to, preset };
    case "90d":
      return { from: subDays(to, 89), to, preset };
    case "ytd":
      return { from: startOfYear(now), to, preset };
    case "custom":
      return { from: subDays(to, 29), to, preset: "custom" };
  }
}

export function parseRange(search: URLSearchParams): DateRange {
  const preset = (search.get("preset") as DateRangePreset | null) ?? null;
  const fromStr = search.get("from");
  const toStr = search.get("to");

  if (fromStr && toStr) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return { from, to, preset: preset ?? "custom" };
    }
  }
  return rangeFromPreset(preset ?? DEFAULT_PRESET);
}

export function formatRangeISO(range: DateRange) {
  return {
    from: format(range.from, "yyyy-MM-dd"),
    to: format(range.to, "yyyy-MM-dd"),
  };
}

export function rangeKey(range: DateRange) {
  const { from, to } = formatRangeISO(range);
  return `${from}_${to}`;
}

export function previousRange(range: DateRange): DateRange {
  const DAY = 86_400_000;
  const days = Math.round((range.to.getTime() - range.from.getTime()) / DAY) + 1;
  const to = new Date(range.from.getTime() - DAY);
  const from = new Date(to.getTime() - (days - 1) * DAY);
  return { from, to, preset: "custom" };
}
