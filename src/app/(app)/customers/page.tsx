import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CUSTOMERS_PAGE_SIZE, listCustomers } from "@/lib/queries/customers";
import { getSettings } from "@/lib/queries/settings";
import { getPage, getParam } from "@/lib/search-params";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const sp = await searchParams;
  const q = getParam(sp, "q");
  const page = getPage(sp);
  const [user, settings, { rows, total }] = await Promise.all([
    requireUser(),
    getSettings(),
    listCustomers({ q, page }),
  ]);
  const canWrite = can(user.role, "customers:write");
  const money = (cents: number) => formatMoney(cents, settings.currency);

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total} ${total === 1 ? "customer" : "customers"}${q ? ` matching “${q}”` : ""}`}
        actions={
          canWrite && (
            <LinkButton href="/customers/new">
              <Plus className="h-4 w-4" aria-hidden /> New customer
            </LinkButton>
          )
        }
      />
      <div className="mb-4">
        <SearchInput placeholder="Search name, company or email…" />
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No customers match your search" : "No customers yet"}
            description={q ? "Try a different name, company or email." : "Add your first customer to start invoicing."}
            action={
              canWrite && !q ? (
                <LinkButton href="/customers/new" size="sm">
                  <Plus className="h-4 w-4" aria-hidden /> New customer
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Customer</TH>
                  <TH className="hidden md:table-cell">Email</TH>
                  <TH className="hidden lg:table-cell">Phone</TH>
                  <TH className="text-right">Invoices</TH>
                  <TH className="text-right">Lifetime revenue</TH>
                  <TH className="text-right">Outstanding</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:text-primary hover:underline">
                        {c.name}
                      </Link>
                      {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">{c.email ?? "—"}</TD>
                    <TD className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{c.phone ?? "—"}</TD>
                    <TD className="text-right tabular-nums">{c.invoiceCount}</TD>
                    <TD className="text-right tabular-nums">{money(c.revenueCents)}</TD>
                    <TD
                      className={cn(
                        "text-right tabular-nums",
                        c.outstandingCents > 0 ? "font-medium text-warning" : "text-muted-foreground",
                      )}
                    >
                      {money(c.outstandingCents)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={CUSTOMERS_PAGE_SIZE}
              total={total}
              pathname="/customers"
              params={{ q }}
            />
          </>
        )}
      </Card>
    </>
  );
}
