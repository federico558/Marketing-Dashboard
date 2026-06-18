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
  userId: string,
  value: T,
  ttlMs = TTL_MS,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  memory.set(key, { value, expiresAt: expiresAt.getTime() });
  await prisma.cacheEntry.upsert({
    where: { key },
    create: { key, userId, value: value as object, expiresAt },
    update: { value: value as object, expiresAt },
  });
}

export async function invalidateUserProvider(userId: string, providerSlug: string) {
  const prefix = `user:${userId}:provider:${providerSlug}`;
  for (const k of memory.keys()) {
    if (k.startsWith(prefix)) memory.delete(k);
  }
  await prisma.cacheEntry.deleteMany({
    where: { userId, key: { startsWith: prefix } },
  });
}

export async function withCache<T>(
  key: string,
  userId: string,
  loader: () => Promise<T>,
  ttlMs = TTL_MS,
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  await setCache(key, userId, value, ttlMs);
  return value;
}
