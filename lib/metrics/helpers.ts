import type { Provider } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getConnection(provider: Provider) {
  return prisma.connection.findUnique({ where: { provider } });
}

export function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

export function avgBy<T>(rows: T[], pick: (r: T) => number): number {
  if (!rows.length) return 0;
  return sumBy(rows, pick) / rows.length;
}

export function safeRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}
