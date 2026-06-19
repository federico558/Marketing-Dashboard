import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { CrmMetrics } from "@/lib/metrics/types";

export function CrmSection({ data }: { data: CrmMetrics }) {
  return (
    <SectionCard title="CRM" description="Pipedrive" connected={data.connected}>
      {!data.connected ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Connect Pipedrive in Settings → Connections to populate this section.
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Period
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                vs previous period
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard
                label="Deals created"
                value={formatNumber(data.dealsCreated)}
                change={data.dealsCreatedChange}
              />
              <KpiCard
                label="Deals won"
                value={formatNumber(data.dealsWon)}
                change={data.dealsWonChange}
              />
              <KpiCard
                label="Won value"
                value={formatCurrency(data.dealsWonValue)}
                change={data.dealsWonValueChange}
              />
              <KpiCard
                label="Deals lost"
                value={formatNumber(data.dealsLost)}
                change={data.dealsLostChange}
                invertChangeColor
              />
              <KpiCard
                label="Win rate"
                value={formatPercent(data.winRate)}
                change={data.winRateChange}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Pipeline (current snapshot)
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
              <KpiCard
                label="Open deals"
                value={formatNumber(data.openDeals)}
              />
              <KpiCard
                label="Open pipeline value"
                value={formatCurrency(data.openDealsValue)}
              />
            </div>
          </div>

          {data.trend.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Deals won — trend
              </div>
              <TrendChart
                data={data.trend}
                series={[
                  { key: "won", label: "Deals won", color: "#10b981" },
                  { key: "value", label: "Value", color: "#3b82f6" },
                ]}
              />
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
