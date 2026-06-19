import type { Connection } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

const BASE = "https://api.lemlist.com/api";

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}`;
}

export async function verifyLemlistKey(apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/team`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) {
    throw new Error(`Lemlist key invalid: ${res.status}`);
  }
}

interface LemlistCampaign {
  _id: string;
  name: string;
}

interface LemlistCampaignStats {
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
}

export interface LemlistDayRow {
  date: string;
  sent: number;
  opens: number;
  replies: number;
}

export async function fetchLemlistRows(
  conn: Connection,
  from: string,
  to: string,
): Promise<LemlistDayRow[]> {
  if (!conn.apiKeyEnc) throw new Error("Lemlist connection missing API key");
  const apiKey = decrypt(conn.apiKeyEnc);
  const headers = { Authorization: authHeader(apiKey) };

  const activitiesUrl = new URL(`${BASE}/activities`);
  activitiesUrl.searchParams.set("startDate", from);
  activitiesUrl.searchParams.set("endDate", to);
  activitiesUrl.searchParams.set("limit", "1000");

  const res = await fetch(activitiesUrl.toString(), { headers });
  if (!res.ok) {
    throw new Error(`Lemlist activities failed: ${res.status}`);
  }
  const activities = (await res.json()) as Array<{
    type: string;
    createdAt?: string;
    date?: string;
  }>;

  const byDay = new Map<string, LemlistDayRow>();
  for (const a of activities) {
    const ts = a.createdAt ?? a.date;
    if (!ts) continue;
    const date = ts.slice(0, 10);
    const row = byDay.get(date) ?? { date, sent: 0, opens: 0, replies: 0 };
    if (a.type === "emailsSent" || a.type === "emailSent") row.sent += 1;
    else if (a.type === "emailsOpened" || a.type === "emailOpened") row.opens += 1;
    else if (a.type === "emailsReplied" || a.type === "emailReplied") row.replies += 1;
    byDay.set(date, row);
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
