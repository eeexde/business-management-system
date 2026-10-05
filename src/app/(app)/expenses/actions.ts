"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { EXPENSE_CATEGORIES, expenses } from "@/db/schema";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { authorize } from "@/lib/auth";
import { getSettings } from "@/lib/queries/settings";
import { formatMoney, parseMoney } from "@/lib/utils";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep it under ${max} characters.` })
    .optional()
    .transform((v) => v || null);

const ExpenseSchema = z.object({
  description: z.string().trim().min(1, { error: "Enter a description." }).max(200, { error: "Keep it under 200 characters." }),
  category: z.enum(EXPENSE_CATEGORIES, { error: "Choose a category." }),
  vendor: optionalText(120),
  amount: z
    .string()
    .transform((v) => parseMoney(v))
    .pipe(
      z
        .number({ error: "Enter a valid amount." })
        .int()
        .min(1, { error: "Enter an amount greater than zero." })
        .max(100_000_000_00, { error: "That amount is too large." }),
    ),
  date: z.iso.date({ error: "Enter a valid date." }),
  notes: optionalText(2000),
});

function parse(formData: FormData) {
  return ExpenseSchema.safeParse(Object.fromEntries(formData));
}

export async function createExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("expenses:write");
  if (!auth.ok) return auth.state;
  const parsed = parse(formData);
  if (!parsed.success) return fieldErrors(parsed.error);

  const { amount, ...data } = parsed.data;
  const [row] = await db
    .insert(expenses)
    .values({ ...data, amountCents: amount, createdBy: auth.user.id })
    .returning({ id: expenses.id });
  const { currency } = await getSettings();
  await logActivity({
    userId: auth.user.id,
    action: "expense.created",
    entityType: "expense",
    entityId: row.id,
    summary: `Recorded expense "${data.description}" (${formatMoney(amount, currency)})`,
  });
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function updateExpense(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("expenses:write");
  if (!auth.ok) return auth.state;
  const parsed = parse(formData);
  if (!parsed.success) return fieldErrors(parsed.error);

  const { amount, ...data } = parsed.data;
  const updated = await db
    .update(expenses)
    .set({ ...data, amountCents: amount })
    .where(eq(expenses.id, id))
    .returning({ id: expenses.id });
  if (updated.length === 0) return { ok: false, message: "This expense no longer exists." };

  await logActivity({
    userId: auth.user.id,
    action: "expense.updated",
    entityType: "expense",
    entityId: id,
    summary: `Updated expense "${data.description}"`,
  });
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function deleteExpense(id: number): Promise<ActionState> {
  const auth = await authorize("expenses:delete");
  if (!auth.ok) return auth.state;

  const [row] = await db
    .delete(expenses)
    .where(eq(expenses.id, id))
    .returning({ description: expenses.description });
  if (!row) return { ok: false, message: "This expense no longer exists." };

  await logActivity({
    userId: auth.user.id,
    action: "expense.deleted",
    entityType: "expense",
    entityId: id,
    summary: `Deleted expense "${row.description}"`,
  });
  revalidatePath("/expenses");
  redirect("/expenses");
}
