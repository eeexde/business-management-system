import { Download, Plus, Receipt, TrendingDown, TrendingUp, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { categoryBreakdown, EXPENSE_CATEGORY_LABEL, formatMonth, percentChange, recentMonths } from "@/lib/expenses";
import { can } from "@/lib/permissions";
import {
  EXPENSES_PAGE_SIZE,
  getCategoryTotals,
  getMonthComparison,
  listExpenses,
  parseExpenseFilters,
} from "@/lib/queries/expenses";
import { getSettings } from "@/lib/queries/settings";
import { formatDate, formatMoney, formatPercent, today } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Expenses" };

const CATEGORY_TONE: Record<ExpenseCategory, BadgeTone> = {
  rent: "primary",
  payroll: "primary",
  utilities: "neutral",
  supplies: "neutral",
  marketing: "success",
  software: "warning",
  travel: "warning",
  inventory: "danger",
  other: "neutral",
};

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const raw = await searchParams;
  const filters = parseExpenseFilters(raw);
  const page = Math.max(1, Math.floor(Number(raw.page)) || 1);
  const now = today();

  const [user, settings, list, comparison, periodTotals] = await Promise.all([
    requireUser(),
    getSettings(),
    listExpenses(filters, page),
    getMonthComparison(now),
    getCategoryTotals(filters),
  ]);
  const money = (cents: number) => formatMoney(cents, settings.currency);

  const change = percentChange(comparison.thisMonthCents, comparison.lastMonthCents);
  const topCategory = categoryBreakdown(comparison.categories)[0];
  const breakdown = categoryBreakdown(periodTotals);
  const periodLabel = filters.month ? formatMonth(filters.month) : "All time";
  const hasFilters = Boolean(filters.q || filters.category || filters.month);

  const filterParams = { q: filters.q, category: filters.category, month: filters.month };
  const exportQuery = new URLSearchParams(
    Object.entries(filterParams).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Track where the money goes."
        actions={
          <>
            {/* Plain <a>: the export is a route handler returning a file, not a page. */}
            <a
              href={`/expenses/export${exportQuery ? `?${exportQuery}` : ""}`}
              className={buttonClasses("secondary")}
              download
            >
              <Download className="h-4 w-4" aria-hidden /> Export CSV
            </a>
            {can(user.role, "expenses:write") && (
              <LinkButton href="/expenses/new">
                <Plus className="h-4 w-4" aria-hidden /> New expense
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Total · ${periodLabel}`}
          value={money(list.totalCents)}
          hint={`${list.count} ${list.count === 1 ? "expense" : "expenses"}${hasFilters ? " matching filters" : ""}`}
          icon={Wallet}
        />
        <StatCard
          label={`This month · ${formatMonth(comparison.thisMonth)}`}
          value={money(comparison.thisMonthCents)}
          hint={
            change === null
              ? `No spending in ${formatMonth(comparison.lastMonth)}`
              : `${change > 0 ? "+" : ""}${formatPercent(Math.round(change * 10) / 10)} vs ${money(comparison.lastMonthCents)} last month`
          }
          icon={change !== null && change > 0 ? TrendingUp : TrendingDown}
          tone={change !== null && change > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Top category this month"
          value={topCategory ? EXPENSE_CATEGORY_LABEL[topCategory.category] : "—"}
          hint={
            topCategory
              ? `${money(topCategory.totalCents)} · ${formatPercent(Math.round(topCategory.share))} of spend`
              : "Nothing recorded yet"
          }
          icon={Trophy}
        />
      </div>

      {breakdown.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="By category" description={periodLabel} />
          <CardBody>
            <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {breakdown.map((b) => (
                <li key={b.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{EXPENSE_CATEGORY_LABEL[b.category]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(b.totalCents)} · {formatPercent(Math.round(b.share))}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(b.share, 1)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search description or vendor…" />
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            param="category"
            label="Filter by category"
            allLabel="All categories"
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))}
          />
          <FilterSelect param="month" label="Filter by month" allLabel="All months" options={recentMonths(now, 12)} />
        </div>
      </div>

      <Card>
        {list.rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={hasFilters ? "No matching expenses" : "No expenses yet"}
            description={hasFilters ? "Try a different search or clear the filters." : "Record your first business cost."}
            action={
              hasFilters ? (
                <LinkButton href="/expenses" variant="secondary" size="sm">
                  Clear filters
                </LinkButton>
              ) : (
                can(user.role, "expenses:write") && (
                  <LinkButton href="/expenses/new" size="sm">
                    <Plus className="h-4 w-4" aria-hidden /> New expense
                  </LinkButton>
                )
              )
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Description</TH>
                  <TH className="hidden md:table-cell">Vendor</TH>
                  <TH>Category</TH>
                  <TH className="text-right">Amount</TH>
                </tr>
              </THead>
              <TBody>
                {list.rows.map((e) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</TD>
                    <TD className="min-w-48">
                      {can(user.role, "expenses:write") ? (
                        <Link href={`/expenses/${e.id}/edit`} className="font-medium hover:text-primary hover:underline">
                          {e.description}
                        </Link>
                      ) : (
                        <span className="font-medium">{e.description}</span>
                      )}
                      {e.vendor && <p className="text-xs text-muted-foreground md:hidden">{e.vendor}</p>}
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{e.vendor ?? "—"}</TD>
                    <TD>
                      <Badge tone={CATEGORY_TONE[e.category]}>{EXPENSE_CATEGORY_LABEL[e.category]}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-right font-medium tabular-nums">{money(e.amountCents)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={EXPENSES_PAGE_SIZE}
              total={list.count}
              pathname="/expenses"
              params={filterParams}
            />
          </>
        )}
      </Card>
    </>
  );
}
