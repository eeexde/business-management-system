import { describe, expect, it } from "vitest";
import {
  applyPayment,
  canEditInvoice,
  canRecordPayment,
  canVoidInvoice,
  InvoiceFormSchema,
  invoiceFormErrors,
  PaymentSchema,
  stockDemand,
  stockToRestore,
  validatePayment,
} from "./invoice-logic";

const validForm = {
  customerId: "3",
  issueDate: "2026-03-01",
  dueDate: "2026-03-31",
  taxRate: "8.5",
  discount: "10",
  notes: "  Thanks!  ",
  items: JSON.stringify([
    { productId: "7", description: "Widget", quantity: "2", unitPrice: "19.99" },
    { productId: "", description: "Setup fee", quantity: "1", unitPrice: "1,250" },
  ]),
};

describe("InvoiceFormSchema", () => {
  it("parses strings into typed values and cents", () => {
    const r = InvoiceFormSchema.safeParse(validForm);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.customerId).toBe(3);
    expect(r.data.taxRate).toBe(8.5);
    expect(r.data.discount).toBe(1000);
    expect(r.data.notes).toBe("Thanks!");
    expect(r.data.items).toEqual([
      { productId: 7, description: "Widget", quantity: 2, unitPrice: 1999 },
      { productId: null, description: "Setup fee", quantity: 1, unitPrice: 125000 },
    ]);
  });

  it("treats blank discount and notes as empty", () => {
    const r = InvoiceFormSchema.safeParse({ ...validForm, discount: "", notes: "" });
    expect(r.success && r.data.discount).toBe(0);
    expect(r.success && r.data.notes).toBeNull();
  });

  it("requires a customer, at least one line and a due date on/after issue", () => {
    const r = InvoiceFormSchema.safeParse({ ...validForm, customerId: "", dueDate: "2026-02-01", items: "[]" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const state = invoiceFormErrors(r.error);
    expect(state.errors?.customerId).toBeDefined();
    expect(state.errors?.dueDate).toEqual(["Due date can't be before the issue date."]);
    expect(state.errors?.items).toEqual(["Add at least one line item."]);
  });

  it("rejects malformed JSON and bad tax rates", () => {
    const r = InvoiceFormSchema.safeParse({ ...validForm, items: "{nope", taxRate: "150" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const state = invoiceFormErrors(r.error);
    expect(state.errors?.items?.length).toBeGreaterThan(0);
    expect(state.errors?.taxRate).toEqual(["Tax rate can't exceed 100%."]);
  });

  it("labels line-item errors with their line number", () => {
    const items = JSON.stringify([
      { productId: null, description: "Ok", quantity: "1", unitPrice: "5" },
      { productId: null, description: " ", quantity: "0", unitPrice: "-3" },
    ]);
    const r = InvoiceFormSchema.safeParse({ ...validForm, items });
    expect(r.success).toBe(false);
    if (r.success) return;
    const messages = invoiceFormErrors(r.error).errors?.items ?? [];
    expect(messages).toContain("Line 2: Enter a description.");
    expect(messages).toContain("Line 2: Quantity must be at least 1.");
    expect(messages).toContain("Line 2: Unit price can't be negative.");
  });

  it("rejects fractional quantities and invalid prices", () => {
    const items = JSON.stringify([{ productId: null, description: "X", quantity: "1.5", unitPrice: "abc" }]);
    const r = InvoiceFormSchema.safeParse({ ...validForm, items });
    expect(r.success).toBe(false);
    if (r.success) return;
    const messages = invoiceFormErrors(r.error).errors?.items ?? [];
    expect(messages).toContain("Line 1: Quantity must be a whole number.");
    expect(messages).toContain("Line 1: Enter a valid unit price.");
  });
});

describe("PaymentSchema", () => {
  it("parses money and method", () => {
    const r = PaymentSchema.safeParse({ amount: "1,000.50", date: "2026-04-01", method: "card", note: "" });
    expect(r.success && r.data).toEqual({ amount: 100050, date: "2026-04-01", method: "card", note: null });
  });
  it("rejects unknown methods and bad dates", () => {
    expect(PaymentSchema.safeParse({ amount: "5", date: "2026-13-45x", method: "card" }).success).toBe(false);
    expect(PaymentSchema.safeParse({ amount: "5", date: "2026-04-01", method: "crypto" }).success).toBe(false);
  });
});

describe("validatePayment", () => {
  const sent = { status: "sent" as const, totalCents: 10_000, amountPaidCents: 2_500 };

  it("accepts amounts up to the balance", () => {
    expect(validatePayment(sent, 100)).toEqual({ ok: true });
    expect(validatePayment(sent, 7_500)).toEqual({ ok: true });
  });
  it("rejects overpayment with the balance in the message", () => {
    expect(validatePayment(sent, 7_501)).toEqual({ ok: false, error: "Amount exceeds the balance due of $75.00." });
  });
  it("rejects zero, negative and non-integer amounts", () => {
    expect(validatePayment(sent, 0).ok).toBe(false);
    expect(validatePayment(sent, -5).ok).toBe(false);
    expect(validatePayment(sent, Number.NaN).ok).toBe(false);
  });
  it("rejects draft, void and already-paid invoices", () => {
    expect(validatePayment({ ...sent, status: "draft" }, 100).ok).toBe(false);
    expect(validatePayment({ ...sent, status: "void" }, 100).ok).toBe(false);
    expect(validatePayment({ ...sent, status: "paid", amountPaidCents: 10_000 }, 100).ok).toBe(false);
  });
});

describe("applyPayment", () => {
  it("marks paid only when the balance reaches zero", () => {
    const inv = { status: "sent" as const, totalCents: 10_000, amountPaidCents: 2_500 };
    expect(applyPayment(inv, 5_000)).toEqual({ amountPaidCents: 7_500, status: "sent", fullyPaid: false });
    expect(applyPayment(inv, 7_500)).toEqual({ amountPaidCents: 10_000, status: "paid", fullyPaid: true });
  });
});

describe("status rules", () => {
  it("only drafts are editable", () => {
    expect(canEditInvoice({ status: "draft" })).toBe(true);
    expect(canEditInvoice({ status: "sent" })).toBe(false);
  });
  it("only unpaid sent invoices can be voided", () => {
    expect(canVoidInvoice({ status: "sent", amountPaidCents: 0 })).toBe(true);
    expect(canVoidInvoice({ status: "sent", amountPaidCents: 1 })).toBe(false);
    expect(canVoidInvoice({ status: "draft", amountPaidCents: 0 })).toBe(false);
    expect(canVoidInvoice({ status: "void", amountPaidCents: 0 })).toBe(false);
  });
  it("payments only on sent invoices with a balance", () => {
    expect(canRecordPayment({ status: "sent", totalCents: 100, amountPaidCents: 0 })).toBe(true);
    expect(canRecordPayment({ status: "sent", totalCents: 100, amountPaidCents: 100 })).toBe(false);
    expect(canRecordPayment({ status: "paid", totalCents: 100, amountPaidCents: 100 })).toBe(false);
  });
});

describe("stock helpers", () => {
  it("aggregates demand per stock-tracked product", () => {
    const demand = stockDemand(
      [
        { productId: 1, quantity: 2 },
        { productId: 1, quantity: 3 },
        { productId: 2, quantity: 4 }, // service
        { productId: null, quantity: 9 }, // custom line
      ],
      (id) => id === 2,
    );
    expect([...demand]).toEqual([[1, 5]]);
  });
  it("reverses sale movements", () => {
    const restore = stockToRestore([
      { productId: 1, quantity: -5 },
      { productId: 3, quantity: -1 },
      { productId: 3, quantity: 1 },
    ]);
    expect([...restore]).toEqual([[1, 5]]);
  });
});
