import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { invalidateUserMetrics } from "@/lib/cache";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await invalidateUserMetrics(session.user.id);
  return NextResponse.json({ ok: true });
}
