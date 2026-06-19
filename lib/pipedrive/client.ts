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
  extra: Record<string, string> = {},
): Promise<{ rows: PipedriveDayRow[]; totalCount: number; totalValue: number }> {
  const res = await fetch(
    url("/deals/timeline", apiKey, {
      start_date: from,
      interval: "day",
      amount: String(dayCount(from, to)),
      field_key: fieldKey,
      totals_convert_currency: "default_currency",
      ...extra,
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

export interface PipedriveStage {
  id: number;
  name: string;
  order_nr: number;
  pipeline_id: number;
  active_flag?: boolean;
}

async function listStages(apiKey: string): Promise<PipedriveStage[]> {
  const res = await fetch(url("/stages", apiKey));
  if (!res.ok) throw new Error(`Pipedrive stages failed: ${res.status}`);
  const json = (await res.json()) as { data?: PipedriveStage[] };
  return (json.data ?? []).filter((s) => s.active_flag !== false);
}

function findStage(stages: PipedriveStage[], patterns: RegExp[]): PipedriveStage | null {
  for (const p of patterns) {
    const hit = stages.find((s) => p.test(s.name));
    if (hit) return hit;
  }
  return null;
}

function downstreamStages(
  stages: PipedriveStage[],
  target: PipedriveStage,
): PipedriveStage[] {
  return stages.filter(
    (s) => s.pipeline_id === target.pipeline_id && s.order_nr >= target.order_nr,
  );
}

async function countDealsCreatedAtStages(
  apiKey: string,
  stageIds: number[],
  from: string,
  to: string,
): Promise<number> {
  if (stageIds.length === 0) return 0;
  const counts = await Promise.all(
    stageIds.map((id) =>
      fetchTimeline(apiKey, "add_time", from, to, { stage_id: String(id) })
        .then((r) => r.totalCount)
        .catch((e) => {
          console.error(`[pipedrive] count for stage ${id} failed`, e);
          return 0;
        }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
}

export interface QualifiedLeadsCounts {
  mqls: number;
  sqls: number;
  mqlStageName: string | null;
  sqlStageName: string | null;
}

const MQL_PATTERNS = [/\bmql\b/i, /marketing[\s_-]*qualified/i];
const SQL_PATTERNS = [/\bsql\b/i, /sales[\s_-]*qualified/i];

async function fetchQualifiedLeads(
  apiKey: string,
  stages: PipedriveStage[],
  from: string,
  to: string,
): Promise<QualifiedLeadsCounts> {
  const mqlStage = findStage(stages, MQL_PATTERNS);
  const sqlStage = findStage(stages, SQL_PATTERNS);

  const [mqls, sqls] = await Promise.all([
    mqlStage
      ? countDealsCreatedAtStages(
          apiKey,
          downstreamStages(stages, mqlStage).map((s) => s.id),
          from,
          to,
        )
      : Promise.resolve(0),
    sqlStage
      ? countDealsCreatedAtStages(
          apiKey,
          downstreamStages(stages, sqlStage).map((s) => s.id),
          from,
          to,
        )
      : Promise.resolve(0),
  ]);

  return {
    mqls,
    sqls,
    mqlStageName: mqlStage?.name ?? null,
    sqlStageName: sqlStage?.name ?? null,
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
  qualified: QualifiedLeadsCounts;
}

export async function fetchPipedriveRange(
  conn: Connection,
  from: string,
  to: string,
): Promise<PipedriveRange> {
  if (!conn.apiKeyEnc) throw new Error("Pipedrive connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const stages = await listStages(apiKey).catch((e) => {
    console.error("[pipedrive] listStages failed", e);
    return [] as PipedriveStage[];
  });
  const [created, won, lost, openSnapshot, qualified] = await Promise.all([
    fetchTimeline(apiKey, "add_time", from, to),
    fetchTimeline(apiKey, "won_time", from, to),
    fetchTimeline(apiKey, "lost_time", from, to),
    fetchOpenDealsSnapshot(apiKey),
    fetchQualifiedLeads(apiKey, stages, from, to),
  ]);
  return {
    created: { count: created.totalCount, value: created.totalValue, byDay: created.rows },
    won: { count: won.totalCount, value: won.totalValue, byDay: won.rows },
    lost: { count: lost.totalCount, value: lost.totalValue, byDay: lost.rows },
    openSnapshot,
    qualified,
  };
}
