import type { DateRange } from "@/lib/dates";
import { rangeFromPreset } from "@/lib/dates";
import { getWebsiteMetrics } from "./website";
import { getOutreachMetrics } from "./outreach";
import { getCrmMetrics } from "./crm";
import { getSocialMetrics } from "./social";
import type { ExecutiveSummary } from "./types";

export async function getExecutiveSummary(
  range: DateRange,
): Promise<ExecutiveSummary> {
  const socialRange = rangeFromPreset("30d");
  const [website, outreach, crm, social] = await Promise.all([
    getWebsiteMetrics(range),
    getOutreachMetrics(range),
    getCrmMetrics(range),
    getSocialMetrics(socialRange),
  ]);
  return {
    website,
    outreach,
    crm,
    social,
    generatedAt: new Date().toISOString(),
  };
}
