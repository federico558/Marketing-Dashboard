import type { Provider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { windsor, connectorSlugFor, fieldsForProvider } from "@/lib/windsor/client";
import type { DateRange } from "@/lib/dates";
import { formatRangeISO } from "@/lib/dates";

export async function getConnection(userId: string, provider: Provider) {
  return prisma.connection.findUnique({
    where: { userId_provider: { userId, provider } },
  });
}

export async function fetchWindsorRows(
  userId: string,
  provider: Provider,
  range: DateRange,
): Promise<Array<Record<string, unknown>> | null> {
  const conn = await getConnection(userId, provider);
  if (!conn || conn.status !== "CONNECTED") return null;
  const { from, to } = formatRangeISO(range);
  try {
    return await windsor.getData({
      connector: connectorSlugFor(provider),
      fields: fieldsForProvider(provider),
      date_from: from,
      date_to: to,
      account_id: conn.windsorAccountId ?? undefined,
    });
  } catch (e) {
    console.error(`[metrics] fetchWindsorRows(${provider}) failed`, e);
    return null;
  }
}

export function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function toString(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

export function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

export function safeRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}
