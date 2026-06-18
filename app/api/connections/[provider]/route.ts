import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { PROVIDERS } from "@/lib/windsor/providers";
import { invalidateUserProvider } from "@/lib/cache";
import type { Provider } from "@prisma/client";

function isProvider(v: string): v is Provider {
  return v in PROVIDERS;
}

export async function DELETE(
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

  await prisma.connection.deleteMany({
    where: { userId: session.user.id, provider },
  });
  await invalidateUserProvider(session.user.id, PROVIDERS[provider].windsorConnectorSlug);
  return NextResponse.json({ ok: true });
}
