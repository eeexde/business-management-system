import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildAging,
  buildPnl,
  categoryBreakdown,
  categoryLabel,
  endOfMonth,
  isIsoDate,
  marginPct,
  monthKeys,
  monthLabel,
  percentChange,
  rangeParams,
  resolveRange,
  startOfMonth,
} from "./reports";

describe("date helpers", () => {
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-2-1")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("finds month boundaries, including leap years", () => {
    expect(startOfMonth("2026-10-05")).toBe("2026-10-01");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
    expect(endOfMonth("2026-12-31")).toBe("2026-12-31");
  });

  it("shifts months across years", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-05", 0)).toBe("2026-05");
  });

  it("labels months", () => {
    expect(monthLabel("2026-03")).toBe("Mar");
    expect(monthLabel("2026-12", true)).toBe("Dec 2026");
  });

  it("labels categories", () => {
    expect(categoryLabel("software")).toBe("Software");
  });
});

describe("resolveRange", () => {
  const today = "2026-10-05";

  it("resolves presets", () => {
    expect(resolveRange("this-month", today)).toEqual({ key: "this-month", from: "2026-10-01", to: today });
    expect(resolveRange("last-month", today)).toEqual({ key: "last-month", from: "2026-09-01", to: "2026-09-30" });
    expect(resolveRange("this-quarter", today)).toEqual({ key: "this-quarter", from: "2026-10-01", to: today });
    expect(resolveRange("ytd", today)).toEqual({ key: "ytd", from: "2026-01-01", to: today });
    expect(resolveRange("last-12-months", today)).toEqual({ key: "last-12-months", from: "2025-11-01", to: today });
  });

  it("handles quarter and January edges", () => {
    expect(resolveRange("this-quarter", "2026-03-31").from).toBe("2026-01-01");
    expect(resolveRange("this-quarter", "2026-08-15").from).toBe("2026-07-01");
    expect(resolveRange("last-month", "2026-01-15")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(resolveRange("last-month", "2026-03-31")).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("falls back to the default for unknown or missing input", () => {
    expect(resolveRange(undefined, today).key).toBe("last-12-months");
    expect(resolveRange("forever", today).key).toBe("last-12-months");
  });

  it("accepts custom ranges, swapping reversed ones, and rejects invalid dates", () => {
    expect(resolveRange("custom", today, { from: "2026-02-01", to: "2026-03-15" })).toEqual({
      key: "custom",
      from: "2026-02-01",
      to: "2026-03-15",
    });
    expect(resolveRange("custom", today, { from: "2026-05-01", to: "2026-04-01" })).toMatchObject({
      from: "2026-04-01",
      to: "2026-05-01",
    });
    expect(resolveRange("custom", today, { from: "nope", to: "2026-04-01" }).key).toBe("last-12-months");
    expect(resolveRange("custom", today).key).toBe("last-12-months");
  });
});

describe("rangeParams", () => {
  it("round-trips presets and custom ranges", () => {
    const today = "2026-10-05";
    expect(rangeParams(resolveRange("ytd", today))).toEqual({ range: "ytd" });
    const custom = resolveRange("custom", today, { from: "2026-01-01", to: "2026-02-01" });
    const p = rangeParams(custom);
    expect(resolveRange(p.range, today, p)).toEqual(custom);
  });
});

describe("monthKeys", () => {
  it("lists every month touched by the range", () => {
    expect(monthKeys("2025-11-15", "2026-02-03")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthKeys("2026-10-01", "2026-10-05")).toEqual(["2026-10"]);
  });
  it("yields 12 months for the last-12-months range", () => {
    const r = resolveRange("last-12-months", "2026-10-05");
    const keys = monthKeys(r.from, r.to);
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe("2025-11");
    expect(keys[11]).toBe("2026-10");
  });
  it("is empty for a reversed range", () => {
    expect(monthKeys("2026-05-01", "2026-04-01")).toEqual([]);
  });
});

describe("percentChange / marginPct", () => {
  it("computes change with one decimal and no baseline as null", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(1, 3)).toBe(-66.7);
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(-50, -100)).toBe(50);
  });
  it("computes margin and null without revenue", () => {
    expect(marginPct(1000, 250)).toBe(25);
    expect(marginPct(1000, -500)).toBe(-50);
    expect(marginPct(0, -500)).toBeNull();
  });
});

describe("buildPnl", () => {
  const months = ["2026-01", "2026-02", "2026-03"];

  it("zero-fills months, sums by category and computes net and margin", () => {
    const pnl = buildPnl(
      months,
      [
        { month: "2026-01", cents: 10_000 },
        { month: "2026-03", cents: 20_000 },
        { month: "2026-03", cents: 5_000 },
      ],
      [
        { month: "2026-01", category: "rent", cents: 4_000 },
        { month: "2026-01", category: "software", cents: 1_000 },
        { month: "2026-02", category: "rent", cents: 4_000 },
        { month: "2026-03", category: "marketing", cents: 2_500 },
      ],
    );
    expect(pnl.rows.map((r) => r.month)).toEqual(months);
    expect(pnl.rows[0]).toMatchObject({ revenueCents: 10_000, expensesCents: 5_000, netCents: 5_000, marginPct: 50 });
    expect(pnl.rows[0]!.byCategory.rent).toBe(4_000);
    expect(pnl.rows[1]).toMatchObject({ revenueCents: 0, expensesCents: 4_000, netCents: -4_000, marginPct: null });
    expect(pnl.rows[2]).toMatchObject({ revenueCents: 25_000, expensesCents: 2_500, netCents: 22_500, marginPct: 90 });
    expect(pnl.totals).toMatchObject({ revenueCents: 35_000, expensesCents: 11_500, netCents: 23_500, marginPct: 67.1 });
    expect(pnl.totals.byCategory.rent).toBe(8_000);
    expect(pnl.categories).toEqual(["rent", "marketing", "software"]);
  });

  it("ignores amounts outside the requested months", () => {
    const pnl = buildPnl(["2026-01"], [{ month: "2025-12", cents: 999 }], [{ month: "2026-02", category: "rent", cents: 1 }]);
    expect(pnl.totals.revenueCents).toBe(0);
    expect(pnl.totals.expensesCents).toBe(0);
    expect(pnl.categories).toEqual([]);
  });

  it("handles no months", () => {
    const pnl = buildPnl([], [], []);
    expect(pnl.rows).toEqual([]);
    expect(pnl.totals.netCents).toBe(0);
  });
});

describe("categoryBreakdown", () => {
  it("merges, sorts by amount, drops zeros and computes shares", () => {
    const slices = categoryBreakdown([
      { category: "rent", cents: 3_000 },
      { category: "travel", cents: 0 },
      { category: "software", cents: 500 },
      { category: "rent", cents: 1_500 },
      { category: "supplies", cents: 1_000 },
    ]);
    expect(slices.map((s) => s.category)).toEqual(["rent", "supplies", "software"]);
    expect(slices[0]).toEqual({ category: "rent", cents: 4_500, pct: 75 });
    expect(slices[2]!.pct).toBe(8.3);
  });
  it("is empty without spend", () => {
    expect(categoryBreakdown([])).toEqual([]);
  });
});

describe("buildAging", () => {
  it("groups balances by customer and bucket", () => {
    const aging = buildAging(
      [
        { customerId: 1, customerName: "Acme", dueDate: "2026-10-10", balanceCents: 1_000 }, // current
        { customerId: 1, customerName: "Acme", dueDate: "2026-09-20", balanceCents: 2_000 }, // 15 days
        { customerId: 2, customerName: "Globex", dueDate: "2026-06-01", balanceCents: 500 }, // 126 days
        { customerId: 2, customerName: "Globex", dueDate: "2026-08-20", balanceCents: 700 }, // 46 days
        { customerId: 3, customerName: "Zero", dueDate: "2026-08-20", balanceCents: 0 }, // skipped
      ],
      "2026-10-05",
    );
    expect(aging.rows.map((r) => r.customerName)).toEqual(["Acme", "Globex"]);
    expect(aging.rows[0]!.buckets).toEqual({ current: 1_000, "1-30": 2_000, "31-60": 0, "61-90": 0, "90+": 0 });
    expect(aging.rows[1]!.buckets["90+"]).toBe(500);
    expect(aging.rows[1]!.buckets["31-60"]).toBe(700);
    expect(aging.totals).toEqual({ current: 1_000, "1-30": 2_000, "31-60": 700, "61-90": 0, "90+": 500 });
    expect(aging.totalCents).toBe(4_200);
  });

  it("is empty with no open invoices", () => {
    expect(buildAging([], "2026-10-05")).toMatchObject({ rows: [], totalCents: 0 });
  });
});
