"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { adjustStock } from "../actions";

/** Manual stock change. The form resets after submit, which suits repeated adjustments. */
export function StockAdjustForm({ productId }: { productId: number }) {
  const [state, formAction] = useActionState(adjustStock.bind(null, productId), initialActionState);
  const err = (name: string) => state.errors?.[name];

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quantity" htmlFor="quantity" errors={err("quantity")} hint="Use a negative number to remove stock.">
          <Input
            id="quantity"
            name="quantity"
            type="number"
            step={1}
            inputMode="numeric"
            placeholder="e.g. 24 or -2"
            required
            aria-invalid={Boolean(err("quantity"))}
            aria-describedby={err("quantity") ? "quantity-error" : undefined}
          />
        </Field>
        <Field label="Reason" htmlFor="reason" errors={err("reason")}>
          <Select id="reason" name="reason" defaultValue="restock">
            <option value="restock">Restock</option>
            <option value="adjustment">Adjustment (count, damage, loss)</option>
            <option value="return">Customer return</option>
          </Select>
        </Field>
      </div>
      <Field label="Note" htmlFor="note" errors={err("note")}>
        <Input id="note" name="note" placeholder="Optional, e.g. PO #4471" />
      </Field>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>Apply adjustment</SubmitButton>
      </div>
    </form>
  );
}
