import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { isProvider } from "@/lib/providers";
import { smartleadDebug } from "@/lib/smartlead/client";
import { parseRange, formatRangeISO } from "@/lib/dates";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { provider: raw } = await params;
  const provider = raw.toUpperCase();
  if (!isProvider(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }
  const conn = await prisma.connection.findUnique({
    where: { userId_provider: { userId: session.user.id, provider } },
  });
  if (!conn) {
    return NextResponse.json({ error: "not connected" }, { status: 404 });
  }

  const url = new URL(req.url);
  const sp = new URLSearchParams();
  for (const [k, v] of url.searchParams) sp.set(k, v);
  const range = parseRange(sp);
  const { from, to } = formatRangeISO(range);

  if (provider === "SMARTLEAD") {
    if (!conn.apiKeyEnc) {
      return NextResponse.json({ error: "missing key" }, { status: 400 });
    }
    try {
      const result = await smartleadDebug(decrypt(conn.apiKeyEnc), from, to);
      return NextResponse.json({ range: { from, to }, result });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "debug failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: `debug not implemented for ${provider}` },
    { status: 400 },
  );
}
