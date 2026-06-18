import crypto from "node:crypto";

const SECRET = () =>
  process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-secret-change-me";

export function signState(payload: Record<string, string>): string {
  const json = JSON.stringify({ ...payload, ts: Date.now() });
  const data = Buffer.from(json).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifyState(
  state: string,
  maxAgeMs = 10 * 60 * 1000,
): Record<string, string> | null {
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SECRET())
    .update(data)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    const json = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (typeof json.ts !== "number" || Date.now() - json.ts > maxAgeMs) {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}
