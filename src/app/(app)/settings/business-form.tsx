"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Settings } from "@/db/schema";
import { initialActionState } from "@/lib/action-state";
import { CURRENCIES } from "@/lib/settings";
import { updateSettings } from "./actions";

/** Business profile. Rendered read-only (disabled fieldset, no submit) for non-admins. */
export function BusinessForm({ settings, readOnly }: { settings: Settings; readOnly: boolean }) {
  const [state, action] = useActionState(updateSettings, initialActionState);
  const err = (name: string) => state.errors?.[name];
  const invalid = (name: string) => (err(name)?.length ? true : undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" htmlFor="businessName" errors={err("businessName")} className="sm:col-span-2">
          <Input
            id="businessName"
            name="businessName"
            defaultValue={settings.businessName}
            required
            aria-invalid={invalid("businessName")}
          />
        </Field>
        <Field label="Email" htmlFor="email" errors={err("email")}>
          <Input id="email" name="email" type="email" defaultValue={settings.email ?? ""} aria-invalid={invalid("email")} />
        </Field>
        <Field label="Phone" htmlFor="phone" errors={err("phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={settings.phone ?? ""} aria-invalid={invalid("phone")} />
        </Field>
        <Field label="Address" htmlFor="address" errors={err("address")} className="sm:col-span-2">
          <Textarea id="address" name="address" rows={3} defaultValue={settings.address ?? ""} aria-invalid={invalid("address")} />
        </Field>
        <Field label="Currency" htmlFor="currency" errors={err("currency")}>
          <Select id="currency" name="currency" defaultValue={settings.currency} aria-invalid={invalid("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default tax rate (%)" htmlFor="defaultTaxRate" errors={err("defaultTaxRate")}>
          <Input
            id="defaultTaxRate"
            name="defaultTaxRate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            inputMode="decimal"
            defaultValue={settings.defaultTaxRate}
            aria-invalid={invalid("defaultTaxRate")}
          />
        </Field>
        <Field
          label="Invoice number prefix"
          htmlFor="invoicePrefix"
          errors={err("invoicePrefix")}
          hint="New invoices are numbered like INV-0042."
        >
          <Input
            id="invoicePrefix"
            name="invoicePrefix"
            defaultValue={settings.invoicePrefix}
            required
            aria-invalid={invalid("invoicePrefix")}
          />
        </Field>
        <Field label="Payment terms (days)" htmlFor="paymentTerms" errors={err("paymentTerms")} hint="Default due date for new invoices.">
          <Input
            id="paymentTerms"
            name="paymentTerms"
            type="number"
            min="0"
            max="365"
            step="1"
            inputMode="numeric"
            defaultValue={settings.paymentTerms}
            aria-invalid={invalid("paymentTerms")}
          />
        </Field>
      </fieldset>
      <FormMessage state={state} />
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Only admins can change business settings.</p>
      ) : (
        <div className="flex justify-end">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      )}
    </form>
  );
}
