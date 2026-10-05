import { PageHeader } from "@/components/ui/page-header";
import { TASK_STATUSES, type TaskStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { listCustomerOptions, listUserOptions } from "@/lib/queries/tasks";
import { getParam } from "@/lib/search-params";
import { createTask } from "../actions";
import { TaskForm } from "../task-form";

export const metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  const params = await searchParams;
  const [user, users, customers] = await Promise.all([requireUser(), listUserOptions(), listCustomerOptions()]);

  // Prefill from ?customerId= (e.g. from a customer page) and ?status= (from a board column).
  const customerParam = Number(getParam(params, "customerId"));
  const customerId = customers.some((c) => c.id === customerParam) ? customerParam : null;
  const statusParam = getParam(params, "status");
  const status = (TASK_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as TaskStatus) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New task" description="Add a to-do for yourself or the team." />
      <TaskForm
        action={createTask}
        defaults={{ status, customerId, assigneeId: user.id }}
        users={users}
        customers={customers}
      />
    </div>
  );
}
