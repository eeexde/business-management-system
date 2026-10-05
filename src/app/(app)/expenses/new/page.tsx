import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/queries/settings";
import { today } from "@/lib/utils";
import { createExpense } from "../actions";
import { ExpenseForm } from "../expense-form";

export const metadata = { title: "New expense" };

export default async function NewExpensePage() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  if (!can(user.role, "expenses:write")) redirect("/expenses");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New expense" description="Record a business cost." />
      <ExpenseForm action={createExpense} defaultDate={today()} currency={settings.currency} />
    </div>
  );
}
