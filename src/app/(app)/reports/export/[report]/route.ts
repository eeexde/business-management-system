import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { AGING_BUCKETS } from "@/lib/invoices";
import { can } from "@/lib/permissions";
import {
  getAging,
  getInvoicedByMonth,
  getPnl,
  getSalesByCustomer,
  getSalesByProduct,
} from "@/lib/queries/reports";
import {
  AGING_LABELS,
  categoryBreakdown,
  categoryLabel,
  REPORT_NAMES,
  resolveRange,
  type DateRange,
  type ReportName,
} from "@/lib/reports";
import { today } from "@/lib/utils";

/** Cents as a plain decimal for spreadsheets, e.g. 123456 -> "1234.56". */
const amount = (cents: number) => (cents / 100).toFixed(2);

async function buildCsv(report: ReportName, range: DateRange, asOf: string): Promise<string> {
  switch (report) {
    case "pnl": {
      const [pnl, invoiced] = await Promise.all([getPnl(range.from, range.to), getInvoicedByMonth(range.from, range.to)]);
      const invoicedBy = new Map(invoiced.map((i) => [i.month, i.cents]));
      const rows = [
        ...pnl.rows.map((r) => ({ ...r, label: r.month, invoicedCents: invoicedBy.get(r.month) ?? 0 })),
        { ...pnl.totals, label: "Total", invoicedCents: invoiced.reduce((s, i) => s + i.cents, 0) },
      ];
      return toCsv(rows, [
        { header: "Month", value: (r) => r.label },
        { header: "Invoiced", value: (r) => amount(r.invoicedCents) },
        { header: "Revenue (cash)", value: (r) => amount(r.revenueCents) },
        ...pnl.categories.map((c) => ({
          header: `Expenses: ${categoryLabel(c)}`,
          value: (r: (typeof rows)[number]) => amount(r.byCategory[c]),
        })),
        { header: "Total expenses", value: (r) => amount(r.expensesCents) },
        { header: "Net profit", value: (r) => amount(r.netCents) },
        { header: "Margin %", value: (r) => r.marginPct },
      ]);
    }
    case "products": {
      const rows = await getSalesByProduct(range.from, range.to);
      return toCsv(rows, [
        { header: "Product", value: (r) => r.name },
        { header: "SKU", value: (r) => r.sku },
        { header: "Units", value: (r) => r.units },
        { header: "Revenue", value: (r) => amount(r.revenueCents) },
        { header: "Cost", value: (r) => amount(r.costCents) },
        { header: "Gross profit", value: (r) => amount(r.grossProfitCents) },
      ]);
    }
    case "customers": {
      const rows = await getSalesByCustomer(range.from, range.to);
      return toCsv(rows, [
        { header: "Customer", value: (r) => r.name },
        { header: "Company", value: (r) => r.company },
        { header: "Invoices", value: (r) => r.invoiceCount },
        { header: "Invoiced", value: (r) => amount(r.invoicedCents) },
        { header: "Paid", value: (r) => amount(r.paidCents) },
      ]);
    }
    case "expenses": {
      const pnl = await getPnl(range.from, range.to);
      const rows = categoryBreakdown(pnl.categories.map((c) => ({ category: c, cents: pnl.totals.byCategory[c] })));
      return toCsv(rows, [
        { header: "Category", value: (r) => categoryLabel(r.category) },
        { header: "Amount", value: (r) => amount(r.cents) },
        { header: "Share %", value: (r) => r.pct },
      ]);
    }
    case "aging": {
      const aging = await getAging(asOf);
      const rows = [
        ...aging.rows,
        { customerId: 0, customerName: "Total", buckets: aging.totals, totalCents: aging.totalCents },
      ];
      return toCsv(rows, [
        { header: "Customer", value: (r) => r.customerName },
        ...AGING_BUCKETS.map((b) => ({ header: AGING_LABELS[b], value: (r: (typeof rows)[number]) => amount(r.buckets[b]) })),
        { header: "Total", value: (r) => amount(r.totalCents) },
      ]);
    }
  }
}

/** CSV export for one report section. Accepts the same ?range= / ?from= / ?to= as the page. */
export async function GET(request: NextRequest, ctx: RouteContext<"/reports/export/[report]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user.role, "reports:view")) return new Response("Forbidden", { status: 403 });

  const { report } = await ctx.params;
  if (!(REPORT_NAMES as readonly string[]).includes(report)) return new Response("Not found", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const asOf = today();
  const range = resolveRange(sp.get("range") ?? undefined, asOf, {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  const csv = await buildCsv(report as ReportName, range, asOf);
  const filename = report === "aging" ? `ar-aging-${asOf}.csv` : `${report}-${range.from}-to-${range.to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
