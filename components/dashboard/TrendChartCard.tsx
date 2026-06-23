"use client";
import { useEffect, useState } from "react";
import { TrendChart, type TrendSeries } from "@/components/dashboard/TrendChart";
import { Button } from "@/components/ui/button";
import type { TrendPoint } from "@/lib/metrics/types";

type Preset = "7d" | "30d" | "90d" | "ytd";

const PRESETS: { label: string; value: Preset }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "YTD", value: "ytd" },
];

interface Props {
  section: "website" | "outreach" | "crm" | "social";
  series: TrendSeries[];
  defaultPreset?: Preset;
  height?: number;
}

export function TrendChartCard({
  section,
  series,
  defaultPreset = "30d",
  height,
}: Props) {
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/metrics/trend?section=${section}&preset=${preset}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((j: { trend?: TrendPoint[] }) => {
        if (cancelled) return;
        setTrend(j.trend ?? []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "fetch failed");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, preset]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          Trend
        </span>
        <div className="flex gap-1 rounded-md border bg-card p-1">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={preset === p.value ? "default" : "ghost"}
              onClick={() => setPreset(p.value)}
              disabled={loading}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      {error ? (
        <div
          className="flex items-center justify-center rounded-md border border-dashed text-sm text-destructive"
          style={{ height: height ?? 240 }}
        >
          {error}
        </div>
      ) : loading ? (
        <div
          className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
          style={{ height: height ?? 240 }}
        >
          Loading…
        </div>
      ) : (
        <TrendChart data={trend} series={series} height={height} />
      )}
    </div>
  );
}
