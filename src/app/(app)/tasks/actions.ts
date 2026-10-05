"use server";

import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { customers, TASK_PRIORITIES, TASK_STATUSES, tasks, users, type TaskStatus } from "@/db/schema";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { authorize } from "@/lib/auth";
import { planMove, TASK_STATUS_LABEL } from "@/lib/tasks";

/** Empty select value -> null, otherwise a positive integer id. */
const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .pipe(z.number().int().positive().nullable());

const TaskSchema = z.object({
  title: z.string().trim().min(1, { error: "Enter a title." }).max(200, { error: "Keep it under 200 characters." }),
  description: z
    .string()
    .trim()
    .max(5000, { error: "Keep it under 5000 characters." })
    .optional()
    .transform((v) => v || null),
  status: z.enum(TASK_STATUSES, { error: "Choose a status." }),
  priority: z.enum(TASK_PRIORITIES, { error: "Choose a priority." }),
  dueDate: z
    .union([z.iso.date({ error: "Enter a valid date." }), z.literal("")])
    .optional()
    .transform((v) => v || null),
  assigneeId: optionalId,
  customerId: optionalId,
});

type TaskInput = z.infer<typeof TaskSchema>;

/** Validate form data, including that referenced users and customers exist. */
async function parse(formData: FormData) {
  const parsed = TaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: fieldErrors(parsed.error) } as const;
  const { assigneeId, customerId } = parsed.data;
  const errors: Record<string, string[]> = {};
  if (assigneeId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, assigneeId)).limit(1);
    if (!u) errors.assigneeId = ["That user no longer exists."];
  }
  if (customerId) {
    const [c] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!c) errors.customerId = ["That customer no longer exists."];
  }
  if (Object.keys(errors).length) {
    return { error: { ok: false, errors, message: "Please fix the highlighted fields." } satisfies ActionState } as const;
  }
  return { data: parsed.data } as const;
}

/** Next free position at the bottom of a column. */
async function endOfColumn(status: TaskStatus) {
  const [row] = await db.select({ max: max(tasks.position) }).from(tasks).where(eq(tasks.status, status));
  return row?.max === null || row?.max === undefined ? 0 : row.max + 1;
}

function revalidateTaskPaths(input: Pick<TaskInput, "customerId">) {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (input.customerId) revalidatePath(`/customers/${input.customerId}`);
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("tasks:write");
  if (!auth.ok) return auth.state;
  const result = await parse(formData);
  if (result.error) return result.error;

  const data = result.data;
  const [row] = await db
    .insert(tasks)
    .values({ ...data, position: await endOfColumn(data.status), createdBy: auth.user.id })
    .returning({ id: tasks.id });
  await logActivity({
    userId: auth.user.id,
    action: "task.created",
    entityType: "task",
    entityId: row.id,
    summary: `Created task "${data.title}"`,
  });
  revalidateTaskPaths(data);
  redirect("/tasks");
}

export async function updateTask(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("tasks:write");
  if (!auth.ok) return auth.state;
  const result = await parse(formData);
  if (result.error) return result.error;

  const [existing] = await db
    .select({ status: tasks.status, customerId: tasks.customerId })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);
  if (!existing) return { ok: false, message: "This task no longer exists." };

  const data = result.data;
  // Changing status from the form drops the card at the bottom of its new column.
  const position = existing.status === data.status ? undefined : await endOfColumn(data.status);
  await db
    .update(tasks)
    .set({ ...data, ...(position === undefined ? {} : { position }) })
    .where(eq(tasks.id, id));
  await logActivity({
    userId: auth.user.id,
    action: "task.updated",
    entityType: "task",
    entityId: id,
    summary: `Updated task "${data.title}"`,
  });
  revalidateTaskPaths(data);
  if (existing.customerId && existing.customerId !== data.customerId) {
    revalidatePath(`/customers/${existing.customerId}`);
  }
  redirect("/tasks");
}

export async function deleteTask(id: number): Promise<ActionState> {
  const auth = await authorize("tasks:delete");
  if (!auth.ok) return auth.state;

  const [row] = await db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning({ title: tasks.title, customerId: tasks.customerId });
  if (!row) return { ok: false, message: "This task no longer exists." };

  await logActivity({
    userId: auth.user.id,
    action: "task.deleted",
    entityType: "task",
    entityId: id,
    summary: `Deleted task "${row.title}"`,
  });
  revalidateTaskPaths(row);
  redirect("/tasks");
}

const MoveSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(TASK_STATUSES),
  position: z.number().int().min(0),
});

/**
 * Move a task to `status`, inserting it before the first task whose position is >= `position`
 * (see planMove). The target column is renumbered 0..n-1 in one transaction.
 */
export async function moveTask(id: number, status: TaskStatus, position: number): Promise<ActionState> {
  const auth = await authorize("tasks:write");
  if (!auth.ok) return auth.state;
  const parsed = MoveSchema.safeParse({ id, status, position });
  if (!parsed.success) return { ok: false, message: "Invalid move." };

  const moved = await db.transaction(async (tx) => {
    const [task] = await tx
      .select({ title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    if (!task) return null;

    const column = await tx
      .select({ id: tasks.id, position: tasks.position, priority: tasks.priority, dueDate: tasks.dueDate })
      .from(tasks)
      .where(eq(tasks.status, status));
    const order = planMove(column, id, position);
    for (const [index, taskId] of order.entries()) {
      await tx
        .update(tasks)
        .set(taskId === id ? { status, position: index } : { position: index })
        .where(eq(tasks.id, taskId));
    }
    return task;
  });
  if (!moved) return { ok: false, message: "This task no longer exists." };

  if (moved.status !== status) {
    await logActivity({
      userId: auth.user.id,
      action: "task.moved",
      entityType: "task",
      entityId: id,
      summary: `Moved "${moved.title}" to ${TASK_STATUS_LABEL[status]}`,
    });
  }
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}
