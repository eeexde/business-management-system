import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  FileText,
  History,
  Landmark,
  PackageX,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { RevenueExpenseArea, type MonthPoint } from "@/components/charts/revenue-expense-chart";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { TaskPriority } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { activityHref, firstName, greeting, relativeTime } from "@/lib/dashboard";
import { displayStatus, STATUS_TONE } from "@/lib/invoices";
import { can } from "@/lib/permissions";
import {
  getDashboardKpis,
  getMyOpenTasks,
  getRecentActivity,
  getRecentInvoices,
  getTopCustomers,
} from "@/lib/queries/dashboard";
import { getExpensesByMonthCategory, getRevenueByMonth } from "@/lib/queries/reports";
import { getSettings } from "@/lib/queries/settings";
import { buildPnl, marginPct, monthKeys, monthLabel, percentChange, resolveRange } from "@/lib/reports";
import { cn, formatDate, formatMoney, formatPercent, initials, today } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };

/** Server clock snapshot for the greeting and relative times. */
function serverNow() {
  const now = new Date();
  return {
    now,
    hour: now.getHours(),
    longDate: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
  };
}

function Trend({ change, label }: { change: number | null; label: string }) {
  if (change === null) return <span>No data {label}</span>;
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-flex items-center font-medium", up ? "text-success" : "text-danger")}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {formatPercent(Math.abs(change))}
      </span>
      {label}
    </span>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const todayStr = today();
  const { now, hour, longDate } = serverNow();
  const chartRange = resolveRange("last-12-months", todayStr);

  const [settings, kpis, revenue, spend, recentInvoices, topCustomers, myTasks, activity] = await Promise.all([
    getSettings(),
    getDashboardKpis(todayStr),
    getRevenueByMonth(chartRange.from, chartRange.to),
    getExpensesByMonthCategory(chartRange.from, chartRange.to),
    getRecentInvoices(5),
    getTopCustomers(chartRange.from, 5),
    getMyOpenTasks(user.id, 5),
    getRecentActivity(10),
  ]);
  const money = (cents: number) => formatMoney(cents, settings.currency);

  const pnl = buildPnl(monthKeys(chartRange.from, chartRange.to), revenue, spend);
  const chartData: MonthPoint[] = pnl.rows.map((r) => ({
    label: monthLabel(r.month),
    title: monthLabel(r.month, true),
    revenueCents: r.revenueCents,
    expensesCents: r.expensesCents,
    netCents: r.netCents,
  }));
  const netThisMonth = kpis.revenueThisMonthCents - kpis.expensesThisMonthCents;
  const margin = marginPct(kpis.revenueThisMonthCents, netThisMonth);
  const topMax = Math.max(1, ...topCustomers.map((c) => c.revenueCents));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{longDate}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {greeting(hour)}, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how {settings.businessName} is doing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can(user.role, "reports:view") && (
            <LinkButton href="/reports" variant="secondary">
              <BarChart3 className="h-4 w-4" aria-hidden /> Reports
            </LinkButton>
          )}
          {can(user.role, "invoices:write") && (
            <LinkButton href="/invoices/new">
              <Plus className="h-4 w-4" aria-hidden /> New invoice
            </LinkButton>
          )}
        </div>
      </div>

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Revenue this month"
          value={money(kpis.revenueThisMonthCents)}
          icon={TrendingUp}
          tone="primary"
          hint={
            <Trend
              change={percentChange(kpis.revenueThisMonthCents, kpis.revenueLastMonthCents)}
              label="vs last month"
            />
          }
        />
        <StatCard
          label="Outstanding A/R"
          value={money(kpis.outstandingCents)}
          icon={Landmark}
          tone="primary"
          hint={`${kpis.openInvoiceCount} open ${kpis.openInvoiceCount === 1 ? "invoice" : "invoices"}`}
        />
        <StatCard
          label="Overdue"
          value={money(kpis.overdueCents)}
          icon={AlertTriangle}
          tone={kpis.overdueCount > 0 ? "danger" : "success"}
          hint={
            kpis.overdueCount > 0
              ? `${kpis.overdueCount} ${kpis.overdueCount === 1 ? "invoice is" : "invoices are"} past due`
              : "Nothing past due"
          }
        />
        <StatCard
          label="Expenses this month"
          value={money(kpis.expensesThisMonthCents)}
          icon={Wallet}
          tone="warning"
          hint={`Invoiced ${money(kpis.invoicedThisMonthCents)} this month`}
        />
        <StatCard
          label="Net profit this month"
          value={money(netThisMonth)}
          icon={netThisMonth >= 0 ? TrendingUp : ArrowDownRight}
          tone={netThisMonth >= 0 ? "success" : "danger"}
          hint={margin === null ? "No revenue yet this month" : `${formatPercent(margin)} margin`}
        />
        <Link
          href="/products?lowStock=1"
          className="rounded-xl transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StatCard
            label="Low stock"
            value={kpis.lowStockCount}
            icon={PackageX}
            tone={kpis.lowStockCount > 0 ? "warning" : "success"}
            hint={kpis.lowStockCount > 0 ? "Products at or below reorder level →" : "All products stocked"}
          />
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue vs expenses"
            description="Last 12 months · revenue is cash received"
            action={
              <div className="text-right">
                <p className="text-xs text-muted-foreground">12-month net</p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    pnl.totals.netCents >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {money(pnl.totals.netCents)}
                </p>
              </div>
            }
          />
          <CardBody className="pb-3 pl-2 pr-4 pt-4">
            <RevenueExpenseArea data={chartData} currency={settings.currency} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top customers" description="By revenue, last 12 months" />
          {topCustomers.length === 0 ? (
            <EmptyState icon={Users} title="No payments yet" description="Customers appear here once they pay." />
          ) : (
            <ol className="divide-y">
              {topCustomers.map((c, i) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/customers/${c.id}`} className="block truncate text-sm font-medium hover:underline">
                        <span className="sr-only">#{i + 1} </span>
                        {c.name}
                      </Link>
                      {c.company && <p className="truncate text-xs text-muted-foreground">{c.company}</p>}
                    </div>
                    <span className="text-sm font-medium tabular-nums">{money(c.revenueCents)}</span>
                  </div>
                  <div className="ml-11 mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (c.revenueCents / topMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent invoices"
            action={
              <Link href="/invoices" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            }
          />
          {recentInvoices.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet" description="Your latest invoices will show up here." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Invoice</TH>
                  <TH>Customer</TH>
                  <TH className="hidden sm:table-cell">Issued</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                </tr>
              </THead>
              <TBody>
                {recentInvoices.map((inv) => {
                  const status = displayStatus(inv, todayStr);
                  return (
                    <TR key={inv.id}>
                      <TD className="whitespace-nowrap font-medium">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.number}
                        </Link>
                      </TD>
                      <TD className="max-w-28 truncate sm:max-w-40">{inv.customerName}</TD>
                      <TD className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                        {formatDate(inv.issueDate)}
                      </TD>
                      <TD>
                        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                      </TD>
                      <TD className="text-right tabular-nums">{money(inv.totalCents)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="My open tasks"
            action={
              <Link href="/tasks" className="text-xs font-medium text-primary hover:underline">
                Board
              </Link>
            }
          />
          {myTasks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="You're all caught up" description="No open tasks assigned to you." />
          ) : (
            <ul className="divide-y">
              {myTasks.map((t) => {
                const late = t.dueDate !== null && t.dueDate < todayStr;
                return (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        t.status === "in_progress" ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <Link href="/tasks" className="block truncate text-sm font-medium hover:underline">
                        {t.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className={cn("inline-flex items-center gap-1", late && "font-medium text-danger")}>
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          {t.dueDate ? `${late ? "Overdue · " : "Due "}${formatDate(t.dueDate)}` : "No due date"}
                        </span>
                        {t.customerName && <span className="truncate">· {t.customerName}</span>}
                      </p>
                    </div>
                    <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent activity" description="What your team has been up to" />
        {activity.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" description="Changes across the app are logged here." />
        ) : (
          <ul className="grid divide-y md:grid-cols-2 md:divide-y-0">
            {activity.map((a) => {
              const href = activityHref(a.entityType, a.entityId);
              return (
                <li key={a.id} className="flex items-start gap-3 border-b px-5 py-3 md:odd:border-r">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {a.userName ? initials(a.userName) : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{a.userName ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">·</span>{" "}
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {a.summary}
                        </Link>
                      ) : (
                        a.summary
                      )}
                    </p>
                    <time dateTime={a.createdAt} className="text-xs text-muted-foreground">
                      {relativeTime(a.createdAt, now)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
