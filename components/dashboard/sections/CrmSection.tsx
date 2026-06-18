import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatNumber, formatCurrency } from "@/lib/utils";
import type { CrmMetrics } from "@/lib/metrics/types";

export function CrmSection({ data }: { data: CrmMetrics }) {
  return (
    <SectionCard
      title="CRM"
      description="Pipedrive funnel — MQLs, SQLs, meetings, and deals."
      connected={data.connected}
    >
      {data.connected ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="MQLs" value={formatNumber(data.mqls)} />
          <KpiCard label="SQLs" value={formatNumber(data.sqls)} />
          <KpiCard label="Meetings" value={formatNumber(data.meetings)} />
          <KpiCard label="Deals" value={formatNumber(data.deals)} />
          <KpiCard
            label="Deal value"
            value={formatCurrency(data.dealsValue)}
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Connect Pipedrive to see your sales funnel.
        </div>
      )}
    </SectionCard>
  );
}
