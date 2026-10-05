import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Everyone on the team (no password hashes), alphabetical. */
export async function listTeam() {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.name));
}
