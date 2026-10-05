import type { Role } from "@/db/schema";

/**
 * Permission matrix. Pure so it can be used in both server and client components.
 * - admin: everything
 * - manager: all business data, no team/settings
 * - staff: read all; create/edit customers, expenses, tasks; no deletes, no invoices writes, no inventory writes
 */
export type Permission =
  | "customers:write"
  | "customers:delete"
  | "products:write"
  | "products:delete"
  | "invoices:write"
  | "invoices:delete"
  | "expenses:write"
  | "expenses:delete"
  | "tasks:write"
  | "tasks:delete"
  | "reports:view"
  | "settings:manage"
  | "team:manage";

const MATRIX: Record<Role, ReadonlySet<Permission> | "all"> = {
  admin: "all",
  manager: new Set<Permission>([
    "customers:write",
    "customers:delete",
    "products:write",
    "products:delete",
    "invoices:write",
    "invoices:delete",
    "expenses:write",
    "expenses:delete",
    "tasks:write",
    "tasks:delete",
    "reports:view",
  ]),
  staff: new Set<Permission>(["customers:write", "expenses:write", "tasks:write", "reports:view"]),
};

export function can(role: Role, permission: Permission) {
  const allowed = MATRIX[role];
  return allowed === "all" || allowed.has(permission);
}
