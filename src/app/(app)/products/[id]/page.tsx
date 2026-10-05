import { Boxes, History, Pencil, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { STOCK_REASONS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isLowStock, marginPercent, stockValueCents } from "@/lib/products";
import { getProduct, getProductMovements, getUnitsSoldSince, isProductInvoiced } from "@/lib/queries/products";
import { getSettings } from "@/lib/queries/settings";
import { addDays, cn, formatDate, formatMoney, formatPercent, today } from "@/lib/utils";
import { ProductActions } from "./product-actions";
import { StockAdjustForm } from "./stock-adjust-form";

const REASON_TONE: Record<(typeof STOCK_REASONS)[number], BadgeTone> = {
  restock: "success",
  sale: "primary",
  adjustment: "warning",
  return: "success",
  void: "neutral",
};

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const product = Number.isInteger(id) ? await getProduct(id) : null;
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const product = await getProduct(id);
  if (!product) notFound();

  const [user, settings, movements, unitsSold, invoiced] = await Promise.all([
    requireUser(),
    getSettings(),
    getProductMovements(id),
    getUnitsSoldSince(id, addDays(today(), -30)),
    isProductInvoiced(id),
  ]);
  const money = (cents: number) => formatMoney(cents, settings.currency);
  const canWrite = can(user.role, "products:write");
  const canDelete = can(user.role, "products:delete") && !invoiced;
  const margin = marginPercent(product.priceCents, product.costCents);
  const low = isLowStock(product);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name}
            {product.archived && <Badge>Archived</Badge>}
            {product.isService && <Badge tone="primary">Service</Badge>}
          </span>
        }
        description={
          <>
            <span className="font-mono">{product.sku}</span>
            {product.category ? ` · ${product.category}` : ""}
          </>
        }
        actions={
          <>
            {canWrite && (
              <LinkButton href={`/products/${id}/edit`} variant="secondary">
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </LinkButton>
            )}
            {(canWrite || canDelete) && (
              <ProductActions id={id} archived={product.archived} canArchive={canWrite} canDelete={canDelete} />
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Stock on hand"
          value={product.isService ? "—" : product.stock}
          hint={
            product.isService
              ? "Services aren't stock-tracked"
              : low
                ? `At or below reorder level (${product.reorderLevel})`
                : `Reorder level ${product.reorderLevel}`
          }
          icon={Boxes}
          tone={low ? (product.stock <= 0 ? "danger" : "warning") : "primary"}
        />
        <StatCard
          label="Stock value"
          value={money(stockValueCents(product))}
          hint={`At cost (${money(product.costCents)} / unit)`}
          icon={Wallet}
          tone="success"
        />
        <StatCard label="Sold (30 days)" value={unitsSold} hint="Units on sent and paid invoices" icon={TrendingUp} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <Detail label="Sale price">{money(product.priceCents)}</Detail>
              <Detail label="Unit cost">{money(product.costCents)}</Detail>
              <Detail label="Margin">
                <span className={cn(margin !== null && margin < 0 && "text-danger")}>
                  {margin === null ? "—" : formatPercent(margin)}
                </span>
              </Detail>
              <Detail label="Reorder level">{product.isService ? "—" : product.reorderLevel}</Detail>
              <Detail label="Added">{formatDate(product.createdAt)}</Detail>
              <Detail label="Status">{product.archived ? "Archived" : "Active"}</Detail>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd className="mt-0.5 whitespace-pre-line">
                  {product.description ?? <span className="text-muted-foreground">No description.</span>}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {canWrite && !product.isService && (
            <Card>
              <CardHeader title="Adjust stock" description="Every change is recorded in the movement history." />
              <CardBody>
                <StockAdjustForm productId={id} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Stock movements" description={movements.length ? `Latest ${movements.length}` : undefined} />
            {movements.length === 0 ? (
              <EmptyState
                icon={History}
                title="No stock movements"
                description={product.isService ? "Services aren't stock-tracked." : "Restocks, sales and adjustments will appear here."}
              />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Reason</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="hidden sm:table-cell">Details</TH>
                  </tr>
                </THead>
                <TBody>
                  {movements.map((m) => (
                    <TR key={m.id}>
                      <TD className="whitespace-nowrap text-muted-foreground">{formatDate(m.createdAt)}</TD>
                      <TD>
                        <Badge tone={REASON_TONE[m.reason]}>{m.reason}</Badge>
                      </TD>
                      <TD
                        className={cn(
                          "text-right font-medium tabular-nums",
                          m.quantity > 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </TD>
                      <TD className="hidden text-muted-foreground sm:table-cell">
                        {m.invoiceId && (
                          <Link href={`/invoices/${m.invoiceId}`} className="text-primary hover:underline">
                            {m.invoiceNumber ?? `Invoice #${m.invoiceId}`}
                          </Link>
                        )}
                        {m.invoiceId && (m.note || m.userName) ? " · " : ""}
                        {[m.note, m.userName].filter(Boolean).join(" · ") || (m.invoiceId ? "" : "—")}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular-nums">{children}</dd>
    </div>
  );
}
