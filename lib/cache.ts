import { prisma } from "./db";

const TTL_MS = 10 * 60 * 1000;

const memory = new Map<string, { value: unknown; expiresAt: number }>();

export function cacheKey(parts: (string | number)[]): string {
  return parts.map((p) => String(p)).join(":");
}

export async function getCache<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && mem.expiresAt > now) return mem.value as T;
  if (mem) memory.delete(key);

  const row = await prisma.cacheEntry.findUnique({ where: { key } });
  if (!row) return null;
  if (row.expiresAt.getTime() < now) {
    await prisma.cacheEntry.delete({ where: { key } }).catch(() => {});
    return null;
  }
  memory.set(key, { value: row.value, expiresAt: row.expiresAt.getTime() });
  return row.value as T;
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlMs = TTL_MS,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  memory.set(key, { value, expiresAt: expiresAt.getTime() });
  await prisma.cacheEntry.upsert({
    where: { key },
    create: { key, value: value as object, expiresAt },
    update: { value: value as object, expiresAt },
  });
}

export async function invalidateMetrics() {
  memory.clear();
  await prisma.cacheEntry.deleteMany({});
}

export async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = TTL_MS,
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  await setCache(key, value, ttlMs);
  return value;
}
