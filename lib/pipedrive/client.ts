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
  const json = (await res.json()) as {
    data?: Array<{
      period_start?: string;
      totals?: { count?: number };
      totals_converted?: { value?: number };
    }>;
  };
  const periods = json.data ?? [];
  const rows: PipedriveDayRow[] = [];
  let totalCount = 0;
  let totalValue = 0;
  for (const p of periods) {
    const count = Number(p.totals?.count ?? 0);
    const value = Number(p.totals_converted?.value ?? 0);
    totalCount += count;
    totalValue += value;
    if (p.period_start) {
      rows.push({ date: p.period_start.slice(0, 10), count, value });
    }
  }
  return { rows, totalCount, totalValue };
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

interface DealSummary {
  id: number;
  add_time?: string;
  stage_id?: number;
}

async function listDealsUpdatedSince(
  apiKey: string,
  since: string,
): Promise<DealSummary[]> {
  const sinceMs = new Date(`${since}T00:00:00Z`).getTime();
  const deals: DealSummary[] = [];
  let start = 0;
  const limit = 100;

  while (deals.length < MAX_DEALS_TO_INSPECT) {
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
      data?: Array<{
        id: number;
        update_time?: string;
        add_time?: string;
        stage_id?: number;
      }>;
      additional_data?: { pagination?: { more_items_in_collection?: boolean } };
    };
    const data = json.data ?? [];
    if (data.length === 0) break;

    let foundOlder = false;
    for (const d of data) {
      if (!d.update_time) continue;
      const updMs = parsePipedriveDate(d.update_time);
      if (updMs >= sinceMs) {
        deals.push({ id: d.id, add_time: d.add_time, stage_id: d.stage_id });
      } else {
        foundOlder = true;
      }
    }

    if (foundOlder) break;
    if (!json.additional_data?.pagination?.more_items_in_collection) break;
    if (data.length < limit) break;
    start += limit;
  }

  return deals;
}

interface FlowEvent {
  object: string;
  timestamp?: string;
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
  const events: FlowEvent[] = [];
  let start = 0;
  const limit = 500;
  while (true) {
    const res = await fetch(
      url(`/deals/${dealId}/flow`, apiKey, {
        all_changes: "1",
        items: "dealChange",
        limit: String(limit),
        start: String(start),
      }),
    );
    if (!res.ok) {
      if (res.status === 404) return events;
      throw new Error(`Pipedrive flow ${dealId} failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      data?: FlowEvent[];
      additional_data?: { pagination?: { more_items_in_collection?: boolean } };
    };
    const batch = json.data ?? [];
    events.push(...batch);
    if (!json.additional_data?.pagination?.more_items_in_collection) break;
    if (batch.length < limit) break;
    start += limit;
  }
  return events;
}

function eventTime(e: FlowEvent): string | undefined {
  return e.data.log_time ?? e.timestamp;
}

function initialStageId(
  deal: DealSummary,
  stageChanges: FlowEvent[],
): number | null {
  if (stageChanges.length === 0) {
    return deal.stage_id ?? null;
  }
  const sorted = [...stageChanges].sort((a, b) => {
    const at = parsePipedriveDate(eventTime(a) ?? "1970-01-01 00:00:00");
    const bt = parsePipedriveDate(eventTime(b) ?? "1970-01-01 00:00:00");
    return at - bt;
  });
  const earliest = sorted[0];
  const oldVal = earliest?.data.old_value;
  if (oldVal == null) return deal.stage_id ?? null;
  const n = Number(oldVal);
  return Number.isFinite(n) ? n : null;
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

  const deals = await listDealsUpdatedSince(apiKey, from);
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime() + 86_400_000 - 1;

  const mqlDeals = new Set<number>();
  const sqlDeals = new Set<number>();

  for (let i = 0; i < deals.length; i += FLOW_CONCURRENCY) {
    const chunk = deals.slice(i, i + FLOW_CONCURRENCY);
    const flows = await Promise.all(
      chunk.map((d) =>
        fetchDealFlow(apiKey, d.id).catch((e) => {
          console.error(`[pipedrive] flow ${d.id} failed`, e);
          return [] as FlowEvent[];
        }),
      ),
    );

    chunk.forEach((deal, idx) => {
      const events = flows[idx];
      const stageChanges = events.filter(
        (e) => e.object === "dealChange" && e.data.field_key === "stage_id",
      );

      for (const event of stageChanges) {
        const logTime = eventTime(event);
        if (!logTime) continue;
        const logMs = parsePipedriveDate(logTime);
        if (logMs < fromMs || logMs > toMs) continue;
        const newStageId = Number(event.data.new_value);
        if (mqlStageId != null && newStageId === mqlStageId) mqlDeals.add(deal.id);
        if (sqlStageId != null && newStageId === sqlStageId) sqlDeals.add(deal.id);
      }

      if (deal.add_time) {
        const addMs = parsePipedriveDate(deal.add_time);
        if (addMs >= fromMs && addMs <= toMs) {
          const initial = initialStageId(deal, stageChanges);
          if (initial != null) {
            if (mqlStageId != null && initial === mqlStageId) mqlDeals.add(deal.id);
            if (sqlStageId != null && initial === sqlStageId) sqlDeals.add(deal.id);
          }
        }
      }
    });
  }

  return { mqls: mqlDeals.size, sqls: sqlDeals.size, inspectedDeals: deals.length };
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

export async function pipedriveDebug(
  apiKey: string,
  from: string,
  to: string,
): Promise<unknown> {
  const stages = await listStages(apiKey);
  const mqlStage = findStage(stages, MQL_PATTERNS);
  const sqlStage = findStage(stages, SQL_PATTERNS);
  const deals = await listDealsUpdatedSince(apiKey, from);

  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime() + 86_400_000 - 1;

  const timelineUrl = url("/deals/timeline", apiKey, {
    start_date: from,
    interval: "day",
    amount: String(dayCount(from, to)),
    field_key: "add_time",
    totals_convert_currency: "default_currency",
  });
  const timelineRes = await fetch(timelineUrl);
  const timelineRaw = await timelineRes.json().catch(() => null);

  const sample = deals.slice(0, 10);
  const sampleFlows = await Promise.all(
    sample.map(async (deal) => {
      try {
        const events = await fetchDealFlow(apiKey, deal.id);
        const stageChanges = events.filter(
          (e) => e.object === "dealChange" && e.data.field_key === "stage_id",
        );
        const initial = initialStageId(deal, stageChanges);
        const addMs = deal.add_time ? parsePipedriveDate(deal.add_time) : NaN;
        return {
          dealId: deal.id,
          add_time: deal.add_time,
          createdInRange: addMs >= fromMs && addMs <= toMs,
          current_stage_id: deal.stage_id,
          initial_stage_id: initial,
          initialMatchesMql: mqlStage ? initial === mqlStage.id : false,
          initialMatchesSql: sqlStage ? initial === sqlStage.id : false,
          stageChanges: stageChanges.map((e) => {
            const lt = eventTime(e);
            const logMs = lt ? parsePipedriveDate(lt) : NaN;
            return {
              log_time: lt,
              inRange: logMs >= fromMs && logMs <= toMs,
              old_value: e.data.old_value,
              new_value: e.data.new_value,
              newStageMatchesMql: mqlStage
                ? Number(e.data.new_value) === mqlStage.id
                : false,
              newStageMatchesSql: sqlStage
                ? Number(e.data.new_value) === sqlStage.id
                : false,
            };
          }),
        };
      } catch (e) {
        return {
          dealId: deal.id,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }),
  );

  return {
    range: { from, to, fromMs, toMs },
    stages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      pipeline_id: s.pipeline_id,
      order_nr: s.order_nr,
    })),
    detected: {
      mql: mqlStage ? { id: mqlStage.id, name: mqlStage.name } : null,
      sql: sqlStage ? { id: sqlStage.id, name: sqlStage.name } : null,
    },
    candidateDealCount: deals.length,
    candidateDeals: deals,
    sampleFlows,
    timelineAddTime: {
      status: timelineRes.status,
      raw: timelineRaw,
    },
  };
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
