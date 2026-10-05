"use client";

import { useActionState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { EXPENSE_CATEGORIES, type Expense } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expenses";
import { centsToInput } from "@/lib/utils";

type ExpenseAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Shared create/edit form. Pass `expense` to edit; `defaultDate` prefills new expenses. */
export function ExpenseForm({
  action,
  expense,
  defaultDate,
  currency,
}: {
  action: ExpenseAction;
  expense?: Expense;
  defaultDate: string;
  currency: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const err = (name: string) => state.errors?.[name];
  const invalid = (name: string) => (err(name)?.length ? true : undefined);

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Description" htmlFor="description" errors={err("description")} className="sm:col-span-2">
            <Input
              id="description"
              name="description"
              defaultValue={expense?.description}
              placeholder="e.g. Office rent — March"
              maxLength={200}
              required
              aria-invalid={invalid("description")}
            />
          </Field>
          <Field label="Category" htmlFor="category" errors={err("category")}>
            <Select id="category" name="category" defaultValue={expense?.category ?? "other"} aria-invalid={invalid("category")}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vendor" htmlFor="vendor" errors={err("vendor")}>
            <Input
              id="vendor"
              name="vendor"
              defaultValue={expense?.vendor ?? ""}
              placeholder="Optional"
              maxLength={120}
              aria-invalid={invalid("vendor")}
            />
          </Field>
          <Field label={`Amount (${currency})`} htmlFor="amount" errors={err("amount")}>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              defaultValue={expense ? centsToInput(expense.amountCents) : ""}
              placeholder="0.00"
              required
              aria-invalid={invalid("amount")}
            />
          </Field>
          <Field label="Date" htmlFor="date" errors={err("date")}>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={expense?.date ?? defaultDate}
              required
              aria-invalid={invalid("date")}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" errors={err("notes")} className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={expense?.notes ?? ""} maxLength={2000} aria-invalid={invalid("notes")} />
          </Field>
          <FormMessage state={state} className="sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <LinkButton href="/expenses" variant="secondary">
              Cancel
            </LinkButton>
            <SubmitButton>{expense ? "Save changes" : "Add expense"}</SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
