import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { windsor } from "@/lib/windsor/client";
import { PROVIDERS } from "@/lib/windsor/providers";
import { signState } from "@/lib/state";
import type { Provider } from "@prisma/client";

function isProvider(v: string): v is Provider {
  return v in PROVIDERS;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { provider: raw } = await params;
  const provider = raw.toUpperCase();
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }

  const config = PROVIDERS[provider];
  const callbackUrl = `${process.env.APP_URL ?? process.env.NEXTAUTH_URL}/api/connections/callback`;
  const state = signState({ userId: session.user.id, provider });

  // Create or mark pending
  await prisma.connection.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: {
      userId: session.user.id,
      provider,
      windsorConnectorSlug: config.windsorConnectorSlug,
      status: "PENDING",
    },
    update: { status: "PENDING" },
  });

  try {
    const url = await windsor.getAuthorizationUrl({
      connector: config.windsorConnectorSlug,
      redirect_uri: callbackUrl,
      state,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[connect] windsor auth url failed", e);
    return NextResponse.json(
      { error: "Failed to start OAuth. Check WINDSOR_API_KEY." },
      { status: 502 },
    );
  }
}
