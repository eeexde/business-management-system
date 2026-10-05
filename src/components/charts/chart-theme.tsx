import type { ExpenseCategory } from "@/db/schema";
import { formatMoney } from "@/lib/utils";

/**
 * Categorical chart palette, defined as CSS variables on the chart wrapper so light and
 * dark each get their own validated steps (fixed order; color follows the entity).
 */
export const CHART_PALETTE_CLASS = [
  "[--chart-1:#2a78d6] [--chart-2:#eb6834] [--chart-3:#1baf7a] [--chart-4:#eda100]",
  "[--chart-5:#e87ba4] [--chart-6:#008300] [--chart-7:#4a3aa7] [--chart-8:#e34948]",
  "dark:[--chart-1:#3987e5] dark:[--chart-2:#d95926] dark:[--chart-3:#199e70] dark:[--chart-4:#c98500]",
  "dark:[--chart-5:#d55181] dark:[--chart-6:#008300] dark:[--chart-7:#9085e9] dark:[--chart-8:#e66767]",
].join(" ");

/** Each expense category always gets the same color; "other" is neutral. */
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  rent: "var(--chart-1)",
  payroll: "var(--chart-2)",
  utilities: "var(--chart-3)",
  supplies: "var(--chart-4)",
  marketing: "var(--chart-5)",
  software: "var(--chart-6)",
  travel: "var(--chart-7)",
  inventory: "var(--chart-8)",
  other: "var(--muted-foreground)",
};

export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

/** Short axis labels, e.g. 1234500 cents -> "$12K". */
export function compactMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export type TooltipRow = { name: string; value: number; color: string };

/** Themed tooltip body shared by all charts. Values are cents. */
export function ChartTooltipCard({
  title,
  rows,
  currency,
}: {
  title?: string;
  rows: TooltipRow[];
  currency: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-40 rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      {title && <p className="mb-1.5 font-medium text-foreground">{title}</p>}
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />
              {r.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">{formatMoney(r.value, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
