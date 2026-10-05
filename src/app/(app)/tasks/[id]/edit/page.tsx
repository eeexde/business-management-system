import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getTask, listCustomerOptions, listUserOptions } from "@/lib/queries/tasks";
import { updateTask } from "../../actions";
import { DeleteTaskButton } from "../../delete-task-button";
import { TaskForm } from "../../task-form";

export const metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [user, task, users, customers] = await Promise.all([
    requireUser(),
    getTask(id),
    listUserOptions(),
    listCustomerOptions(),
  ]);
  if (!task) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Edit task"
        description={task.title}
        actions={can(user.role, "tasks:delete") && <DeleteTaskButton id={task.id} />}
      />
      <TaskForm action={updateTask.bind(null, task.id)} task={task} users={users} customers={customers} />
    </div>
  );
}
