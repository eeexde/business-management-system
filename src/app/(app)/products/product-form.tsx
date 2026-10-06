"use client";

import { startTransition, useActionState, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { Product } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { marginPercent } from "@/lib/products";
import { centsToInput, formatPercent, parseMoney } from "@/lib/utils";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  product?: Product;
  categories: string[];
  cancelHref: string;
};

/** Shared create/edit form. Initial stock is only shown when creating. */
export function ProductForm({ action, product, categories, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [isService, setIsService] = useState(product?.isService ?? false);
  const [price, setPrice] = useState(product ? centsToInput(product.priceCents) : "");
  const [cost, setCost] = useState(product ? centsToInput(product.costCents) : "");
  const err = (name: string) => state.errors?.[name];
  const invalid = (name: string) => ({
    "aria-invalid": Boolean(err(name)),
    "aria-describedby": err(name) ? `${name}-error` : undefined,
  });

  const priceCents = parseMoney(price);
  const costCents = parseMoney(cost);
  const margin =
    Number.isFinite(priceCents) && Number.isFinite(costCents) ? marginPercent(priceCents, costCents) : null;

  return (
    <Card>
      <CardBody>
        <form
          action={formAction}
          // Submit manually so React doesn't reset the fields when validation fails.
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => formAction(data));
          }}
          className="grid gap-5 sm:grid-cols-2"
          noValidate
        >
          <Field label="SKU" htmlFor="sku" errors={err("sku")} hint="Unique code, e.g. OFC-1001.">
            <Input
              id="sku"
              name="sku"
              defaultValue={product?.sku}
              required
              autoCapitalize="characters"
              className="font-mono uppercase"
              {...invalid("sku")}
            />
          </Field>
          <Field label="Name" htmlFor="name" errors={err("name")}>
            <Input id="name" name="name" defaultValue={product?.name} required {...invalid("name")} />
          </Field>
          <Field label="Description" htmlFor="description" errors={err("description")} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={3} defaultValue={product?.description ?? ""} />
          </Field>
          <Field label="Category" htmlFor="category" errors={err("category")} hint="Pick an existing one or type a new one.">
            <Input id="category" name="category" list="product-categories" defaultValue={product?.category ?? ""} />
            <datalist id="product-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Reorder level" htmlFor="reorderLevel" errors={err("reorderLevel")} hint="Flag as low stock at or below this.">
            <Input
              id="reorderLevel"
              name="reorderLevel"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={product?.reorderLevel ?? 0}
              disabled={isService}
              {...invalid("reorderLevel")}
            />
            {/* Disabled inputs aren't submitted; keep the value for services. */}
            {isService && <input type="hidden" name="reorderLevel" value={product?.reorderLevel ?? 0} />}
          </Field>
          <Field label="Sale price" htmlFor="price" errors={err("price")}>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              {...invalid("price")}
            />
          </Field>
          <Field
            label="Unit cost"
            htmlFor="cost"
            errors={err("cost")}
            hint={margin === null ? undefined : `Margin: ${formatPercent(margin)}`}
          >
            <Input
              id="cost"
              name="cost"
              inputMode="decimal"
              placeholder="0.00"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              {...invalid("cost")}
            />
          </Field>
          {!product && !isService && (
            <Field
              label="Initial stock"
              htmlFor="initialStock"
              errors={err("initialStock")}
              hint="Recorded as a restock movement."
            >
              <Input
                id="initialStock"
                name="initialStock"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={0}
                {...invalid("initialStock")}
              />
            </Field>
          )}
          {!product && isService && <input type="hidden" name="initialStock" value="0" />}
          <div className="flex items-start gap-3 sm:col-span-2">
            <input
              id="isService"
              name="isService"
              type="checkbox"
              checked={isService}
              onChange={(e) => setIsService(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border accent-primary"
            />
            <label htmlFor="isService" className="text-sm">
              <span className="font-medium">This is a service</span>
              <span className="block text-xs text-muted-foreground">Services (labour, installation…) aren&apos;t stock-tracked.</span>
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div className="flex justify-end gap-2">
              <LinkButton href={cancelHref} variant="secondary">
                Cancel
              </LinkButton>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : product ? "Save changes" : "Create product"}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
