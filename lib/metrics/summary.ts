import type { DateRange } from "@/lib/dates";
import { getWebsiteMetrics } from "./website";
import { getOutreachMetrics } from "./outreach";
import { getCrmMetrics } from "./crm";
import type { ExecutiveSummary } from "./types";

export async function getExecutiveSummary(
  userId: string,
  range: DateRange,
): Promise<ExecutiveSummary> {
  const [website, outreach, crm] = await Promise.all([
    getWebsiteMetrics(userId, range),
    getOutreachMetrics(userId, range),
    getCrmMetrics(userId, range),
  ]);
  return {
    website,
    outreach,
    crm,
    generatedAt: new Date().toISOString(),
  };
}
