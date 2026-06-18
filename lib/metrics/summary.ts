import type { DateRange } from "@/lib/dates";
import { getWebsiteMetrics } from "./website";
import { getOutreachMetrics } from "./outreach";
import { getCrmMetrics } from "./crm";
import { getSocialMetrics } from "./social";
import type { ExecutiveSummary } from "./types";

export async function getExecutiveSummary(
  userId: string,
  range: DateRange,
): Promise<ExecutiveSummary> {
  const [website, outreach, crm, social] = await Promise.all([
    getWebsiteMetrics(userId, range),
    getOutreachMetrics(userId, range),
    getCrmMetrics(userId, range),
    getSocialMetrics(userId, range),
  ]);
  return {
    website,
    outreach,
    crm,
    social,
    generatedAt: new Date().toISOString(),
  };
}
