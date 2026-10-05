import type { ExpenseCategory } from "@/db/schema";

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  rent: "Rent",
  payroll: "Payroll",
  utilities: "Utilities",
  supplies: "Supplies",
  marketing: "Marketing",
  software: "Software",
  travel: "Travel",
  inventory: "Inventory",
  other: "Other",
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True for a "YYYY-MM" string. */
export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** "2026-03-07" -> "2026-03". */
export function monthKey(date: string) {
  return date.slice(0, 7);
}

/** Shift a "YYYY-MM" month by n months (negative goes back). */
export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Date range for a month as [start, end) YYYY-MM-DD strings, suitable for `date >= start AND date < end`. */
export function monthRange(month: string) {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` };
}

/** "2026-03" -> "Mar 2026". */
export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** The current month and the n - 1 before it, newest first, as select options. */
export function recentMonths(today: string, n = 12) {
  const current = monthKey(today);
  return Array.from({ length: n }, (_, i) => {
    const value = addMonths(current, -i);
    return { value, label: formatMonth(value) };
  });
}

/** Percent change from previous to current, or null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export type CategoryTotal = { category: ExpenseCategory; totalCents: number };

/** Sort category totals descending and attach each one's share of the whole (0–100). */
export function categoryBreakdown(totals: readonly CategoryTotal[]) {
  const sum = totals.reduce((acc, t) => acc + t.totalCents, 0);
  return totals
    .filter((t) => t.totalCents > 0)
    .map((t) => ({ ...t, share: sum === 0 ? 0 : (t.totalCents / sum) * 100 }))
    .sort((a, b) => b.totalCents - a.totalCents || a.category.localeCompare(b.category));
}
