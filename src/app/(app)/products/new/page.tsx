import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listProductCategories } from "@/lib/queries/products";
import { createProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const user = await requireUser();
  if (!can(user.role, "products:write")) redirect("/products?notice=forbidden");
  const categories = await listProductCategories();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New product" description="Add an item or service you sell." />
      <ProductForm action={createProduct} categories={categories} cancelHref="/products" />
    </div>
  );
}
