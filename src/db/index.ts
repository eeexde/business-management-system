import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { serializeClient } from "./serialize";

const url = process.env.DATABASE_URL ?? "file:local.db";

const globalForDb = globalThis as unknown as { libsql?: ReturnType<typeof createClient> };

function createDbClient() {
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  // Local files need in-process serialization (see serialize.ts); remote libSQL/Turso
  // servers handle concurrency themselves.
  return url.startsWith("file:") ? serializeClient(client) : client;
}

// Reuse one client across hot reloads in development.
const client = globalForDb.libsql ?? createDbClient();
if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
export { schema };
