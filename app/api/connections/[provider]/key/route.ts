import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { isProvider } from "@/lib/providers";
import { encrypt } from "@/lib/crypto";
import { verifyLemlistKey } from "@/lib/lemlist/client";
import { verifySmartleadKey } from "@/lib/smartlead/client";
import { invalidateUserProvider } from "@/lib/cache";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { provider: raw } = await params;
  const provider = raw.toUpperCase();
  if (!isProvider(provider) || (provider !== "LEMLIST" && provider !== "SMARTLEAD")) {
    return NextResponse.json({ error: "unsupported provider" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  try {
    if (provider === "LEMLIST") await verifyLemlistKey(apiKey);
    else await verifySmartleadKey(apiKey);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid key" },
      { status: 400 },
    );
  }

  await prisma.connection.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: {
      userId: session.user.id,
      provider,
      status: "CONNECTED",
      apiKeyEnc: encrypt(apiKey),
    },
    update: {
      status: "CONNECTED",
      apiKeyEnc: encrypt(apiKey),
      meta: undefined,
    },
  });
  await invalidateUserProvider(session.user.id, provider);
  return NextResponse.json({ ok: true });
}
