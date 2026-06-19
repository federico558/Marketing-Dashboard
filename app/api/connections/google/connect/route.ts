import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { isProvider } from "@/lib/providers";
import { buildAuthUrl } from "@/lib/google/oauth";
import { signState } from "@/lib/state";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { provider?: string };
  const provider = body.provider?.toUpperCase() ?? "";
  if (!isProvider(provider) || (provider !== "GA4" && provider !== "SEARCH_CONSOLE")) {
    return NextResponse.json({ error: "unsupported provider" }, { status: 400 });
  }

  await prisma.connection.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: { userId: session.user.id, provider, status: "PENDING" },
    update: { status: "PENDING" },
  });

  const state = signState({ userId: session.user.id, provider });
  try {
    const url = buildAuthUrl({ provider, state });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[google/connect] failed", e);
    return NextResponse.json(
      { error: "Failed to start OAuth. Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET." },
      { status: 500 },
    );
  }
}
