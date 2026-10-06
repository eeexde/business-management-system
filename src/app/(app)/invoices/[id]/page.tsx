import { AlertTriangle, ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PAYMENT_METHODS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  canEditInvoice,
  canRecordPayment,
  canVoidInvoice,
  PAYMENT_METHOD_LABELS,
  stockDemand,
} from "@/lib/invoice-logic";
import { balanceDue, displayStatus, lineTotal } from "@/lib/invoices";
import { can } from "@/lib/permissions";
import { getInvoice } from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { getParam } from "@/lib/search-params";
import { centsToInput, cn, formatDate, formatMoney, formatPercent, today } from "@/lib/utils";
import { recordPayment } from "../actions";
import { InvoiceStatusBadge } from "../status-badge";
import { InvoiceActions } from "./invoice-actions";
import { PaymentForm } from "./payment-form";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">) {
  const id = Number((await params).id);
  const invoice = Number.isInteger(id) && id > 0 ? await getInvoice(id) : null;
  return { title: invoice ? `Invoice ${invoice.number}` : "Invoice" };
}

function Notice({ tone, icon: Icon, children }: { tone: "warning" | "neutral"; icon: typeof Lock; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "no-print mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        tone === "warning" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export default async function InvoiceDetailPage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [user, settings, invoice, sp] = await Promise.all([requireUser(), getSettings(), getInvoice(id), searchParams]);
  if (!invoice) notFound();

  const money = (cents: number) => formatMoney(cents, settings.currency);
  const asOf = today();
  const status = displayStatus(invoice, asOf);
  const balance = invoice.status === "void" ? 0 : balanceDue(invoice);
  const canWrite = can(user.role, "invoices:write");
  const isDraft = canEditInvoice(invoice);
  const takesPayment = canWrite && canRecordPayment(invoice);
  const customer = invoice.customer;

  // Drafts: warn before sending if any stock-tracked product would go negative.
  const shortages = isDraft
    ? [
        ...stockDemand(invoice.items, (pid) => invoice.items.find((i) => i.productId === pid)?.isService !== false),
      ].flatMap(([pid, qty]) => {
        const item = invoice.items.find((i) => i.productId === pid)!;
        return item.stock !== null && qty > item.stock ? [{ name: item.description, stock: item.stock, qty }] : [];
      })
    : [];

  return (
    <>
      <div className="no-print mb-6 flex flex-col gap-4">
        <Link
          href="/invoices"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Invoices
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.number}</h1>
            <InvoiceStatusBadge status={status} />
          </div>
          <InvoiceActions
            id={invoice.id}
            canEdit={canWrite && isDraft}
            canSend={canWrite && isDraft}
            canVoid={canWrite && canVoidInvoice(invoice)}
            voidBlockedReason={
              canWrite && invoice.status === "sent" && invoice.amountPaidCents > 0
                ? "This invoice has payments, so it can't be voided. Settle the balance or issue a credit instead."
                : undefined
            }
            canDuplicate={canWrite}
            canDelete={isDraft && can(user.role, "invoices:delete")}
          />
        </div>
      </div>

      {getParam(sp, "notice") === "locked" && (
        <Notice tone="neutral" icon={Lock}>
          Only draft invoices can be edited. Duplicate this invoice to make a new draft{invoice.status === "sent" && invoice.amountPaidCents === 0 ? ", or void it" : ""}.
        </Notice>
      )}
      {shortages.length > 0 && (
        <Notice tone="warning" icon={AlertTriangle}>
          Not enough stock for{" "}
          {shortages.map((s) => `${s.name} (needs ${s.qty}, ${s.stock} in stock)`).join(", ")}. Sending this invoice will
          take stock negative.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] print:block">
        <Card className="p-6 sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {/* Header: business on the left, invoice meta on the right */}
          <div className="flex flex-col justify-between gap-6 sm:flex-row print:flex-row">
            <div>
              <p className="text-lg font-semibold">{settings.businessName}</p>
              {settings.address && (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{settings.address}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {[settings.email, settings.phone].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="sm:text-right print:text-right">
              <p className="text-3xl font-light uppercase tracking-[0.2em] text-muted-foreground">
                {invoice.status === "void" ? "Void" : "Invoice"}
              </p>
              <p className="mt-1 font-mono text-sm font-medium">{invoice.number}</p>
              <InvoiceStatusBadge status={status} className="mt-2 hidden print:inline-flex" />
            </div>
          </div>

          {/* Bill-to and dates */}
          <div className="mt-10 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bill to</p>
              <p className="mt-2 font-medium">
                <Link href={`/customers/${customer.id}`} className="hover:underline print:no-underline">
                  {customer.name}
                </Link>
              </p>
              {customer.company && <p className="text-sm">{customer.company}</p>}
              {customer.address && (
                <p className="whitespace-pre-line text-sm text-muted-foreground">{customer.address}</p>
              )}
              {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
              {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-sm sm:text-right print:text-right">
              <dt className="text-muted-foreground">Issue date</dt>
              <dd className="font-medium">{formatDate(invoice.issueDate)}</dd>
              <dt className="text-muted-foreground">Due date</dt>
              <dd className={cn("font-medium", status === "overdue" && "text-danger")}>{formatDate(invoice.dueDate)}</dd>
              {invoice.paidAt && (
                <>
                  <dt className="text-muted-foreground">Paid on</dt>
                  <dd className="font-medium text-success">{formatDate(invoice.paidAt)}</dd>
                </>
              )}
              <dt className="mt-2 text-muted-foreground">Balance due</dt>
              <dd className="mt-2 text-lg font-semibold tabular-nums">{money(balance)}</dd>
            </dl>
          </div>

          {/* Line items */}
          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Unit price</th>
                  <th className="py-2 pl-4 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.items.map((item) => (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className="py-3 pr-4">
                      <p>{item.description}</p>
                      {item.sku && <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(item.unitPriceCents)}</td>
                    <td className="whitespace-nowrap py-3 pl-4 text-right font-medium tabular-nums">
                      {money(lineTotal(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end break-inside-avoid">
            <dl className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{money(invoice.subtotalCents)}</dd>
              </div>
              {invoice.discountCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="tabular-nums">−{money(invoice.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax ({formatPercent(invoice.taxRate)})</dt>
                <dd className="tabular-nums">{money(invoice.taxCents)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(invoice.totalCents)}</dd>
              </div>
              {invoice.amountPaidCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Amount paid</dt>
                  <dd className="tabular-nums">−{money(invoice.amountPaidCents)}</dd>
                </div>
              )}
              <div className="flex justify-between rounded-lg bg-muted px-3 py-2 font-semibold print:bg-transparent print:px-0">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{money(balance)}</dd>
              </div>
            </dl>
          </div>

          {invoice.notes && (
            <div className="mt-10 break-inside-avoid">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-2 whitespace-pre-line text-sm">{invoice.notes}</p>
            </div>
          )}

          {invoice.payments.length > 0 && (
            <div className="mt-10 break-inside-avoid">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment history</p>
              <table className="mt-2 w-full text-sm">
                <tbody className="divide-y">
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap py-2 pr-4">{formatDate(p.date)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[p.method]}
                        {p.note && ` · ${p.note}`}
                      </td>
                      <td className="whitespace-nowrap py-2 text-right font-medium tabular-nums">{money(p.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-12 border-t pt-4 text-center text-xs text-muted-foreground">
            Thank you for your business. Questions about this invoice? Contact{" "}
            {settings.email ?? settings.phone ?? settings.businessName}.
          </p>
        </Card>

        <div className="no-print flex flex-col gap-6">
          {takesPayment && (
            <Card>
              <CardHeader title="Record payment" description={`Balance due: ${money(balance)}`} />
              <CardBody>
                <PaymentForm
                  action={recordPayment.bind(null, invoice.id)}
                  balance={balance}
                  balanceInput={centsToInput(balance)}
                  defaultDate={asOf < invoice.issueDate ? invoice.issueDate : asOf}
                  minDate={invoice.issueDate}
                  methods={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
                />
              </CardBody>
            </Card>
          )}
          {invoice.status === "paid" && (
            <Card>
              <CardBody className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                <span>
                  Paid in full{invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""}. Paid invoices are locked.
                </span>
              </CardBody>
            </Card>
          )}
          {invoice.status === "void" && (
            <Card>
              <CardBody className="flex items-center gap-3 text-sm text-muted-foreground">
                <Lock className="h-5 w-5 shrink-0" aria-hidden />
                <span>This invoice was voided. Stock was restored and it can no longer be changed.</span>
              </CardBody>
            </Card>
          )}
          {isDraft && (
            <Card>
              <CardBody className="text-sm text-muted-foreground">
                This is a draft. Stock is deducted and payments can be recorded once you mark it as sent.
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
