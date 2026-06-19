import type { Connection } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

const BASE = "https://api.pipedrive.com/v1";

function url(path: string, apiKey: string, params: Record<string, string> = {}) {
  const u = new URL(`${BASE}${path}`);
  u.searchParams.set("api_token", apiKey);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export async function verifyPipedriveKey(apiKey: string): Promise<void> {
  const res = await fetch(url("/users/me", apiKey));
  if (!res.ok) {
    throw new Error(`Pipedrive key invalid: ${res.status}`);
  }
}

interface TimelinePeriod {
  period_start: string;
  period_end: string;
  totals?: {
    count?: number;
    values?: Record<string, number>;
    weighted_values?: Record<string, number>;
  };
  deals?: Array<{ value?: number; currency?: string }>;
}

interface TimelineResponse {
  success?: boolean;
  data?: {
    totals?: {
      count?: number;
      values?: Record<string, number>;
    };
    deals?: TimelinePeriod[];
  };
}

export interface PipedriveDayRow {
  date: string;
  count: number;
  value: number;
}

function dayCount(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function pickValue(values?: Record<string, number>): number {
  if (!values) return 0;
  let total = 0;
  for (const v of Object.values(values)) total += Number(v ?? 0);
  return total;
}

async function fetchTimeline(
  apiKey: string,
  fieldKey: "add_time" | "won_time" | "lost_time",
  from: string,
  to: string,
): Promise<{ rows: PipedriveDayRow[]; totalCount: number; totalValue: number }> {
  const res = await fetch(
    url("/deals/timeline", apiKey, {
      start_date: from,
      interval: "day",
      amount: String(dayCount(from, to)),
      field_key: fieldKey,
      totals_convert_currency: "default_currency",
    }),
  );
  if (!res.ok) {
    throw new Error(`Pipedrive timeline (${fieldKey}) failed: ${res.status}`);
  }
  const json = (await res.json()) as TimelineResponse;
  const rows: PipedriveDayRow[] = (json.data?.deals ?? []).map((p) => ({
    date: (p.period_start ?? "").slice(0, 10),
    count: Number(p.totals?.count ?? 0),
    value: pickValue(p.totals?.values),
  }));
  return {
    rows,
    totalCount: Number(json.data?.totals?.count ?? 0),
    totalValue: pickValue(json.data?.totals?.values),
  };
}

export interface PipedriveSnapshot {
  count: number;
  value: number;
}

async function fetchOpenDealsSnapshot(apiKey: string): Promise<PipedriveSnapshot> {
  const res = await fetch(url("/deals/summary", apiKey, { status: "open" }));
  if (!res.ok) {
    throw new Error(`Pipedrive deals summary failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: {
      values_total?: Record<string, { value?: number; count?: number }>;
      total_count?: number;
      values_total_converted?: Record<string, number>;
    };
  };
  const count = Number(json.data?.total_count ?? 0);
  let value = 0;
  if (json.data?.values_total_converted) {
    value = pickValue(json.data.values_total_converted);
  } else if (json.data?.values_total) {
    for (const entry of Object.values(json.data.values_total)) {
      value += Number(entry?.value ?? 0);
    }
  }
  return { count, value };
}

export interface PipedriveRange {
  created: { count: number; value: number; byDay: PipedriveDayRow[] };
  won: { count: number; value: number; byDay: PipedriveDayRow[] };
  lost: { count: number; value: number; byDay: PipedriveDayRow[] };
  openSnapshot: PipedriveSnapshot;
}

export async function fetchPipedriveRange(
  conn: Connection,
  from: string,
  to: string,
): Promise<PipedriveRange> {
  if (!conn.apiKeyEnc) throw new Error("Pipedrive connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const [created, won, lost, openSnapshot] = await Promise.all([
    fetchTimeline(apiKey, "add_time", from, to),
    fetchTimeline(apiKey, "won_time", from, to),
    fetchTimeline(apiKey, "lost_time", from, to),
    fetchOpenDealsSnapshot(apiKey),
  ]);
  return {
    created: { count: created.totalCount, value: created.totalValue, byDay: created.rows },
    won: { count: won.totalCount, value: won.totalValue, byDay: won.rows },
    lost: { count: lost.totalCount, value: lost.totalValue, byDay: lost.rows },
    openSnapshot,
  };
}
