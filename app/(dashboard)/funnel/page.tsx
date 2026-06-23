import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { parseRange } from "@/lib/dates";
import { getExecutiveSummary } from "@/lib/metrics/summary";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { RefreshDataButton } from "@/components/dashboard/RefreshDataButton";
import { SalesFunnelSection } from "@/components/dashboard/sections/SalesFunnelSection";

export const dynamic = "force-dynamic";

export default async function FunnelPage({
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
  const summary = await getExecutiveSummary(range);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Funnel</h1>
          <p className="text-sm text-muted-foreground">
            End-to-end view from reach to closed deals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <RefreshDataButton />
        </div>
      </header>

      <SalesFunnelSection data={summary} />
    </div>
  );
}
