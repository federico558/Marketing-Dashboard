import type { Connection } from "@prisma/client";
import { getValidAccessToken } from "./oauth";

export interface GA4Property {
  propertyId: string;
  displayName: string;
}

export async function listGA4Properties(conn: Connection): Promise<GA4Property[]> {
  const token = await getValidAccessToken(conn);
  const res = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`GA4 accountSummaries failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    accountSummaries?: Array<{
      propertySummaries?: Array<{ property: string; displayName: string }>;
    }>;
  };
  const out: GA4Property[] = [];
  for (const acc of json.accountSummaries ?? []) {
    for (const p of acc.propertySummaries ?? []) {
      out.push({
        propertyId: p.property.replace(/^properties\//, ""),
        displayName: p.displayName,
      });
    }
  }
  return out;
}

export interface GA4Row {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  avgSessionDuration: number;
  bounceRate: number;
  engagementRate: number;
}

export async function fetchGA4Rows(
  conn: Connection,
  from: string,
  to: string,
): Promise<GA4Row[]> {
  if (!conn.externalId) throw new Error("GA4 connection missing propertyId");
  const token = await getValidAccessToken(conn);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${conn.externalId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "engagementRate" },
        ],
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`GA4 runReport failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    rows?: Array<{
      dimensionValues: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }>;
  };
  return (json.rows ?? []).map((r) => {
    const raw = r.dimensionValues[0]?.value ?? "";
    const date = raw.length === 8
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
      : raw;
    return {
      date,
      sessions: Number(r.metricValues[0]?.value ?? 0),
      users: Number(r.metricValues[1]?.value ?? 0),
      pageviews: Number(r.metricValues[2]?.value ?? 0),
      avgSessionDuration: Number(r.metricValues[3]?.value ?? 0),
      bounceRate: Number(r.metricValues[4]?.value ?? 0),
      engagementRate: Number(r.metricValues[5]?.value ?? 0),
    };
  });
}

export interface GA4BreakdownRow {
  label: string;
  value: number;
  changePercent: number | null;
}

async function runBreakdownReport(
  conn: Connection,
  token: string,
  from: string,
  to: string,
  dimension: string,
  metric: string,
  limit: number,
): Promise<Map<string, number>> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${conn.externalId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: dimension }],
        metrics: [{ name: metric }],
        orderBys: [{ metric: { metricName: metric }, desc: true }],
        limit: String(limit),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `GA4 breakdown (${dimension}) failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    rows?: Array<{
      dimensionValues: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }>;
  };
  const out = new Map<string, number>();
  for (const r of json.rows ?? []) {
    const label = r.dimensionValues[0]?.value ?? "(unknown)";
    if (label === "(not set)") continue;
    out.set(label, Number(r.metricValues[0]?.value ?? 0));
  }
  return out;
}

export async function fetchGA4Breakdown(
  conn: Connection,
  current: { from: string; to: string },
  previous: { from: string; to: string },
  dimension: string,
  metric: string,
  limit = 7,
): Promise<GA4BreakdownRow[]> {
  if (!conn.externalId) throw new Error("GA4 connection missing propertyId");
  const token = await getValidAccessToken(conn);
  const [curr, prev] = await Promise.all([
    runBreakdownReport(conn, token, current.from, current.to, dimension, metric, limit),
    runBreakdownReport(conn, token, previous.from, previous.to, dimension, metric, limit * 4),
  ]);
  return Array.from(curr.entries()).map(([label, value]) => {
    const prevValue = prev.get(label);
    let changePercent: number | null = null;
    if (prevValue != null && prevValue > 0) {
      changePercent = ((value - prevValue) / prevValue) * 100;
    }
    return { label, value, changePercent };
  });
}
