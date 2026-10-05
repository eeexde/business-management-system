import { describe, expect, it } from "vitest";
import { activityHref, firstName, greeting, relativeTime } from "./dashboard";

describe("dashboard helpers", () => {
  it("takes the first name", () => {
    expect(firstName("Alex Morgan")).toBe("Alex");
    expect(firstName("  Priya  ")).toBe("Priya");
    expect(firstName("Cher")).toBe("Cher");
  });

  it("greets by time of day", () => {
    expect(greeting(3)).toBe("Good evening");
    expect(greeting(8)).toBe("Good morning");
    expect(greeting(13)).toBe("Good afternoon");
    expect(greeting(20)).toBe("Good evening");
  });

  it("formats relative times", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(relativeTime("2026-10-05T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-10-05T11:55:00Z", now)).toBe("5m ago");
    expect(relativeTime("2026-10-05T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-10-04T10:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-10-01T12:00:00Z", now)).toBe("4d ago");
    expect(relativeTime("2026-09-20T12:00:00Z", now)).toBe("2w ago");
    expect(relativeTime("2026-06-01T12:00:00Z", now)).toMatch(/2026/);
    expect(relativeTime("2026-10-05T12:10:00Z", now)).toBe("just now");
    expect(relativeTime("garbage", now)).toBe("");
  });

  it("links activity to entity pages", () => {
    expect(activityHref("invoice", 7)).toBe("/invoices/7");
    expect(activityHref("customer", 3)).toBe("/customers/3");
    expect(activityHref("product", null)).toBe("/products");
    expect(activityHref("expense", 9)).toBe("/expenses");
    expect(activityHref("task", 1)).toBe("/tasks");
    expect(activityHref("user", 1)).toBeNull();
  });
});
