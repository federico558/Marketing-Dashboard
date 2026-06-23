import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/db";
import { parseRange } from "@/lib/dates";
import { getExecutiveSummary } from "@/lib/metrics/summary";
import { getWebsiteMetrics } from "@/lib/metrics/website";
import { getOutreachMetrics } from "@/lib/metrics/outreach";
import { getCrmMetrics } from "@/lib/metrics/crm";
import { getSocialMetrics } from "@/lib/metrics/social";

const DateRangeSchema = {
  from: z.string().describe("Start date in YYYY-MM-DD"),
  to: z.string().describe("End date in YYYY-MM-DD"),
};

function rangeFromInput(input: { from: string; to: string }) {
  const sp = new URLSearchParams({
    from: input.from,
    to: input.to,
    preset: "custom",
  });
  return parseRange(sp);
}

export function buildMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "marketing-dashboard",
    version: "0.1.0",
  });

  server.tool(
    "get_executive_summary",
    "Full executive summary across website, outreach, CRM, and social.",
    DateRangeSchema,
    async (input) => {
      const range = rangeFromInput(input);
      const result = await getExecutiveSummary(userId, range);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    "get_website_metrics",
    "Google Analytics 4 + Google Search Console.",
    DateRangeSchema,
    async (input) => {
      const result = await getWebsiteMetrics(userId, rangeFromInput(input));
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    "get_outreach_stats",
    "Lemlist + Smartlead outreach metrics. source = lemlist | smartlead | combined (default).",
    {
      ...DateRangeSchema,
      source: z.enum(["lemlist", "smartlead", "combined"]).optional(),
    },
    async (input) => {
      const result = await getOutreachMetrics(userId, rangeFromInput(input));
      const source = input.source ?? "combined";
      const slice =
        source === "lemlist"
          ? result.lemlist
          : source === "smartlead"
            ? result.smartlead
            : result.combined;
      return {
        content: [{ type: "text", text: JSON.stringify({ source, ...slice }) }],
      };
    },
  );

  server.tool(
    "get_crm_stats",
    "Pipedrive CRM — deals created, won, lost, win rate, won value, open pipeline.",
    DateRangeSchema,
    async (input) => {
      const result = await getCrmMetrics(userId, rangeFromInput(input));
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    "get_social_stats",
    "Buffer — per-channel social post performance (impressions, reach, engagement, top posts).",
    DateRangeSchema,
    async (input) => {
      const result = await getSocialMetrics(userId, rangeFromInput(input));
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    "list_connections",
    "List the data sources connected for this user.",
    {},
    async () => {
      const rows = await prisma.connection.findMany({
        where: { userId },
        select: { provider: true, status: true, updatedAt: true },
      });
      return { content: [{ type: "text", text: JSON.stringify(rows) }] };
    },
  );

  return server;
}
