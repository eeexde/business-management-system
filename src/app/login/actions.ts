"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { createSession, deleteSession, getCurrentUser, revokeSessions } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/demo";
import { RateLimiter } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";

const LoginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Enter your password." }).max(200),
  next: z.string().optional(),
});

// 5 failed attempts per email+IP and 30 per IP every 15 minutes.
const perAccount = new RateLimiter(5, 15 * 60_000);
const perIp = new RateLimiter(30, 15 * 60_000);

// Compared against when the email is unknown so both paths cost one bcrypt check
// (prevents discovering registered emails by response time).
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-real-password", 10);

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password, next } = parsed.data;
  const ip = await clientIp();
  const accountKey = `${email}|${ip}`;
  const ipCheck = perIp.hit(ip);
  const accountCheck = perAccount.hit(accountKey);
  if (!ipCheck.allowed || !accountCheck.allowed) {
    const wait = Math.ceil(Math.max(ipCheck.retryAfter, accountCheck.retryAfter) / 60);
    return { ok: false, message: `Too many sign-in attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    return { ok: false, message: "Invalid email or password." };
  }

  perAccount.reset(accountKey);
  await createSession({ userId: user.id, role: user.role, v: user.sessionVersion });
  await logActivity({
    userId: user.id,
    action: "user.login",
    entityType: "user",
    entityId: user.id,
    summary: `${user.name} signed in`,
  });
  redirect(safeNext(next));
}

export async function logout() {
  const user = await getCurrentUser();
  // Revoke server-side too, so a copied cookie stops working after sign-out. Skipped in the
  // public demo, where everyone shares one account and would be signed out together.
  if (user && !DEMO_MODE) await revokeSessions(user.id);
  await deleteSession();
  redirect("/login");
}
