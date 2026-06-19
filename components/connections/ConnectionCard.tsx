"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConnectionStatus, Provider } from "@prisma/client";
import type { AuthMode } from "@/lib/providers";

interface Props {
  provider: Provider;
  label: string;
  description: string;
  authMode: AuthMode;
  status: ConnectionStatus | null;
  externalLabel: string | null;
}

export function ConnectionCard({
  provider,
  label,
  description,
  authMode,
  status,
  externalLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = status === "CONNECTED";

  const startOAuth = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/connections/google/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } finally {
      setSubmitting(false);
    }
  };

  const submitKey = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/connections/${provider}/key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      setApiKey("");
      setShowKeyInput(false);
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const disconnect = async () => {
    setError(null);
    const res = await fetch(`/api/connections/${provider}`, { method: "DELETE" });
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
            {connected && externalLabel ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Linked: <span className="font-mono">{externalLabel}</span>
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showKeyInput && !connected ? (
          <div className="flex flex-col gap-2">
            <Input
              type="password"
              placeholder={`Paste your ${label} API key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={submitKey}
                disabled={submitting || !apiKey.trim()}
              >
                {submitting ? "Verifying..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowKeyInput(false);
                  setApiKey("");
                  setError(null);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <div className="text-xs">
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
          ) : authMode === "google_oauth" ? (
            <Button size="sm" onClick={startOAuth} disabled={submitting}>
              {submitting ? "Redirecting..." : "Connect with Google"}
            </Button>
          ) : showKeyInput ? null : (
            <Button size="sm" onClick={() => setShowKeyInput(true)}>
              Add API key
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
