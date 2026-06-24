"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Token {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  endpoint: string;
  tokens: Token[];
}

export function McpTokens({ endpoint, tokens }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  const create = async () => {
    const res = await fetch("/api/mcp/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const { token } = (await res.json()) as { token: string };
    setNewToken(token);
    setName("");
    startTransition(() => router.refresh());
  };

  const revoke = async (id: string) => {
    await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  };

  const snippets = newToken
    ? [
        {
          label: "Claude Desktop (Windows)",
          help: "Paste into claude_desktop_config.json. Quit Claude Desktop from the tray and reopen.",
          code: `{
  "mcpServers": {
    "marketing-dashboard": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "mcp-remote@latest",
        "${endpoint}",
        "--header",
        "Authorization:Bearer ${newToken}"
      ]
    }
  }
}`,
        },
        {
          label: "Claude Desktop (macOS)",
          help: "Paste into claude_desktop_config.json (Settings → Developer → Edit Config). Quit Claude Desktop and reopen.",
          code: `{
  "mcpServers": {
    "marketing-dashboard": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "${endpoint}",
        "--header",
        "Authorization:Bearer ${newToken}"
      ]
    }
  }
}`,
        },
        {
          label: "Claude Code CLI / other HTTP-native MCP clients",
          help: "For clients that speak Streamable HTTP directly. Claude Desktop does not — use one of the wrappers above.",
          code: `{
  "mcpServers": {
    "marketing-dashboard": {
      "type": "http",
      "url": "${endpoint}",
      "headers": { "Authorization": "Bearer ${newToken}" }
    }
  }
}`,
        },
      ]
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>
            Configure this URL in your Claude client to access the dashboard via MCP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block w-full overflow-x-auto rounded-md border bg-muted px-3 py-2 text-sm">
            {endpoint}
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create token</CardTitle>
          <CardDescription>
            Tokens are shown once. Store them somewhere safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="flex-1">
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                placeholder="e.g. Claude Desktop"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button onClick={create} disabled={pending}>
              Create token
            </Button>
          </div>
          {newToken ? (
            <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="font-medium text-emerald-900">
                New token — copy it now, you won&apos;t see it again.
              </div>
              <code className="block break-all rounded bg-emerald-100 px-2 py-1 text-emerald-900">
                {newToken}
              </code>
              {snippets ? (
                <details>
                  <summary className="cursor-pointer text-xs text-emerald-900">
                    Show Claude MCP config snippets
                  </summary>
                  <div className="mt-2 space-y-3">
                    {snippets.map((s) => (
                      <div key={s.label} className="space-y-1">
                        <div className="text-xs font-semibold text-emerald-900">
                          {s.label}
                        </div>
                        <div className="text-xs text-emerald-900/80">
                          {s.help}
                        </div>
                        <pre className="overflow-x-auto rounded bg-emerald-100 p-2 text-xs text-emerald-900">
                          {s.code}
                        </pre>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active tokens</CardTitle>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No tokens yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Created</th>
                  <th className="px-2 py-2 text-left">Last used</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-2 py-2">{t.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {t.lastUsedAt
                        ? new Date(t.lastUsedAt).toLocaleString()
                        : "never"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revoke(t.id)}
                        disabled={pending}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
