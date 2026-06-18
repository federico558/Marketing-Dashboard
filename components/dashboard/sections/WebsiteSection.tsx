import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { formatNumber, formatPercent, formatDuration } from "@/lib/utils";
import type { WebsiteMetrics } from "@/lib/metrics/types";

export function WebsiteSection({ data }: { data: WebsiteMetrics }) {
  const anyConnected = data.ga4.connected || data.searchConsole.connected;
  return (
    <SectionCard
      title="Website"
      description="Google Analytics 4 + Google Search Console"
      connected={anyConnected}
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Google Analytics 4
          </div>
          {data.ga4.connected ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard label="Sessions" value={formatNumber(data.ga4.sessions)} />
              <KpiCard label="Users" value={formatNumber(data.ga4.users)} />
              <KpiCard label="Pageviews" value={formatNumber(data.ga4.pageviews)} />
              <KpiCard
                label="Avg session"
                value={formatDuration(data.ga4.avgSessionDuration)}
              />
              <KpiCard
                label="Bounce rate"
                value={formatPercent(data.ga4.bounceRate)}
              />
            </div>
          ) : (
            <EmptyHint label="Connect GA4 in Settings → Connections to populate this section." />
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Search Console
          </div>
          {data.searchConsole.connected ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard
                label="Impressions"
                value={formatNumber(data.searchConsole.impressions)}
              />
              <KpiCard
                label="Clicks"
                value={formatNumber(data.searchConsole.clicks)}
              />
              <KpiCard
                label="CTR"
                value={formatPercent(data.searchConsole.ctr)}
              />
              <KpiCard
                label="Avg position"
                value={data.searchConsole.avgPosition.toFixed(1)}
              />
            </div>
          ) : (
            <EmptyHint label="Connect Google Search Console to see organic search performance." />
          )}
        </div>

        {anyConnected ? (
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Trend
            </div>
            <TrendChart
              data={data.trend}
              series={[
                { key: "sessions", label: "Sessions", color: "#3b82f6" },
                { key: "clicks", label: "Search clicks", color: "#10b981" },
              ]}
            />
          </div>
        ) : null}
      </div>
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
