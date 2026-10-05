import { Users } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { getInvoiceFormOptions } from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { getParam } from "@/lib/search-params";
import { addDays, today } from "@/lib/utils";
import { createInvoice } from "../actions";
import { InvoiceForm } from "../invoice-form";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  await requirePermission("invoices:write");
  const params = await searchParams;
  const [settings, { customers, products }] = await Promise.all([getSettings(), getInvoiceFormOptions()]);

  const requested = getParam(params, "customerId");
  const customerId = customers.some((c) => String(c.id) === requested) ? requested! : "";
  const issueDate = today();

  return (
    <>
      <PageHeader title="New invoice" description="Draft an invoice. You can review it before marking it as sent." />
      {customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Add a customer first"
            description="Invoices are billed to a customer."
            action={
              <LinkButton href="/customers/new" size="sm">
                New customer
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <InvoiceForm
          action={createInvoice}
          customers={customers}
          products={products}
          paymentTerms={settings.paymentTerms}
          currency={settings.currency}
          submitLabel="Create draft"
          cancelHref="/invoices"
          defaults={{
            customerId,
            issueDate,
            dueDate: addDays(issueDate, settings.paymentTerms),
            taxRate: String(settings.defaultTaxRate),
            discount: "",
            notes: "",
            items: [],
          }}
        />
      )}
    </>
  );
}
