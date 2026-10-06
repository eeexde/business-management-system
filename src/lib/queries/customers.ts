import "server-only";
import { and, asc, count, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import { contains } from "@/lib/sql-search";
import { db } from "@/db";
import { customers, invoices, tasks, users } from "@/db/schema";

export const CUSTOMERS_PAGE_SIZE = 25;

/** Per-customer invoice aggregates. Revenue = paid amounts on non-void invoices; outstanding = open balance on sent invoices. */
function invoiceStatsSubquery() {
  return db
    .select({
      customerId: invoices.customerId,
      invoiceCount: count().as("invoice_count"),
      revenueCents:
        sql<number>`sum(case when ${invoices.status} <> 'void' then ${invoices.amountPaidCents} else 0 end)`.as(
          "revenue_cents",
        ),
      outstandingCents: sql<number>`sum(case when ${invoices.status} = 'sent'
          then max(${invoices.totalCents} - ${invoices.amountPaidCents}, 0) else 0 end)`.as("outstanding_cents"),
    })
    .from(invoices)
    .groupBy(invoices.customerId)
    .as("invoice_stats");
}

function searchFilter(q: string | undefined): SQL | undefined {
  if (!q) return undefined;
  return or(contains(customers.name, q), contains(customers.company, q), contains(customers.email, q));
}

export async function listCustomers({ q, page = 1 }: { q?: string; page?: number }) {
  const stats = invoiceStatsSubquery();
  const where = searchFilter(q);
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        company: customers.company,
        email: customers.email,
        phone: customers.phone,
        invoiceCount: sql<number>`coalesce(${stats.invoiceCount}, 0)`,
        revenueCents: sql<number>`coalesce(${stats.revenueCents}, 0)`,
        outstandingCents: sql<number>`coalesce(${stats.outstandingCents}, 0)`,
      })
      .from(customers)
      .leftJoin(stats, eq(stats.customerId, customers.id))
      .where(where)
      .orderBy(asc(customers.name), asc(customers.id))
      .limit(CUSTOMERS_PAGE_SIZE)
      .offset((page - 1) * CUSTOMERS_PAGE_SIZE),
    db.select({ total: count() }).from(customers).where(where),
  ]);
  return { rows, total: totalRow?.total ?? 0 };
}

export async function getCustomer(id: number) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row ?? null;
}

export async function getCustomerStats(id: number) {
  const [row] = await db
    .select({
      invoiceCount: count(),
      revenueCents: sql<number>`coalesce(sum(case when ${invoices.status} <> 'void' then ${invoices.amountPaidCents} else 0 end), 0)`,
      outstandingCents: sql<number>`coalesce(sum(case when ${invoices.status} = 'sent'
          then max(${invoices.totalCents} - ${invoices.amountPaidCents}, 0) else 0 end), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.customerId, id));
  return row ?? { invoiceCount: 0, revenueCents: 0, outstandingCents: 0 };
}

export async function getCustomerInvoices(id: number) {
  return db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
    })
    .from(invoices)
    .where(eq(invoices.customerId, id))
    .orderBy(desc(invoices.issueDate), desc(invoices.id));
}

/** Tasks linked to the customer that aren't done, soonest due first (undated last). */
export async function getCustomerOpenTasks(id: number) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      assigneeName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.customerId, id), ne(tasks.status, "done")))
    .orderBy(sql`${tasks.dueDate} is null`, asc(tasks.dueDate), asc(tasks.id));
}

export async function countCustomerInvoices(id: number) {
  const [row] = await db.select({ n: count() }).from(invoices).where(eq(invoices.customerId, id));
  return row?.n ?? 0;
}
