import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, like, lt, or, sql, type SQL } from "drizzle-orm";
import { contains } from "@/lib/sql-search";
import { db } from "@/db";
import {
  customers,
  invoiceItems,
  invoices,
  payments,
  products,
  stockMovements,
  type Invoice,
  type PAYMENT_METHODS,
} from "@/db/schema";
import {
  applyPayment,
  PAGE_SIZE,
  stockDemand,
  stockToRestore,
  validatePayment,
  type InvoiceFormInput,
} from "@/lib/invoice-logic";
import { computeInvoiceTotals, nextInvoiceNumber, type DisplayStatus } from "@/lib/invoices";
import { addDays, today } from "@/lib/utils";
import { getSettings } from "./settings";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** SQL condition matching `displayStatus()` for a given display status. */
function statusCondition(status: DisplayStatus, asOf: string): SQL | undefined {
  const isPartial = and(gt(invoices.amountPaidCents, 0), lt(invoices.amountPaidCents, invoices.totalCents));
  switch (status) {
    case "draft":
    case "paid":
    case "void":
      return eq(invoices.status, status);
    case "overdue":
      return and(eq(invoices.status, "sent"), lt(invoices.dueDate, asOf));
    case "partial":
      return and(eq(invoices.status, "sent"), gte(invoices.dueDate, asOf), isPartial);
    case "sent":
      return and(eq(invoices.status, "sent"), gte(invoices.dueDate, asOf), sql`not (${isPartial})`);
  }
}

export async function listInvoices({
  q,
  status,
  page,
}: {
  q?: string;
  status?: DisplayStatus;
  page: number;
}) {
  const conditions: (SQL | undefined)[] = [];
  if (q) {
    conditions.push(or(contains(invoices.number, q), contains(customers.name, q), contains(customers.company, q)));
  }
  if (status) conditions.push(statusCondition(status, today()));
  const where = and(...conditions);

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        totalCents: invoices.totalCents,
        amountPaidCents: invoices.amountPaidCents,
        customerId: customers.id,
        customerName: customers.name,
        customerCompany: customers.company,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(where)
      .orderBy(desc(invoices.issueDate), desc(invoices.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(where),
  ]);
  return { rows, total: Number(count), pageCount: Math.max(1, Math.ceil(Number(count) / PAGE_SIZE)) };
}

/** Outstanding / overdue balances and cash collected in the last 30 days. */
export async function getInvoiceSummary() {
  const asOf = today();
  const balance = sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.amountPaidCents}), 0)`;
  const count = sql<number>`count(*)`;
  const [[outstanding], [overdue], [collected]] = await Promise.all([
    db.select({ cents: balance, count }).from(invoices).where(eq(invoices.status, "sent")),
    db
      .select({ cents: balance, count })
      .from(invoices)
      .where(and(eq(invoices.status, "sent"), lt(invoices.dueDate, asOf))),
    db
      .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`, count })
      .from(payments)
      .where(gte(payments.date, addDays(asOf, -30))),
  ]);
  return {
    outstanding: { cents: Number(outstanding.cents), count: Number(outstanding.count) },
    overdue: { cents: Number(overdue.cents), count: Number(overdue.count) },
    collected: { cents: Number(collected.cents), count: Number(collected.count) },
  };
}

export async function getInvoice(id: number) {
  const [row] = await db
    .select({ invoice: invoices, customer: customers })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) return null;
  const [items, paymentRows] = await Promise.all([
    db
      .select({
        id: invoiceItems.id,
        productId: invoiceItems.productId,
        description: invoiceItems.description,
        quantity: invoiceItems.quantity,
        unitPriceCents: invoiceItems.unitPriceCents,
        sku: products.sku,
        isService: products.isService,
        stock: products.stock,
      })
      .from(invoiceItems)
      .leftJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.position), asc(invoiceItems.id)),
    db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, id))
      .orderBy(asc(payments.date), asc(payments.id)),
  ]);
  return { ...row.invoice, customer: row.customer, items, payments: paymentRows };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

/** Customers and products for the editor's selects. */
export async function getInvoiceFormOptions() {
  const [customerRows, productRows] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name, company: customers.company })
      .from(customers)
      .orderBy(asc(customers.name)),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        priceCents: products.priceCents,
        stock: products.stock,
        isService: products.isService,
        archived: products.archived,
      })
      .from(products)
      .orderBy(asc(products.name)),
  ]);
  return { customers: customerRows, products: productRows };
}

export type FormCustomer = Awaited<ReturnType<typeof getInvoiceFormOptions>>["customers"][number];
export type FormProduct = Awaited<ReturnType<typeof getInvoiceFormOptions>>["products"][number];

// ---------------------------------------------------------------------------
// Writes. Each runs in a transaction and returns a result instead of throwing
// for business-rule failures, so actions can surface friendly messages.
// ---------------------------------------------------------------------------

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function nextNumber(tx: Tx, prefix: string) {
  const rows = await tx
    .select({ number: invoices.number })
    .from(invoices)
    .where(like(invoices.number, `${prefix}%`));
  return nextInvoiceNumber(prefix, rows.map((r) => r.number));
}

/** Ensure the customer and every referenced product exist. */
async function checkReferences(tx: Tx, input: InvoiceFormInput): Promise<string | null> {
  const [customer] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, input.customerId))
    .limit(1);
  if (!customer) return "That customer no longer exists.";
  const productIds = [...new Set(input.items.flatMap((i) => (i.productId === null ? [] : [i.productId])))];
  if (productIds.length) {
    const found = await tx.select({ id: products.id }).from(products).where(inArray(products.id, productIds));
    if (found.length !== productIds.length) return "One of the selected products no longer exists.";
  }
  return null;
}

function headerValues(input: InvoiceFormInput) {
  // Totals are always recomputed on the server; client previews are never trusted.
  const totals = computeInvoiceTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPriceCents: i.unitPrice })),
    input.taxRate,
    input.discount,
  );
  return {
    customerId: input.customerId,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    taxRate: input.taxRate,
    notes: input.notes,
    ...totals,
  };
}

function itemRows(invoiceId: number, input: InvoiceFormInput) {
  return input.items.map((item, position) => ({
    invoiceId,
    productId: item.productId,
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPrice,
    position,
  }));
}

export async function createInvoice(
  input: InvoiceFormInput,
  userId: number,
): Promise<Result<{ id: number; number: string }>> {
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    const problem = await checkReferences(tx, input);
    if (problem) return { ok: false, error: problem };
    const number = await nextNumber(tx, settings.invoicePrefix);
    const [created] = await tx
      .insert(invoices)
      .values({ ...headerValues(input), number, status: "draft", createdBy: userId })
      .returning({ id: invoices.id });
    await tx.insert(invoiceItems).values(itemRows(created.id, input));
    return { ok: true, id: created.id, number };
  });
}

export async function updateDraftInvoice(id: number, input: InvoiceFormInput): Promise<Result<{ number: string }>> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: invoices.status, number: invoices.number })
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);
    if (!current) return { ok: false, error: "Invoice not found." };
    if (current.status !== "draft") return { ok: false, error: "Only draft invoices can be edited." };
    const problem = await checkReferences(tx, input);
    if (problem) return { ok: false, error: problem };
    await tx.update(invoices).set(headerValues(input)).where(eq(invoices.id, id));
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await tx.insert(invoiceItems).values(itemRows(id, input));
    return { ok: true, number: current.number };
  });
}

async function lockedInvoice(tx: Tx, id: number): Promise<Invoice | undefined> {
  const [row] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return row;
}

/** Draft -> sent. Decrements stock for non-service products; stock may go negative. */
export async function markInvoiceSent(
  id: number,
  userId: number,
): Promise<Result<{ number: string; negativeStock: { name: string; stock: number }[] }>> {
  return db.transaction(async (tx) => {
    const invoice = await lockedInvoice(tx, id);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.status !== "draft") return { ok: false, error: "Only draft invoices can be marked as sent." };

    const lines = await tx
      .select({ productId: invoiceItems.productId, quantity: invoiceItems.quantity, isService: products.isService })
      .from(invoiceItems)
      .leftJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoiceItems.invoiceId, id));
    if (lines.length === 0) return { ok: false, error: "Add at least one line item before sending." };

    const services = new Set(lines.filter((l) => l.isService !== false).map((l) => l.productId));
    const demand = stockDemand(lines, (pid) => services.has(pid));
    const negativeStock: { name: string; stock: number }[] = [];
    for (const [productId, quantity] of demand) {
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${quantity}` })
        .where(eq(products.id, productId))
        .returning({ name: products.name, stock: products.stock });
      await tx.insert(stockMovements).values({
        productId,
        quantity: -quantity,
        reason: "sale",
        note: `Invoice ${invoice.number}`,
        invoiceId: id,
        userId,
      });
      if (updated && updated.stock < 0) negativeStock.push(updated);
    }
    await tx.update(invoices).set({ status: "sent" }).where(eq(invoices.id, id));
    return { ok: true, number: invoice.number, negativeStock };
  });
}

export async function recordPayment(
  id: number,
  payment: { amountCents: number; date: string; method: (typeof PAYMENT_METHODS)[number]; note: string | null },
  currency: string,
): Promise<Result<{ number: string; fullyPaid: boolean }>> {
  return db.transaction(async (tx) => {
    const invoice = await lockedInvoice(tx, id);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    const check = validatePayment(invoice, payment.amountCents, currency);
    if (!check.ok) return check;
    if (payment.date < invoice.issueDate) return { ok: false, error: "Payment date can't be before the issue date." };

    await tx.insert(payments).values({
      invoiceId: id,
      amountCents: payment.amountCents,
      date: payment.date,
      method: payment.method,
      note: payment.note,
    });
    const next = applyPayment(invoice, payment.amountCents);
    await tx
      .update(invoices)
      .set({
        amountPaidCents: next.amountPaidCents,
        status: next.status,
        // paidAt records when the final payment landed (its business date).
        paidAt: next.fullyPaid ? `${payment.date}T12:00:00.000Z` : null,
      })
      .where(eq(invoices.id, id));
    return { ok: true, number: invoice.number, fullyPaid: next.fullyPaid };
  });
}

/** Sent (unpaid) -> void. Reverses this invoice's sale movements. */
export async function voidInvoice(id: number, userId: number): Promise<Result<{ number: string }>> {
  return db.transaction(async (tx) => {
    const invoice = await lockedInvoice(tx, id);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.status !== "sent" || invoice.amountPaidCents > 0) {
      return { ok: false, error: "Only sent invoices without payments can be voided." };
    }
    const movements = await tx
      .select({ productId: stockMovements.productId, quantity: stockMovements.quantity })
      .from(stockMovements)
      .where(and(eq(stockMovements.invoiceId, id), inArray(stockMovements.reason, ["sale", "void"])));
    for (const [productId, quantity] of stockToRestore(movements)) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${quantity}` })
        .where(eq(products.id, productId));
      await tx.insert(stockMovements).values({
        productId,
        quantity,
        reason: "void",
        note: `Voided invoice ${invoice.number}`,
        invoiceId: id,
        userId,
      });
    }
    await tx.update(invoices).set({ status: "void" }).where(eq(invoices.id, id));
    return { ok: true, number: invoice.number };
  });
}

/** Copy an invoice (any status) into a new draft dated today. */
export async function duplicateInvoice(id: number, userId: number): Promise<Result<{ id: number; number: string }>> {
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    const source = await lockedInvoice(tx, id);
    if (!source) return { ok: false, error: "Invoice not found." };
    const items = await tx
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(asc(invoiceItems.position), asc(invoiceItems.id));
    const issueDate = today();
    const totals = computeInvoiceTotals(items, source.taxRate, source.discountCents);
    const number = await nextNumber(tx, settings.invoicePrefix);
    const [created] = await tx
      .insert(invoices)
      .values({
        number,
        customerId: source.customerId,
        status: "draft",
        issueDate,
        dueDate: addDays(issueDate, settings.paymentTerms),
        taxRate: source.taxRate,
        notes: source.notes,
        createdBy: userId,
        ...totals,
      })
      .returning({ id: invoices.id });
    if (items.length) {
      await tx.insert(invoiceItems).values(
        items.map((item, position) => ({
          invoiceId: created.id,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          position,
        })),
      );
    }
    return { ok: true, id: created.id, number };
  });
}

export async function deleteDraftInvoice(id: number): Promise<Result<{ number: string }>> {
  return db.transaction(async (tx) => {
    const invoice = await lockedInvoice(tx, id);
    if (!invoice) return { ok: false, error: "Invoice not found." };
    if (invoice.status !== "draft") return { ok: false, error: "Only draft invoices can be deleted." };
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await tx.delete(invoices).where(eq(invoices.id, id));
    return { ok: true, number: invoice.number };
  });
}
