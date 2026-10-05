# BizDesk — Plan

All-in-one business management app for small businesses: customers, inventory, invoicing, expenses, tasks, and reporting in one place. Built as a portfolio project.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`) | Current stable, full-stack in one codebase |
| Language | TypeScript (strict) | Type safety end to end |
| Styling | Tailwind CSS v4 + small in-house UI kit (`src/components/ui`) | No heavy component dependency |
| Database | SQLite via libSQL + Drizzle ORM | Zero-setup local file DB; same code deploys to Turso |
| Auth | Email/password, bcrypt hashes, signed JWT session cookie (`jose`) | Stateless, follows the Next.js auth guide |
| Validation | Zod v4 | Shared schemas for server actions |
| Charts | Recharts | Dashboard and reports |
| Tests | Vitest (unit), Playwright (e2e smoke) | |

## Conventions

- Money is stored as **integer cents**. Format only at the edge with `formatMoney`.
- Dates are stored as ISO strings (`YYYY-MM-DD` for business dates, full ISO for timestamps).
- Every mutation is a Server Action that (1) calls `requireUser()` / `requireRole()`, (2) validates with Zod, (3) writes, (4) logs activity, (5) `revalidatePath`.
- Pure business logic lives in `src/lib/<module>.ts` and is unit-tested. DB access is in `src/lib/queries/<module>.ts`.
- Roles: `admin` (everything, plus team and settings), `manager` (all business data), `staff` (read everything; create and edit tasks, customers, and expenses; cannot delete or change settings).

## Modules

1. **Dashboard**: KPIs (revenue this month, outstanding A/R, expenses this month, net profit, low-stock items), a 12-month revenue vs expenses chart, recent invoices, top customers, and my open tasks.
2. **Customers (CRM)**: searchable list; create, edit, and delete; detail page with contact info, notes, invoices, lifetime value, and outstanding balance.
3. **Products & inventory**: SKU, price, cost, stock, reorder level; low-stock filter; manual stock adjustments with an audit trail (`stock_movements`).
4. **Invoices**: line items (from products or custom), per-invoice tax rate and discount, statuses draft, sent, paid, overdue (derived), and void. Stock is decremented when an invoice leaves draft and restored on void. Payments are recorded. Includes a printable invoice view.
5. **Expenses**: category, vendor, date, amount, notes; filters by category and month.
6. **Tasks**: kanban board (todo, in progress, done) with priority, assignee, due date, and optional customer link.
7. **Reports**: monthly P&L, sales by product, expenses by category, A/R aging; CSV export.
8. **Settings & team**: business profile (name, currency, default tax rate, invoice prefix); user management (admin only).
9. **Activity log**: who did what, shown on the dashboard.

## Demo

`npm run db:seed` creates a demo company with 12 months of realistic data. Demo login: `demo@bizdesk.app` / `demo1234`.
