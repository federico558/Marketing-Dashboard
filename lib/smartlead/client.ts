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

async function listCampaigns(apiKey: string): Promise<SmartleadCampaign[]> {
  const url = new URL(`${BASE}/campaigns`);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Smartlead campaigns failed: ${res.status}`);
  const json = (await res.json()) as SmartleadCampaign[];
  return Array.isArray(json) ? json : [];
}

async function fetchCampaignAnalytics(
  apiKey: string,
  campaignId: number,
  from: string,
  to: string,
): Promise<SmartleadDayRow[]> {
  const url = new URL(`${BASE}/campaigns/${campaignId}/analytics-by-date`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = (await res.json()) as Array<{
    date?: string;
    sent_count?: number;
    open_count?: number;
    reply_count?: number;
  }>;
  return (Array.isArray(json) ? json : []).map((r) => ({
    date: (r.date ?? "").slice(0, 10),
    sent: Number(r.sent_count ?? 0),
    opens: Number(r.open_count ?? 0),
    replies: Number(r.reply_count ?? 0),
  }));
}

export async function fetchSmartleadRows(
  conn: Connection,
  from: string,
  to: string,
): Promise<SmartleadDayRow[]> {
  if (!conn.apiKeyEnc) throw new Error("Smartlead connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const campaigns = await listCampaigns(apiKey);
  const byDay = new Map<string, SmartleadDayRow>();
  await Promise.all(
    campaigns.map(async (c) => {
      const rows = await fetchCampaignAnalytics(apiKey, c.id, from, to);
      for (const r of rows) {
        if (!r.date) continue;
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
    }),
  );
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
