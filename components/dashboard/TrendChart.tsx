"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { TrendPoint } from "@/lib/metrics/types";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  yAxisId?: "left" | "right";
}

interface TrendChartProps {
  data: TrendPoint[];
  series: TrendSeries[];
  height?: number;
}

export function TrendChart({ data, series, height = 240 }: TrendChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        No trend data for this period.
      </div>
    );
  }
  const hasRight = series.some((s) => s.yAxisId === "right");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        {hasRight ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
        ) : null}
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            yAxisId={s.yAxisId ?? "left"}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
