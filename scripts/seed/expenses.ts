/**
 * Demo expenses: ~12 months of recurring costs (rent, payroll, utilities, software) plus
 * one-off marketing, travel, supplies and inventory purchases. Deterministic (seeded PRNG).
 */
import { asc, count } from "drizzle-orm";
import { db } from "../../src/db";
import { expenses, users, type ExpenseCategory } from "../../src/db/schema";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Row = {
  description: string;
  category: ExpenseCategory;
  vendor: string | null;
  amountCents: number;
  date: string;
  notes: string | null;
};

const SOFTWARE = [
  { vendor: "Google Workspace", description: "Google Workspace — 6 seats", cents: 8400, day: 2 },
  { vendor: "QuickBooks", description: "QuickBooks Online Plus", cents: 9000, day: 5 },
  { vendor: "Figma", description: "Figma Professional", cents: 4500, day: 9 },
  { vendor: "Slack", description: "Slack Pro", cents: 4375, day: 12 },
  { vendor: "Shopify", description: "Shopify Basic plan", cents: 3900, day: 14 },
  { vendor: "Adobe", description: "Adobe Creative Cloud", cents: 5999, day: 20 },
];

const MARKETING = [
  { vendor: "Google Ads", description: "Google Ads search campaign" },
  { vendor: "Meta", description: "Instagram & Facebook ads" },
  { vendor: "Mailchimp", description: "Email newsletter — Standard plan" },
  { vendor: "Local Print Co.", description: "Flyers and trade-show banners" },
  { vendor: "LinkedIn", description: "LinkedIn sponsored posts" },
];

const TRAVEL = [
  { vendor: "United Airlines", description: "Flight to supplier visit — Portland" },
  { vendor: "Marriott", description: "Hotel — regional trade show" },
  { vendor: "Uber", description: "Client meeting rides" },
  { vendor: "Hertz", description: "Rental car — customer site visits" },
];

const SUPPLIES = [
  { vendor: "Staples", description: "Office supplies" },
  { vendor: "Uline", description: "Packing tape, boxes and labels" },
  { vendor: "Amazon Business", description: "Printer toner and paper" },
  { vendor: "Costco", description: "Break room restock" },
];

const INVENTORY = [
  { vendor: "Pacific Wholesale", description: "Inventory restock — core SKUs" },
  { vendor: "Harbor Trading Co.", description: "Bulk purchase — seasonal stock" },
  { vendor: "Midwest Distributors", description: "Inventory reorder" },
];

export async function seedExpenses(): Promise<void> {
  const [{ value: existing }] = await db.select({ value: count() }).from(expenses);
  if (existing > 0) {
    console.log(`  expenses: ${existing} already present, skipping`);
    return;
  }

  const rand = mulberry32(20260301);
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const userIds = (await db.select({ id: users.id }).from(users).orderBy(asc(users.id))).map((u) => u.id);

  const now = new Date();
  const todayIso = isoDate(now);
  const rows: Row[] = [];

  // Oldest month first: 11 months ago through the current month (dates after today are skipped).
  for (let offset = 11; offset >= 0; offset--) {
    const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const y = first.getFullYear();
    const m = first.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const on = (day: number) => isoDate(new Date(y, m, Math.min(day, lastDay)));
    const monthName = first.toLocaleDateString("en-US", { month: "long" });
    // A couple of heavier months so not every month is profitable.
    const heavy = offset === 7 || offset === 3;

    const add = (row: Omit<Row, "notes"> & { notes?: string | null }) => {
      if (row.date <= todayIso) rows.push({ notes: null, ...row });
    };

    add({ description: `Office & warehouse rent — ${monthName}`, category: "rent", vendor: "Bayside Properties LLC", amountCents: 450000, date: on(1) });
    add({ description: `Payroll — ${monthName} 1–15`, category: "payroll", vendor: "Gusto", amountCents: between(900000, 1200000), date: on(15) });
    add({ description: `Payroll — ${monthName} 16–${lastDay}`, category: "payroll", vendor: "Gusto", amountCents: between(900000, 1200000), date: on(lastDay) });

    // Utilities: electricity is seasonal (higher in summer and winter).
    const season = [0, 1, 6, 7, 11].includes(m) ? 1.35 : 1;
    add({ description: "Electricity", category: "utilities", vendor: "PG&E", amountCents: Math.round(between(28000, 42000) * season), date: on(8) });
    add({ description: "Business internet", category: "utilities", vendor: "Comcast Business", amountCents: 14999, date: on(10) });
    add({ description: "Water & waste", category: "utilities", vendor: "City Utilities", amountCents: between(6500, 9500), date: on(18) });

    for (const s of SOFTWARE) {
      add({ description: s.description, category: "software", vendor: s.vendor, amountCents: s.cents, date: on(s.day) });
    }

    const campaigns = heavy ? 3 : between(0, 2);
    for (let i = 0; i < campaigns; i++) {
      const c = pick(MARKETING);
      add({ description: c.description, category: "marketing", vendor: c.vendor, amountCents: between(40000, heavy ? 380000 : 180000), date: on(between(3, 26)) });
    }

    if (rand() < 0.55 || heavy) {
      const t = pick(TRAVEL);
      add({ description: t.description, category: "travel", vendor: t.vendor, amountCents: between(18000, 240000), date: on(between(4, 25)) });
    }

    for (let i = between(1, 3); i > 0; i--) {
      const s = pick(SUPPLIES);
      add({ description: s.description, category: "supplies", vendor: s.vendor, amountCents: between(4500, 52000), date: on(between(2, 27)) });
    }

    for (let i = heavy ? 3 : between(1, 2); i > 0; i--) {
      const inv = pick(INVENTORY);
      add({
        description: inv.description,
        category: "inventory",
        vendor: inv.vendor,
        amountCents: between(280000, heavy ? 1100000 : 750000),
        date: on(between(3, 24)),
        notes: rand() < 0.3 ? "Net 30 terms; paid on delivery." : null,
      });
    }

    if (rand() < 0.4) {
      add({ description: "Business insurance — monthly premium", category: "other", vendor: "Hiscox", amountCents: 21500, date: on(6) });
    }
    if (offset === 9) {
      add({ description: "Annual accounting & tax prep", category: "other", vendor: "Chen & Partners CPA", amountCents: 240000, date: on(17), notes: "Prior-year return and quarterly estimates." });
    }
    if (offset === 5) {
      add({ description: "Replacement laptop for warehouse", category: "supplies", vendor: "Apple", amountCents: 149900, date: on(11) });
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  await db.insert(expenses).values(
    rows.map((r, i) => ({
      ...r,
      createdBy: userIds.length ? userIds[i % userIds.length]! : null,
      createdAt: `${r.date}T16:00:00.000Z`,
    })),
  );
  console.log(`  expenses: ${rows.length} inserted`);
}
