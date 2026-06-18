import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { McpTokens } from "@/components/mcp/McpTokens";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const tokens = await prisma.mcpToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });

  const appUrl =
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const endpoint = `${appUrl.replace(/\/$/, "")}/api/mcp`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">MCP Server</h1>
        <p className="text-sm text-muted-foreground">
          Expose this dashboard&apos;s metrics to Claude via a Model Context Protocol
          server.
        </p>
      </header>
      <McpTokens
        endpoint={endpoint}
        tokens={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          createdAt: t.createdAt.toISOString(),
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
