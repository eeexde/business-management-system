import { z } from "zod";
import type { Product } from "@/db/schema";
import { optionalText } from "./customers";
import { parseMoney } from "./utils";

/**
 * Gross margin as a percent of price, rounded to one decimal, e.g. (1000, 600) -> 40.
 * Null when the price is zero or negative (margin is undefined).
 */
export function marginPercent(priceCents: number, costCents: number): number | null {
  if (priceCents <= 0) return null;
  return Math.round(((priceCents - costCents) / priceCents) * 1000) / 10;
}

/** Stock-tracked products at or below their reorder level. Services are never low. */
export function isLowStock(p: Pick<Product, "stock" | "reorderLevel" | "isService">) {
  return !p.isService && p.stock <= p.reorderLevel;
}

/** Inventory value at cost. Services and negative stock count as zero. */
export function stockValueCents(p: Pick<Product, "stock" | "costCents" | "isService">) {
  if (p.isService) return 0;
  return Math.max(0, p.stock) * p.costCents;
}

/** New stock level after a change, or null if it would go negative. */
export function applyStockChange(current: number, delta: number): number | null {
  const next = current + delta;
  return next < 0 ? null : next;
}

/** Reasons a user may pick for a manual adjustment ("sale"/"void" are written by invoices). */
export const MANUAL_STOCK_REASONS = ["restock", "adjustment", "return"] as const;
export type ManualStockReason = (typeof MANUAL_STOCK_REASONS)[number];

const money = (label: string) =>
  z
    .string({ error: `Enter a ${label}.` })
    .trim()
    .transform((v, ctx) => {
      const cents = parseMoney(v);
      if (!Number.isFinite(cents) || cents < 0) {
        ctx.addIssue({ code: "custom", message: `Enter a valid ${label} (e.g. 19.99).` });
        return z.NEVER;
      }
      if (cents > 100_000_000_00) {
        ctx.addIssue({ code: "custom", message: `That ${label} is too large.` });
        return z.NEVER;
      }
      return cents;
    });

const wholeNumber = (label: string) =>
  z.coerce
    .number({ error: `Enter a whole number for ${label}.` })
    .int({ error: `Enter a whole number for ${label}.` })
    .min(0, { error: `${label[0]!.toUpperCase()}${label.slice(1)} can't be negative.` })
    .max(1_000_000, { error: `${label[0]!.toUpperCase()}${label.slice(1)} is too large.` });

/** Validates the shared product create/edit form. */
export const ProductSchema = z.object({
  sku: z
    .string({ error: "SKU is required." })
    .trim()
    .toUpperCase()
    .min(1, { error: "SKU is required." })
    .max(40, { error: "Keep the SKU under 40 characters." })
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/, { error: "Use letters, numbers, dots, dashes or underscores." }),
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(1, { error: "Name is required." })
    .max(120, { error: "Keep the name under 120 characters." }),
  description: optionalText(2000),
  category: optionalText(60),
  price: money("price"),
  cost: money("cost"),
  reorderLevel: wholeNumber("reorder level"),
  isService: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

/** Create form adds an initial stock quantity (recorded as a restock movement). */
export const ProductCreateSchema = ProductSchema.extend({
  initialStock: wholeNumber("initial stock"),
});

export type ProductInput = z.infer<typeof ProductSchema>;

/** Validates the manual stock adjustment form on the product detail page. */
export const StockAdjustSchema = z
  .object({
    quantity: z.coerce
      .number({ error: "Enter a quantity." })
      .int({ error: "Enter a whole number." })
      .min(-1_000_000, { error: "That quantity is too large." })
      .max(1_000_000, { error: "That quantity is too large." })
      .refine((n) => n !== 0, { error: "Quantity can't be zero." }),
    reason: z.enum(MANUAL_STOCK_REASONS, { error: "Choose a reason." }),
    note: optionalText(500),
  })
  .refine((d) => d.reason === "adjustment" || d.quantity > 0, {
    error: "Restocks and returns add stock, so use a positive quantity.",
    path: ["quantity"],
  });
