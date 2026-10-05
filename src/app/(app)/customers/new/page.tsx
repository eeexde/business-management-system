import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const user = await requireUser();
  if (!can(user.role, "customers:write")) redirect("/customers");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New customer" description="Add a client you sell to." />
      <CustomerForm action={createCustomer} cancelHref="/customers" />
    </div>
  );
}
