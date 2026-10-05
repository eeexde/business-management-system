import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { can, type Permission } from "./permissions";
import {
  decryptSession,
  encryptSession,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from "./session";

export type CurrentUser = Pick<User, "id" | "name" | "email" | "role">;

export async function createSession(payload: SessionPayload) {
  const token = await encryptSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Current user from the session cookie, re-validated against the DB. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  return user ?? null;
});

/** Use in pages/layouts/actions: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`You don't have permission to do that (${permission}).`);
    this.name = "ForbiddenError";
  }
}

/** Use in Server Actions: throws ForbiddenError when the user lacks the permission. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}

/**
 * For Server Actions returning ActionState: resolves the user or a friendly error state
 * instead of throwing. Usage:
 *   const auth = await authorize("customers:write");
 *   if (!auth.ok) return auth.state;
 */
export async function authorize(
  permission: Permission,
): Promise<{ ok: true; user: CurrentUser } | { ok: false; state: { ok: false; message: string } }> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    return { ok: false, state: { ok: false, message: "You don't have permission to do that." } };
  }
  return { ok: true, user };
}
