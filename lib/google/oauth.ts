import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import type { Connection, Provider } from "@prisma/client";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GA4_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";
export const GSC_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
export const BASE_SCOPES = ["openid", "email", "profile"];

export function getAppUrl(): string {
  const url =
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL;
  if (!url) throw new Error("APP_URL / NEXTAUTH_URL / AUTH_URL not set");
  return url.replace(/\/+$/, "");
}

export function googleClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set");
  }
  return { clientId, clientSecret };
}

export function googleRedirectUri(): string {
  return `${getAppUrl()}/api/connections/google/callback`;
}

export function scopesFor(provider: Provider): string[] {
  if (provider === "GA4") return [...BASE_SCOPES, GA4_SCOPE];
  if (provider === "SEARCH_CONSOLE") return [...BASE_SCOPES, GSC_SCOPE];
  throw new Error(`Provider ${provider} does not use Google OAuth`);
}

export function buildAuthUrl(params: {
  provider: Provider;
  state: string;
}): string {
  const { clientId } = googleClientCredentials();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", scopesFor(params.provider).join(" "));
  url.searchParams.set("state", params.state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleClientCredentials();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleClientCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function getValidAccessToken(conn: Connection): Promise<string> {
  if (!conn.accessTokenEnc || !conn.refreshTokenEnc) {
    throw new Error("Connection is missing OAuth tokens");
  }
  const now = Date.now();
  const expiresAt = conn.tokenExpiresAt?.getTime() ?? 0;
  if (expiresAt > now + 60_000) {
    return decrypt(conn.accessTokenEnc);
  }
  const refreshed = await refreshAccessToken(decrypt(conn.refreshTokenEnc));
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.connection.update({
    where: { id: conn.id },
    data: {
      accessTokenEnc: encrypt(refreshed.access_token),
      tokenExpiresAt: newExpiry,
    },
  });
  return refreshed.access_token;
}
