"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConnectionStatus, Provider } from "@prisma/client";

interface Props {
  provider: Provider;
  label: string;
  description: string;
  status: ConnectionStatus | null;
}

export function ConnectionCard({ provider, label, description, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const connected = status === "CONNECTED";

  const connect = async () => {
    setError(null);
    const res = await fetch(`/api/connections/${provider}/connect`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Request failed (${res.status})`);
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  };

  const disconnect = async () => {
    setError(null);
    const res = await fetch(`/api/connections/${provider}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Request failed (${res.status})`);
      return;
    }
    startTransition(() => router.refresh());
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {label}
              {connected ? <Badge variant="success">Connected</Badge> : null}
              {status === "PENDING" ? <Badge variant="outline">Pending</Badge> : null}
              {status === "ERROR" ? <Badge variant="destructive">Error</Badge> : null}
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {error ? <span className="text-destructive">{error}</span> : null}
        </div>
        {connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={disconnect}
            disabled={pending}
          >
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={connect}>
            Connect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
