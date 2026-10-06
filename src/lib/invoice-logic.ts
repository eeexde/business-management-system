import { z } from "zod";
import type { Invoice, InvoiceStatus } from "@/db/schema";
import { PAYMENT_METHODS } from "@/db/schema";
import type { ActionState } from "./action-state";
import { balanceDue, type DisplayStatus } from "./invoices";
import { formatMoney, parseMoney } from "./utils";

/** Pure invoice rules shared by the server actions, the editor and the seed. */

export const PAGE_SIZE = 25;

export const DISPLAY_STATUSES: DisplayStatus[] = ["draft", "sent", "partial", "overdue", "paid", "void"];

const isoDate = z
  .string({ error: "Enter a date." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Enter a valid date." })
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), { error: "Enter a valid date." });

/** Money typed by a user ("1,234.50") -> integer cents. */
const moneyInput = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" ? 0 : parseMoney(v)))
    .refine((c) => Number.isFinite(c), { error: `Enter a valid ${label}.` })
    .refine((c) => c >= 0, { error: `${capitalize(label)} can't be negative.` })
    .refine((c) => c <= 100_000_000_00, { error: `${capitalize(label)} is too large.` });

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One editor row as submitted by the client (strings straight from inputs). */
export const LineItemSchema = z.object({
  productId: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), { error: "Pick a valid product." }),
  description: z
    .string()
    .trim()
    .min(1, { error: "Enter a description." })
    .max(500, { error: "Description is too long." }),
  quantity: z.coerce
    .number({ error: "Enter a quantity." })
    .int({ error: "Quantity must be a whole number." })
    .min(1, { error: "Quantity must be at least 1." })
    .max(100_000, { error: "Quantity is too large." }),
  unitPrice: moneyInput("unit price"),
});

export type LineItemInput = z.output<typeof LineItemSchema>;

/** Upper bound on an invoice subtotal ($10B) so cent math stays well inside safe integers. */
export const MAX_INVOICE_CENTS = 1_000_000_000_000;

/** The whole invoice editor form. `items` arrives as a JSON string in a hidden input. */
export const InvoiceFormSchema = z
  .object({
    customerId: z.coerce
      .number({ error: "Choose a customer." })
      .int()
      .positive({ error: "Choose a customer." }),
    issueDate: isoDate,
    dueDate: isoDate,
    taxRate: z.coerce
      .number({ error: "Enter a tax rate." })
      .min(0, { error: "Tax rate can't be negative." })
      .max(100, { error: "Tax rate can't exceed 100%." }),
    discount: moneyInput("discount"),
    notes: z
      .string()
      .trim()
      .max(2000, { error: "Notes are too long." })
      .optional()
      .transform((v) => (v ? v : null)),
    items: z.preprocess(
      (v) => {
        if (typeof v !== "string") return v;
        try {
          return JSON.parse(v);
        } catch {
          return undefined;
        }
      },
      z
        .array(LineItemSchema, { error: "Line items are missing." })
        .min(1, { error: "Add at least one line item." })
        .max(100, { error: "Too many line items (max 100)." }),
    ),
  })
  .refine((v) => v.dueDate >= v.issueDate, { error: "Due date can't be before the issue date.", path: ["dueDate"] })
  .refine((v) => v.items.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) <= MAX_INVOICE_CENTS, {
    error: "Invoice total is too large.",
    path: ["items"],
  });

export type InvoiceFormInput = z.output<typeof InvoiceFormSchema>;

/**
 * Like `fieldErrors`, but line-item issues are flattened into `errors.items`
 * as "Line 2: Enter a description." so the editor can show them in one place.
 */
export function invoiceFormErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): ActionState {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const [key, index] = issue.path;
    const field = String(key ?? "form");
    const message =
      field === "items" && typeof index === "number" ? `Line ${index + 1}: ${issue.message}` : issue.message;
    const list = (errors[field] ??= []);
    if (!list.includes(message)) list.push(message);
  }
  return { ok: false, errors, message: "Please fix the highlighted fields." };
}

export const PaymentSchema = z.object({
  amount: z
    .string()
    .transform((v) => parseMoney(v))
    .refine((c) => Number.isFinite(c), { error: "Enter a valid amount." }),
  date: isoDate,
  method: z.enum(PAYMENT_METHODS, { error: "Choose a payment method." }),
  note: z
    .string()
    .trim()
    .max(500, { error: "Note is too long." })
    .optional()
    .transform((v) => (v ? v : null)),
});

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  check: "Check",
  other: "Other",
};

type PaymentTarget = Pick<Invoice, "status" | "totalCents" | "amountPaidCents">;

/** Whether a payment of `amountCents` may be recorded against an invoice. */
export function validatePayment(
  invoice: PaymentTarget,
  amountCents: number,
  currency = "USD",
): { ok: true } | { ok: false; error: string } {
  if (invoice.status === "draft") return { ok: false, error: "Mark the invoice as sent before recording payments." };
  if (invoice.status === "void") return { ok: false, error: "Void invoices can't receive payments." };
  const balance = balanceDue(invoice);
  if (invoice.status === "paid" || balance === 0) return { ok: false, error: "This invoice is already paid in full." };
  if (!Number.isFinite(amountCents) || !Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  if (amountCents > balance) {
    return { ok: false, error: `Amount exceeds the balance due of ${formatMoney(balance, currency)}.` };
  }
  return { ok: true };
}

/** Invoice state after applying a (validated) payment. */
export function applyPayment(invoice: PaymentTarget, amountCents: number) {
  const amountPaidCents = invoice.amountPaidCents + amountCents;
  const fullyPaid = amountPaidCents >= invoice.totalCents;
  return { amountPaidCents, status: (fullyPaid ? "paid" : invoice.status) as InvoiceStatus, fullyPaid };
}

/** Only drafts are editable or deletable. */
export function canEditInvoice(invoice: Pick<Invoice, "status">) {
  return invoice.status === "draft";
}

/** Sent invoices with no payments may be voided; paid, partial, draft and void may not. */
export function canVoidInvoice(invoice: Pick<Invoice, "status" | "amountPaidCents">) {
  return invoice.status === "sent" && invoice.amountPaidCents === 0;
}

export function canRecordPayment(invoice: PaymentTarget) {
  return invoice.status === "sent" && balanceDue(invoice) > 0;
}

/**
 * Aggregate stock-tracked quantities per product for a set of lines.
 * Lines without a product, or whose product is a service, are ignored.
 */
export function stockDemand(
  lines: { productId: number | null; quantity: number }[],
  isService: (productId: number) => boolean,
): Map<number, number> {
  const demand = new Map<number, number>();
  for (const line of lines) {
    if (line.productId === null || isService(line.productId)) continue;
    demand.set(line.productId, (demand.get(line.productId) ?? 0) + line.quantity);
  }
  return demand;
}

/** Reverse a set of signed stock movements (e.g. "sale" rows) into per-product quantities to restore. */
export function stockToRestore(movements: { productId: number; quantity: number }[]): Map<number, number> {
  const restore = new Map<number, number>();
  for (const m of movements) restore.set(m.productId, (restore.get(m.productId) ?? 0) - m.quantity);
  for (const [id, qty] of restore) if (qty === 0) restore.delete(id);
  return restore;
}
