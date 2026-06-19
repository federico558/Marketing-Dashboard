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

function parsePipedriveDate(s: string): number {
  return new Date(s.replace(" ", "T") + "Z").getTime();
}

const MAX_DEALS_TO_INSPECT = 500;
const FLOW_CONCURRENCY = 10;

async function listDealsUpdatedSince(
  apiKey: string,
  since: string,
): Promise<number[]> {
  const sinceMs = new Date(`${since}T00:00:00Z`).getTime();
  const ids: number[] = [];
  let start = 0;
  const limit = 100;

  while (ids.length < MAX_DEALS_TO_INSPECT) {
    const res = await fetch(
      url("/deals", apiKey, {
        start: String(start),
        limit: String(limit),
        sort: "update_time DESC",
        status: "all_not_deleted",
      }),
    );
    if (!res.ok) throw new Error(`Pipedrive deals list failed: ${res.status}`);
    const json = (await res.json()) as {
      data?: Array<{ id: number; update_time?: string }>;
      additional_data?: { pagination?: { more_items_in_collection?: boolean } };
    };
    const data = json.data ?? [];
    if (data.length === 0) break;

    let foundOlder = false;
    for (const d of data) {
      if (!d.update_time) continue;
      const updMs = parsePipedriveDate(d.update_time);
      if (updMs >= sinceMs) {
        ids.push(d.id);
      } else {
        foundOlder = true;
      }
    }

    if (foundOlder) break;
    if (!json.additional_data?.pagination?.more_items_in_collection) break;
    if (data.length < limit) break;
    start += limit;
  }

  return ids;
}

interface FlowEvent {
  object: string;
  data: {
    field_key?: string;
    old_value?: string | number | null;
    new_value?: string | number | null;
    log_time?: string;
  };
}

async function fetchDealFlow(
  apiKey: string,
  dealId: number,
): Promise<FlowEvent[]> {
  const res = await fetch(
    url(`/deals/${dealId}/flow`, apiKey, { all_changes: "1" }),
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Pipedrive flow ${dealId} failed: ${res.status}`);
  }
  const json = (await res.json()) as { data?: FlowEvent[] };
  return json.data ?? [];
}

async function countStageTransitionsInRange(
  apiKey: string,
  mqlStageId: number | null,
  sqlStageId: number | null,
  from: string,
  to: string,
): Promise<{ mqls: number; sqls: number; inspectedDeals: number }> {
  if (mqlStageId == null && sqlStageId == null) {
    return { mqls: 0, sqls: 0, inspectedDeals: 0 };
  }

  const dealIds = await listDealsUpdatedSince(apiKey, from);
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime() + 86_400_000 - 1;

  const mqlDeals = new Set<number>();
  const sqlDeals = new Set<number>();

  for (let i = 0; i < dealIds.length; i += FLOW_CONCURRENCY) {
    const chunk = dealIds.slice(i, i + FLOW_CONCURRENCY);
    const flows = await Promise.all(
      chunk.map((id) =>
        fetchDealFlow(apiKey, id).catch((e) => {
          console.error(`[pipedrive] flow ${id} failed`, e);
          return [] as FlowEvent[];
        }),
      ),
    );

    chunk.forEach((dealId, idx) => {
      const events = flows[idx];
      for (const event of events) {
        if (event.object !== "dealChange") continue;
        if (event.data.field_key !== "stage_id") continue;
        const logTime = event.data.log_time;
        if (!logTime) continue;
        const logMs = parsePipedriveDate(logTime);
        if (logMs < fromMs || logMs > toMs) continue;
        const newStageId = Number(event.data.new_value);
        if (mqlStageId != null && newStageId === mqlStageId) mqlDeals.add(dealId);
        if (sqlStageId != null && newStageId === sqlStageId) sqlDeals.add(dealId);
      }
    });
  }

  return { mqls: mqlDeals.size, sqls: sqlDeals.size, inspectedDeals: dealIds.length };
}

export interface QualifiedLeadsCounts {
  mqls: number;
  sqls: number;
  mqlStageName: string | null;
  sqlStageName: string | null;
  inspectedDeals: number;
  capped: boolean;
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

  const { mqls, sqls, inspectedDeals } = await countStageTransitionsInRange(
    apiKey,
    mqlStage?.id ?? null,
    sqlStage?.id ?? null,
    from,
    to,
  );

  return {
    mqls,
    sqls,
    mqlStageName: mqlStage?.name ?? null,
    sqlStageName: sqlStage?.name ?? null,
    inspectedDeals,
    capped: inspectedDeals >= MAX_DEALS_TO_INSPECT,
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
