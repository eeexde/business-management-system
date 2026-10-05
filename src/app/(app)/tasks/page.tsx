import { Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { TASK_PRIORITIES } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { listBoardTasks, listUserOptions, parseTaskFilters } from "@/lib/queries/tasks";
import { isOverdue } from "@/lib/tasks";
import { today } from "@/lib/utils";
import { TaskBoard } from "./board";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const user = await requireUser();
  const filters = parseTaskFilters(await searchParams, user.id);
  const [tasks, users] = await Promise.all([listBoardTasks(filters), listUserOptions()]);
  const now = today();
  const open = tasks.filter((t) => t.status !== "done").length;
  const overdue = tasks.filter((t) => isOverdue(t, now)).length;

  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${open} open${overdue ? ` · ${overdue} overdue` : ""}. Drag cards between columns or use each card's status menu.`}
        actions={
          <LinkButton href="/tasks/new">
            <Plus className="h-4 w-4" aria-hidden /> New task
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect
          param="assignee"
          label="Filter by assignee"
          allLabel="Everyone"
          options={[
            { value: "me", label: "Assigned to me" },
            { value: "unassigned", label: "Unassigned" },
            ...users.filter((u) => u.id !== user.id).map((u) => ({ value: String(u.id), label: u.name })),
          ]}
        />
        <FilterSelect
          param="priority"
          label="Filter by priority"
          allLabel="Any priority"
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
        />
      </div>

      {/* Key on the filters so optimistic and drag state reset when the visible set changes. */}
      <TaskBoard key={`${filters.assignee ?? ""}-${filters.priority ?? ""}`} tasks={tasks} today={now} />
    </>
  );
}
