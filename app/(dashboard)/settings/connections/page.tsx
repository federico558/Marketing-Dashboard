import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PROVIDER_LIST } from "@/lib/windsor/providers";
import { ConnectionCard } from "@/components/connections/ConnectionCard";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const params = await searchParams;
  const connectedFlag = typeof params.connected === "string" ? params.connected : null;
  const errorFlag = typeof params.error === "string" ? params.error : null;

  const rows = await prisma.connection.findMany({
    where: { userId: session.user.id },
  });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          Connect your data sources via Windsor.ai to populate the dashboard.
        </p>
      </header>

      {connectedFlag ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {connectedFlag.toUpperCase()} connected successfully.
        </div>
      ) : null}
      {errorFlag ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Connection failed: {errorFlag}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDER_LIST.map((p) => (
          <ConnectionCard
            key={p.id}
            provider={p.id}
            label={p.label}
            description={p.description}
            status={byProvider.get(p.id)?.status ?? null}
          />
        ))}
      </div>
    </div>
  );
}
