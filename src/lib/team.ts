import type { Role } from "@/db/schema";

/**
 * Team guard rails (pure). Returns an error message when the change is not allowed, else null.
 * - Nobody can remove themselves.
 * - The last admin can never be removed or demoted, so the business always has an admin.
 */
export function checkRemoveUser(args: { actorId: number; target: { id: number; role: Role }; adminCount: number }) {
  if (args.actorId === args.target.id) return "You can't remove your own account.";
  if (args.target.role === "admin" && args.adminCount <= 1) return "You can't remove the last admin.";
  return null;
}

export function checkRoleChange(args: { target: { id: number; role: Role }; newRole: Role; adminCount: number }) {
  if (args.target.role === "admin" && args.newRole !== "admin" && args.adminCount <= 1) {
    return "There must be at least one admin. Promote someone else first.";
  }
  return null;
}
