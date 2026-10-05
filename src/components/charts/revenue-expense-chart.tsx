"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { AXIS_TICK, ChartTooltipCard, compactMoney } from "./chart-theme";

export type MonthPoint = {
  /** Short axis label, e.g. "Mar" */
  label: string;
  /** Long label for the tooltip, e.g. "Mar 2026" */
  title: string;
  revenueCents: number;
  expensesCents: number;
  netCents: number;
};

const SERIES = {
  revenueCents: { name: "Revenue", color: "var(--primary)" },
  expensesCents: { name: "Expenses", color: "var(--danger)" },
  netCents: { name: "Net profit", color: "var(--success)" },
} as const;

function tooltip(currency: string) {
  function MonthTooltip({ active, payload }: TooltipContentProps<number, string>) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as MonthPoint | undefined;
    if (!point) return null;
    const keys = (Object.keys(SERIES) as (keyof typeof SERIES)[]).filter((k) =>
      payload.some((p) => p.dataKey === k),
    );
    return (
      <ChartTooltipCard
        title={point.title}
        currency={currency}
        rows={keys.map((k) => ({ name: SERIES[k].name, value: point[k], color: SERIES[k].color }))}
      />
    );
  }
  return MonthTooltip;
}

function LegendLabel(value: string) {
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

function summary(data: MonthPoint[]) {
  return `Revenue and expenses by month, ${data[0]?.title ?? ""} to ${data.at(-1)?.title ?? ""}.`;
}

/** Dashboard: revenue vs expenses as soft overlapping areas. */
export function RevenueExpenseArea({
  data,
  currency,
  height = 280,
}: {
  data: MonthPoint[];
  currency: string;
  height?: number;
}) {
  const Content = tooltip(currency);
  return (
    <div role="img" aria-label={summary(data)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-revenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-expenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--danger)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={8} />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => compactMoney(v, currency)}
          />
          <Tooltip content={Content} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
          <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} formatter={LegendLabel} />
          <Area
            type="monotone"
            dataKey="revenueCents"
            name={SERIES.revenueCents.name}
            stroke={SERIES.revenueCents.color}
            strokeWidth={2}
            fill="url(#fill-revenue)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
          <Area
            type="monotone"
            dataKey="expensesCents"
            name={SERIES.expensesCents.name}
            stroke={SERIES.expensesCents.color}
            strokeWidth={2}
            fill="url(#fill-expenses)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Reports: monthly revenue and expense bars with a net profit line (one shared axis). */
export function RevenueExpenseBars({
  data,
  currency,
  height = 300,
}: {
  data: MonthPoint[];
  currency: string;
  height?: number;
}) {
  const Content = tooltip(currency);
  return (
    <div role="img" aria-label={summary(data)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={8} />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => compactMoney(v, currency)}
          />
          <Tooltip content={Content} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} formatter={LegendLabel} />
          <Bar
            dataKey="revenueCents"
            name={SERIES.revenueCents.name}
            fill={SERIES.revenueCents.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="expensesCents"
            name={SERIES.expensesCents.name}
            fill={SERIES.expensesCents.color}
            fillOpacity={0.8}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Line
            type="monotone"
            dataKey="netCents"
            name={SERIES.netCents.name}
            stroke={SERIES.netCents.color}
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--success)", strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
