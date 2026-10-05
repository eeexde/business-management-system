import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:local.db";

const globalForDb = globalThis as unknown as { libsql?: ReturnType<typeof createClient> };

// Reuse one client across hot reloads in development.
const client =
  globalForDb.libsql ??
  createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
