"use client";

import { startTransition, useActionState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Textarea } from "@/components/ui/input";
import type { Customer } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  customer?: Customer;
  cancelHref: string;
};

/** Shared create/edit form. Pass a bound update action when editing. */
export function CustomerForm({ action, customer, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const err = (name: string) => state.errors?.[name];

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
          <Field label="Name" htmlFor="name" errors={err("name")}>
            <Input
              id="name"
              name="name"
              defaultValue={customer?.name}
              required
              autoComplete="name"
              aria-invalid={Boolean(err("name"))}
              aria-describedby={err("name") ? "name-error" : undefined}
            />
          </Field>
          <Field label="Company" htmlFor="company" errors={err("company")}>
            <Input id="company" name="company" defaultValue={customer?.company ?? ""} autoComplete="organization" />
          </Field>
          <Field label="Email" htmlFor="email" errors={err("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={customer?.email ?? ""}
              autoComplete="email"
              aria-invalid={Boolean(err("email"))}
              aria-describedby={err("email") ? "email-error" : undefined}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" errors={err("phone")}>
            <Input id="phone" name="phone" type="tel" defaultValue={customer?.phone ?? ""} autoComplete="tel" />
          </Field>
          <Field label="Address" htmlFor="address" errors={err("address")} className="sm:col-span-2">
            <Textarea id="address" name="address" rows={3} defaultValue={customer?.address ?? ""} autoComplete="street-address" />
          </Field>
          <Field
            label="Notes"
            htmlFor="notes"
            errors={err("notes")}
            hint="Internal only — never shown on invoices."
            className="sm:col-span-2"
          >
            <Textarea id="notes" name="notes" rows={4} defaultValue={customer?.notes ?? ""} />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div className="flex justify-end gap-2">
              <LinkButton href={cancelHref} variant="secondary">
                Cancel
              </LinkButton>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : customer ? "Save changes" : "Create customer"}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
