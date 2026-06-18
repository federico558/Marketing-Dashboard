import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PROVIDERS } from "@/lib/windsor/providers";
import { verifyState } from "@/lib/state";
import { invalidateUserProvider } from "@/lib/cache";
import type { Provider } from "@prisma/client";

function isProvider(v: string): v is Provider {
  return v in PROVIDERS;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const accountId = url.searchParams.get("account_id");
  const error = url.searchParams.get("error");

  const back = `${process.env.APP_URL ?? process.env.NEXTAUTH_URL}/settings/connections`;

  if (!state) {
    return NextResponse.redirect(`${back}?error=missing_state`);
  }
  const decoded = verifyState(state);
  if (!decoded) {
    return NextResponse.redirect(`${back}?error=invalid_state`);
  }
  const provider = decoded.provider;
  if (!isProvider(provider)) {
    return NextResponse.redirect(`${back}?error=unknown_provider`);
  }
  const userId = decoded.userId;

  if (error) {
    await prisma.connection.updateMany({
      where: { userId, provider },
      data: { status: "ERROR", meta: { error } },
    });
    return NextResponse.redirect(`${back}?error=${encodeURIComponent(error)}`);
  }

  await prisma.connection.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      userId,
      provider,
      windsorConnectorSlug: PROVIDERS[provider].windsorConnectorSlug,
      windsorAccountId: accountId ?? undefined,
      status: "CONNECTED",
    },
    update: {
      windsorAccountId: accountId ?? undefined,
      status: "CONNECTED",
      meta: undefined,
    },
  });
  await invalidateUserProvider(userId, PROVIDERS[provider].windsorConnectorSlug);

  return NextResponse.redirect(`${back}?connected=${provider.toLowerCase()}`);
}
