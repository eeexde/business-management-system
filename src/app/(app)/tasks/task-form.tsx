"use client";

import { useActionState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Task, TaskStatus } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { BOARD_COLUMNS, TASK_STATUS_LABEL } from "@/lib/tasks";

type TaskAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

/** Shared create/edit form. `defaults` prefill a new task (e.g. from ?customerId=). */
export function TaskForm({
  action,
  task,
  defaults,
  users,
  customers,
}: {
  action: TaskAction;
  task?: Task;
  defaults?: { status?: TaskStatus; customerId?: number | null; assigneeId?: number | null };
  users: { id: number; name: string }[];
  customers: { id: number; name: string; company: string | null }[];
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const err = (name: string) => state.errors?.[name];
  const invalid = (name: string) => (err(name)?.length ? true : undefined);
  const customerId = task ? task.customerId : defaults?.customerId;
  const assigneeId = task ? task.assigneeId : defaults?.assigneeId;

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" errors={err("title")} className="sm:col-span-2">
            <Input
              id="title"
              name="title"
              defaultValue={task?.title}
              placeholder="e.g. Follow up on overdue invoice"
              maxLength={200}
              required
              aria-invalid={invalid("title")}
            />
          </Field>
          <Field label="Description" htmlFor="description" errors={err("description")} className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={task?.description ?? ""}
              maxLength={5000}
              aria-invalid={invalid("description")}
            />
          </Field>
          <Field label="Status" htmlFor="status" errors={err("status")}>
            <Select id="status" name="status" defaultValue={task?.status ?? defaults?.status ?? "todo"}>
              {BOARD_COLUMNS.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="priority" errors={err("priority")}>
            <Select id="priority" name="priority" defaultValue={task?.priority ?? "medium"}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="dueDate" errors={err("dueDate")}>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} aria-invalid={invalid("dueDate")} />
          </Field>
          <Field label="Assignee" htmlFor="assigneeId" errors={err("assigneeId")}>
            <Select id="assigneeId" name="assigneeId" defaultValue={assigneeId ? String(assigneeId) : ""} aria-invalid={invalid("assigneeId")}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Customer" htmlFor="customerId" errors={err("customerId")} hint="Optional" className="sm:col-span-2">
            <Select id="customerId" name="customerId" defaultValue={customerId ? String(customerId) : ""} aria-invalid={invalid("customerId")}>
              <option value="">No customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company && c.company !== c.name ? `${c.name} (${c.company})` : c.name}
                </option>
              ))}
            </Select>
          </Field>
          <FormMessage state={state} className="sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <LinkButton href="/tasks" variant="secondary">
              Cancel
            </LinkButton>
            <SubmitButton>{task ? "Save changes" : "Create task"}</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
