import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { parseRange } from "@/lib/dates";
import { getWebsiteMetrics } from "@/lib/metrics/website";
import { getOutreachMetrics } from "@/lib/metrics/outreach";
import { getCrmMetrics } from "@/lib/metrics/crm";
import { getSocialMetrics } from "@/lib/metrics/social";

export const dynamic = "force-dynamic";

type Section = "website" | "outreach" | "crm" | "social";

function isSection(v: string | null): v is Section {
  return v === "website" || v === "outreach" || v === "crm" || v === "social";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const section = url.searchParams.get("section");
  if (!isSection(section)) {
    return NextResponse.json({ error: "unknown section" }, { status: 400 });
  }
  const range = parseRange(url.searchParams);
  const userId = session.user.id;
  let trend: unknown = [];
  switch (section) {
    case "website":
      trend = (await getWebsiteMetrics(userId, range)).trend;
      break;
    case "outreach":
      trend = (await getOutreachMetrics(userId, range)).trend;
      break;
    case "crm":
      trend = (await getCrmMetrics(userId, range)).trend;
      break;
    case "social":
      trend = (await getSocialMetrics(userId, range)).trend;
      break;
  }
  return NextResponse.json({ trend });
}
