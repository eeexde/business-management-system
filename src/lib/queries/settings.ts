import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { settings, type Settings } from "@/db/schema";

const DEFAULTS: Settings = {
  id: 1,
  businessName: "My Business",
  email: null,
  phone: null,
  address: null,
  currency: "USD",
  defaultTaxRate: 0,
  invoicePrefix: "INV-",
  paymentTerms: 30,
};

/** Business settings (single row, id = 1). Falls back to defaults if not seeded. Cached per request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return row ?? DEFAULTS;
});
