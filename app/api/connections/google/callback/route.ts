import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { verifyState } from "@/lib/state";
import { exchangeCode, getAppUrl } from "@/lib/google/oauth";
import { listGA4Properties } from "@/lib/google/ga4";
import { listGSCSites } from "@/lib/google/searchConsole";
import { isProvider } from "@/lib/providers";
import { invalidateUserProvider } from "@/lib/cache";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const back = `${getAppUrl()}/settings/connections`;

  if (!state) return NextResponse.redirect(`${back}?error=missing_state`);
  const decoded = verifyState(state);
  if (!decoded) return NextResponse.redirect(`${back}?error=invalid_state`);
  const { userId, provider } = decoded;
  if (!isProvider(provider) || (provider !== "GA4" && provider !== "SEARCH_CONSOLE")) {
    return NextResponse.redirect(`${back}?error=unknown_provider`);
  }

  if (error) {
    await prisma.connection.updateMany({
      where: { userId, provider },
      data: { status: "ERROR", meta: { error } },
    });
    return NextResponse.redirect(`${back}?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${back}?error=missing_code`);
  }

  try {
    const tokens = await exchangeCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const conn = await prisma.connection.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        status: "PENDING",
        accessTokenEnc: encrypt(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiresAt: expiresAt,
        scope: tokens.scope,
      },
      update: {
        status: "PENDING",
        accessTokenEnc: encrypt(tokens.access_token),
        ...(tokens.refresh_token
          ? { refreshTokenEnc: encrypt(tokens.refresh_token) }
          : {}),
        tokenExpiresAt: expiresAt,
        scope: tokens.scope,
      },
    });

    let externalId: string | null = null;
    let externalLabel: string | null = null;
    if (provider === "GA4") {
      const props = await listGA4Properties(conn);
      const first = props[0];
      if (first) {
        externalId = first.propertyId;
        externalLabel = first.displayName;
      }
    } else {
      const sites = await listGSCSites(conn);
      const first = sites[0];
      if (first) {
        externalId = first.siteUrl;
        externalLabel = first.siteUrl;
      }
    }

    if (!externalId) {
      await prisma.connection.update({
        where: { id: conn.id },
        data: { status: "ERROR", meta: { error: "no_accessible_property" } },
      });
      return NextResponse.redirect(`${back}?error=no_accessible_property`);
    }

    await prisma.connection.update({
      where: { id: conn.id },
      data: {
        status: "CONNECTED",
        externalId,
        externalLabel,
        meta: undefined,
      },
    });
    await invalidateUserProvider(userId, provider);

    return NextResponse.redirect(`${back}?connected=${provider.toLowerCase()}`);
  } catch (e) {
    console.error("[google/callback] failed", e);
    const msg = e instanceof Error ? e.message : "unknown_error";
    await prisma.connection.updateMany({
      where: { userId, provider },
      data: { status: "ERROR", meta: { error: msg } },
    });
    return NextResponse.redirect(`${back}?error=${encodeURIComponent(msg)}`);
  }
}
