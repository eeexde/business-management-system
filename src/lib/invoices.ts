import type { BadgeTone } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/db/schema";

/** Display status: stored status plus derived "overdue" and "partial". */
export type DisplayStatus = InvoiceStatus | "overdue" | "partial";

export type LineInput = { quantity: number; unitPriceCents: number };

export type InvoiceTotals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

/**
 * Invoice math. Discount applies before tax; tax rounds half-up to the cent.
 * Discount is clamped to [0, subtotal] so totals never go negative.
 */
export function computeInvoiceTotals(
  lines: LineInput[],
  taxRatePercent: number,
  discountCents = 0,
): InvoiceTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const discount = Math.min(Math.max(0, Math.round(discountCents)), subtotalCents);
  const taxable = subtotalCents - discount;
  // Integer math in basis points: float rates like 4.35 would otherwise round 130.5 down to 130.
  const basisPoints = Math.round(Math.max(0, taxRatePercent) * 100);
  const taxCents = Math.floor((taxable * basisPoints + 5000) / 10000);
  return { subtotalCents, discountCents: discount, taxCents, totalCents: taxable + taxCents };
}

export function lineTotal(line: LineInput) {
  return Math.round(line.quantity * line.unitPriceCents);
}

export function balanceDue(inv: { totalCents: number; amountPaidCents: number }) {
  return Math.max(0, inv.totalCents - inv.amountPaidCents);
}

/** Derive the status shown to users. `asOf` is YYYY-MM-DD (defaults to today, local). */
export function displayStatus(
  inv: { status: InvoiceStatus; dueDate: string; totalCents: number; amountPaidCents: number },
  asOf: string,
): DisplayStatus {
  if (inv.status !== "sent") return inv.status;
  if (inv.dueDate < asOf) return "overdue";
  if (inv.amountPaidCents > 0 && inv.amountPaidCents < inv.totalCents) return "partial";
  return "sent";
}

export const STATUS_TONE: Record<DisplayStatus, BadgeTone> = {
  draft: "neutral",
  sent: "primary",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  void: "neutral",
};

/** Next invoice number from the highest existing one, e.g. ("INV-", ["INV-0041"]) -> "INV-0042". */
export function nextInvoiceNumber(prefix: string, existing: string[]) {
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(prefix)) continue;
    const num = Number.parseInt(n.slice(prefix.length), 10);
    if (Number.isFinite(num) && num > max) max = num;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Days past due as of a date (0 when not overdue). Both YYYY-MM-DD. */
export function daysOverdue(dueDate: string, asOf: string) {
  const ms = Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";
export const AGING_BUCKETS: AgingBucket[] = ["current", "1-30", "31-60", "61-90", "90+"];

export function agingBucket(dueDate: string, asOf: string): AgingBucket {
  const d = daysOverdue(dueDate, asOf);
  if (d === 0) return "current";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}
