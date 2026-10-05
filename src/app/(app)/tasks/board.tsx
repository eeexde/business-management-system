"use client";

import { Building2, CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { startTransition, useOptimistic, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import type { TaskStatus } from "@/db/schema";
import type { BoardTask } from "@/lib/queries/tasks";
import {
  APPEND_POSITION,
  BOARD_COLUMNS,
  groupByStatus,
  isOverdue,
  moveTaskInList,
  TASK_PRIORITY_TONE,
  TASK_STATUS_LABEL,
} from "@/lib/tasks";
import { cn, formatDate, initials } from "@/lib/utils";
import { moveTask } from "./actions";

type Move = { id: number; status: TaskStatus; position: number };
/** Where a dragged card would land: before `beforeId`, or at the end of the column when null. */
type DropTarget = { status: TaskStatus; beforeId: number | null };

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-warning",
  done: "bg-success",
};

export function TaskBoard({ tasks, today }: { tasks: BoardTask[]; today: string }) {
  const [optimisticTasks, applyMove] = useOptimistic(tasks, (current, move: Move) =>
    moveTaskInList(current, move.id, move.status, move.position),
  );
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [error, setError] = useState<string>();
  const [announcement, setAnnouncement] = useState("");

  const columns = groupByStatus(optimisticTasks);
  const byId = new Map(optimisticTasks.map((t) => [t.id, t]));

  function move(id: number, status: TaskStatus, position: number) {
    const task = byId.get(id);
    if (!task) return;
    setError(undefined);
    startTransition(async () => {
      applyMove({ id, status, position });
      const result = await moveTask(id, status, position);
      if (!result.ok) setError(result.message ?? "Couldn't move that task.");
      else setAnnouncement(`Moved "${task.title}" to ${TASK_STATUS_LABEL[status]}.`);
    });
  }

  function endDrag() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const id = draggingId ?? Number(e.dataTransfer.getData("text/plain"));
    const target = dropTarget?.status === status ? dropTarget : { status, beforeId: null };
    endDrag();
    if (!byId.has(id) || target.beforeId === id) return;
    const before = target.beforeId === null ? undefined : byId.get(target.beforeId);
    move(id, status, before ? before.position : APPEND_POSITION);
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {BOARD_COLUMNS.map((status) => {
          const columnTasks = columns[status];
          const isTarget = dropTarget?.status === status && draggingId !== null;
          return (
            <section
              key={status}
              aria-labelledby={`column-${status}`}
              className={cn(
                "flex min-h-48 flex-col rounded-xl border bg-muted/40 p-3 transition-colors",
                isTarget && "border-primary bg-primary/5",
              )}
              onDragOver={(e) => {
                if (draggingId === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTarget?.status !== status || dropTarget.beforeId !== null) {
                  setDropTarget({ status, beforeId: null });
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
              }}
              onDrop={(e) => handleDrop(e, status)}
            >
              <header className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2 id={`column-${status}`} className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("h-2 w-2 rounded-full", COLUMN_ACCENT[status])} aria-hidden />
                  {TASK_STATUS_LABEL[status]}
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </h2>
                <Link
                  href={`/tasks/new?status=${status}`}
                  className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                  aria-label={`Add task to ${TASK_STATUS_LABEL[status]}`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Link>
              </header>

              <ul className="flex flex-1 flex-col gap-2">
                {columnTasks.map((task, index) => (
                  <li
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(task.id));
                      setDraggingId(task.id);
                    }}
                    onDragEnd={endDrag}
                    onDragOver={(e) => {
                      if (draggingId === null) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const beforeId =
                        e.clientY < rect.top + rect.height / 2 ? task.id : (columnTasks[index + 1]?.id ?? null);
                      if (dropTarget?.status !== status || dropTarget.beforeId !== beforeId) {
                        setDropTarget({ status, beforeId });
                      }
                    }}
                    className={cn(
                      "relative cursor-grab rounded-lg border bg-card p-3 shadow-sm active:cursor-grabbing",
                      draggingId === task.id && "opacity-50",
                    )}
                  >
                    {isTarget && dropTarget.beforeId === task.id && (
                      <span className="absolute inset-x-0 -top-1.5 h-0.5 rounded-full bg-primary" aria-hidden />
                    )}
                    <TaskCard task={task} today={today} onStatusChange={(s) => move(task.id, s, APPEND_POSITION)} />
                  </li>
                ))}
                {isTarget && dropTarget.beforeId === null && (
                  <li className="h-0.5 rounded-full bg-primary" aria-hidden />
                )}
                {columnTasks.length === 0 && !isTarget && (
                  <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                    No tasks
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function TaskCard({
  task,
  today,
  onStatusChange,
}: {
  task: BoardTask;
  today: string;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const overdue = isOverdue(task, today);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/tasks/${task.id}/edit`}
          draggable={false}
          className={cn(
            "text-sm font-medium leading-snug hover:text-primary hover:underline",
            task.status === "done" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </Link>
        <Badge tone={TASK_PRIORITY_TONE[task.priority]} className="shrink-0">
          {task.priority}
        </Badge>
      </div>

      {task.customerName && (
        <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{task.customerName}</span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {task.assigneeName ? (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
              title={task.assigneeName}
            >
              <span aria-hidden>{initials(task.assigneeName)}</span>
              <span className="sr-only">Assigned to {task.assigneeName}</span>
            </span>
          ) : (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed text-[10px] text-muted-foreground"
              title="Unassigned"
            >
              <span aria-hidden>?</span>
              <span className="sr-only">Unassigned</span>
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1 whitespace-nowrap text-xs",
                overdue ? "font-medium text-danger" : "text-muted-foreground",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">{overdue ? "Overdue, was due" : "Due"}</span>
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>
        {/* Keyboard and touch fallback for drag and drop. */}
        <Select
          aria-label={`Status of ${task.title}`}
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
          className="h-7 w-auto shrink-0 px-2 pr-7 text-xs"
        >
          {BOARD_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
