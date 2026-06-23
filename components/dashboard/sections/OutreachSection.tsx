import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { TrendChartCard } from "@/components/dashboard/TrendChartCard";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { OutreachChannelStats, OutreachMetrics } from "@/lib/metrics/types";

function ChannelRow({ title, stats }: { title: string; stats: OutreachChannelStats }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        {title}
      </div>
      {stats.connected ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Messages sent" value={formatNumber(stats.sent)} />
          <KpiCard label="Open rate" value={formatPercent(stats.openRate)} />
          <KpiCard label="Replies" value={formatNumber(stats.replies)} />
          <KpiCard label="Reply rate" value={formatPercent(stats.replyRate)} />
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Not connected.
        </div>
      )}
    </div>
  );
}

export function OutreachSection({ data }: { data: OutreachMetrics }) {
  const anyConnected =
    data.lemlist.connected || data.smartlead.connected || data.combined.connected;
  return (
    <SectionCard
      title="Outreach"
      description="Lemlist + Smartlead, combined"
      connected={anyConnected}
    >
      <div className="space-y-6">
        <ChannelRow title="Combined" stats={data.combined} />
        <ChannelRow title="Lemlist" stats={data.lemlist} />
        <ChannelRow title="Smartlead" stats={data.smartlead} />
        {anyConnected ? (
          <TrendChartCard
            section="outreach"
            series={[
              { key: "sent", label: "Sent", color: "#3b82f6" },
              { key: "replies", label: "Replies", color: "#f59e0b" },
            ]}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
