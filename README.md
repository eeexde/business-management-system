# BizDesk

**All-in-one business management for small teams.** Customers, inventory, invoicing, expenses, tasks, and financial reports in one fast, role-aware web app.

Built with Next.js 16 (App Router, Server Components, Server Actions), TypeScript, Drizzle ORM on SQLite/libSQL, and Tailwind CSS v4.

> Demo login: `demo@bizdesk.app` / `demo1234` (admin). Also try `priya@bizdesk.app` (manager) and `sam@bizdesk.app` (staff) with the same password to see role-based permissions.

## Features

| Module | Highlights |
| --- | --- |
| **Dashboard** | Revenue, A/R, overdue, expenses, and net profit KPIs; 12-month revenue vs expenses chart; recent invoices; top customers; my tasks; activity feed |
| **Customers** | Searchable CRM, lifetime value and outstanding balance per customer, linked invoices and tasks |
| **Products & inventory** | SKU catalog with margins, low-stock alerts, stock adjustments with a full audit trail |
| **Invoices** | Live line-item editor, tax and discounts, draft → sent → paid lifecycle, partial payments, derived overdue status, void with stock restore, duplicate, printable or PDF invoice |
| **Expenses** | Categorized spend, month-over-month comparison, category breakdown, CSV export |
| **Tasks** | Drag-and-drop kanban with keyboard and touch fallback, priorities, due dates, assignees, customer links |
| **Reports** | Monthly P&L, sales by product and customer, expenses by category, A/R aging, CSV export for every report |
| **Settings & team** | Business profile, currency and tax defaults, user management with admin / manager / staff roles |

## Architecture

```
src/
  app/
    login/              Public sign-in (Server Action + useActionState)
    (app)/              Authenticated area: shared sidebar layout
      <module>/         page.tsx (Server Component) · actions.ts ("use server") · *-form.tsx (client)
  components/ui/        Small in-house UI kit (Button, Field, Table, Card, Badge…)
  db/schema.ts          Drizzle schema: single source of truth for tables and types
  lib/
    queries/            Server-only read functions per module
    <module>.ts         Pure business logic (unit tested)
    auth.ts             Session cookie (JWT via jose), requireUser, authorize(permission)
    permissions.ts      Role → permission matrix, shared by UI and server
  proxy.ts              Optimistic route protection (Next 16's replacement for middleware)
scripts/seed*           Deterministic 12-month demo dataset
e2e/                    Playwright smoke tests
```

Key decisions:

- **Money is integer cents** everywhere. Formatting happens only at render time.
- **Server-side source of truth.** Invoice totals are recomputed on the server from line items. Client previews use the same pure `computeInvoiceTotals` function.
- **Defense in depth for auth.** `proxy.ts` redirects signed-out users cheaply. Every page and Server Action re-checks the session against the database and enforces permissions with `authorize()`.
- **Transactions** wrap multi-table writes (sending an invoice decrements stock and writes stock movements, voiding restores it, and payments update balances).
- **Revocable stateless sessions.** JWTs carry a per-user `sessionVersion`. Logout, password change and role change bump it, so stolen cookies stop working. Login is rate-limited and timing-safe.
- **Derived state isn't stored.** "Overdue" and "partial" are computed from due date and payments, so they can never drift.

## Getting started

Requires Node.js 20+.

```bash
npm install
cp .env.example .env          # then set SESSION_SECRET to a long random string
npm run db:reset              # create local.db, run migrations, seed demo data
npm run dev                   # http://localhost:3000
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run db:migrate` | Apply SQL migrations in `drizzle/` (safe for existing data) |
| `npm run db:generate` | Create a new migration after editing `src/db/schema.ts` |
| `npm run db:seed` / `db:reset` | Seed demo data / wipe, migrate, and seed |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E smoke tests (Playwright) against a production build (run `npm run build` first) |
| `npm run typecheck` / `lint` | TypeScript and ESLint |

## Deploying

The app runs anywhere Node runs. For serverless hosts (for example Vercel), use [Turso](https://turso.tech) as the database. It speaks the same libSQL protocol, so no code changes are needed:

```bash
DATABASE_URL=libsql://<your-db>.turso.io
DATABASE_AUTH_TOKEN=<token>
SESSION_SECRET=<32+ random chars>
DEMO_MODE=true   # for a public demo: account, team and settings become read-only
```

Run `npm run db:migrate && npm run db:seed` once with those variables set, and `npm run db:migrate` after each schema change.

## License

MIT
