import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { parseRange } from "@/lib/dates";
import { getExecutiveSummary } from "@/lib/metrics/summary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const range = parseRange(url.searchParams);
  const summary = await getExecutiveSummary(range);
  return NextResponse.json({ range, summary });
}
