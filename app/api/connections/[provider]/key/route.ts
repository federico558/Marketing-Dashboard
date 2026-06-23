import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { isProvider } from "@/lib/providers";
import { encrypt } from "@/lib/crypto";
import { verifyLemlistKey } from "@/lib/lemlist/client";
import { verifySmartleadKey } from "@/lib/smartlead/client";
import { verifyPipedriveKey } from "@/lib/pipedrive/client";
import { verifyBufferKey } from "@/lib/buffer/client";
import { invalidateMetrics } from "@/lib/cache";

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
  if (
    !isProvider(provider) ||
    (provider !== "LEMLIST" &&
      provider !== "SMARTLEAD" &&
      provider !== "PIPEDRIVE" &&
      provider !== "BUFFER")
  ) {
    return NextResponse.json({ error: "unsupported provider" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { apiKey?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  try {
    if (provider === "LEMLIST") await verifyLemlistKey(apiKey);
    else if (provider === "SMARTLEAD") await verifySmartleadKey(apiKey);
    else if (provider === "PIPEDRIVE") await verifyPipedriveKey(apiKey);
    else await verifyBufferKey(apiKey);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid key" },
      { status: 400 },
    );
  }

  try {
    const enc = encrypt(apiKey);
    await prisma.connection.upsert({
      where: { provider },
      create: {
        provider,
        status: "CONNECTED",
        apiKeyEnc: enc,
      },
      update: {
        status: "CONNECTED",
        apiKeyEnc: enc,
        meta: undefined,
      },
    });
    await invalidateMetrics();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[connections/key] save failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "save failed" },
      { status: 500 },
    );
  }
}
