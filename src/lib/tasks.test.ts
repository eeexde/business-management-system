import { describe, expect, it } from "vitest";
import type { TaskPriority, TaskStatus } from "@/db/schema";
import { APPEND_POSITION, groupByStatus, isOverdue, moveTaskInList, planMove, sortTasks } from "./tasks";

type T = { id: number; status: TaskStatus; position: number; priority: TaskPriority; dueDate: string | null };

const task = (id: number, status: TaskStatus, position: number, extra: Partial<T> = {}): T => ({
  id,
  status,
  position,
  priority: "medium",
  dueDate: null,
  ...extra,
});

describe("isOverdue", () => {
  it("is true only for open tasks due before today", () => {
    expect(isOverdue({ status: "todo", dueDate: "2026-03-09" }, "2026-03-10")).toBe(true);
    expect(isOverdue({ status: "in_progress", dueDate: "2026-03-10" }, "2026-03-10")).toBe(false);
    expect(isOverdue({ status: "done", dueDate: "2026-01-01" }, "2026-03-10")).toBe(false);
    expect(isOverdue({ status: "todo", dueDate: null }, "2026-03-10")).toBe(false);
  });
});

describe("sortTasks", () => {
  it("orders by position, then priority, then due date, then id", () => {
    const sorted = sortTasks([
      task(1, "todo", 1),
      task(2, "todo", 0, { priority: "low" }),
      task(3, "todo", 0, { priority: "high", dueDate: "2026-05-01" }),
      task(4, "todo", 0, { priority: "high", dueDate: "2026-04-01" }),
      task(5, "todo", 0, { priority: "high" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual([4, 3, 5, 2, 1]);
  });
});

describe("groupByStatus", () => {
  it("returns every column, sorted", () => {
    const groups = groupByStatus([task(1, "done", 2), task(2, "done", 1), task(3, "todo", 0)]);
    expect(groups.todo.map((t) => t.id)).toEqual([3]);
    expect(groups.in_progress).toEqual([]);
    expect(groups.done.map((t) => t.id)).toEqual([2, 1]);
  });
});

describe("planMove", () => {
  const column = [task(1, "todo", 0), task(2, "todo", 1), task(3, "todo", 2)];
  it("inserts before the first task at or after the position", () => {
    expect(planMove(column, 9, 1)).toEqual([1, 9, 2, 3]);
    expect(planMove(column, 9, 0)).toEqual([9, 1, 2, 3]);
  });
  it("appends", () => {
    expect(planMove(column, 9, APPEND_POSITION)).toEqual([1, 2, 3, 9]);
  });
  it("reorders within a column", () => {
    expect(planMove(column, 3, 0)).toEqual([3, 1, 2]);
    expect(planMove(column, 1, APPEND_POSITION)).toEqual([2, 3, 1]);
  });
  it("works with sparse positions from a filtered view", () => {
    expect(planMove([task(1, "todo", 0), task(2, "todo", 10)], 9, 5)).toEqual([1, 9, 2]);
  });
});

describe("moveTaskInList", () => {
  it("changes status and renumbers the target column", () => {
    const tasks = [task(1, "todo", 0), task(2, "todo", 1), task(3, "done", 0), task(4, "done", 1)];
    const moved = moveTaskInList(tasks, 2, "done", 1);
    const done = groupByStatus(moved).done;
    expect(done.map((t) => [t.id, t.position])).toEqual([
      [3, 0],
      [2, 1],
      [4, 2],
    ]);
    expect(moved.find((t) => t.id === 1)).toEqual(tasks[0]);
  });
  it("ignores unknown ids", () => {
    const tasks = [task(1, "todo", 0)];
    expect(moveTaskInList(tasks, 99, "done", 0)).toEqual(tasks);
  });
});
