import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, lte, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import { customers, expenses, invoiceItems, invoices, payments, products } from "@/db/schema";
import {
  buildAging,
  buildPnl,
  monthKeys,
  type AgingInvoice,
  type MonthlyAmount,
  type MonthlyCategoryAmount,
} from "@/lib/reports";

/*
 * Report queries. See src/lib/reports.ts for the revenue definition:
 * revenue = payments by payment date (cash basis); invoiced = non-draft, non-void
 * invoice totals by issue date (accrual). All ranges are inclusive YYYY-MM-DD.
 */

/** Invoice statuses that count as "invoiced" (issued and not cancelled). */
export const BILLED_STATUSES = ["sent", "paid"] as const;

export const sumOf = (column: AnyColumn) => sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

/** Cash-basis revenue per YYYY-MM month. */
export async function getRevenueByMonth(from: string, to: string): Promise<MonthlyAmount[]> {
  const month = sql<string>`substr(${payments.date}, 1, 7)`;
  return db
    .select({ month, cents: sumOf(payments.amountCents) })
    .from(payments)
    .where(and(gte(payments.date, from), lte(payments.date, to)))
    .groupBy(month);
}

/** Accrual-basis invoiced totals per YYYY-MM month. */
export async function getInvoicedByMonth(from: string, to: string): Promise<MonthlyAmount[]> {
  const month = sql<string>`substr(${invoices.issueDate}, 1, 7)`;
  return db
    .select({ month, cents: sumOf(invoices.totalCents) })
    .from(invoices)
    .where(
      and(inArray(invoices.status, BILLED_STATUSES), gte(invoices.issueDate, from), lte(invoices.issueDate, to)),
    )
    .groupBy(month);
}

/** Expenses per month and category. */
export async function getExpensesByMonthCategory(from: string, to: string): Promise<MonthlyCategoryAmount[]> {
  const month = sql<string>`substr(${expenses.date}, 1, 7)`;
  return db
    .select({ month, category: expenses.category, cents: sumOf(expenses.amountCents) })
    .from(expenses)
    .where(and(gte(expenses.date, from), lte(expenses.date, to)))
    .groupBy(month, expenses.category);
}

export type ProductSalesRow = {
  productId: number | null;
  name: string;
  sku: string | null;
  units: number;
  revenueCents: number;
  costCents: number;
  grossProfitCents: number;
};

/**
 * Units and line revenue per product on invoices issued in the range (accrual basis,
 * line amounts before invoice-level discount and tax). Cost uses the product's current
 * unit cost. Custom lines without a product are grouped into one row.
 */
export async function getSalesByProduct(from: string, to: string): Promise<ProductSalesRow[]> {
  const revenue = sql<number>`coalesce(sum(${invoiceItems.quantity} * ${invoiceItems.unitPriceCents}), 0)`.mapWith(Number);
  const cost = sql<number>`coalesce(sum(${invoiceItems.quantity} * coalesce(${products.costCents}, 0)), 0)`.mapWith(Number);
  const rows = await db
    .select({
      productId: invoiceItems.productId,
      name: sql<string | null>`max(${products.name})`,
      sku: sql<string | null>`max(${products.sku})`,
      units: sumOf(invoiceItems.quantity),
      revenueCents: revenue,
      costCents: cost,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .where(
      and(inArray(invoices.status, BILLED_STATUSES), gte(invoices.issueDate, from), lte(invoices.issueDate, to)),
    )
    .groupBy(invoiceItems.productId)
    .orderBy(desc(revenue));
  return rows.map((r) => ({
    ...r,
    name: r.name ?? "Custom line items",
    grossProfitCents: r.revenueCents - r.costCents,
  }));
}

export type CustomerSalesRow = {
  customerId: number;
  name: string;
  company: string | null;
  invoiceCount: number;
  invoicedCents: number;
  paidCents: number;
};

/** Per customer: invoices issued in the range (accrual) and payments received in the range (cash). */
export async function getSalesByCustomer(from: string, to: string): Promise<CustomerSalesRow[]> {
  const [billed, paid] = await Promise.all([
    db
      .select({
        customerId: invoices.customerId,
        invoiceCount: sql<number>`count(*)`.mapWith(Number),
        invoicedCents: sumOf(invoices.totalCents),
      })
      .from(invoices)
      .where(
        and(inArray(invoices.status, BILLED_STATUSES), gte(invoices.issueDate, from), lte(invoices.issueDate, to)),
      )
      .groupBy(invoices.customerId),
    db
      .select({ customerId: invoices.customerId, paidCents: sumOf(payments.amountCents) })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(and(gte(payments.date, from), lte(payments.date, to)))
      .groupBy(invoices.customerId),
  ]);

  const ids = [...new Set([...billed.map((b) => b.customerId), ...paid.map((p) => p.customerId)])];
  if (ids.length === 0) return [];
  const names = await db
    .select({ id: customers.id, name: customers.name, company: customers.company })
    .from(customers)
    .where(inArray(customers.id, ids));

  const billedBy = new Map(billed.map((b) => [b.customerId, b]));
  const paidBy = new Map(paid.map((p) => [p.customerId, p.paidCents]));
  return names
    .map((c) => ({
      customerId: c.id,
      name: c.name,
      company: c.company,
      invoiceCount: billedBy.get(c.id)?.invoiceCount ?? 0,
      invoicedCents: billedBy.get(c.id)?.invoicedCents ?? 0,
      paidCents: paidBy.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.paidCents - a.paidCents || b.invoicedCents - a.invoicedCents);
}

/** Open (sent, unpaid balance) invoices for the A/R aging report. */
export async function getOpenReceivables(): Promise<AgingInvoice[]> {
  return db
    .select({
      customerId: invoices.customerId,
      customerName: customers.name,
      dueDate: invoices.dueDate,
      balanceCents: sql<number>`${invoices.totalCents} - ${invoices.amountPaidCents}`.mapWith(Number),
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.status, "sent"), gt(invoices.totalCents, invoices.amountPaidCents)))
    .orderBy(asc(invoices.dueDate));
}

/** Monthly P&L for an inclusive range (cash-basis revenue). */
export async function getPnl(from: string, to: string) {
  const [revenue, spend] = await Promise.all([getRevenueByMonth(from, to), getExpensesByMonthCategory(from, to)]);
  return buildPnl(monthKeys(from, to), revenue, spend);
}

/** A/R aging snapshot by customer as of a date. */
export async function getAging(asOf: string) {
  return buildAging(await getOpenReceivables(), asOf);
}
