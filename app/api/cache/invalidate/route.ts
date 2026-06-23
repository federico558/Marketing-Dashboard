import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { invalidateMetrics } from "@/lib/cache";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await invalidateMetrics();
  return NextResponse.json({ ok: true });
}
