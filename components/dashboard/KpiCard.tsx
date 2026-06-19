import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  change?: number | null;
  invertChangeColor?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  change,
  invertChangeColor,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {change !== undefined ? (
          <ChangeBadge change={change} invert={invertChangeColor} />
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </Card>
  );
}

function ChangeBadge({
  change,
  invert,
}: {
  change: number | null;
  invert?: boolean;
}) {
  if (change == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const positive = change >= 0;
  const good = invert ? !positive : positive;
  const cls = good ? "text-emerald-600" : "text-red-600";
  const arrow = positive ? "▲" : "▼";
  const abs = Math.abs(change);
  const display = abs >= 1000 ? `${Math.round(abs)}%` : `${abs.toFixed(1)}%`;
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {arrow} {display}
    </span>
  );
}
