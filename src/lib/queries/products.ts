import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { contains } from "@/lib/sql-search";
import { db } from "@/db";
import { invoiceItems, invoices, products, stockMovements, users } from "@/db/schema";

export const PRODUCTS_PAGE_SIZE = 25;

export type ProductFilters = {
  q?: string;
  category?: string;
  lowStock?: boolean;
  showArchived?: boolean;
  page?: number;
};

/** Mirrors isLowStock() in @/lib/products. */
const lowStockCondition = sql`(${products.isService} = 0 and ${products.stock} <= ${products.reorderLevel})`;

function productFilter({ q, category, lowStock, showArchived }: ProductFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (!showArchived) conditions.push(eq(products.archived, false));
  if (q) conditions.push(or(contains(products.name, q), contains(products.sku, q)));
  if (category) conditions.push(eq(products.category, category));
  if (lowStock) conditions.push(lowStockCondition);
  return and(...conditions);
}

export async function listProducts(filters: ProductFilters) {
  const page = filters.page ?? 1;
  const where = productFilter(filters);
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(asc(products.name), asc(products.id))
      .limit(PRODUCTS_PAGE_SIZE)
      .offset((page - 1) * PRODUCTS_PAGE_SIZE),
    db.select({ total: count() }).from(products).where(where),
  ]);
  return { rows, total: totalRow?.total ?? 0 };
}

/** Distinct categories in use, for filters and the form's datalist. */
export async function listProductCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(isNotNull(products.category))
    .orderBy(asc(products.category));
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c));
}

/** Headline numbers for the products list (active products only). */
export async function getInventorySummary() {
  const [row] = await db
    .select({
      activeCount: count(),
      lowStockCount: sql<number>`coalesce(sum(case when ${lowStockCondition} then 1 else 0 end), 0)`,
      stockValueCents: sql<number>`coalesce(sum(case when ${products.isService} = 0
          then max(${products.stock}, 0) * ${products.costCents} else 0 end), 0)`,
    })
    .from(products)
    .where(eq(products.archived, false));
  return row ?? { activeCount: 0, lowStockCount: 0, stockValueCents: 0 };
}

export async function getProduct(id: number) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

export async function getProductMovements(id: number, limit = 100) {
  return db
    .select({
      id: stockMovements.id,
      quantity: stockMovements.quantity,
      reason: stockMovements.reason,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      invoiceId: stockMovements.invoiceId,
      invoiceNumber: invoices.number,
      userName: users.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .leftJoin(invoices, eq(invoices.id, stockMovements.invoiceId))
    .where(eq(stockMovements.productId, id))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(limit);
}

/** Units on issued (sent or paid) invoices dated on or after `since` (YYYY-MM-DD). */
export async function getUnitsSoldSince(id: number, since: string) {
  const [row] = await db
    .select({ units: sql<number>`coalesce(sum(${invoiceItems.quantity}), 0)` })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
    .where(
      and(
        eq(invoiceItems.productId, id),
        inArray(invoices.status, ["sent", "paid"]),
        gte(invoices.issueDate, since),
      ),
    );
  return row?.units ?? 0;
}

/** True when any invoice line references the product (then it can only be archived). */
export async function isProductInvoiced(id: number) {
  const [row] = await db
    .select({ id: invoiceItems.id })
    .from(invoiceItems)
    .where(eq(invoiceItems.productId, id))
    .limit(1);
  return Boolean(row);
}
