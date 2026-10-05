import { describe, expect, it } from "vitest";
import {
  addMonths,
  categoryBreakdown,
  formatMonth,
  isMonthKey,
  monthRange,
  percentChange,
  recentMonths,
} from "./expenses";

describe("month helpers", () => {
  it("validates month keys", () => {
    expect(isMonthKey("2026-03")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-3")).toBe(false);
    expect(isMonthKey(undefined)).toBe(false);
  });

  it("adds months across year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-05", -17)).toBe("2024-12");
  });

  it("builds a half-open month range", () => {
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  it("lists recent months newest first", () => {
    const months = recentMonths("2026-02-14", 3);
    expect(months.map((m) => m.value)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(months[0].label).toBe(formatMonth("2026-02"));
    expect(recentMonths("2026-02-14")).toHaveLength(12);
  });
});

describe("percentChange", () => {
  it("returns null without a baseline", () => {
    expect(percentChange(500, 0)).toBeNull();
  });
  it("computes increases and decreases", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(75, 100)).toBe(-25);
  });
});

describe("categoryBreakdown", () => {
  it("sorts by total, drops empty categories and computes shares", () => {
    const result = categoryBreakdown([
      { category: "software", totalCents: 1000 },
      { category: "rent", totalCents: 3000 },
      { category: "travel", totalCents: 0 },
    ]);
    expect(result.map((r) => r.category)).toEqual(["rent", "software"]);
    expect(result[0].share).toBe(75);
    expect(result[1].share).toBe(25);
  });
  it("handles an empty list", () => {
    expect(categoryBreakdown([])).toEqual([]);
  });
});
