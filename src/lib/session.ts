import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/db/schema";

/** Edge-safe session helpers (used by proxy.ts and server code). No DB access here. */

export const SESSION_COOKIE = "bizdesk_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** `v` is the user's sessionVersion at sign-in; see getCurrentUser(). */
export type SessionPayload = { userId: number; role: Role; v: number };

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("change-me")) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getKey());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "number" || typeof payload.role !== "string" || typeof payload.v !== "number") {
      return null;
    }
    return { userId: payload.userId, role: payload.role as Role, v: payload.v };
  } catch {
    return null;
  }
}
