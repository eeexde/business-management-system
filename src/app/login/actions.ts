"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { createSession, deleteSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

const LoginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Enter your password." }),
  next: z.string().optional(),
});

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
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) {
    return { ok: false, message: "Invalid email or password." };
  }

  await createSession({ userId: user.id, role: user.role });
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
  await deleteSession();
  redirect("/login");
}
