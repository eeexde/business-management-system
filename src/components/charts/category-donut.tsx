"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps } from "recharts";
import type { CategorySlice } from "@/lib/reports";
import { categoryLabel } from "@/lib/reports";
import { formatMoney } from "@/lib/utils";
import { CATEGORY_COLORS, CHART_PALETTE_CLASS, ChartTooltipCard } from "./chart-theme";

/** Expense share by category: donut with the total in the middle and a legend with values. */
export function CategoryDonut({ slices, currency }: { slices: CategorySlice[]; currency: string }) {
  const total = slices.reduce((s, c) => s + c.cents, 0);

  function SliceTooltip({ active, payload }: TooltipContentProps<number, string>) {
    const slice = payload?.[0]?.payload as CategorySlice | undefined;
    if (!active || !slice) return null;
    return (
      <ChartTooltipCard
        currency={currency}
        rows={[{ name: `${categoryLabel(slice.category)} · ${slice.pct}%`, value: slice.cents, color: CATEGORY_COLORS[slice.category] }]}
      />
    );
  }

  return (
    <div className={`${CHART_PALETTE_CLASS} grid items-center gap-6 sm:grid-cols-[minmax(0,220px)_1fr]`}>
      <div className="relative mx-auto h-[220px] w-full max-w-[220px]" role="img" aria-label="Expenses by category">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="cents"
              nameKey="category"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={1}
              cornerRadius={3}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.category} fill={CATEGORY_COLORS[s.category]} />
              ))}
            </Pie>
            <Tooltip content={SliceTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(total, currency)}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.category} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[s.category] }} aria-hidden />
            <span className="flex-1 truncate">{categoryLabel(s.category)}</span>
            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{s.pct}%</span>
            <span className="w-24 text-right font-medium tabular-nums">{formatMoney(s.cents, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
