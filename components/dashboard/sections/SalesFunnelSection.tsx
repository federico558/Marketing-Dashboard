import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import type { ExecutiveSummary } from "@/lib/metrics/types";

export function SalesFunnelSection({ data }: { data: ExecutiveSummary }) {
  return (
    <SectionCard
      title="Sales Funnel"
      description="End-to-end marketing funnel from awareness to closed deals"
    >
      <div className="space-y-4">
        <TopOfFunnel data={data} />
        <MiddleOfFunnel data={data} />
        <BottomOfFunnel data={data} />
      </div>
    </SectionCard>
  );
}

function FunnelLevel({
  label,
  title,
  subtitle,
  children,
}: {
  label: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-baseline justify-between border-b bg-muted/30 px-3 py-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-sm font-semibold">{title}</div>
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {subtitle}
        </div>
      </div>
      <div className="space-y-4 p-3">{children}</div>
    </div>
  );
}

function Group({
  title,
  cols,
  children,
}: {
  title: string;
  cols: "2" | "3" | "4" | "5";
  children: React.ReactNode;
}) {
  const grid =
    cols === "5"
      ? "grid grid-cols-2 gap-3 md:grid-cols-5"
      : cols === "4"
        ? "grid grid-cols-2 gap-3 md:grid-cols-4"
        : cols === "3"
          ? "grid grid-cols-2 gap-3 md:grid-cols-3"
          : "grid grid-cols-2 gap-3";
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
        {title}
      </div>
      <div className={grid}>{children}</div>
    </div>
  );
}

function TopOfFunnel({ data }: { data: ExecutiveSummary }) {
  const { ga4, searchConsole } = data.website;
  const lem = data.outreach.lemlist;
  const sl = data.outreach.smartlead;
  const combined = data.outreach.combined;
  const social = data.social;
  const socialTotals = social.channels.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      engagement: acc.engagement + c.engagement,
      posts: acc.posts + c.posts,
    }),
    { impressions: 0, engagement: 0, posts: 0 },
  );
  const anything =
    ga4.connected ||
    searchConsole.connected ||
    lem.connected ||
    sl.connected ||
    social.connected;

  return (
    <FunnelLevel
      label="Top of funnel"
      title="Reach & awareness"
      subtitle="Website, search, outreach, social"
    >
      {!anything ? (
        <EmptyHint label="Connect GA4, Search Console, Lemlist, Smartlead, or Buffer to populate this level." />
      ) : null}

      {ga4.connected ? (
        <Group title="Google Analytics 4" cols="5">
          <KpiCard label="Sessions" value={formatNumber(ga4.sessions)} change={ga4.sessionsChange} />
          <KpiCard label="Users" value={formatNumber(ga4.users)} change={ga4.usersChange} />
          <KpiCard label="Pageviews" value={formatNumber(ga4.pageviews)} change={ga4.pageviewsChange} />
          <KpiCard
            label="Avg session"
            value={formatDuration(ga4.avgSessionDuration)}
            change={ga4.avgSessionDurationChange}
          />
          <KpiCard
            label="Bounce rate"
            value={formatPercent(ga4.bounceRate)}
            change={ga4.bounceRateChange}
            invertChangeColor
          />
        </Group>
      ) : null}

      {searchConsole.connected ? (
        <Group title="Search Console" cols="4">
          <KpiCard
            label="Impressions"
            value={formatNumber(searchConsole.impressions)}
            change={searchConsole.impressionsChange}
          />
          <KpiCard
            label="Clicks"
            value={formatNumber(searchConsole.clicks)}
            change={searchConsole.clicksChange}
          />
          <KpiCard
            label="CTR"
            value={formatPercent(searchConsole.ctr)}
            change={searchConsole.ctrChange}
          />
          <KpiCard
            label="Avg position"
            value={searchConsole.avgPosition.toFixed(1)}
            change={searchConsole.avgPositionChange}
            invertChangeColor
          />
        </Group>
      ) : null}

      {lem.connected || sl.connected ? (
        <Group title="Outreach (Lemlist + Smartlead)" cols="4">
          <KpiCard label="Messages sent" value={formatNumber(combined.sent)} />
          <KpiCard label="Open rate" value={formatPercent(combined.openRate)} />
          <KpiCard label="Replies" value={formatNumber(combined.replies)} />
          <KpiCard label="Reply rate" value={formatPercent(combined.replyRate)} />
        </Group>
      ) : null}

      {social.connected && social.channels.length > 0 ? (
        <Group title="Social (Buffer)" cols="3">
          <KpiCard label="Posts" value={formatNumber(socialTotals.posts)} />
          <KpiCard label="Impressions" value={formatNumber(socialTotals.impressions)} />
          <KpiCard label="Engagement" value={formatNumber(socialTotals.engagement)} />
        </Group>
      ) : null}
    </FunnelLevel>
  );
}

function MiddleOfFunnel({ data }: { data: ExecutiveSummary }) {
  const crm = data.crm;
  return (
    <FunnelLevel
      label="Middle of funnel"
      title="Qualified leads"
      subtitle="Marketing-qualified"
    >
      {!crm.connected ? (
        <EmptyHint label="Connect Pipedrive to populate this level." />
      ) : (
        <Group title="Pipedrive" cols="2">
          <KpiCard
            label={`MQLs${crm.mqlStageName ? ` (${crm.mqlStageName})` : ""}`}
            value={formatNumber(crm.mqls)}
            change={crm.mqlsChange}
            hint={
              crm.mqlStageName
                ? undefined
                : "No stage matched MQL — name a Pipedrive stage \"MQL\" or \"Marketing Qualified Lead\""
            }
          />
        </Group>
      )}
    </FunnelLevel>
  );
}

function BottomOfFunnel({ data }: { data: ExecutiveSummary }) {
  const crm = data.crm;
  return (
    <FunnelLevel
      label="Bottom of funnel"
      title="Pipeline, wins, and losses"
      subtitle="Sales-qualified through closed"
    >
      {!crm.connected ? (
        <EmptyHint label="Connect Pipedrive to populate this level." />
      ) : (
        <>
          <Group title="Sales qualified" cols="2">
            <KpiCard
              label={`SQLs${crm.sqlStageName ? ` (${crm.sqlStageName})` : ""}`}
              value={formatNumber(crm.sqls)}
              change={crm.sqlsChange}
              hint={
                crm.sqlStageName
                  ? undefined
                  : "No stage matched SQL — name a Pipedrive stage \"SQL\" or \"Sales Qualified Lead\""
              }
            />
          </Group>

          <Group title="Deals (period)" cols="5">
            <KpiCard
              label="Deals created"
              value={formatNumber(crm.dealsCreated)}
              change={crm.dealsCreatedChange}
              hint={
                crm.qualifyingThreshold
                  ? `${crm.qualifyingThreshold} or later`
                  : undefined
              }
            />
            <KpiCard
              label="Deals won"
              value={formatNumber(crm.dealsWon)}
              change={crm.dealsWonChange}
            />
            <KpiCard
              label="Won value"
              value={formatCurrency(crm.dealsWonValue)}
              change={crm.dealsWonValueChange}
            />
            <KpiCard
              label="Deals lost"
              value={formatNumber(crm.dealsLost)}
              change={crm.dealsLostChange}
              invertChangeColor
            />
            <KpiCard
              label="Win rate"
              value={formatPercent(crm.winRate)}
              change={crm.winRateChange}
            />
          </Group>

          <Group title="Open pipeline (snapshot)" cols="2">
            <KpiCard
              label="Open deals"
              value={formatNumber(crm.openDeals)}
              hint={
                crm.qualifyingThreshold
                  ? `${crm.qualifyingThreshold} or later`
                  : undefined
              }
            />
            <KpiCard
              label="Open pipeline value"
              value={formatCurrency(crm.openDealsValue)}
              hint={
                crm.qualifyingThreshold
                  ? `${crm.qualifyingThreshold} or later`
                  : undefined
              }
            />
          </Group>
        </>
      )}
    </FunnelLevel>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
