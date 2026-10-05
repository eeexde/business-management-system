import { Check, Package, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isLowStock, marginPercent, stockValueCents } from "@/lib/products";
import {
  getInventorySummary,
  listProductCategories,
  listProducts,
  PRODUCTS_PAGE_SIZE,
} from "@/lib/queries/products";
import { getSettings } from "@/lib/queries/settings";
import { getPage, getParam, toQueryString } from "@/lib/search-params";
import { cn, formatMoney, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const q = getParam(sp, "q");
  const category = getParam(sp, "category");
  const lowStock = getParam(sp, "stock") === "low";
  const showArchived = getParam(sp, "archived") === "1";
  const page = getPage(sp);

  const [user, settings, { rows, total }, categories, summary] = await Promise.all([
    requireUser(),
    getSettings(),
    listProducts({ q, category, lowStock, showArchived, page }),
    listProductCategories(),
    getInventorySummary(),
  ]);
  const canWrite = can(user.role, "products:write");
  const money = (cents: number) => formatMoney(cents, settings.currency);
  const filtered = Boolean(q || category || lowStock);

  // Current filters as plain params, for toggle links and pagination.
  const current = { q, category, stock: lowStock ? "low" : undefined, archived: showArchived ? "1" : undefined };
  const toggleHref = (key: "stock" | "archived", on: string) =>
    `/products${toQueryString({ ...current, [key]: current[key] ? undefined : on })}`;

  return (
    <>
      <PageHeader
        title="Products"
        description={`${summary.activeCount} active · ${summary.lowStockCount} low on stock · ${money(summary.stockValueCents)} in stock at cost`}
        actions={
          canWrite && (
            <LinkButton href="/products/new">
              <Plus className="h-4 w-4" aria-hidden /> New product
            </LinkButton>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search name or SKU…" />
        <FilterSelect
          param="category"
          label="Category"
          allLabel="All categories"
          options={categories.map((c) => ({ value: c, label: c }))}
        />
        <div className="flex gap-2">
          <ToggleLink href={toggleHref("stock", "low")} active={lowStock}>
            Low stock
          </ToggleLink>
          <ToggleLink href={toggleHref("archived", "1")} active={showArchived}>
            Show archived
          </ToggleLink>
        </div>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title={filtered ? "No products match these filters" : "No products yet"}
            description={filtered ? "Try clearing the search or filters." : "Add products and services to sell on invoices."}
            action={
              canWrite && !filtered ? (
                <LinkButton href="/products/new" size="sm">
                  <Plus className="h-4 w-4" aria-hidden /> New product
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH className="hidden sm:table-cell">SKU</TH>
                  <TH>Name</TH>
                  <TH className="hidden lg:table-cell">Category</TH>
                  <TH className="text-right">Price</TH>
                  <TH className="hidden text-right md:table-cell">Cost</TH>
                  <TH className="hidden text-right md:table-cell">Margin</TH>
                  <TH className="text-right">Stock</TH>
                  <TH className="hidden text-right lg:table-cell">Stock value</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((p) => {
                  const margin = marginPercent(p.priceCents, p.costCents);
                  const low = isLowStock(p);
                  return (
                    <TR key={p.id} className={cn(p.archived && "opacity-60")}>
                      <TD className="hidden whitespace-nowrap font-mono text-xs text-muted-foreground sm:table-cell">{p.sku}</TD>
                      <TD>
                        <Link href={`/products/${p.id}`} className="font-medium hover:text-primary hover:underline">
                          {p.name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {p.isService && <Badge>Service</Badge>}
                          {p.archived && <Badge>Archived</Badge>}
                        </div>
                      </TD>
                      <TD className="hidden text-muted-foreground lg:table-cell">{p.category ?? "—"}</TD>
                      <TD className="text-right tabular-nums">{money(p.priceCents)}</TD>
                      <TD className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{money(p.costCents)}</TD>
                      <TD
                        className={cn(
                          "hidden text-right tabular-nums md:table-cell",
                          margin !== null && margin < 0 && "text-danger",
                        )}
                      >
                        {margin === null ? "—" : formatPercent(margin)}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {p.isService ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-2">
                            {low && <Badge tone={p.stock <= 0 ? "danger" : "warning"}>{p.stock <= 0 ? "Out" : "Low"}</Badge>}
                            {p.stock}
                          </span>
                        )}
                      </TD>
                      <TD className="hidden text-right tabular-nums lg:table-cell">
                        {p.isService ? "—" : money(stockValueCents(p))}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PRODUCTS_PAGE_SIZE} total={total} pathname="/products" params={current} />
          </>
        )}
      </Card>
    </>
  );
}

function ToggleLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <LinkButton href={href} variant={active ? "primary" : "secondary"} aria-current={active ? "true" : undefined}>
      {active && <Check className="h-4 w-4" aria-hidden />}
      {children}
    </LinkButton>
  );
}
