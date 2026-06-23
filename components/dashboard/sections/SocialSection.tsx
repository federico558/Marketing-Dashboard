import { BreakdownTable } from "@/components/dashboard/BreakdownTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { TrendChartCard } from "@/components/dashboard/TrendChartCard";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { SocialMetrics } from "@/lib/metrics/types";

export function SocialSection({ data }: { data: SocialMetrics }) {
  return (
    <SectionCard
      title="Social"
      description="Buffer — post performance across connected channels"
      connected={data.connected}
    >
      {!data.connected ? (
        <EmptyHint label="Connect Buffer in Settings → Connections to populate this section." />
      ) : data.channels.length === 0 ? (
        <EmptyHint label="No posts in this period across your connected Buffer channels." />
      ) : (
        <div className="space-y-6">
          {!data.metricsAvailable ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Connected, but performance metrics need the <code className="font-mono">insights:read</code> scope. In Buffer → Account → Developers, regenerate your personal API token with that scope checked, then paste it again in Settings → Connections.
            </div>
          ) : null}
          {data.channels.map((c) => (
            <div key={c.service}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {c.channelName}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  vs previous period
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <KpiCard
                  label="Posts"
                  value={formatNumber(c.posts)}
                  change={c.postsChange}
                />
                <KpiCard
                  label="Impressions"
                  value={formatNumber(c.impressions)}
                  change={c.impressionsChange}
                />
                <KpiCard
                  label="Reach"
                  value={formatNumber(c.reach)}
                  change={c.reachChange}
                />
                <KpiCard
                  label="Engagement"
                  value={formatNumber(c.engagement)}
                  change={c.engagementChange}
                />
                <KpiCard
                  label="Engagement rate"
                  value={formatPercent(c.engagementRate)}
                  change={c.engagementRateChange}
                />
              </div>
            </div>
          ))}

          {data.topPosts.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Top posts by engagement
              </div>
              <BreakdownTable
                title="Posts"
                metricLabel="Engagement"
                rows={data.topPosts.map((p) => ({
                  label: `[${p.channelName}] ${p.text.slice(0, 80)}`,
                  value: p.engagement,
                  changePercent: null,
                }))}
              />
            </div>
          ) : null}

          <TrendChartCard
            section="social"
            series={[
              { key: "impressions", label: "Impressions", color: "#3b82f6" },
              { key: "engagement", label: "Engagement", color: "#f59e0b" },
              { key: "posts", label: "Posts", color: "#10b981", yAxisId: "right" },
            ]}
          />
        </div>
      )}
    </SectionCard>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
