/**
 * Demo tasks: ~25 small-business to-dos spread across the board, assigned to the seeded users,
 * some linked to existing customers and some overdue. Deterministic (seeded PRNG).
 */
import { asc, count } from "drizzle-orm";
import { db } from "../../src/db";
import { customers, tasks, users, type TaskPriority, type TaskStatus } from "../../src/db/schema";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
function daysFromToday(days: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * `{customer}` in a title links the task to a customer (and is replaced by its name).
 * `due` is days from today (negative = past); null means no due date.
 */
type Template = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: number | null;
  description?: string;
};

const TEMPLATES: Template[] = [
  // To do (several overdue)
  { title: "Follow up with {customer} on overdue invoice", status: "todo", priority: "high", due: -4, description: "Second reminder. Offer to split into two payments if needed." },
  { title: "Prepare Q3 tax filing", status: "todo", priority: "high", due: 9, description: "Gather expense receipts and send the P&L to the accountant." },
  { title: "Reorder packing tape", status: "todo", priority: "low", due: 3 },
  { title: "Send quote for bulk order to {customer}", status: "todo", priority: "high", due: -1 },
  { title: "Renew business insurance policy", status: "todo", priority: "medium", due: 18 },
  { title: "Schedule quarterly check-in with {customer}", status: "todo", priority: "medium", due: 7 },
  { title: "Update product photos on the website", status: "todo", priority: "low", due: null },
  { title: "Reconcile September bank statement", status: "todo", priority: "medium", due: -6 },
  { title: "Collect W-9 from new contractor", status: "todo", priority: "medium", due: 5 },
  { title: "Draft holiday promotion email", status: "todo", priority: "low", due: 21 },
  // In progress
  { title: "Onboard {customer} to monthly billing", status: "in_progress", priority: "high", due: 2, description: "Set up recurring invoice and confirm billing contact." },
  { title: "Negotiate new rates with shipping carrier", status: "in_progress", priority: "medium", due: 12 },
  { title: "Fix damaged-goods claim for {customer}", status: "in_progress", priority: "high", due: -2 },
  { title: "Annual inventory count — warehouse aisle B", status: "in_progress", priority: "medium", due: 4 },
  { title: "Interview candidates for part-time packer", status: "in_progress", priority: "low", due: 10 },
  { title: "Migrate supplier contacts into BizDesk", status: "in_progress", priority: "low", due: null },
  // Done
  { title: "Call {customer} about delivery window", status: "done", priority: "medium", due: -9 },
  { title: "Pay quarterly estimated taxes", status: "done", priority: "high", due: -20 },
  { title: "Set up Google Workspace for new hire", status: "done", priority: "low", due: -15 },
  { title: "Send thank-you gift to {customer}", status: "done", priority: "low", due: -30 },
  { title: "Replace warehouse barcode scanner", status: "done", priority: "medium", due: -12 },
  { title: "File sales tax return", status: "done", priority: "high", due: -25 },
  { title: "Approve marketing budget for Q4", status: "done", priority: "medium", due: -5 },
  { title: "Resolve billing question from {customer}", status: "done", priority: "medium", due: -3 },
  { title: "Restock printer paper and toner", status: "done", priority: "low", due: -8 },
];

export async function seedTasks(): Promise<void> {
  const [{ value: existing }] = await db.select({ value: count() }).from(tasks);
  if (existing > 0) {
    console.log(`  tasks: ${existing} already present, skipping`);
    return;
  }

  const rand = mulberry32(20260415);
  const userIds = (await db.select({ id: users.id }).from(users).orderBy(asc(users.id))).map((u) => u.id);
  const customerRows = await db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(asc(customers.id));

  const positions: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 };
  const rows = TEMPLATES.map((t, i) => {
    const linksCustomer = t.title.includes("{customer}");
    const customer = linksCustomer && customerRows.length ? customerRows[Math.floor(rand() * customerRows.length)]! : null;
    const title = t.title.replace("{customer}", customer?.name ?? "a key account");
    // Mostly round-robin across users, with the occasional unassigned task.
    const assigneeId = userIds.length && rand() > 0.08 ? userIds[i % userIds.length]! : null;
    const createdDaysAgo = Math.max(1, (t.due === null ? 10 : Math.max(0, -t.due)) + 3 + Math.floor(rand() * 14));
    return {
      title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      dueDate: t.due === null ? null : daysFromToday(t.due),
      assigneeId,
      customerId: customer?.id ?? null,
      position: positions[t.status]++,
      createdBy: userIds[0] ?? null,
      createdAt: `${daysFromToday(-createdDaysAgo)}T15:00:00.000Z`,
    };
  });

  await db.insert(tasks).values(rows);
  console.log(`  tasks: ${rows.length} inserted`);
}
