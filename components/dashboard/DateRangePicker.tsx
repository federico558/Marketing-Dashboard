"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PRESET,
  parseRange,
  rangeFromPreset,
  type DateRangePreset,
} from "@/lib/dates";

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Year to date", value: "ytd" },
];

export function DateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = useMemo(() => {
    return parseRange(new URLSearchParams(searchParams.toString()));
  }, [searchParams]);

  const [from, setFrom] = useState(format(current.from, "yyyy-MM-dd"));
  const [to, setTo] = useState(format(current.to, "yyyy-MM-dd"));

  const updateParams = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
        else sp.delete(k);
      }
      startTransition(() => {
        router.push(`?${sp.toString()}`);
      });
    },
    [router, searchParams],
  );

  const selectPreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      updateParams({ preset: "custom", from, to });
      return;
    }
    const r = rangeFromPreset(preset);
    setFrom(format(r.from, "yyyy-MM-dd"));
    setTo(format(r.to, "yyyy-MM-dd"));
    updateParams({
      preset,
      from: format(r.from, "yyyy-MM-dd"),
      to: format(r.to, "yyyy-MM-dd"),
    });
  };

  const activePreset = current.preset ?? DEFAULT_PRESET;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-md border bg-card p-1">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={activePreset === p.value ? "default" : "ghost"}
            onClick={() => selectPreset(p.value)}
            disabled={pending}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 rounded-md border bg-card p-1 pl-2 sm:w-auto">
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-8 min-w-0 flex-1 sm:w-[150px] sm:flex-none"
        />
        <span className="text-muted-foreground">→</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-8 min-w-0 flex-1 sm:w-[150px] sm:flex-none"
        />
        <Button
          size="sm"
          variant={activePreset === "custom" ? "default" : "outline"}
          onClick={() => selectPreset("custom")}
          disabled={pending}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
