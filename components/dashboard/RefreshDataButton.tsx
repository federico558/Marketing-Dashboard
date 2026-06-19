"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      await fetch("/api/cache/invalidate", { method: "POST" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  const loading = busy || pending;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={loading}
      aria-label="Refresh data"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      <span className="ml-2">Refresh</span>
    </Button>
  );
}
