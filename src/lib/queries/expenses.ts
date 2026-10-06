import "server-only";
import { and, desc, eq, gte, lt, or, sql, sum, type SQL } from "drizzle-orm";
import { contains } from "@/lib/sql-search";
import { db } from "@/db";
import { EXPENSE_CATEGORIES, expenses, type ExpenseCategory } from "@/db/schema";
import { addMonths, isMonthKey, monthKey, monthRange, type CategoryTotal } from "@/lib/expenses";

export const EXPENSES_PAGE_SIZE = 25;

export type ExpenseFilters = {
  q?: string;
  category?: ExpenseCategory;
  /** YYYY-MM */
  month?: string;
};

/** Normalise raw search params into filters, dropping anything invalid. */
export function parseExpenseFilters(params: Record<string, string | string[] | undefined>): ExpenseFilters {
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string).trim() : undefined);
  const q = pick("q");
  const category = pick("category");
  const month = pick("month");
  return {
    q: q || undefined,
    category: (EXPENSE_CATEGORIES as readonly string[]).includes(category ?? "")
      ? (category as ExpenseCategory)
      : undefined,
    month: isMonthKey(month) ? month : undefined,
  };
}

function whereFor(filters: ExpenseFilters, { ignoreCategory = false } = {}) {
  const conditions: SQL[] = [];
  if (filters.q) {
    conditions.push(or(contains(expenses.description, filters.q), contains(expenses.vendor, filters.q))!);
  }
  if (filters.category && !ignoreCategory) conditions.push(eq(expenses.category, filters.category));
  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    conditions.push(gte(expenses.date, start), lt(expenses.date, end));
  }
  return conditions.length ? and(...conditions) : undefined;
}

/** One page of expenses plus the count and total of everything matching the filters. */
export async function listExpenses(filters: ExpenseFilters, page = 1) {
  const where = whereFor(filters);
  const [rows, [summary]] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.date), desc(expenses.id))
      .limit(EXPENSES_PAGE_SIZE)
      .offset((page - 1) * EXPENSES_PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)`, totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)` })
      .from(expenses)
      .where(where),
  ]);
  return { rows, count: Number(summary?.count ?? 0), totalCents: Number(summary?.totalCents ?? 0) };
}

/** Every expense matching the filters (for CSV export), newest first. */
export async function listAllExpenses(filters: ExpenseFilters) {
  return db
    .select()
    .from(expenses)
    .where(whereFor(filters))
    .orderBy(desc(expenses.date), desc(expenses.id));
}

export async function getExpense(id: number) {
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return row ?? null;
}

async function totalsByCategory(where: SQL | undefined): Promise<CategoryTotal[]> {
  const rows = await db
    .select({ category: expenses.category, totalCents: sum(expenses.amountCents) })
    .from(expenses)
    .where(where)
    .groupBy(expenses.category);
  return rows.map((r) => ({ category: r.category, totalCents: Number(r.totalCents ?? 0) }));
}

/** Category totals for the filtered period. Ignores the category filter so the whole mix stays visible. */
export function getCategoryTotals(filters: ExpenseFilters) {
  return totalsByCategory(whereFor(filters, { ignoreCategory: true }));
}

/** This month vs last month, plus this month's category totals. */
export async function getMonthComparison(today: string) {
  const thisMonth = monthKey(today);
  const lastMonth = addMonths(thisMonth, -1);
  const total = async (month: string) => {
    const { start, end } = monthRange(month);
    const [row] = await db
      .select({ totalCents: sum(expenses.amountCents) })
      .from(expenses)
      .where(and(gte(expenses.date, start), lt(expenses.date, end)));
    return Number(row?.totalCents ?? 0);
  };
  const { start, end } = monthRange(thisMonth);
  const [thisMonthCents, lastMonthCents, categories] = await Promise.all([
    total(thisMonth),
    total(lastMonth),
    totalsByCategory(and(gte(expenses.date, start), lt(expenses.date, end))),
  ]);
  return { thisMonth, lastMonth, thisMonthCents, lastMonthCents, categories };
}
