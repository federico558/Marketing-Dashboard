import type { Connection } from "@prisma/client";
import { getValidAccessToken } from "./oauth";

export interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export async function listGSCSites(conn: Connection): Promise<GSCSite[]> {
  const token = await getValidAccessToken(conn);
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GSC sites failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
  };
  return (json.siteEntry ?? []).filter(
    (s) => s.permissionLevel !== "siteUnverifiedUser",
  );
}

export interface GSCRow {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

export async function fetchGSCRows(
  conn: Connection,
  from: string,
  to: string,
): Promise<GSCRow[]> {
  if (!conn.externalId) throw new Error("GSC connection missing siteUrl");
  const token = await getValidAccessToken(conn);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(conn.externalId)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: from,
        endDate: to,
        dimensions: ["date"],
        rowLimit: 25000,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`GSC searchAnalytics failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    rows?: Array<{
      keys: string[];
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  };
  return (json.rows ?? []).map((r) => ({
    date: r.keys[0] ?? "",
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.ctr,
    position: r.position,
  }));
}
