import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { canEditInvoice } from "@/lib/invoice-logic";
import { getInvoice, getInvoiceFormOptions } from "@/lib/queries/invoices";
import { getSettings } from "@/lib/queries/settings";
import { centsToInput } from "@/lib/utils";
import { updateInvoice } from "../../actions";
import { InvoiceForm } from "../../invoice-form";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  await requirePermission("invoices:write", "/invoices");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [invoice, settings, { customers, products }] = await Promise.all([
    getInvoice(id),
    getSettings(),
    getInvoiceFormOptions(),
  ]);
  if (!invoice) notFound();
  // Only drafts are editable; sent/paid/void invoices are locked.
  if (!canEditInvoice(invoice)) redirect(`/invoices/${id}?notice=locked`);

  return (
    <>
      <PageHeader title={`Edit ${invoice.number}`} description="Changes are saved to this draft." />
      <InvoiceForm
        action={updateInvoice.bind(null, id)}
        customers={customers}
        products={products}
        paymentTerms={settings.paymentTerms}
        currency={settings.currency}
        submitLabel="Save draft"
        cancelHref={`/invoices/${id}`}
        defaults={{
          customerId: String(invoice.customerId),
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          taxRate: String(invoice.taxRate),
          discount: invoice.discountCents ? centsToInput(invoice.discountCents) : "",
          notes: invoice.notes ?? "",
          items: invoice.items.map((item) => ({
            productId: item.productId ? String(item.productId) : "",
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: centsToInput(item.unitPriceCents),
          })),
        }}
      />
    </>
  );
}
