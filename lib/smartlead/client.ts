import type { Connection } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

const BASE = "https://server.smartlead.ai/api/v1";

export async function verifySmartleadKey(apiKey: string): Promise<void> {
  const url = new URL(`${BASE}/campaigns`);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Smartlead key invalid: ${res.status}`);
  }
}

interface SmartleadCampaign {
  id: number;
  name: string;
}

export interface SmartleadDayRow {
  date: string;
  sent: number;
  opens: number;
  replies: number;
}

function unwrapArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.result)) return obj.result;
    if (Array.isArray(obj.rows)) return obj.rows;
  }
  return [];
}

function num(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (c == null) continue;
    const n = typeof c === "number" ? c : parseFloat(String(c));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pickDate(r: Record<string, unknown>): string {
  const raw =
    (r.date as string | undefined) ??
    (r.stats_date as string | undefined) ??
    (r.day as string | undefined) ??
    "";
  return raw.slice(0, 10);
}

export async function listSmartleadCampaigns(
  apiKey: string,
): Promise<SmartleadCampaign[]> {
  const url = new URL(`${BASE}/campaigns`);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Smartlead campaigns failed: ${res.status}`);
  const items = unwrapArray(await res.json());
  return items
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ id: num(c.id), name: String(c.name ?? "") }))
    .filter((c) => c.id > 0);
}

export async function fetchSmartleadCampaignAnalyticsByDate(
  apiKey: string,
  campaignId: number,
  from: string,
  to: string,
): Promise<{ raw: unknown; rows: SmartleadDayRow[] }> {
  const url = new URL(`${BASE}/campaigns/${campaignId}/analytics-by-date`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  const res = await fetch(url.toString());
  if (!res.ok) return { raw: { status: res.status }, rows: [] };
  const raw = await res.json();
  const items = unwrapArray(raw);
  const rows: SmartleadDayRow[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const date = pickDate(r);
    if (!date) continue;
    rows.push({
      date,
      sent: num(r.sent_count, r.total_sent_count, r.sentCount, r.sent),
      opens: num(
        r.unique_open_count,
        r.open_count,
        r.total_open_count,
        r.openCount,
        r.opens,
      ),
      replies: num(
        r.unique_reply_count,
        r.reply_count,
        r.total_reply_count,
        r.replyCount,
        r.replies,
      ),
    });
  }
  return { raw, rows };
}

export async function fetchSmartleadRows(
  conn: Connection,
  from: string,
  to: string,
): Promise<SmartleadDayRow[]> {
  if (!conn.apiKeyEnc) throw new Error("Smartlead connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const campaigns = await listSmartleadCampaigns(apiKey);
  const byDay = new Map<string, SmartleadDayRow>();
  await Promise.all(
    campaigns.map(async (c) => {
      try {
        const { rows } = await fetchSmartleadCampaignAnalyticsByDate(
          apiKey,
          c.id,
          from,
          to,
        );
        for (const r of rows) {
          const cur = byDay.get(r.date) ?? {
            date: r.date,
            sent: 0,
            opens: 0,
            replies: 0,
          };
          cur.sent += r.sent;
          cur.opens += r.opens;
          cur.replies += r.replies;
          byDay.set(r.date, cur);
        }
      } catch (e) {
        console.error(
          `[smartlead] campaign ${c.id} (${c.name}) analytics failed`,
          e,
        );
      }
    }),
  );
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function smartleadDebug(
  apiKey: string,
  from: string,
  to: string,
): Promise<unknown> {
  const campaignsUrl = new URL(`${BASE}/campaigns`);
  campaignsUrl.searchParams.set("api_key", apiKey);
  const campaignsRes = await fetch(campaignsUrl.toString());
  const campaignsRaw = await campaignsRes.json().catch(() => null);
  const campaigns = unwrapArray(campaignsRaw)
    .slice(0, 3)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object");
  const analyticsByDate = await Promise.all(
    campaigns.map(async (c) => {
      const id = num(c.id);
      const { raw } = await fetchSmartleadCampaignAnalyticsByDate(
        apiKey,
        id,
        from,
        to,
      );
      return { campaignId: id, name: c.name, raw };
    }),
  );
  return {
    campaignsStatus: campaignsRes.status,
    campaignsRaw,
    analyticsByDate,
  };
}
