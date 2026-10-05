/**
 * Demo invoices: ~180 invoices over the last 12 months with growth toward recent months,
 * payments, a realistic status mix and matching stock movements. Deterministic (seeded PRNG).
 * Requires customers and products (run after seedCustomersProducts). Skips if invoices exist.
 */
import { asc, count } from "drizzle-orm";
import { db } from "../../src/db";
import {
  customers,
  invoiceItems,
  invoices,
  payments,
  PAYMENT_METHODS,
  products,
  settings as settingsTable,
  stockMovements,
  users,
  type InvoiceStatus,
} from "../../src/db/schema";
import { computeInvoiceTotals, nextInvoiceNumber } from "../../src/lib/invoices";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(31415926);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return isoDate(new Date(y!, m! - 1, d! + days));
}
const stamp = (date: string, time = "12:00:00") => `${date}T${time}.000Z`;

const TARGET = 180;
const DRAFTS = 6;
const VOIDS = 3;
const OVERDUE = 8;
const PARTIAL = 5;

const NOTES = [
  "Thank you for your business!",
  "Please include the invoice number with your payment.",
  "Bank transfer preferred. Account details on request.",
  "Thanks for the repeat order. We appreciate it.",
];

type Plan = {
  issueDate: string;
  dueDate: string;
  age: number;
  status: InvoiceStatus;
  /** Payments as [days after issue, fraction of total]; fractions of a paid invoice sum to 1. */
  pays: { offset: number; fraction: number }[];
};

export async function seedInvoices(): Promise<void> {
  const [{ n: existing }] = await db.select({ n: count() }).from(invoices);
  if (existing > 0) {
    console.log("Invoices already seeded; skipping.");
    return;
  }

  const customerRows = await db.select({ id: customers.id }).from(customers).orderBy(asc(customers.id));
  const productRows = (await db.select().from(products).orderBy(asc(products.id))).filter((p) => !p.archived);
  if (customerRows.length === 0 || productRows.length === 0) {
    throw new Error("seedInvoices needs customers and products. Run the customers/products seed first.");
  }
  const userRows = await db.select({ id: users.id, role: users.role }).from(users).orderBy(asc(users.id));
  const creators = userRows.filter((u) => u.role !== "staff").map((u) => u.id);
  const actorId = creators[0] ?? userRows[0]?.id ?? null;
  const [settings] = await db.select().from(settingsTable).limit(1);
  const prefix = settings?.invoicePrefix ?? "INV-";
  const terms = settings?.paymentTerms ?? 30;
  const taxRate = settings?.defaultTaxRate ?? 0;
  const today = isoDate(new Date());

  // Issue dates: 0-364 days ago, density rising toward today (business is growing).
  const ages: number[] = [];
  while (ages.length < TARGET) {
    const t = rand(); // 0 = a year ago, 1 = today
    if (rand() < 0.4 + 0.6 * t) ages.push(Math.min(364, Math.floor((1 - t) * 365)));
  }
  ages.sort((a, b) => b - a); // oldest first -> sequential numbers by issue date

  const plans: Plan[] = ages.map((age) => {
    const issueDate = addDays(today, -age);
    const net = rand() < 0.15 ? pick([15, 45]) : terms;
    return { issueDate, dueDate: addDays(issueDate, net), age, status: "paid", pays: [] };
  });

  // Status mix. Indices are chosen from candidate pools so each lands in a sensible age range.
  const taken = new Set<number>();
  const choose = (filter: (p: Plan) => boolean, n: number) => {
    const pool = shuffle(plans.map((p, i) => i).filter((i) => !taken.has(i) && filter(plans[i]!)));
    const chosen = pool.slice(0, n);
    for (const i of chosen) taken.add(i);
    return chosen;
  };
  const pastDue = (p: Plan) => p.dueDate < today;

  for (const i of choose((p) => p.age <= 14, DRAFTS)) plans[i]!.status = "draft";
  for (const i of choose((p) => p.age >= 45 && p.age <= 300, VOIDS)) plans[i]!.status = "void";
  choose((p) => pastDue(p) && p.age <= terms + 100, OVERDUE).forEach((i, k) => {
    const p = plans[i]!;
    p.status = "sent";
    // A couple of overdue invoices have a partial payment on them.
    if (k < 2) p.pays = [{ offset: int(5, Math.max(5, p.age - 1)), fraction: 0.3 + rand() * 0.3 }];
  });
  for (const i of choose((p) => !pastDue(p) && p.age >= 3, PARTIAL)) {
    const p = plans[i]!;
    p.status = "sent";
    p.pays = [{ offset: int(1, p.age), fraction: 0.25 + rand() * 0.35 }];
  }
  plans.forEach((p, i) => {
    if (taken.has(i)) return;
    if (!pastDue(p) && rand() < 0.6) {
      p.status = "sent"; // recent, not yet due
      return;
    }
    p.status = "paid";
    const latest = Math.min(p.age, terms + 25);
    const final = int(Math.min(3, latest), latest);
    p.pays =
      rand() < 0.2 && final >= 6
        ? [
            { offset: int(1, final - 3), fraction: 0.4 + rand() * 0.2 },
            { offset: final, fraction: 1 },
          ]
        : [{ offset: final, fraction: 1 }];
  });

  // Customers are Pareto-ish: a handful of accounts buy far more often.
  const customerFor = () => customerRows[Math.floor(customerRows.length * rand() ** 1.8)]!.id;
  const lineCount = () => {
    const r = rand();
    return r < 0.25 ? 1 : r < 0.55 ? 2 : r < 0.8 ? 3 : r < 0.92 ? 4 : 5;
  };

  const numbers: string[] = [];
  type Sale = { productId: number; quantity: number; date: string };
  const sales: Sale[] = [];

  await db.transaction(async (tx) => {
    for (const plan of plans) {
      const growth = 1 + 0.6 * (1 - plan.age / 365);
      const chosen = shuffle(productRows).slice(0, Math.min(lineCount(), productRows.length));
      const lines = chosen.map((product, position) => {
        const base = product.isService ? int(2, 16) : product.priceCents >= 30_000 ? int(1, 4) : int(1, 12);
        return {
          productId: product.id,
          isService: product.isService,
          description: product.name,
          quantity: Math.max(1, Math.round(base * growth)),
          unitPriceCents: product.priceCents,
          position,
        };
      });
      const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0);
      const discount = rand() < 0.12 ? Math.round((subtotal * 0.05) / 100) * 100 : 0;
      const totals = computeInvoiceTotals(lines, taxRate, discount);

      // Payment amounts in cents; the last payment of a paid invoice settles the remainder exactly.
      const paymentRows: { amountCents: number; date: string }[] = [];
      let paid = 0;
      for (const pay of plan.pays) {
        const amount =
          plan.status === "paid" && pay.fraction === 1
            ? totals.totalCents - paid
            : Math.round((totals.totalCents * pay.fraction) / 100) * 100;
        const date = addDays(plan.issueDate, Math.min(pay.offset, plan.age));
        if (amount > 0) paymentRows.push({ amountCents: amount, date });
        paid += amount;
      }
      const lastPayment = paymentRows.at(-1)?.date;

      const number = nextInvoiceNumber(prefix, numbers);
      numbers.push(number);
      const createdAt = stamp(plan.issueDate, "09:00:00");
      const [inv] = await tx
        .insert(invoices)
        .values({
          number,
          customerId: customerFor(),
          status: plan.status,
          issueDate: plan.issueDate,
          dueDate: plan.dueDate,
          taxRate,
          ...totals,
          amountPaidCents: paid,
          notes: rand() < 0.35 ? pick(NOTES) : null,
          paidAt: plan.status === "paid" && lastPayment ? stamp(lastPayment) : null,
          createdBy: creators.length ? pick(creators) : null,
          createdAt,
        })
        .returning({ id: invoices.id });
      const invoiceId = inv!.id;

      await tx.insert(invoiceItems).values(
        lines.map(({ productId, description, quantity, unitPriceCents, position }) => ({
          invoiceId,
          productId,
          description,
          quantity,
          unitPriceCents,
          position,
        })),
      );
      if (paymentRows.length) {
        await tx.insert(payments).values(
          paymentRows.map((p) => ({
            invoiceId,
            ...p,
            method: pick(PAYMENT_METHODS.slice(0, 4)),
            note: null,
            createdAt: stamp(p.date, "15:00:00"),
          })),
        );
      }

      // Sent invoices (paid, partial, open, overdue) took stock out on their issue date.
      if (plan.status !== "draft" && plan.status !== "void") {
        for (const line of lines) {
          if (line.isService) continue;
          sales.push({ productId: line.productId, quantity: line.quantity, date: plan.issueDate });
          await tx.insert(stockMovements).values({
            productId: line.productId,
            quantity: -line.quantity,
            reason: "sale",
            note: `Invoice ${number}`,
            invoiceId,
            userId: actorId,
            createdAt: stamp(plan.issueDate, "10:00:00"),
          });
        }
      }
    }

    // Restocks: replay sales per product and insert supplier deliveries whenever stock would go
    // negative. Total restocked equals total sold, so on-hand stock ends where the product seed
    // left it (low-stock items stay low) while the movement history always stays non-negative.
    for (const product of productRows) {
      if (product.isService) continue;
      const productSales = sales.filter((s) => s.productId === product.id);
      const sold = productSales.reduce((s, x) => s + x.quantity, 0);
      if (sold === 0) continue;
      const batch = Math.max(product.reorderLevel * 2, Math.ceil(sold / 3));
      let level = product.stock;
      let restocked = 0;
      const deliveries: { quantity: number; date: string }[] = [];
      for (const sale of productSales) {
        if (level - sale.quantity < 0) {
          const qty = Math.min(sold - restocked, Math.max(sale.quantity - level, batch));
          deliveries.push({ quantity: qty, date: sale.date });
          level += qty;
          restocked += qty;
        }
        level -= sale.quantity;
      }
      if (restocked < sold) {
        const first = productSales[0]!.date;
        const span = Math.max(0, Math.round((Date.parse(today) - Date.parse(first)) / 86_400_000));
        deliveries.push({ quantity: sold - restocked, date: addDays(first, int(0, span)) });
      }
      await tx.insert(stockMovements).values(
        deliveries.map((d) => ({
          productId: product.id,
          quantity: d.quantity,
          reason: "restock" as const,
          note: "Supplier delivery",
          userId: actorId,
          createdAt: stamp(d.date, "08:00:00"),
        })),
      );
      // Net change is zero (restocked === sold), so products.stock already matches the ledger.
    }
  });

  console.log(`Seeded ${plans.length} invoices.`);
}
