import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/db/schema";
import { AGING_BUCKETS, agingBucket, type AgingBucket } from "./invoices";

/*
 * Reporting math (pure, unit-tested). SQL lives in src/lib/queries/reports.ts.
 *
 * Revenue definition, used everywhere in the app (dashboard, reports, CSV):
 * - "Revenue" is CASH BASIS: the sum of payments.amountCents, bucketed by payment date.
 * - "Invoiced" is ACCRUAL: the sum of invoices.totalCents for non-draft, non-void
 *   invoices, bucketed by issue date. Shown alongside revenue where useful.
 * Expenses are bucketed by expense date. Net = revenue - expenses.
 */

export const RANGE_KEYS = ["this-month", "last-month", "this-quarter", "ytd", "last-12-months", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-quarter": "This quarter",
  ytd: "Year to date",
  "last-12-months": "Last 12 months",
  custom: "Custom range",
};

export const DEFAULT_RANGE: RangeKey = "last-12-months";

/** Inclusive date range, both YYYY-MM-DD. */
export type DateRange = { key: RangeKey; from: string; to: string };

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Build YYYY-MM-DD from possibly out-of-range parts (e.g. month 0 or day 0 roll over). */
function isoFromParts(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function parts(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parts(value);
  return isoFromParts(y, m, d) === value;
}

export function startOfMonth(date: string) {
  const { y, m } = parts(date);
  return isoFromParts(y, m, 1);
}

export function endOfMonth(date: string) {
  const { y, m } = parts(date);
  return isoFromParts(y, m + 1, 0);
}

/** Shift a YYYY-MM month key by n months. */
export function addMonths(month: string, n: number) {
  const { y, m } = parts(`${month}-01`);
  return isoFromParts(y, m + n, 1).slice(0, 7);
}

/**
 * Resolve a `?range=` value into concrete dates. Current periods end today; past periods
 * cover full months. Unknown or invalid input falls back to the default range, and a
 * reversed custom range is swapped.
 */
export function resolveRange(
  range: string | undefined,
  today: string,
  custom: { from?: string; to?: string } = {},
): DateRange {
  const key = (RANGE_KEYS as readonly string[]).includes(range ?? "") ? (range as RangeKey) : DEFAULT_RANGE;
  const { y, m } = parts(today);
  switch (key) {
    case "this-month":
      return { key, from: isoFromParts(y, m, 1), to: today };
    case "last-month":
      return { key, from: isoFromParts(y, m - 1, 1), to: isoFromParts(y, m, 0) };
    case "this-quarter":
      return { key, from: isoFromParts(y, Math.floor((m - 1) / 3) * 3 + 1, 1), to: today };
    case "ytd":
      return { key, from: isoFromParts(y, 1, 1), to: today };
    case "custom": {
      if (!isIsoDate(custom.from) || !isIsoDate(custom.to)) return resolveRange(DEFAULT_RANGE, today);
      const [from, to] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
      return { key, from, to };
    }
    case "last-12-months":
    default:
      return { key: "last-12-months", from: isoFromParts(y, m - 11, 1), to: today };
  }
}

/** Every YYYY-MM month touched by an inclusive date range, in order. */
export function monthKeys(from: string, to: string): string[] {
  if (from > to) return [];
  const keys: string[] = [];
  const last = to.slice(0, 7);
  for (let k = from.slice(0, 7); k <= last; k = addMonths(k, 1)) keys.push(k);
  return keys;
}

/** "2026-03" -> "Mar" or "Mar 2026". */
export function monthLabel(month: string, withYear = false) {
  const { y, m } = parts(`${month}-01`);
  const name = MONTH_NAMES[m - 1] ?? month;
  return withYear ? `${name} ${y}` : name;
}

/** Percent change from previous to current, one decimal. Null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** Net margin as a percent of revenue, one decimal. Null when revenue is zero. */
export function marginPct(revenueCents: number, netCents: number): number | null {
  if (revenueCents === 0) return null;
  return Math.round((netCents / revenueCents) * 1000) / 10;
}

export function categoryLabel(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Profit & loss

export type MonthlyAmount = { month: string; cents: number };
export type MonthlyCategoryAmount = { month: string; category: ExpenseCategory; cents: number };

export type PnlFigures = {
  revenueCents: number;
  expensesCents: number;
  byCategory: Record<ExpenseCategory, number>;
  netCents: number;
  marginPct: number | null;
};
export type PnlRow = PnlFigures & { month: string };
export type Pnl = {
  rows: PnlRow[];
  totals: PnlFigures;
  /** Categories with any spend in the period, in canonical order. */
  categories: ExpenseCategory[];
};

function emptyCategories(): Record<ExpenseCategory, number> {
  return Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<ExpenseCategory, number>;
}

function finish(fig: Omit<PnlFigures, "netCents" | "marginPct">): PnlFigures {
  const netCents = fig.revenueCents - fig.expensesCents;
  return { ...fig, netCents, marginPct: marginPct(fig.revenueCents, netCents) };
}

/**
 * Monthly P&L. One row per month key (zero-filled); amounts for months outside
 * `months` are ignored. Revenue is cash basis (see top of file).
 */
export function buildPnl(months: string[], revenue: MonthlyAmount[], expenses: MonthlyCategoryAmount[]): Pnl {
  const acc = new Map(months.map((month) => [month, { revenueCents: 0, expensesCents: 0, byCategory: emptyCategories() }]));
  for (const r of revenue) {
    const row = acc.get(r.month);
    if (row) row.revenueCents += r.cents;
  }
  for (const e of expenses) {
    const row = acc.get(e.month);
    if (!row) continue;
    row.expensesCents += e.cents;
    row.byCategory[e.category] += e.cents;
  }

  const rows = months.map((month) => ({ month, ...finish(acc.get(month)!) }));
  const totalsByCategory = emptyCategories();
  for (const row of rows) for (const c of EXPENSE_CATEGORIES) totalsByCategory[c] += row.byCategory[c];
  const totals = finish({
    revenueCents: rows.reduce((s, r) => s + r.revenueCents, 0),
    expensesCents: rows.reduce((s, r) => s + r.expensesCents, 0),
    byCategory: totalsByCategory,
  });
  return { rows, totals, categories: EXPENSE_CATEGORIES.filter((c) => totalsByCategory[c] !== 0) };
}

// ---------------------------------------------------------------------------
// Expense breakdown

export type CategorySlice = { category: ExpenseCategory; cents: number; pct: number };

/** Share of spend per category (largest first, zero categories dropped, pct to one decimal). */
export function categoryBreakdown(rows: { category: ExpenseCategory; cents: number }[]): CategorySlice[] {
  const totals = emptyCategories();
  for (const r of rows) totals[r.category] += r.cents;
  const sum = EXPENSE_CATEGORIES.reduce((s, c) => s + totals[c], 0);
  return EXPENSE_CATEGORIES.filter((c) => totals[c] > 0)
    .map((category) => ({
      category,
      cents: totals[category],
      pct: sum === 0 ? 0 : Math.round((totals[category] / sum) * 1000) / 10,
    }))
    .sort((a, b) => b.cents - a.cents);
}

// ---------------------------------------------------------------------------
// A/R aging

export type AgingInvoice = { customerId: number; customerName: string; dueDate: string; balanceCents: number };
export type AgingRow = {
  customerId: number;
  customerName: string;
  buckets: Record<AgingBucket, number>;
  totalCents: number;
};
export type Aging = { rows: AgingRow[]; totals: Record<AgingBucket, number>; totalCents: number };

function emptyBuckets(): Record<AgingBucket, number> {
  return Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;
}

/** Group open balances by customer and aging bucket as of a date. Largest balances first. */
export function buildAging(invoices: AgingInvoice[], asOf: string): Aging {
  const byCustomer = new Map<number, AgingRow>();
  const totals = emptyBuckets();
  for (const inv of invoices) {
    if (inv.balanceCents <= 0) continue;
    const bucket = agingBucket(inv.dueDate, asOf);
    let row = byCustomer.get(inv.customerId);
    if (!row) {
      row = { customerId: inv.customerId, customerName: inv.customerName, buckets: emptyBuckets(), totalCents: 0 };
      byCustomer.set(inv.customerId, row);
    }
    row.buckets[bucket] += inv.balanceCents;
    row.totalCents += inv.balanceCents;
    totals[bucket] += inv.balanceCents;
  }
  const rows = [...byCustomer.values()].sort(
    (a, b) => b.totalCents - a.totalCents || a.customerName.localeCompare(b.customerName),
  );
  return { rows, totals, totalCents: rows.reduce((s, r) => s + r.totalCents, 0) };
}

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};
