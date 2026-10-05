import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const ROLES = ["admin", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull().default("staff"),
  createdAt: createdAt(),
});

/** Single-row table (id = 1) holding business profile settings. */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  businessName: text("business_name").notNull().default("My Business"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  currency: text("currency").notNull().default("USD"),
  /** Default tax rate in percent, e.g. 8.5 */
  defaultTaxRate: real("default_tax_rate").notNull().default(0),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  /** Default payment terms in days */
  paymentTerms: integer("payment_terms").notNull().default(30),
});

export const customers = sqliteTable(
  "customers",
  {
    id: id(),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("customers_name_idx").on(t.name)],
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    /** Sale price in cents */
    priceCents: integer("price_cents").notNull().default(0),
    /** Unit cost in cents */
    costCents: integer("cost_cents").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    reorderLevel: integer("reorder_level").notNull().default(0),
    /** Services are not stock-tracked */
    isService: integer("is_service", { mode: "boolean" }).notNull().default(false),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("products_name_idx").on(t.name)],
);

export const STOCK_REASONS = ["restock", "sale", "adjustment", "return", "void"] as const;

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: id(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Positive = stock in, negative = stock out */
    quantity: integer("quantity").notNull(),
    reason: text("reason", { enum: STOCK_REASONS }).notNull(),
    note: text("note"),
    invoiceId: integer("invoice_id"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId)],
);

/** Stored statuses. "overdue" is derived (sent + past due date), never stored. */
export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    number: text("number").notNull().unique(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("draft"),
    /** YYYY-MM-DD */
    issueDate: text("issue_date").notNull(),
    /** YYYY-MM-DD */
    dueDate: text("due_date").notNull(),
    /** Percent, e.g. 8.5 */
    taxRate: real("tax_rate").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    /** Denormalized totals, recomputed on every write via computeInvoiceTotals */
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    amountPaidCents: integer("amount_paid_cents").notNull().default(0),
    notes: text("notes"),
    /** Full ISO timestamp when fully paid */
    paidAt: text("paid_at"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_customer_idx").on(t.customerId),
    index("invoices_issue_date_idx").on(t.issueDate),
  ],
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: id(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "check", "other"] as const;

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("bank_transfer"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
);

export const EXPENSE_CATEGORIES = [
  "rent",
  "payroll",
  "utilities",
  "supplies",
  "marketing",
  "software",
  "travel",
  "inventory",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenses = sqliteTable(
  "expenses",
  {
    id: id(),
    description: text("description").notNull(),
    category: text("category", { enum: EXPENSE_CATEGORIES }).notNull().default("other"),
    vendor: text("vendor"),
    amountCents: integer("amount_cents").notNull(),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_date_idx").on(t.date)],
);

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    priority: text("priority", { enum: TASK_PRIORITIES }).notNull().default("medium"),
    /** YYYY-MM-DD */
    dueDate: text("due_date"),
    assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_status_idx").on(t.status)],
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: id(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** e.g. "invoice.created" */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    /** Human-readable summary, e.g. "Created invoice INV-0042" */
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_log_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;
