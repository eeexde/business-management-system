"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { authorize } from "@/lib/auth";
import { InvoiceFormSchema, invoiceFormErrors, PaymentSchema } from "@/lib/invoice-logic";
import * as q from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { formatMoney } from "@/lib/utils";

function revalidateInvoices(id?: number) {
  revalidatePath("/invoices");
  if (id) revalidatePath(`/invoices/${id}`);
  // Invoice changes feed the dashboard, reports, customer and product pages.
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/customers", "layout");
  revalidatePath("/products", "layout");
}

export async function createInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("invoices:write");
  if (!auth.ok) return auth.state;
  const parsed = InvoiceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invoiceFormErrors(parsed.error);

  const result = await q.createInvoice(parsed.data, auth.user.id);
  if (!result.ok) return { ok: false, message: result.error };
  await logActivity({
    userId: auth.user.id,
    action: "invoice.created",
    entityType: "invoice",
    entityId: result.id,
    summary: `Created invoice ${result.number}`,
  });
  revalidateInvoices(result.id);
  redirect(`/invoices/${result.id}`);
}

export async function updateInvoice(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("invoices:write");
  if (!auth.ok) return auth.state;
  const parsed = InvoiceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invoiceFormErrors(parsed.error);

  const result = await q.updateDraftInvoice(id, parsed.data);
  if (!result.ok) return { ok: false, message: result.error };
  await logActivity({
    userId: auth.user.id,
    action: "invoice.updated",
    entityType: "invoice",
    entityId: id,
    summary: `Updated invoice ${result.number}`,
  });
  revalidateInvoices(id);
  redirect(`/invoices/${id}`);
}

export async function markInvoiceSent(id: number): Promise<ActionState> {
  const auth = await authorize("invoices:write");
  if (!auth.ok) return auth.state;
  const result = await q.markInvoiceSent(id, auth.user.id);
  if (!result.ok) return { ok: false, message: result.error };
  await logActivity({
    userId: auth.user.id,
    action: "invoice.sent",
    entityType: "invoice",
    entityId: id,
    summary: `Marked invoice ${result.number} as sent`,
  });
  revalidateInvoices(id);
  if (result.negativeStock.length) {
    const list = result.negativeStock.map((p) => `${p.name} (${p.stock})`).join(", ");
    return { ok: true, message: `Invoice sent. Warning: stock is now negative for ${list}.` };
  }
  return { ok: true, message: "Invoice marked as sent and stock updated." };
}

export async function recordPayment(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("invoices:write");
  if (!auth.ok) return auth.state;
  const parsed = PaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const { currency } = await getSettings();
  const { amount, ...rest } = parsed.data;
  const result = await q.recordPayment(id, { amountCents: amount, ...rest }, currency);
  if (!result.ok) {
    // Attach the error to the field it is about so the right input is flagged.
    const field = /date/i.test(result.error) ? "date" : "amount";
    return { ok: false, message: result.error, errors: { [field]: [result.error] } };
  }
  await logActivity({
    userId: auth.user.id,
    action: "invoice.payment",
    entityType: "invoice",
    entityId: id,
    summary: `Recorded ${formatMoney(amount, currency)} payment on ${result.number}`,
  });
  revalidateInvoices(id);
  return { ok: true, message: result.fullyPaid ? "Payment recorded. Invoice is paid in full." : "Payment recorded." };
}

export async function voidInvoice(id: number): Promise<ActionState> {
  const auth = await authorize("invoices:write");
  if (!auth.ok) return auth.state;
  const result = await q.voidInvoice(id, auth.user.id);
  if (!result.ok) return { ok: false, message: result.error };
  await logActivity({
    userId: auth.user.id,
    action: "invoice.voided",
    entityType: "invoice",
    entityId: id,
    summary: `Voided invoice ${result.number}`,
  });
  revalidateInvoices(id);
  return { ok: true, message: "Invoice voided and stock restored." };
}

export async function duplicateInvoice(id: number): Promise<ActionState> {
  const auth = await authorize("invoices:write");
  if (!auth.ok) return auth.state;
  const result = await q.duplicateInvoice(id, auth.user.id);
  if (!result.ok) return { ok: false, message: result.error };
  await logActivity({
    userId: auth.user.id,
    action: "invoice.created",
    entityType: "invoice",
    entityId: result.id,
    summary: `Created invoice ${result.number} (copy)`,
  });
  revalidateInvoices(result.id);
  redirect(`/invoices/${result.id}/edit`);
}

export async function deleteInvoice(id: number): Promise<ActionState> {
  const auth = await authorize("invoices:delete");
  if (!auth.ok) return auth.state;
  const result = await q.deleteDraftInvoice(id);
  if (!result.ok) return { ok: false, message: result.error };
  await logActivity({
    userId: auth.user.id,
    action: "invoice.deleted",
    entityType: "invoice",
    entityId: id,
    summary: `Deleted draft invoice ${result.number}`,
  });
  revalidateInvoices();
  redirect("/invoices");
}
