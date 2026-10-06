import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getExpense } from "@/lib/queries/expenses";
import { getSettings } from "@/lib/queries/settings";
import { today } from "@/lib/utils";
import { updateExpense } from "../../actions";
import { DeleteExpenseButton } from "../../delete-expense-button";
import { ExpenseForm } from "../../expense-form";

export const metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: PageProps<"/expenses/[id]/edit">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [user, settings, expense] = await Promise.all([requireUser(), getSettings(), getExpense(id)]);
  if (!expense) notFound();
  if (!can(user.role, "expenses:write")) redirect("/expenses?notice=forbidden");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Edit expense"
        description={expense.description}
        actions={can(user.role, "expenses:delete") && <DeleteExpenseButton id={expense.id} />}
      />
      <ExpenseForm
        action={updateExpense.bind(null, expense.id)}
        expense={expense}
        defaultDate={today()}
        currency={settings.currency}
      />
    </div>
  );
}
