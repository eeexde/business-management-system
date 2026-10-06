import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getProduct, listProductCategories } from "@/lib/queries/products";
import { updateProduct } from "../../actions";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [user, product, categories] = await Promise.all([requireUser(), getProduct(id), listProductCategories()]);
  if (!product) notFound();
  if (!can(user.role, "products:write")) redirect(`/products/${id}?notice=forbidden`);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit product"
        description={`${product.name} · Stock is changed with adjustments on the product page.`}
      />
      <ProductForm
        action={updateProduct.bind(null, id)}
        product={product}
        categories={categories}
        cancelHref={`/products/${id}`}
      />
    </div>
  );
}
