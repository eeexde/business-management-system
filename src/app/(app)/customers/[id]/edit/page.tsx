import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCustomer } from "@/lib/queries/customers";
import { updateCustomer } from "../../actions";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [user, customer] = await Promise.all([requireUser(), getCustomer(id)]);
  if (!customer) notFound();
  if (!can(user.role, "customers:write")) redirect(`/customers/${id}`);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit customer" description={customer.name} />
      <CustomerForm action={updateCustomer.bind(null, id)} customer={customer} cancelHref={`/customers/${id}`} />
    </div>
  );
}
