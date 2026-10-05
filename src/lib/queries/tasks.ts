import "server-only";
import { and, asc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, TASK_PRIORITIES, tasks, users, type TaskPriority } from "@/db/schema";

export type TaskFilters = {
  /** A user id, or "unassigned" */
  assignee?: number | "unassigned";
  priority?: TaskPriority;
};

/**
 * Normalise search params into filters. `?assignee=me` resolves to the current user's id;
 * anything invalid is dropped.
 */
export function parseTaskFilters(
  params: Record<string, string | string[] | undefined>,
  currentUserId: number,
): TaskFilters {
  const assignee = typeof params.assignee === "string" ? params.assignee : undefined;
  const priority = typeof params.priority === "string" ? params.priority : undefined;
  const assigneeId = assignee === "me" ? currentUserId : Number(assignee);
  return {
    assignee:
      assignee === "unassigned" ? "unassigned" : Number.isInteger(assigneeId) && assigneeId > 0 ? assigneeId : undefined,
    priority: (TASK_PRIORITIES as readonly string[]).includes(priority ?? "") ? (priority as TaskPriority) : undefined,
  };
}

/** Board cards: tasks joined with assignee and customer names. */
export async function listBoardTasks(filters: TaskFilters) {
  const conditions: SQL[] = [];
  if (filters.assignee === "unassigned") conditions.push(isNull(tasks.assigneeId));
  else if (filters.assignee) conditions.push(eq(tasks.assigneeId, filters.assignee));
  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      position: tasks.position,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      customerId: tasks.customerId,
      customerName: customers.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(customers, eq(tasks.customerId, customers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(tasks.position), asc(tasks.id));
}

export type BoardTask = Awaited<ReturnType<typeof listBoardTasks>>[number];

export async function getTask(id: number) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row ?? null;
}

/** Users for assignee selects and filters. */
export function listUserOptions() {
  return db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
}

/** Customers for the optional "linked customer" select. */
export function listCustomerOptions() {
  return db
    .select({ id: customers.id, name: customers.name, company: customers.company })
    .from(customers)
    .orderBy(asc(customers.name));
}
