import { describe, expect, it } from "vitest";
import { CustomerSchema } from "./customers";

describe("CustomerSchema", () => {
  it("requires a name and stores blanks as null", () => {
    const r = CustomerSchema.parse({ name: "  Dana Cole ", company: "", email: "", phone: " ", address: "", notes: "" });
    expect(r).toEqual({ name: "Dana Cole", company: null, email: null, phone: null, address: null, notes: null });
    expect(CustomerSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("validates email only when present", () => {
    expect(CustomerSchema.parse({ name: "A", email: " dana@acme.com " }).email).toBe("dana@acme.com");
    const r = CustomerSchema.safeParse({ name: "A", email: "not-an-email" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(["email"]);
  });
});
