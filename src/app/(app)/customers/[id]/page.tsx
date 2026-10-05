import { AlertCircle, FilePlus2, FileText, KanbanSquare, Mail, MapPin, Pencil, Phone, Wallet } from "lucide-react";
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
import type { TaskPriority } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { balanceDue, displayStatus, STATUS_TONE } from "@/lib/invoices";
import { can } from "@/lib/permissions";
import {
  getCustomer,
  getCustomerInvoices,
  getCustomerOpenTasks,
  getCustomerStats,
} from "@/lib/queries/customers";
import { getSettings } from "@/lib/queries/settings";
import { formatDate, formatMoney, today } from "@/lib/utils";
import { DeleteCustomerButton } from "./delete-customer-button";

const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };

export async function generateMetadata({ params }: PageProps<"/customers/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const customer = Number.isInteger(id) ? await getCustomer(id) : null;
  return { title: customer?.name ?? "Customer" };
}

export default async function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const [user, settings, stats, invoices, openTasks] = await Promise.all([
    requireUser(),
    getSettings(),
    getCustomerStats(id),
    getCustomerInvoices(id),
    getCustomerOpenTasks(id),
  ]);
  const money = (cents: number) => formatMoney(cents, settings.currency);
  const asOf = today();

  return (
    <>
      <PageHeader
        title={customer.name}
        description={customer.company ?? "Individual customer"}
        actions={
          <>
            {can(user.role, "invoices:write") && (
              <LinkButton href={`/invoices/new?customerId=${id}`}>
                <FilePlus2 className="h-4 w-4" aria-hidden /> New invoice
              </LinkButton>
            )}
            {can(user.role, "customers:write") && (
              <LinkButton href={`/customers/${id}/edit`} variant="secondary">
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </LinkButton>
            )}
            {can(user.role, "customers:delete") && <DeleteCustomerButton id={id} />}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Lifetime revenue" value={money(stats.revenueCents)} hint="Paid on non-void invoices" icon={Wallet} tone="success" />
        <StatCard
          label="Outstanding"
          value={money(stats.outstandingCents)}
          hint="Open balance on sent invoices"
          icon={AlertCircle}
          tone={stats.outstandingCents > 0 ? "warning" : "primary"}
        />
        <StatCard label="Invoices" value={stats.invoiceCount} icon={FileText} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Contact" description={`Customer since ${formatDate(customer.createdAt)}`} />
            <CardBody>
              <dl className="flex flex-col gap-4 text-sm">
                <ContactRow icon={Mail} label="Email">
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="break-all text-primary hover:underline">
                      {customer.email}
                    </a>
                  ) : null}
                </ContactRow>
                <ContactRow icon={Phone} label="Phone">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">
                      {customer.phone}
                    </a>
                  ) : null}
                </ContactRow>
                <ContactRow icon={MapPin} label="Address">
                  {customer.address ? <span className="whitespace-pre-line">{customer.address}</span> : null}
                </ContactRow>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              {customer.notes ? (
                <p className="whitespace-pre-line text-sm">{customer.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Invoices" description={`${invoices.length} total`} />
            {invoices.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" description="Invoices for this customer will show up here." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Number</TH>
                    <TH className="hidden sm:table-cell">Issued</TH>
                    <TH className="hidden sm:table-cell">Due</TH>
                    <TH className="text-right">Total</TH>
                    <TH className="hidden text-right md:table-cell">Balance</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {invoices.map((inv) => {
                    const status = displayStatus(inv, asOf);
                    return (
                      <TR key={inv.id}>
                        <TD>
                          <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                            {inv.number}
                          </Link>
                        </TD>
                        <TD className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{formatDate(inv.issueDate)}</TD>
                        <TD className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{formatDate(inv.dueDate)}</TD>
                        <TD className="text-right tabular-nums">{money(inv.totalCents)}</TD>
                        <TD className="hidden text-right tabular-nums md:table-cell">
                          {inv.status === "void" || inv.status === "draft" ? "—" : money(balanceDue(inv))}
                        </TD>
                        <TD>
                          <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Open tasks"
              description="To-do and in-progress tasks linked to this customer"
              action={
                <Link href="/tasks" className="text-xs font-medium text-primary hover:underline">
                  View board
                </Link>
              }
            />
            {openTasks.length === 0 ? (
              <EmptyState icon={KanbanSquare} title="No open tasks" description="Nothing pending for this customer." />
            ) : (
              <ul className="divide-y">
                {openTasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.status === "in_progress" ? "In progress" : "To do"}
                        {t.assigneeName ? ` · ${t.assigneeName}` : " · Unassigned"}
                        {t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ""}
                      </p>
                    </div>
                    <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{children ?? <span className="text-muted-foreground">—</span>}</dd>
      </div>
    </div>
  );
}
