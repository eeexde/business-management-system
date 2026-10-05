"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { authorize } from "@/lib/auth";
import { applyStockChange, ProductCreateSchema, ProductSchema, StockAdjustSchema } from "@/lib/products";
import { getProduct, isProductInvoiced } from "@/lib/queries/products";

const DUPLICATE_SKU: ActionState = {
  ok: false,
  errors: { sku: ["Another product already uses this SKU."] },
  message: "Please fix the highlighted fields.",
};

/** Detects a UNIQUE constraint failure from libSQL (possibly wrapped by Drizzle). */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes("UNIQUE constraint failed")) return true;
  }
  return false;
}

async function skuTaken(sku: string, exceptId?: number) {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(exceptId ? and(eq(products.sku, sku), ne(products.id, exceptId)) : eq(products.sku, sku))
    .limit(1);
  return Boolean(row);
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("products:write");
  if (!auth.ok) return auth.state;
  const parsed = ProductCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { price, cost, initialStock, ...rest } = parsed.data;
  if (await skuTaken(rest.sku)) return DUPLICATE_SKU;

  // Services aren't stock-tracked, so their initial stock is ignored.
  const stock = rest.isService ? 0 : initialStock;
  let id: number;
  try {
    id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(products)
        .values({ ...rest, priceCents: price, costCents: cost, stock })
        .returning({ id: products.id });
      if (stock > 0) {
        await tx.insert(stockMovements).values({
          productId: row!.id,
          quantity: stock,
          reason: "restock",
          note: "Initial stock",
          userId: auth.user.id,
        });
      }
      return row!.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return DUPLICATE_SKU;
    throw err;
  }

  await logActivity({
    userId: auth.user.id,
    action: "product.created",
    entityType: "product",
    entityId: id,
    summary: `Added product ${rest.name} (${rest.sku})`,
  });
  revalidatePath("/products");
  redirect(`/products/${id}`);
}

/** Bound with the product id: updateProduct.bind(null, id). Stock changes go through adjustStock. */
export async function updateProduct(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("products:write");
  if (!auth.ok) return auth.state;
  const parsed = ProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { price, cost, ...rest } = parsed.data;
  if (await skuTaken(rest.sku, id)) return DUPLICATE_SKU;

  try {
    const updated = await db
      .update(products)
      .set({ ...rest, priceCents: price, costCents: cost })
      .where(eq(products.id, id))
      .returning({ id: products.id });
    if (updated.length === 0) return { ok: false, message: "That product no longer exists." };
  } catch (err) {
    if (isUniqueViolation(err)) return DUPLICATE_SKU;
    throw err;
  }

  await logActivity({
    userId: auth.user.id,
    action: "product.updated",
    entityType: "product",
    entityId: id,
    summary: `Updated product ${rest.name} (${rest.sku})`,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

/** Bound with the product id. Writes a stock movement and updates stock atomically. */
export async function adjustStock(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorize("products:write");
  if (!auth.ok) return auth.state;
  const parsed = StockAdjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { quantity, reason, note } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [product] = await tx
      .select({ name: products.name, stock: products.stock, isService: products.isService })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!product) return { error: "That product no longer exists." } as const;
    if (product.isService) return { error: "Services aren't stock-tracked." } as const;
    const next = applyStockChange(product.stock, quantity);
    if (next === null) {
      return { error: `Only ${product.stock} in stock — you can remove at most ${product.stock}.` } as const;
    }
    await tx.update(products).set({ stock: next }).where(eq(products.id, id));
    await tx.insert(stockMovements).values({ productId: id, quantity, reason, note, userId: auth.user.id });
    return { name: product.name, stock: next } as const;
  });
  if ("error" in result) return { ok: false, message: result.error };

  await logActivity({
    userId: auth.user.id,
    action: "product.stock_adjusted",
    entityType: "product",
    entityId: id,
    summary: `Adjusted stock of ${result.name} by ${quantity > 0 ? "+" : ""}${quantity} (${reason})`,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, message: `Stock updated. ${result.stock} on hand.` };
}

export async function setProductArchived(id: number, archived: boolean): Promise<ActionState> {
  const auth = await authorize("products:write");
  if (!auth.ok) return auth.state;
  const [row] = await db
    .update(products)
    .set({ archived })
    .where(eq(products.id, id))
    .returning({ name: products.name });
  if (!row) return { ok: false, message: "That product no longer exists." };

  await logActivity({
    userId: auth.user.id,
    action: archived ? "product.archived" : "product.unarchived",
    entityType: "product",
    entityId: id,
    summary: `${archived ? "Archived" : "Restored"} product ${row.name}`,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, message: archived ? "Product archived." : "Product restored." };
}

/** Hard delete, only for products never used on an invoice (otherwise archive). */
export async function deleteProduct(id: number): Promise<ActionState> {
  const auth = await authorize("products:delete");
  if (!auth.ok) return auth.state;
  const product = await getProduct(id);
  if (!product) return { ok: false, message: "That product no longer exists." };
  if (await isProductInvoiced(id)) {
    return {
      ok: false,
      message: `${product.name} appears on invoices, so it can't be deleted. Archive it instead to hide it.`,
    };
  }

  // Stock movements cascade.
  await db.delete(products).where(eq(products.id, id));
  await logActivity({
    userId: auth.user.id,
    action: "product.deleted",
    entityType: "product",
    entityId: id,
    summary: `Deleted product ${product.name} (${product.sku})`,
  });
  revalidatePath("/products");
  redirect("/products");
}
