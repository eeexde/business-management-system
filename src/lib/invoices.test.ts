import { describe, expect, it } from "vitest";
import {
  agingBucket,
  balanceDue,
  computeInvoiceTotals,
  daysOverdue,
  displayStatus,
  nextInvoiceNumber,
} from "./invoices";

describe("computeInvoiceTotals", () => {
  it("sums lines, applies discount before tax, rounds tax", () => {
    const t = computeInvoiceTotals(
      [
        { quantity: 2, unitPriceCents: 1999 },
        { quantity: 1, unitPriceCents: 500 },
      ],
      8.5,
      498,
    );
    expect(t.subtotalCents).toBe(4498);
    expect(t.discountCents).toBe(498);
    expect(t.taxCents).toBe(340); // 4000 * 8.5% = 340
    expect(t.totalCents).toBe(4340);
  });

  it("clamps discount to subtotal and never goes negative", () => {
    const t = computeInvoiceTotals([{ quantity: 1, unitPriceCents: 1000 }], 10, 5000);
    expect(t.discountCents).toBe(1000);
    expect(t.totalCents).toBe(0);
  });

  it("handles empty invoices", () => {
    expect(computeInvoiceTotals([], 10).totalCents).toBe(0);
  });
});

describe("displayStatus", () => {
  const base = { dueDate: "2026-03-10", totalCents: 1000, amountPaidCents: 0 };
  it("derives overdue from sent + past due", () => {
    expect(displayStatus({ ...base, status: "sent" }, "2026-03-11")).toBe("overdue");
    expect(displayStatus({ ...base, status: "sent" }, "2026-03-10")).toBe("sent");
  });
  it("derives partial", () => {
    expect(displayStatus({ ...base, status: "sent", amountPaidCents: 400 }, "2026-03-01")).toBe("partial");
  });
  it("keeps stored statuses otherwise", () => {
    expect(displayStatus({ ...base, status: "paid" }, "2027-01-01")).toBe("paid");
    expect(displayStatus({ ...base, status: "draft" }, "2027-01-01")).toBe("draft");
  });
});

describe("helpers", () => {
  it("balanceDue floors at zero", () => {
    expect(balanceDue({ totalCents: 100, amountPaidCents: 150 })).toBe(0);
  });
  it("nextInvoiceNumber pads and ignores other prefixes", () => {
    expect(nextInvoiceNumber("INV-", ["INV-0009", "INV-0041", "X-9999"])).toBe("INV-0042");
    expect(nextInvoiceNumber("INV-", [])).toBe("INV-0001");
  });
  it("aging buckets", () => {
    expect(daysOverdue("2026-01-01", "2026-01-31")).toBe(30);
    expect(agingBucket("2026-01-01", "2025-12-31")).toBe("current");
    expect(agingBucket("2026-01-01", "2026-01-31")).toBe("1-30");
    expect(agingBucket("2026-01-01", "2026-04-15")).toBe("90+");
  });
});
