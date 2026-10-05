/**
 * Demo activity feed: ~30 entries over the last 2 weeks that reference real invoices,
 * customers, expenses and tasks (any type with no rows is skipped). Deterministic order and
 * content (seeded PRNG); timestamps are relative to now. Skips when the feed already has
 * entries other than sign-ins.
 */
import { count, desc, eq, ne } from "drizzle-orm";
import { db } from "../../src/db";
import { activityLog, customers, expenses, invoices, tasks, users } from "../../src/db/schema";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261005);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

type Entry = {
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
};

export async function seedActivity(): Promise<void> {
  const [existing] = await db
    .select({ n: count() })
    .from(activityLog)
    .where(ne(activityLog.action, "user.login"));
  if ((existing?.n ?? 0) > 0) {
    console.log("activity: already seeded, skipping");
    return;
  }

  const [team, recentInvoices, someCustomers, recentExpenses, doneTasks] = await Promise.all([
    db.select({ id: users.id }).from(users),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        totalCents: invoices.totalCents,
        amountPaidCents: invoices.amountPaidCents,
        customerName: customers.name,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .orderBy(desc(invoices.issueDate))
      .limit(20),
    db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(desc(customers.id)).limit(15),
    db
      .select({ id: expenses.id, description: expenses.description, amountCents: expenses.amountCents })
      .from(expenses)
      .orderBy(desc(expenses.date))
      .limit(15),
    db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.status, "done"))
      .orderBy(desc(tasks.id))
      .limit(10),
  ]);
  if (team.length === 0) {
    console.log("activity: no users, skipping");
    return;
  }
  const actor = () => pick(team).id;

  // Each generator produces one plausible entry for its entity type.
  const generators: (() => Entry)[] = [];
  if (recentInvoices.length) {
    generators.push(
      () => {
        const inv = pick(recentInvoices);
        return {
          userId: actor(),
          action: "invoice.created",
          entityType: "invoice",
          entityId: inv.id,
          summary: `Created invoice ${inv.number} for ${inv.customerName}`,
        };
      },
      () => {
        const inv = pick(recentInvoices);
        return {
          userId: actor(),
          action: "invoice.sent",
          entityType: "invoice",
          entityId: inv.id,
          summary: `Sent invoice ${inv.number} to ${inv.customerName}`,
        };
      },
    );
    const paid = recentInvoices.filter((i) => i.amountPaidCents > 0);
    if (paid.length) {
      generators.push(() => {
        const inv = pick(paid);
        return {
          userId: actor(),
          action: "payment.recorded",
          entityType: "invoice",
          entityId: inv.id,
          summary: `Recorded payment of ${money(inv.amountPaidCents)} on ${inv.number}`,
        };
      });
    }
  }
  if (someCustomers.length) {
    generators.push(
      () => {
        const c = pick(someCustomers);
        return { userId: actor(), action: "customer.created", entityType: "customer", entityId: c.id, summary: `Added customer ${c.name}` };
      },
      () => {
        const c = pick(someCustomers);
        return {
          userId: actor(),
          action: "customer.updated",
          entityType: "customer",
          entityId: c.id,
          summary: `Updated contact details for ${c.name}`,
        };
      },
    );
  }
  if (recentExpenses.length) {
    generators.push(() => {
      const e = pick(recentExpenses);
      return {
        userId: actor(),
        action: "expense.created",
        entityType: "expense",
        entityId: e.id,
        summary: `Logged expense "${e.description}" (${money(e.amountCents)})`,
      };
    });
  }
  if (doneTasks.length) {
    generators.push(() => {
      const t = pick(doneTasks);
      return { userId: actor(), action: "task.completed", entityType: "task", entityId: t.id, summary: `Completed task "${t.title}"` };
    });
  }
  if (generators.length === 0) {
    console.log("activity: no business data yet, skipping");
    return;
  }

  // ~30 entries spread over the last 14 days, oldest first.
  const now = Date.now();
  const rows = Array.from({ length: 30 }, () => {
    const minutesAgo = int(0, 13) * 1440 + int(0, 9) * 60 + int(0, 59);
    return { ...pick(generators)(), createdAt: new Date(now - minutesAgo * 60_000 - 5 * 60_000).toISOString() };
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  await db.insert(activityLog).values(rows);
  console.log(`activity: ${rows.length} entries`);
}
