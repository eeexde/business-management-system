import { Download, Landmark, Package, PieChart, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { CategoryDonut } from "@/components/charts/category-donut";
import { RevenueExpenseBars, type MonthPoint } from "@/components/charts/revenue-expense-chart";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth";
import { AGING_BUCKETS } from "@/lib/invoices";
import {
  getAging,
  getInvoicedByMonth,
  getPnl,
  getSalesByCustomer,
  getSalesByProduct,
} from "@/lib/queries/reports";
import { getSettings } from "@/lib/queries/settings";
import {
  AGING_LABELS,
  categoryBreakdown,
  categoryLabel,
  monthLabel,
  RANGE_LABELS,
  rangeParams,
  resolveRange,
  type DateRange,
  type ReportName,
} from "@/lib/reports";
import { getParam, toQueryString } from "@/lib/search-params";
import { cn, formatDate, formatMoney, formatPercent, today } from "@/lib/utils";
import { RangePicker } from "./range-picker";

export const metadata = { title: "Reports" };

function exportHref(report: ReportName, range: DateRange) {
  return `/reports/export/${report}${toQueryString(rangeParams(range))}`;
}

function ExportLink({ report, range }: { report: ReportName; range: DateRange }) {
  // A plain <a> so the browser downloads the file instead of client-side navigating.
  return (
    <a
      href={exportHref(report, range)}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      download
    >
      <Download className="h-3.5 w-3.5" aria-hidden /> CSV
    </a>
  );
}

function pct(value: number | null) {
  return value === null ? "—" : formatPercent(value);
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requirePermission("reports:view");
  const sp = await searchParams;
  const todayStr = today();
  const range = resolveRange(getParam(sp, "range"), todayStr, { from: getParam(sp, "from"), to: getParam(sp, "to") });

  const [settings, pnl, invoiced, productSales, customerSales, aging] = await Promise.all([
    getSettings(),
    getPnl(range.from, range.to),
    getInvoicedByMonth(range.from, range.to),
    getSalesByProduct(range.from, range.to),
    getSalesByCustomer(range.from, range.to),
    getAging(todayStr),
  ]);
  const money = (cents: number) => formatMoney(cents, settings.currency);

  const invoicedByMonth = new Map(invoiced.map((i) => [i.month, i.cents]));
  const invoicedTotal = invoiced.reduce((s, i) => s + i.cents, 0);
  const slices = categoryBreakdown(pnl.categories.map((c) => ({ category: c, cents: pnl.totals.byCategory[c] })));
  const multiYear = pnl.rows.length > 0 && pnl.rows[0]!.month.slice(0, 4) !== pnl.rows.at(-1)!.month.slice(0, 4);
  const chartData: MonthPoint[] = pnl.rows.map((r) => ({
    label: monthLabel(r.month, multiYear),
    title: monthLabel(r.month, true),
    revenueCents: r.revenueCents,
    expensesCents: r.expensesCents,
    netCents: r.netCents,
  }));
  const productTotals = productSales.reduce(
    (t, p) => ({ units: t.units + p.units, revenue: t.revenue + p.revenueCents, profit: t.profit + p.grossProfitCents }),
    { units: 0, revenue: 0, profit: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description={`${RANGE_LABELS[range.key]} · ${formatDate(range.from)} – ${formatDate(range.to)}`}
        actions={<RangePicker key={`${range.key}:${range.from}:${range.to}`} range={range} />}
      />

      <section aria-label="Period summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (cash)" value={money(pnl.totals.revenueCents)} icon={TrendingUp} hint="Payments received" />
        <StatCard label="Invoiced" value={money(invoicedTotal)} icon={Receipt} hint="Issued, excluding drafts and voids" />
        <StatCard label="Expenses" value={money(pnl.totals.expensesCents)} icon={Wallet} tone="warning" />
        <StatCard
          label="Net profit"
          value={money(pnl.totals.netCents)}
          icon={Landmark}
          tone={pnl.totals.netCents >= 0 ? "success" : "danger"}
          hint={`${pct(pnl.totals.marginPct)} margin`}
        />
      </section>

      <Card id="pnl">
        <CardHeader
          title="Profit & loss"
          description="Revenue is cash received (payments by date); invoiced is shown for reference."
          action={<ExportLink report="pnl" range={range} />}
        />
        <CardBody className="pb-3 pl-2 pr-4 pt-4">
          <RevenueExpenseBars data={chartData} currency={settings.currency} />
        </CardBody>
        <Table>
          <THead>
            <tr>
              <TH>Month</TH>
              <TH className="text-right">Invoiced</TH>
              <TH className="text-right">Revenue</TH>
              {pnl.categories.map((c) => (
                <TH key={c} className="text-right">
                  {categoryLabel(c)}
                </TH>
              ))}
              <TH className="text-right">Expenses</TH>
              <TH className="text-right">Net</TH>
              <TH className="text-right">Margin</TH>
            </tr>
          </THead>
          <TBody className="tabular-nums">
            {pnl.rows.map((r) => (
              <TR key={r.month}>
                <TD className="whitespace-nowrap font-medium">{monthLabel(r.month, true)}</TD>
                <TD className="text-right text-muted-foreground">{money(invoicedByMonth.get(r.month) ?? 0)}</TD>
                <TD className="text-right">{money(r.revenueCents)}</TD>
                {pnl.categories.map((c) => (
                  <TD key={c} className="text-right text-muted-foreground">
                    {money(r.byCategory[c])}
                  </TD>
                ))}
                <TD className="text-right">{money(r.expensesCents)}</TD>
                <TD className={cn("text-right font-medium", r.netCents < 0 && "text-danger")}>{money(r.netCents)}</TD>
                <TD className="text-right text-muted-foreground">{pct(r.marginPct)}</TD>
              </TR>
            ))}
          </TBody>
          <tfoot className="border-t-2 bg-muted/50 font-semibold tabular-nums">
            <tr>
              <TD>Total</TD>
              <TD className="text-right">{money(invoicedTotal)}</TD>
              <TD className="text-right">{money(pnl.totals.revenueCents)}</TD>
              {pnl.categories.map((c) => (
                <TD key={c} className="text-right">
                  {money(pnl.totals.byCategory[c])}
                </TD>
              ))}
              <TD className="text-right">{money(pnl.totals.expensesCents)}</TD>
              <TD className={cn("text-right", pnl.totals.netCents < 0 && "text-danger")}>{money(pnl.totals.netCents)}</TD>
              <TD className="text-right">{pct(pnl.totals.marginPct)}</TD>
            </tr>
          </tfoot>
        </Table>
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card id="expenses" className="xl:col-span-2">
          <CardHeader
            title="Expenses by category"
            description="Share of spend in the period"
            action={<ExportLink report="expenses" range={range} />}
          />
          {slices.length === 0 ? (
            <EmptyState icon={PieChart} title="No expenses in this period" />
          ) : (
            <CardBody>
              <CategoryDonut slices={slices} currency={settings.currency} />
            </CardBody>
          )}
        </Card>

        <Card id="customers" className="xl:col-span-3">
          <CardHeader
            title="Sales by customer"
            description="Invoiced by issue date; paid by payment date"
            action={<ExportLink report="customers" range={range} />}
          />
          {customerSales.length === 0 ? (
            <EmptyState icon={Users} title="No customer sales in this period" />
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>Customer</TH>
                    <TH className="text-right">Invoices</TH>
                    <TH className="text-right">Invoiced</TH>
                    <TH className="text-right">Paid</TH>
                  </tr>
                </THead>
                <TBody className="tabular-nums">
                  {customerSales.map((c) => (
                    <TR key={c.customerId}>
                      <TD className="max-w-56">
                        <Link href={`/customers/${c.customerId}`} className="block truncate font-medium hover:underline">
                          {c.name}
                        </Link>
                        {c.company && <span className="block truncate text-xs text-muted-foreground">{c.company}</span>}
                      </TD>
                      <TD className="text-right text-muted-foreground">{c.invoiceCount}</TD>
                      <TD className="text-right">{money(c.invoicedCents)}</TD>
                      <TD className="text-right font-medium">{money(c.paidCents)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Card id="products">
        <CardHeader
          title="Sales by product"
          description="Line amounts on invoices issued in the period (before invoice discounts and tax); cost uses each product's current unit cost"
          action={<ExportLink report="products" range={range} />}
        />
        {productSales.length === 0 ? (
          <EmptyState icon={Package} title="No product sales in this period" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH className="text-right">Units</TH>
                <TH className="text-right">Revenue</TH>
                <TH className="hidden text-right sm:table-cell">Cost</TH>
                <TH className="text-right">Gross profit</TH>
                <TH className="hidden text-right sm:table-cell">Margin</TH>
              </tr>
            </THead>
            <TBody className="tabular-nums">
              {productSales.map((p) => {
                const margin = p.revenueCents === 0 ? null : Math.round((p.grossProfitCents / p.revenueCents) * 1000) / 10;
                return (
                  <TR key={p.productId ?? "custom"}>
                    <TD className="max-w-64">
                      {p.productId ? (
                        <Link href={`/products/${p.productId}`} className="block truncate font-medium hover:underline">
                          {p.name}
                        </Link>
                      ) : (
                        <span className="block truncate font-medium italic text-muted-foreground">{p.name}</span>
                      )}
                      {p.sku && <span className="block font-mono text-xs text-muted-foreground">{p.sku}</span>}
                    </TD>
                    <TD className="text-right">{p.units.toLocaleString("en-US")}</TD>
                    <TD className="text-right">{money(p.revenueCents)}</TD>
                    <TD className="hidden text-right text-muted-foreground sm:table-cell">{money(p.costCents)}</TD>
                    <TD className={cn("text-right font-medium", p.grossProfitCents < 0 && "text-danger")}>
                      {money(p.grossProfitCents)}
                    </TD>
                    <TD className="hidden text-right text-muted-foreground sm:table-cell">{pct(margin)}</TD>
                  </TR>
                );
              })}
            </TBody>
            <tfoot className="border-t-2 bg-muted/50 font-semibold tabular-nums">
              <tr>
                <TD>Total</TD>
                <TD className="text-right">{productTotals.units.toLocaleString("en-US")}</TD>
                <TD className="text-right">{money(productTotals.revenue)}</TD>
                <TD className="hidden text-right sm:table-cell">{money(productTotals.revenue - productTotals.profit)}</TD>
                <TD className="text-right">{money(productTotals.profit)}</TD>
                <TD className="hidden text-right sm:table-cell">
                  {pct(productTotals.revenue === 0 ? null : Math.round((productTotals.profit / productTotals.revenue) * 1000) / 10)}
                </TD>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      <Card id="aging">
        <CardHeader
          title="A/R aging"
          description={`Open balances on sent invoices by days past due, as of ${formatDate(todayStr)} (not affected by the period)`}
          action={<ExportLink report="aging" range={range} />}
        />
        {aging.rows.length === 0 ? (
          <EmptyState icon={Landmark} title="Nothing outstanding" description="Every sent invoice is paid." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Customer</TH>
                {AGING_BUCKETS.map((b) => (
                  <TH key={b} className="text-right">
                    {AGING_LABELS[b]}
                  </TH>
                ))}
                <TH className="text-right">Total</TH>
              </tr>
            </THead>
            <TBody className="tabular-nums">
              {aging.rows.map((r) => (
                <TR key={r.customerId}>
                  <TD className="max-w-56">
                    <Link href={`/customers/${r.customerId}`} className="block truncate font-medium hover:underline">
                      {r.customerName}
                    </Link>
                  </TD>
                  {AGING_BUCKETS.map((b) => (
                    <TD
                      key={b}
                      className={cn(
                        "text-right",
                        r.buckets[b] === 0 && "text-muted-foreground",
                        r.buckets[b] > 0 && (b === "61-90" || b === "90+") && "font-medium text-danger",
                        r.buckets[b] > 0 && (b === "1-30" || b === "31-60") && "text-warning",
                      )}
                    >
                      {r.buckets[b] === 0 ? "—" : money(r.buckets[b])}
                    </TD>
                  ))}
                  <TD className="text-right font-medium">{money(r.totalCents)}</TD>
                </TR>
              ))}
            </TBody>
            <tfoot className="border-t-2 bg-muted/50 font-semibold tabular-nums">
              <tr>
                <TD>Total</TD>
                {AGING_BUCKETS.map((b) => (
                  <TD key={b} className="text-right">
                    {money(aging.totals[b])}
                  </TD>
                ))}
                <TD className="text-right">{money(aging.totalCents)}</TD>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
