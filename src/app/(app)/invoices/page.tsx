import { AlertTriangle, CircleDollarSign, FileText, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { DISPLAY_STATUSES } from "@/lib/invoice-logic";
import { balanceDue, displayStatus, type DisplayStatus } from "@/lib/invoices";
import { can } from "@/lib/permissions";
import { getInvoiceSummary, listInvoices } from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { getPage, getParam, toQueryString } from "@/lib/search-params";
import { cn, formatDate, formatMoney, today } from "@/lib/utils";
import { InvoiceStatusBadge, STATUS_LABELS } from "./status-badge";

export const metadata = { title: "Invoices" };

function isDisplayStatus(value: string | undefined): value is DisplayStatus {
  return DISPLAY_STATUSES.includes(value as DisplayStatus);
}

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const params = await searchParams;
  const q = getParam(params, "q");
  const rawStatus = getParam(params, "status");
  const status = isDisplayStatus(rawStatus) ? rawStatus : undefined;
  const page = getPage(params);

  const [user, settings, summary, { rows, total, pageCount }] = await Promise.all([
    requireUser(),
    getSettings(),
    getInvoiceSummary(),
    listInvoices({ q, status, page }),
  ]);
  const money = (cents: number) => formatMoney(cents, settings.currency);
  const asOf = today();
  const canWrite = can(user.role, "invoices:write");
  const filtered = Boolean(q || status);
  const pageHref = (p: number) => `/invoices${toQueryString({ q, status, page: p > 1 ? p : undefined })}`;

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Bill customers, track payments and follow up on overdue balances."
        actions={
          canWrite && (
            <LinkButton href="/invoices/new">
              <Plus className="h-4 w-4" aria-hidden /> New invoice
            </LinkButton>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={money(summary.outstanding.cents)}
          hint={`${summary.outstanding.count} open ${summary.outstanding.count === 1 ? "invoice" : "invoices"}`}
          icon={Wallet}
        />
        <StatCard
          label="Overdue"
          value={money(summary.overdue.cents)}
          hint={`${summary.overdue.count} past due`}
          icon={AlertTriangle}
          tone={summary.overdue.cents > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Paid (last 30 days)"
          value={money(summary.collected.cents)}
          hint={`${summary.collected.count} ${summary.collected.count === 1 ? "payment" : "payments"} received`}
          icon={CircleDollarSign}
          tone="success"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput placeholder="Search number or customer…" />
          <FilterSelect
            param="status"
            label="Filter by status"
            allLabel="All statuses"
            options={DISPLAY_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filtered ? "No matching invoices" : "No invoices yet"}
            description={
              filtered ? "Try a different search or status filter." : "Create your first invoice to start getting paid."
            }
            action={
              !filtered &&
              canWrite && (
                <LinkButton href="/invoices/new" size="sm">
                  <Plus className="h-4 w-4" aria-hidden /> New invoice
                </LinkButton>
              )
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Number</TH>
                  <TH>Customer</TH>
                  <TH className="hidden md:table-cell">Issued</TH>
                  <TH className="hidden sm:table-cell">Due</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="hidden text-right lg:table-cell">Balance due</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((inv) => {
                  const ds = displayStatus(inv, asOf);
                  const balance = inv.status === "void" ? 0 : balanceDue(inv);
                  return (
                    <TR key={inv.id}>
                      <TD className="whitespace-nowrap font-medium">
                        <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                          {inv.number}
                        </Link>
                      </TD>
                      <TD>
                        <div className="max-w-[14rem] truncate">{inv.customerName}</div>
                        {inv.customerCompany && (
                          <div className="max-w-[14rem] truncate text-xs text-muted-foreground">{inv.customerCompany}</div>
                        )}
                      </TD>
                      <TD className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {formatDate(inv.issueDate)}
                      </TD>
                      <TD
                        className={cn(
                          "hidden whitespace-nowrap sm:table-cell",
                          ds === "overdue" ? "font-medium text-danger" : "text-muted-foreground",
                        )}
                      >
                        {formatDate(inv.dueDate)}
                      </TD>
                      <TD className={cn("whitespace-nowrap text-right tabular-nums", ds === "void" && "line-through text-muted-foreground")}>
                        {money(inv.totalCents)}
                      </TD>
                      <TD className="hidden whitespace-nowrap text-right tabular-nums lg:table-cell">
                        {balance > 0 && inv.status !== "draft" ? money(balance) : <span className="text-muted-foreground">—</span>}
                      </TD>
                      <TD>
                        <InvoiceStatusBadge status={ds} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <nav
              className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm"
              aria-label="Pagination"
            >
              <p className="text-muted-foreground">
                {total} {total === 1 ? "invoice" : "invoices"}
                {pageCount > 1 && ` · Page ${page} of ${pageCount}`}
              </p>
              {pageCount > 1 && (
                <div className="flex gap-2">
                  {page > 1 && (
                    <LinkButton href={pageHref(page - 1)} variant="secondary" size="sm">
                      Previous
                    </LinkButton>
                  )}
                  {page < pageCount && (
                    <LinkButton href={pageHref(page + 1)} variant="secondary" size="sm">
                      Next
                    </LinkButton>
                  )}
                </div>
              )}
            </nav>
          </>
        )}
      </Card>
    </>
  );
}
