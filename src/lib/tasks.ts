import type { BadgeTone } from "@/components/ui/badge";
import type { TaskPriority, TaskStatus } from "@/db/schema";

// Type-only schema imports keep this module free of drizzle so the board (a client component) can use it.

/** Board column order. */
export const BOARD_COLUMNS: readonly TaskStatus[] = ["todo", "in_progress", "done"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Pass as `position` to drop a task at the end of a column. */
export const APPEND_POSITION = Number.MAX_SAFE_INTEGER;

type Sortable = { id: number; position: number; priority: TaskPriority; dueDate: string | null };

/** True when a not-done task's due date is before today (YYYY-MM-DD). */
export function isOverdue(task: { status: TaskStatus; dueDate: string | null }, today: string) {
  return task.status !== "done" && task.dueDate !== null && task.dueDate < today;
}

/** Board order: manual position, then priority (high first), then due date (none last), then id. */
export function sortTasks<T extends Sortable>(tasks: readonly T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      a.position - b.position ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
      a.id - b.id,
  );
}

/** Split tasks into sorted board columns. Every status is present, possibly empty. */
export function groupByStatus<T extends Sortable & { status: TaskStatus }>(tasks: readonly T[]) {
  const groups = Object.fromEntries(BOARD_COLUMNS.map((s) => [s, [] as T[]])) as Record<TaskStatus, T[]>;
  for (const task of tasks) groups[task.status].push(task);
  for (const status of BOARD_COLUMNS) groups[status] = sortTasks(groups[status]);
  return groups;
}

/**
 * New order of ids for a column after inserting `movedId`. `position` is a position value, not an
 * index: the task lands before the first other task whose position is >= it, so a client that only
 * sees a filtered subset of the column can still address a slot. Use APPEND_POSITION for the end.
 */
export function planMove(column: readonly Sortable[], movedId: number, position: number): number[] {
  const others = sortTasks(column.filter((t) => t.id !== movedId));
  let index = others.findIndex((t) => t.position >= position);
  if (index === -1) index = others.length;
  const ids = others.map((t) => t.id);
  ids.splice(index, 0, movedId);
  return ids;
}

/** Apply a move to a task list (used for the optimistic board): new status, column renumbered 0..n-1. */
export function moveTaskInList<T extends Sortable & { status: TaskStatus }>(
  tasks: readonly T[],
  id: number,
  status: TaskStatus,
  position: number,
): T[] {
  if (!tasks.some((t) => t.id === id)) return [...tasks];
  const order = planMove(
    tasks.filter((t) => t.status === status),
    id,
    position,
  );
  const newPosition = new Map(order.map((taskId, index) => [taskId, index]));
  return tasks.map((t) => {
    const p = newPosition.get(t.id);
    if (p === undefined) return t;
    return t.id === id ? { ...t, status, position: p } : { ...t, position: p };
  });
}
