import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeNext("/invoices/12?tab=payments#history")).toBe("/invoices/12?tab=payments#history");
  });

  it.each([
    undefined,
    "",
    "dashboard",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "/.//evil.com",
    "/..//evil.com",
    "/%2e//evil.com",
    "/\tevil.com",
    "/\nevil.com",
    "javascript:alert(1)",
  ])("falls back for %j", (input) => {
    const out = safeNext(input);
    expect(out.startsWith("/")).toBe(true);
    expect(out.startsWith("//")).toBe(false);
    expect(new URL(out, "http://x.invalid").origin).toBe("http://x.invalid");
  });

  it("uses dashboard as the fallback", () => {
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("/.//evil.com")).toBe("/dashboard");
  });
});
