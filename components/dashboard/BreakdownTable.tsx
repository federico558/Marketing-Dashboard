import { formatNumber } from "@/lib/utils";
import type { BreakdownRow } from "@/lib/metrics/types";

interface Props {
  title: string;
  metricLabel: string;
  rows: BreakdownRow[];
  emptyHint?: string;
}

export function BreakdownTable({ title, metricLabel, rows, emptyHint }: Props) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-md border">
      <div className="flex w-full items-center justify-between gap-2 border-b px-3 py-2">
        <span className="min-w-0 truncate text-xs font-medium uppercase text-muted-foreground">
          {title}
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          {metricLabel}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted-foreground">
          {emptyHint ?? "No data for this period."}
        </div>
      ) : (
        <ul className="w-full divide-y">
          {rows.map((r) => (
            <li
              key={r.label}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate" title={r.label}>
                {r.label}
              </span>
              <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-xs">
                <span>{formatNumber(r.value)}</span>
                <ChangeBadge change={r.changePercent} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change == null) {
    return <span className="w-14 text-right text-muted-foreground">—</span>;
  }
  const positive = change >= 0;
  const cls = positive ? "text-emerald-600" : "text-red-600";
  const arrow = positive ? "▲" : "▼";
  const abs = Math.abs(change);
  const display = abs >= 1000 ? `${Math.round(abs)}%` : `${abs.toFixed(1)}%`;
  return (
    <span className={`w-14 text-right ${cls}`}>
      {arrow} {display}
    </span>
  );
}
