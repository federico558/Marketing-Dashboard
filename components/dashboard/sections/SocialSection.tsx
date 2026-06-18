import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { SocialChannelStats, SocialMetrics, SocialPost } from "@/lib/metrics/types";

function Channel({
  title,
  stats,
}: {
  title: string;
  stats: SocialChannelStats;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        {title}
      </div>
      {stats.connected ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard
              label="Impressions"
              value={formatNumber(stats.totalImpressions)}
            />
            <KpiCard
              label="Engagement"
              value={formatNumber(stats.totalEngagement)}
            />
            <KpiCard
              label="Avg engagement rate"
              value={formatPercent(stats.avgEngagementRate)}
            />
          </div>
          {stats.posts.length ? (
            <div className="mt-3 overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Post</th>
                    <th className="px-3 py-2 text-right">Impressions</th>
                    <th className="px-3 py-2 text-right">Engagement</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.posts.map((p: SocialPost, i) => (
                    <tr key={i} className="border-t">
                      <td className="max-w-md truncate px-3 py-2">
                        {p.text || p.date}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatNumber(p.impressions)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatNumber(p.engagement)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatPercent(p.engagementRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Not connected.
        </div>
      )}
    </div>
  );
}

export function SocialSection({ data }: { data: SocialMetrics }) {
  const anyConnected = data.linkedin.connected || data.instagram.connected;
  return (
    <SectionCard
      title="Social"
      description="LinkedIn + Instagram organic posts"
      connected={anyConnected}
    >
      <div className="space-y-6">
        <Channel title="LinkedIn" stats={data.linkedin} />
        <Channel title="Instagram" stats={data.instagram} />
        {anyConnected ? (
          <div>
            <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Impressions trend
            </div>
            <TrendChart
              data={data.trend}
              series={[
                { key: "linkedin", label: "LinkedIn", color: "#0a66c2" },
                { key: "instagram", label: "Instagram", color: "#e1306c" },
              ]}
            />
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
