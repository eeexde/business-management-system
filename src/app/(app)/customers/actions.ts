"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { authorize } from "@/lib/auth";
import { CustomerSchema } from "@/lib/customers";
import { countCustomerInvoices, getCustomer } from "@/lib/queries/customers";

/** Whether another customer already uses this email (case-insensitive). */
async function emailTaken(email: string | null | undefined, excludeId?: number) {
  if (!email) return false;
  const match = sql`lower(${customers.email}) = ${email.toLowerCase()}`;
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(excludeId ? and(match, ne(customers.id, excludeId)) : match)
    .limit(1);
  return Boolean(row);
}

const EMAIL_TAKEN: ActionState = {
  ok: false,
  errors: { email: ["Another customer already uses this email."] },
  message: "Please fix the highlighted fields.",
};

export async function createCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("customers:write");
  if (!auth.ok) return auth.state;
  const parsed = CustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  if (await emailTaken(parsed.data.email)) return EMAIL_TAKEN;

  const [row] = await db.insert(customers).values(parsed.data).returning({ id: customers.id });
  await logActivity({
    userId: auth.user.id,
    action: "customer.created",
    entityType: "customer",
    entityId: row!.id,
    summary: `Added customer ${parsed.data.name}`,
  });
  revalidatePath("/customers");
  redirect(`/customers/${row!.id}`);
}

/** Bound with the customer id: updateCustomer.bind(null, id). */
export async function updateCustomer(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("customers:write");
  if (!auth.ok) return auth.state;
  const parsed = CustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  if (await emailTaken(parsed.data.email, id)) return EMAIL_TAKEN;

  const updated = await db
    .update(customers)
    .set(parsed.data)
    .where(eq(customers.id, id))
    .returning({ id: customers.id });
  if (updated.length === 0) return { ok: false, message: "That customer no longer exists." };

  await logActivity({
    userId: auth.user.id,
    action: "customer.updated",
    entityType: "customer",
    entityId: id,
    summary: `Updated customer ${parsed.data.name}`,
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

/** Customers with invoices can't be deleted (invoices.customer_id is ON DELETE RESTRICT). */
export async function deleteCustomer(id: number): Promise<ActionState> {
  const auth = await authorize("customers:delete");
  if (!auth.ok) return auth.state;
  const customer = await getCustomer(id);
  if (!customer) return { ok: false, message: "That customer no longer exists." };

  const invoiceCount = await countCustomerInvoices(id);
  if (invoiceCount > 0) {
    return {
      ok: false,
      message: `${customer.name} has ${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}, so they can't be deleted. Void or delete those invoices first.`,
    };
  }

  await db.delete(customers).where(eq(customers.id, id));
  await logActivity({
    userId: auth.user.id,
    action: "customer.deleted",
    entityType: "customer",
    entityId: id,
    summary: `Deleted customer ${customer.name}`,
  });
  revalidatePath("/customers");
  redirect("/customers");
}
