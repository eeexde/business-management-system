import { describe, expect, it } from "vitest";
import {
  applyStockChange,
  isLowStock,
  marginPercent,
  ProductCreateSchema,
  ProductSchema,
  StockAdjustSchema,
  stockValueCents,
} from "./products";

describe("marginPercent", () => {
  it("computes margin over price, rounded to one decimal", () => {
    expect(marginPercent(1000, 600)).toBe(40);
    expect(marginPercent(2999, 1850)).toBe(38.3);
  });
  it("can be negative when selling below cost", () => {
    expect(marginPercent(1000, 1500)).toBe(-50);
  });
  it("is null when price is zero", () => {
    expect(marginPercent(0, 500)).toBeNull();
  });
  it("is 100 for zero-cost items", () => {
    expect(marginPercent(5000, 0)).toBe(100);
  });
});

describe("isLowStock", () => {
  it("flags stock at or below the reorder level", () => {
    expect(isLowStock({ stock: 5, reorderLevel: 5, isService: false })).toBe(true);
    expect(isLowStock({ stock: 2, reorderLevel: 5, isService: false })).toBe(true);
    expect(isLowStock({ stock: 6, reorderLevel: 5, isService: false })).toBe(false);
  });
  it("never flags services", () => {
    expect(isLowStock({ stock: 0, reorderLevel: 10, isService: true })).toBe(false);
  });
});

describe("stockValueCents", () => {
  it("multiplies stock by unit cost", () => {
    expect(stockValueCents({ stock: 12, costCents: 250, isService: false })).toBe(3000);
  });
  it("is zero for services and negative stock", () => {
    expect(stockValueCents({ stock: 12, costCents: 250, isService: true })).toBe(0);
    expect(stockValueCents({ stock: -3, costCents: 250, isService: false })).toBe(0);
  });
});

describe("applyStockChange", () => {
  it("returns the new level, or null when it would go negative", () => {
    expect(applyStockChange(10, 5)).toBe(15);
    expect(applyStockChange(10, -10)).toBe(0);
    expect(applyStockChange(10, -11)).toBeNull();
  });
});

describe("ProductSchema", () => {
  const valid = {
    sku: " ofc-001 ",
    name: "Copy paper",
    description: "",
    category: "Office Supplies",
    price: "$1,249.50",
    cost: "800",
    reorderLevel: "10",
  };

  it("normalizes SKU, money, and optional fields", () => {
    const r = ProductSchema.parse(valid);
    expect(r.sku).toBe("OFC-001");
    expect(r.price).toBe(124950);
    expect(r.cost).toBe(80000);
    expect(r.reorderLevel).toBe(10);
    expect(r.description).toBeNull();
    expect(r.isService).toBe(false);
  });

  it("reads the isService checkbox", () => {
    expect(ProductSchema.parse({ ...valid, isService: "on" }).isService).toBe(true);
  });

  it("rejects bad money and SKUs", () => {
    const r = ProductSchema.safeParse({ ...valid, price: "abc", sku: "bad sku" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("price");
    expect(paths).toContain("sku");
  });

  it("requires a non-negative whole initial stock on create", () => {
    expect(ProductCreateSchema.parse({ ...valid, initialStock: "25" }).initialStock).toBe(25);
    expect(ProductCreateSchema.safeParse({ ...valid, initialStock: "-1" }).success).toBe(false);
    expect(ProductCreateSchema.safeParse({ ...valid, initialStock: "1.5" }).success).toBe(false);
  });
});

describe("StockAdjustSchema", () => {
  it("accepts negative adjustments", () => {
    const r = StockAdjustSchema.parse({ quantity: "-3", reason: "adjustment", note: "Damaged" });
    expect(r).toEqual({ quantity: -3, reason: "adjustment", note: "Damaged" });
  });
  it("rejects zero and negative restocks", () => {
    expect(StockAdjustSchema.safeParse({ quantity: "0", reason: "adjustment" }).success).toBe(false);
    const r = StockAdjustSchema.safeParse({ quantity: "-2", reason: "restock" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(["quantity"]);
  });
  it("rejects reasons reserved for invoices", () => {
    expect(StockAdjustSchema.safeParse({ quantity: "2", reason: "sale" }).success).toBe(false);
  });
});
