import "server-only";
import { eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
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
  // Secure whenever the request arrived over HTTPS (directly or via a proxy). Plain-HTTP
  // self-hosting, e.g. on a LAN, would otherwise have the cookie silently dropped by browsers.
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Current user from the session cookie, re-validated against the DB. Cached per request.
 * Rejects sessions for deleted users and sessions issued before the user's sessionVersion
 * was bumped (logout, password change, role change), so stolen cookies can be revoked.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user || user.sessionVersion !== session.v) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** Invalidate every existing session for a user. Returns the new version. */
export async function revokeSessions(userId: number): Promise<number> {
  const [row] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ v: users.sessionVersion });
  return row?.v ?? 0;
}

/** Use in pages/layouts/actions: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Use in pages: redirects users lacking the permission to `fallback` with a notice
 * banner (see NoticeBanner) instead of rendering an error page.
 */
export async function requirePermission(permission: Permission, fallback = "/dashboard"): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect(`${fallback}?notice=forbidden`);
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
