import { BreakdownTable } from "@/components/dashboard/BreakdownTable";
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
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Google Analytics 4
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              vs previous period
            </span>
          </div>
          {data.ga4.connected ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard
                label="Sessions"
                value={formatNumber(data.ga4.sessions)}
                change={data.ga4.sessionsChange}
              />
              <KpiCard
                label="Users"
                value={formatNumber(data.ga4.users)}
                change={data.ga4.usersChange}
              />
              <KpiCard
                label="Pageviews"
                value={formatNumber(data.ga4.pageviews)}
                change={data.ga4.pageviewsChange}
              />
              <KpiCard
                label="Avg session"
                value={formatDuration(data.ga4.avgSessionDuration)}
                change={data.ga4.avgSessionDurationChange}
              />
              <KpiCard
                label="Bounce rate"
                value={formatPercent(data.ga4.bounceRate)}
                change={data.ga4.bounceRateChange}
                invertChangeColor
              />
            </div>
          ) : (
            <EmptyHint label="Connect GA4 in Settings → Connections to populate this section." />
          )}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Search Console
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              vs previous period
            </span>
          </div>
          {data.searchConsole.connected ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard
                label="Impressions"
                value={formatNumber(data.searchConsole.impressions)}
                change={data.searchConsole.impressionsChange}
              />
              <KpiCard
                label="Clicks"
                value={formatNumber(data.searchConsole.clicks)}
                change={data.searchConsole.clicksChange}
              />
              <KpiCard
                label="CTR"
                value={formatPercent(data.searchConsole.ctr)}
                change={data.searchConsole.ctrChange}
              />
              <KpiCard
                label="Avg position"
                value={data.searchConsole.avgPosition.toFixed(1)}
                change={data.searchConsole.avgPositionChange}
                invertChangeColor
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

        {data.ga4.connected ? (
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Breakdowns (vs previous period)
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <BreakdownTable
                title="Users by country"
                metricLabel="Active users"
                rows={data.breakdowns.byCountry}
              />
              <BreakdownTable
                title="Top pages"
                metricLabel="Views"
                rows={data.breakdowns.byPage}
              />
              <BreakdownTable
                title="Sessions by channel"
                metricLabel="Sessions"
                rows={data.breakdowns.byChannel}
              />
            </div>
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
