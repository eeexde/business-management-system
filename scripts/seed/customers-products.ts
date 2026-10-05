/**
 * Demo customers (~40 B2B accounts) and products (~30 items across 6 categories, incl. services).
 * Deterministic: the same data on every run. Skips a table that already has rows.
 */
import { count } from "drizzle-orm";
import { db } from "../../src/db";
import { customers, products, stockMovements } from "../../src/db/schema";

/** mulberry32: tiny deterministic PRNG returning floats in [0, 1). */
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

const rand = mulberry32(20260101);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;

/** Full ISO timestamp `days` ago (noon UTC, so the calendar date is stable). */
function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

// [contact name, company, domain]
const CUSTOMERS: [string, string, string][] = [
  ["Maria Gonzalez", "Brightline Dental Group", "brightlinedental.com"],
  ["James Whitaker", "Harbor & Pine Architects", "harborpine.com"],
  ["Aisha Okafor", "Lumen Analytics", "lumenanalytics.io"],
  ["Tom Becker", "Becker Logistics", "beckerlogistics.com"],
  ["Hannah Cho", "Copperleaf Coffee Roasters", "copperleafcoffee.com"],
  ["Daniel Reyes", "Reyes & Partners LLP", "reyespartners.com"],
  ["Olivia Martin", "Summit Physical Therapy", "summitpt.com"],
  ["Ethan Brooks", "Northgate Property Management", "northgatepm.com"],
  ["Sofia Rossi", "Bella Vista Events", "bellavistaevents.com"],
  ["Michael Chen", "Pacific Crest Engineering", "pacificcresteng.com"],
  ["Grace Kim", "Bluebird Pediatrics", "bluebirdpeds.com"],
  ["Lucas Silva", "Ironwood Fitness", "ironwoodfit.com"],
  ["Emma Johansson", "Fjord Design Studio", "fjorddesign.co"],
  ["Noah Patel", "Patel Family Pharmacy", "patelpharmacy.com"],
  ["Chloe Dubois", "Maison Bakery", "maisonbakery.com"],
  ["Ryan O'Connor", "Clover Insurance Agency", "cloverinsure.com"],
  ["Isabella Moreno", "Verde Landscaping", "verdelandscaping.com"],
  ["William Foster", "Foster Accounting Services", "fostercpa.com"],
  ["Mia Tanaka", "Sakura Sushi Bar", "sakurasushibar.com"],
  ["Benjamin Hart", "Hartwell Academy", "hartwellacademy.org"],
  ["Ava Thompson", "Thompson Real Estate", "thompsonrealty.com"],
  ["Jacob Novak", "Novak Machine Works", "novakmachine.com"],
  ["Zoe Adams", "Riverside Veterinary Clinic", "riversidevet.com"],
  ["Samuel Wright", "Keystone Construction", "keystonebuild.com"],
  ["Lily Nguyen", "Lotus Spa & Wellness", "lotusspa.com"],
  ["Henry Walsh", "Walsh Legal Group", "walshlegal.com"],
  ["Priya Raman", "Orbit Software", "orbitsoftware.io"],
  ["Jack Morrison", "Morrison Auto Repair", "morrisonauto.com"],
  ["Ella Fischer", "Alpine Outfitters", "alpineoutfitters.com"],
  ["Owen Gallagher", "Gallagher Print Shop", "gallagherprint.com"],
  ["Nora Lindqvist", "Nordic Home Interiors", "nordichome.co"],
  ["Leo Martins", "Atlas Coworking", "atlascowork.com"],
  ["Ruby Clarke", "Clarke Marketing Co.", "clarkemarketing.com"],
  ["Mateo Alvarez", "Sunset Hotel & Suites", "sunsethotel.com"],
  ["Harper Lee", "Evergreen Senior Living", "evergreenliving.org"],
  ["Elijah Grant", "Grant Medical Supplies", "grantmedical.com"],
  ["Scarlett Young", "Petal & Stem Florists", "petalandstem.com"],
  ["Caleb Rivera", "Rivera Tech Repair", "riveratech.com"],
  ["Aria Shah", "Greenleaf Grocers", "greenleafgrocers.com"],
  ["Isaac Bennett", "", ""], // individual customer, no company
];

const CITIES: [string, string, string][] = [
  ["San Francisco", "CA", "941"],
  ["Oakland", "CA", "946"],
  ["San Jose", "CA", "951"],
  ["Sacramento", "CA", "958"],
  ["Portland", "OR", "972"],
  ["Seattle", "WA", "981"],
  ["Denver", "CO", "802"],
  ["Austin", "TX", "787"],
  ["Phoenix", "AZ", "850"],
  ["Salt Lake City", "UT", "841"],
];
const STREETS = ["Market St", "Mission St", "Oak Ave", "Elm St", "Broadway", "Pine St", "Valencia St", "Main St", "Harbor Blvd", "Lincoln Ave", "Cedar Ln", "Park Ave"];
const AREA_CODES = ["415", "510", "408", "916", "503", "206", "303", "512", "602", "801"];
const NOTES = [
  "Prefers invoices by email. Net 30.",
  "Quarterly bulk order of office supplies. Ask about volume discount.",
  "Main contact for facilities. Deliveries to the loading dock at the rear.",
  "Interested in an annual maintenance contract.",
  "Pays promptly. Referred by Harbor & Pine Architects.",
  "Opening a second location next spring — follow up about furniture.",
];

function customerRows() {
  return CUSTOMERS.map(([name, company, domain], i) => {
    const [city, state, zipPrefix] = CITIES[i % CITIES.length]!;
    const first = name.split(" ")[0]!.toLowerCase().replace(/[^a-z]/g, "");
    const area = AREA_CODES[i % AREA_CODES.length]!;
    const suite = rand() < 0.5 ? `, Suite ${int(100, 950)}` : "";
    return {
      name,
      company: company || null,
      email: domain ? `${first}@${domain}` : `${first}.${name.split(" ")[1]!.toLowerCase()}@example.com`,
      // 555-01xx numbers are reserved for fictional use.
      phone: `+1 (${area}) 555-01${String(int(0, 99)).padStart(2, "0")}`,
      address: `${int(10, 4999)} ${pick(STREETS)}${suite}\n${city}, ${state} ${zipPrefix}${String(int(0, 99)).padStart(2, "0")}`,
      notes: rand() < 0.3 ? pick(NOTES) : null,
      // Every customer predates the 12 months of invoice history.
      createdAt: daysAgoIso(int(370, 420)),
    };
  });
}

type ProductSeed = {
  sku: string;
  name: string;
  category: string;
  price: number; // dollars
  cost: number; // dollars
  stock: number;
  reorder: number;
  description?: string;
  service?: boolean;
};

// A few items start below their reorder level so the low-stock views have data.
const PRODUCTS: ProductSeed[] = [
  { sku: "OFC-1001", name: "Copy Paper, Letter (case of 10 reams)", category: "Office Supplies", price: 54.99, cost: 34.5, stock: 180, reorder: 40 },
  { sku: "OFC-1002", name: "Ballpoint Pens, Black (box of 50)", category: "Office Supplies", price: 18.5, cost: 7.25, stock: 240, reorder: 50 },
  { sku: "OFC-1003", name: "Sticky Notes 3x3 (24-pack)", category: "Office Supplies", price: 21.99, cost: 9.8, stock: 160, reorder: 40 },
  { sku: "OFC-1004", name: "Heavy-Duty Stapler", category: "Office Supplies", price: 29.95, cost: 13.4, stock: 9, reorder: 15 },
  { sku: "OFC-1005", name: "Hanging File Folders (box of 25)", category: "Office Supplies", price: 24.75, cost: 11.9, stock: 120, reorder: 30 },
  { sku: "OFC-1006", name: "Dry-Erase Markers (12-pack)", category: "Office Supplies", price: 16.99, cost: 7.1, stock: 150, reorder: 35 },
  { sku: "ELC-2001", name: "27\" 4K Monitor", category: "Electronics", price: 349.0, cost: 241.0, stock: 48, reorder: 10, description: "IPS panel, USB-C with 65W power delivery, height-adjustable stand." },
  { sku: "ELC-2002", name: "Wireless Keyboard & Mouse Combo", category: "Electronics", price: 59.99, cost: 31.0, stock: 95, reorder: 20 },
  { sku: "ELC-2003", name: "USB-C Docking Station", category: "Electronics", price: 189.0, cost: 118.0, stock: 6, reorder: 12, description: "Dual display, 2.5GbE, 100W pass-through charging." },
  { sku: "ELC-2004", name: "Laser Printer, Mono", category: "Electronics", price: 279.0, cost: 196.0, stock: 22, reorder: 5 },
  { sku: "ELC-2005", name: "Noise-Cancelling Headset", category: "Electronics", price: 129.0, cost: 72.0, stock: 64, reorder: 15 },
  { sku: "ELC-2006", name: "Surge Protector, 8 Outlet", category: "Electronics", price: 34.99, cost: 15.5, stock: 110, reorder: 25 },
  { sku: "FRN-3001", name: "Ergonomic Office Chair", category: "Furniture", price: 429.0, cost: 255.0, stock: 36, reorder: 8, description: "Mesh back, adjustable lumbar support and 4D armrests." },
  { sku: "FRN-3002", name: "Sit-Stand Desk, 60\"", category: "Furniture", price: 649.0, cost: 410.0, stock: 24, reorder: 6, description: "Dual motor, memory presets, bamboo top." },
  { sku: "FRN-3003", name: "4-Drawer Filing Cabinet", category: "Furniture", price: 289.0, cost: 168.0, stock: 3, reorder: 5 },
  { sku: "FRN-3004", name: "Conference Table, 8-Seat", category: "Furniture", price: 1290.0, cost: 820.0, stock: 8, reorder: 2 },
  { sku: "FRN-3005", name: "Bookshelf, 5-Tier", category: "Furniture", price: 159.0, cost: 88.0, stock: 30, reorder: 6 },
  { sku: "PKG-4001", name: "Shipping Boxes 12x12x12 (bundle of 25)", category: "Packaging", price: 38.0, cost: 19.5, stock: 200, reorder: 50 },
  { sku: "PKG-4002", name: "Packing Tape, Clear (6 rolls)", category: "Packaging", price: 19.99, cost: 8.6, stock: 260, reorder: 60 },
  { sku: "PKG-4003", name: "Bubble Wrap Roll, 12\" x 175'", category: "Packaging", price: 32.5, cost: 16.0, stock: 18, reorder: 25 },
  { sku: "PKG-4004", name: "Poly Mailers 10x13 (pack of 100)", category: "Packaging", price: 27.0, cost: 11.75, stock: 140, reorder: 30 },
  { sku: "CLN-5001", name: "Disinfectant Wipes (6 canisters)", category: "Cleaning", price: 31.99, cost: 17.2, stock: 150, reorder: 40 },
  { sku: "CLN-5002", name: "Paper Towels, Commercial (12 rolls)", category: "Cleaning", price: 42.0, cost: 24.5, stock: 130, reorder: 30 },
  { sku: "CLN-5003", name: "Hand Soap Refill, 1 gal", category: "Cleaning", price: 22.5, cost: 10.4, stock: 90, reorder: 20 },
  { sku: "CLN-5004", name: "Trash Bags, 33 gal (case of 100)", category: "Cleaning", price: 36.0, cost: 18.9, stock: 110, reorder: 25 },
  { sku: "CLN-5005", name: "Microfiber Cloths (24-pack)", category: "Cleaning", price: 24.0, cost: 9.6, stock: 85, reorder: 20 },
  { sku: "SRV-9001", name: "Installation service (per hour)", category: "Services", price: 95.0, cost: 45.0, stock: 0, reorder: 0, service: true, description: "On-site installation of furniture and equipment." },
  { sku: "SRV-9002", name: "Office setup & delivery", category: "Services", price: 149.0, cost: 70.0, stock: 0, reorder: 0, service: true, description: "Delivery, unboxing and placement, flat rate within 25 miles." },
  { sku: "SRV-9003", name: "IT equipment configuration (per device)", category: "Services", price: 65.0, cost: 25.0, stock: 0, reorder: 0, service: true },
  { sku: "SRV-9004", name: "Annual maintenance plan", category: "Services", price: 1200.0, cost: 480.0, stock: 0, reorder: 0, service: true, description: "Quarterly on-site checks of furniture and equipment." },
];

const cents = (dollars: number) => Math.round(dollars * 100);

export async function seedCustomersProducts(): Promise<void> {
  const [{ n: customerCount }] = await db.select({ n: count() }).from(customers);
  if (customerCount === 0) {
    await db.insert(customers).values(customerRows());
  }

  const [{ n: productCount }] = await db.select({ n: count() }).from(products);
  if (productCount === 0) {
    const createdAt = daysAgoIso(366);
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(products)
        .values(
          PRODUCTS.map((p) => ({
            sku: p.sku,
            name: p.name,
            description: p.description ?? null,
            category: p.category,
            priceCents: cents(p.price),
            costCents: cents(p.cost),
            stock: p.service ? 0 : p.stock,
            reorderLevel: p.reorder,
            isService: p.service ?? false,
            createdAt,
          })),
        )
        .returning({ id: products.id, stock: products.stock, isService: products.isService });

      // Initial stock is recorded as a restock movement so history adds up to stock on hand.
      const movements = inserted
        .filter((p) => !p.isService && p.stock > 0)
        .map((p) => ({ productId: p.id, quantity: p.stock, reason: "restock" as const, note: "Opening stock", createdAt: daysAgoIso(365) }));
      if (movements.length) await tx.insert(stockMovements).values(movements);
    });
  }
}
