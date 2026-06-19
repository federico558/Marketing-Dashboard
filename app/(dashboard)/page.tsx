import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { parseRange } from "@/lib/dates";
import { getExecutiveSummary } from "@/lib/metrics/summary";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { WebsiteSection } from "@/components/dashboard/sections/WebsiteSection";
import { OutreachSection } from "@/components/dashboard/sections/OutreachSection";
import { CrmSection } from "@/components/dashboard/sections/CrmSection";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const params = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") sp.set(k, v);
  }
  const range = parseRange(sp);
  const summary = await getExecutiveSummary(session.user.id, range);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Executive Summary
          </h1>
          <p className="text-sm text-muted-foreground">
            Marketing performance across your connected sources.
          </p>
        </div>
        <DateRangePicker />
      </header>

      <div className="grid gap-6">
        <WebsiteSection data={summary.website} />
        <OutreachSection data={summary.outreach} />
        <CrmSection data={summary.crm} />
      </div>
    </div>
  );
}
