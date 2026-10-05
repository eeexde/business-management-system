/**
 * Seeds the database with a demo company.
 * Run: npm run db:seed  (or npm run db:reset for a clean slate)
 *
 * Base seed: users + settings. Module data is appended by seedDemoData() below.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import { settings, users } from "../src/db/schema";

export const DEMO_PASSWORD = "demo1234";

async function seedBase() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await db
    .insert(users)
    .values([
      { name: "Alex Morgan", email: "demo@bizdesk.app", passwordHash, role: "admin" },
      { name: "Priya Shah", email: "priya@bizdesk.app", passwordHash, role: "manager" },
      { name: "Sam Lee", email: "sam@bizdesk.app", passwordHash, role: "staff" },
    ])
    .onConflictDoNothing();

  await db
    .insert(settings)
    .values({
      id: 1,
      businessName: "Northwind Supply Co.",
      email: "hello@northwind.example",
      phone: "+1 (555) 010-2030",
      address: "120 Market Street, Suite 400\nSan Francisco, CA 94105",
      currency: "USD",
      defaultTaxRate: 8.5,
      invoicePrefix: "INV-",
      paymentTerms: 30,
    })
    .onConflictDoNothing();
}

async function main() {
  await seedBase();
  console.log("Seed complete. Login: demo@bizdesk.app / " + DEMO_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
