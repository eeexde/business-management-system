"use server";

import bcrypt from "bcryptjs";
import { count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { ROLES, settings, users, type Role } from "@/db/schema";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { authorize, createSession, requireUser, revokeSessions } from "@/lib/auth";
import { demoLocked } from "@/lib/demo";
import { CURRENCY_CODES } from "@/lib/settings";
import { checkRemoveUser, checkRoleChange } from "@/lib/team";

/** Optional text input: trimmed, empty -> null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep it under ${max} characters.` })
    .transform((v) => v || null);

const SettingsSchema = z.object({
  businessName: z.string().trim().min(1, { error: "Enter your business name." }).max(100),
  email: z
    .union([z.literal(""), z.email({ error: "Enter a valid email." }).trim().toLowerCase()])
    .transform((v) => v || null),
  phone: optionalText(40),
  address: optionalText(300),
  currency: z.enum(CURRENCY_CODES, { error: "Choose a currency." }),
  defaultTaxRate: z.coerce
    .number({ error: "Enter a number." })
    .min(0, { error: "Tax rate can't be negative." })
    .max(100, { error: "Tax rate must be 100% or less." }),
  invoicePrefix: z
    .string()
    .trim()
    .min(1, { error: "Enter a prefix." })
    .max(12, { error: "Keep the prefix under 12 characters." }),
  paymentTerms: z.coerce
    .number({ error: "Enter a number of days." })
    .int({ error: "Use whole days." })
    .min(0, { error: "Can't be negative." })
    .max(365, { error: "Maximum is 365 days." }),
});

export async function updateSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locked = demoLocked();
  if (locked) return locked;
  const auth = await authorize("settings:manage");
  if (!auth.ok) return auth.state;
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  await db
    .insert(settings)
    .values({ id: 1, ...parsed.data })
    .onConflictDoUpdate({ target: settings.id, set: parsed.data });
  await logActivity({
    userId: auth.user.id,
    action: "settings.updated",
    entityType: "settings",
    entityId: 1,
    summary: "Updated business settings",
  });
  // Business name and currency show up across the app (sidebar, money formatting).
  revalidatePath("/", "layout");
  return { ok: true, message: "Business settings saved." };
}

const ProfileSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter your name." }).max(80),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locked = demoLocked();
  if (locked) return locked;
  const user = await requireUser();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Name updated." };
}

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Enter your current password." }),
    newPassword: z.string().min(8, { error: "Use at least 8 characters." }).max(200),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    error: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locked = demoLocked();
  if (locked) return locked;
  const user = await requireUser();
  const parsed = PasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await bcrypt.compare(parsed.data.currentPassword, row.hash))) {
    return { ok: false, errors: { currentPassword: ["That password is incorrect."] }, message: "Password not changed." };
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  // Sign out every other device, then re-issue this browser a fresh session.
  const v = await revokeSessions(user.id);
  await createSession({ userId: user.id, role: user.role, v });
  await logActivity({
    userId: user.id,
    action: "user.password_changed",
    entityType: "user",
    entityId: user.id,
    summary: `${user.name} changed their password`,
  });
  return { ok: true, message: "Password changed." };
}

const NewUserSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name." }).max(80),
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  role: z.enum(ROLES, { error: "Choose a role." }),
  password: z.string().min(8, { error: "Use at least 8 characters." }).max(200),
});

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locked = demoLocked();
  if (locked) return locked;
  const auth = await authorize("team:manage");
  if (!auth.ok) return auth.state;
  const parsed = NewUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const { name, email, role, password } = parsed.data;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { ok: false, errors: { email: ["Someone on the team already uses this email."] } };

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db.insert(users).values({ name, email, role, passwordHash }).returning({ id: users.id });
  await logActivity({
    userId: auth.user.id,
    action: "user.created",
    entityType: "user",
    entityId: created?.id ?? null,
    summary: `Added ${name} to the team as ${role}`,
  });
  revalidatePath("/settings");
  return { ok: true, message: `${name} can now sign in with the temporary password.` };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Admin count read inside the same write transaction as the change it guards. */
async function adminCount(tx: Tx) {
  const [row] = await tx.select({ n: count() }).from(users).where(eq(users.role, "admin"));
  return row?.n ?? 0;
}

async function findUser(id: number) {
  const [row] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row;
}

export async function changeUserRole(userId: number, role: Role): Promise<ActionState> {
  const locked = demoLocked();
  if (locked) return locked;
  const auth = await authorize("team:manage");
  if (!auth.ok) return auth.state;
  if (!ROLES.includes(role)) return { ok: false, message: "Unknown role." };

  const target = await findUser(userId);
  if (!target) return { ok: false, message: "That user no longer exists." };
  if (target.role === role) return { ok: true };
  // Check and write in one write transaction (BEGIN IMMEDIATE) so two admins cannot
  // concurrently demote each other and leave the business with none.
  const blocked = await db.transaction(async (tx) => {
    const reason = checkRoleChange({ target, newRole: role, adminCount: await adminCount(tx) });
    if (reason) return reason;
    await tx
      .update(users)
      .set({ role, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId));
    return null;
  });
  if (blocked) return { ok: false, message: blocked };
  await logActivity({
    userId: auth.user.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    summary: `Changed ${target.name}'s role to ${role}`,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `${target.name} is now ${role === "admin" ? "an" : "a"} ${role}.` };
}

export async function removeUser(userId: number): Promise<ActionState> {
  const locked = demoLocked();
  if (locked) return locked;
  const auth = await authorize("team:manage");
  if (!auth.ok) return auth.state;

  const target = await findUser(userId);
  if (!target) return { ok: false, message: "That user no longer exists." };
  // Foreign keys set created_by / assignee / activity user to null, so history is kept.
  const blocked = await db.transaction(async (tx) => {
    const reason = checkRemoveUser({ actorId: auth.user.id, target, adminCount: await adminCount(tx) });
    if (reason) return reason;
    await tx.delete(users).where(eq(users.id, userId));
    return null;
  });
  if (blocked) return { ok: false, message: blocked };
  await logActivity({
    userId: auth.user.id,
    action: "user.removed",
    entityType: "user",
    entityId: null,
    summary: `Removed ${target.name} from the team`,
  });
  revalidatePath("/settings");
  return { ok: true, message: `${target.name} was removed.` };
}
