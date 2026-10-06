import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, customers, expenses, invoices, payments, products, tasks, users } from "@/db/schema";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/reports";
import { sumOf } from "./reports";

/*
 * Dashboard queries. Revenue is cash basis (payments by payment date); see src/lib/reports.ts.
 */

async function paymentsBetween(from: string, to: string) {
  const [row] = await db
    .select({ cents: sumOf(payments.amountCents) })
    .from(payments)
    .where(and(gte(payments.date, from), lte(payments.date, to)));
  return row?.cents ?? 0;
}

export type DashboardKpis = {
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  invoicedThisMonthCents: number;
  expensesThisMonthCents: number;
  outstandingCents: number;
  openInvoiceCount: number;
  overdueCents: number;
  overdueCount: number;
  lowStockCount: number;
};

export async function getDashboardKpis(today: string): Promise<DashboardKpis> {
  const monthStart = startOfMonth(today);
  // Month-to-date, the same window as Reports "This month", so the two always agree.
  const monthEnd = today;
  const lastMonthStart = `${addMonths(today.slice(0, 7), -1)}-01`;
  const lastMonthEnd = endOfMonth(lastMonthStart);
  const balance = sql`${invoices.totalCents} - ${invoices.amountPaidCents}`;

  const [revenueThisMonthCents, revenueLastMonthCents, [invoiced], [spent], [ar], [overdue], [lowStock]] =
    await Promise.all([
      paymentsBetween(monthStart, monthEnd),
      paymentsBetween(lastMonthStart, lastMonthEnd),
      db
        .select({ cents: sumOf(invoices.totalCents) })
        .from(invoices)
        .where(
          and(
            inArray(invoices.status, ["sent", "paid"]),
            gte(invoices.issueDate, monthStart),
            lte(invoices.issueDate, monthEnd),
          ),
        ),
      db
        .select({ cents: sumOf(expenses.amountCents) })
        .from(expenses)
        .where(and(gte(expenses.date, monthStart), lte(expenses.date, monthEnd))),
      db
        .select({
          cents: sql<number>`coalesce(sum(${balance}), 0)`.mapWith(Number),
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(invoices)
        .where(and(eq(invoices.status, "sent"), gt(invoices.totalCents, invoices.amountPaidCents))),
      db
        .select({
          cents: sql<number>`coalesce(sum(${balance}), 0)`.mapWith(Number),
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(invoices)
        .where(
          and(eq(invoices.status, "sent"), gt(invoices.totalCents, invoices.amountPaidCents), lt(invoices.dueDate, today)),
        ),
      db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(products)
        .where(
          and(
            eq(products.archived, false),
            eq(products.isService, false),
            lte(products.stock, products.reorderLevel),
          ),
        ),
    ]);

  return {
    revenueThisMonthCents,
    revenueLastMonthCents,
    invoicedThisMonthCents: invoiced?.cents ?? 0,
    expensesThisMonthCents: spent?.cents ?? 0,
    outstandingCents: ar?.cents ?? 0,
    openInvoiceCount: ar?.count ?? 0,
    overdueCents: overdue?.cents ?? 0,
    overdueCount: overdue?.count ?? 0,
    lowStockCount: lowStock?.count ?? 0,
  };
}

export async function getRecentInvoices(limit = 5) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      customerName: customers.name,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .orderBy(desc(invoices.issueDate), desc(invoices.id))
    .limit(limit);
}

/** Top customers by cash received since `from`. */
export async function getTopCustomers(from: string, limit = 5) {
  const total = sumOf(payments.amountCents);
  return db
    .select({ id: customers.id, name: customers.name, company: customers.company, revenueCents: total })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(gte(payments.date, from))
    .groupBy(customers.id)
    .orderBy(desc(total))
    .limit(limit);
}

/** The user's unfinished tasks, soonest due first (undated last). */
export async function getMyOpenTasks(userId: number, limit = 5) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      customerId: tasks.customerId,
      customerName: customers.name,
    })
    .from(tasks)
    .leftJoin(customers, eq(tasks.customerId, customers.id))
    .where(and(eq(tasks.assigneeId, userId), ne(tasks.status, "done")))
    .orderBy(sql`${tasks.dueDate} is null`, asc(tasks.dueDate), desc(tasks.id))
    .limit(limit);
}

export async function getRecentActivity(limit = 10) {
  return db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      summary: activityLog.summary,
      createdAt: activityLog.createdAt,
      userName: users.name,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    // Sign-ins are noise on the dashboard feed.
    .where(ne(activityLog.action, "user.login"))
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(limit);
}
