import type { DateRange } from "@/lib/dates";
import { getWebsiteMetrics } from "./website";
import { getOutreachMetrics } from "./outreach";
import type { ExecutiveSummary } from "./types";

export async function getExecutiveSummary(
  userId: string,
  range: DateRange,
): Promise<ExecutiveSummary> {
  const [website, outreach] = await Promise.all([
    getWebsiteMetrics(userId, range),
    getOutreachMetrics(userId, range),
  ]);
  return {
    website,
    outreach,
    generatedAt: new Date().toISOString(),
  };
}
