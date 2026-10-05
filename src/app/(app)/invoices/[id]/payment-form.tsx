"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-state";

type Option = { value: string; label: string };

/** Controlled fields, remounted (via key) whenever the balance changes so the amount resets. */
function PaymentFields({
  defaultAmount,
  defaultDate,
  minDate,
  methods,
  errors,
}: {
  defaultAmount: string;
  defaultDate: string;
  minDate: string;
  methods: Option[];
  errors: ActionState["errors"];
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const [date, setDate] = useState(defaultDate);
  const [method, setMethod] = useState("bank_transfer");
  const [note, setNote] = useState("");
  return (
    <>
      <Field label="Amount" htmlFor="amount" errors={errors?.amount}>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={Boolean(errors?.amount)}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="date" errors={errors?.date}>
          <Input
            id="date"
            name="date"
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Method" htmlFor="method" errors={errors?.method}>
          <Select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {methods.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Note" htmlFor="note" errors={errors?.note}>
        <Input
          id="note"
          name="note"
          placeholder="Optional, e.g. check #1042"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </Field>
    </>
  );
}

export function PaymentForm({
  action,
  balance,
  balanceInput,
  defaultDate,
  minDate,
  methods,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  balance: number;
  balanceInput: string;
  defaultDate: string;
  minDate: string;
  methods: Option[];
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <PaymentFields
        key={balance}
        defaultAmount={balanceInput}
        defaultDate={defaultDate}
        minDate={minDate}
        methods={methods}
        errors={state.errors}
      />
      <FormMessage state={state.errors?.amount ? { ...state, message: undefined } : state} />
      <SubmitButton pendingText="Recording…" className="w-full">
        Record payment
      </SubmitButton>
    </form>
  );
}
