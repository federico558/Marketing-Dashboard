import crypto from "node:crypto";
import { prisma } from "@/lib/db";

export function generateToken(): { token: string; tokenHash: string } {
  const token = `mkd_${crypto.randomBytes(32).toString("base64url")}`;
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function resolveTokenToUserId(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const row = await prisma.mcpToken.findUnique({ where: { tokenHash } });
  if (!row) return null;
  // best-effort lastUsedAt update
  prisma.mcpToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return row.userId;
}
