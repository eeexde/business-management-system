"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { computeInvoiceTotals, lineTotal } from "@/lib/invoices";
import type { FormCustomer, FormProduct } from "@/lib/queries/invoices";
import { addDays, centsToInput, cn, formatMoney, parseMoney } from "@/lib/utils";

export type EditorLine = { productId: string; description: string; quantity: string; unitPrice: string };

export type EditorDefaults = {
  customerId: string;
  issueDate: string;
  dueDate: string;
  taxRate: string;
  discount: string;
  notes: string;
  items: EditorLine[];
};

type Line = EditorLine & { key: number };

const BLANK_LINE: EditorLine = { productId: "", description: "", quantity: "1", unitPrice: "" };

/** Cents from a money input, 0 when blank or invalid (preview only; the server re-validates). */
function previewCents(value: string) {
  const cents = parseMoney(value);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

function previewQuantity(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function InvoiceForm({
  action,
  customers,
  products,
  defaults,
  paymentTerms,
  currency,
  submitLabel,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  customers: FormCustomer[];
  products: FormProduct[];
  defaults: EditorDefaults;
  paymentTerms: number;
  currency: string;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [customerId, setCustomerId] = useState(defaults.customerId);
  const [issueDate, setIssueDate] = useState(defaults.issueDate);
  const [dueDate, setDueDate] = useState(defaults.dueDate);
  const [dueTouched, setDueTouched] = useState(false);
  const [taxRate, setTaxRate] = useState(defaults.taxRate);
  const [discount, setDiscount] = useState(defaults.discount);
  const [notes, setNotes] = useState(defaults.notes);
  const [lines, setLines] = useState<Line[]>(() =>
    (defaults.items.length ? defaults.items : [BLANK_LINE]).map((l, i) => ({ ...l, key: i })),
  );
  const nextKey = useRef(defaults.items.length + 1);

  const productById = new Map(products.map((p) => [String(p.id), p]));
  const money = (cents: number) => formatMoney(cents, currency);
  const totals = computeInvoiceTotals(
    lines.map((l) => ({ quantity: previewQuantity(l.quantity), unitPriceCents: previewCents(l.unitPrice) })),
    Math.max(0, Number(taxRate) || 0),
    previewCents(discount),
  );
  const errors = state.errors ?? {};

  function updateLine(key: number, patch: Partial<EditorLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function chooseProduct(key: number, productId: string) {
    const product = productById.get(productId);
    updateLine(
      key,
      product
        ? { productId, description: product.name, unitPrice: centsToInput(product.priceCents) }
        : { productId: "" },
    );
  }

  function addLine() {
    const key = nextKey.current++;
    setLines((prev) => [...prev, { ...BLANK_LINE, key }]);
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  const itemsJson = JSON.stringify(
    lines.map(({ productId, description, quantity, unitPrice }) => ({ productId, description, quantity, unitPrice })),
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="items" value={itemsJson} />

      <Card>
        <CardHeader title="Details" description="Who you're billing and when payment is due." />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Customer" htmlFor="customerId" errors={errors.customerId} className="sm:col-span-2">
            <Select
              id="customerId"
              name="customerId"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              aria-invalid={Boolean(errors.customerId)}
              required
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ? `${c.name} (${c.company})` : c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Issue date" htmlFor="issueDate" errors={errors.issueDate}>
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value);
                if (!dueTouched && e.target.value) setDueDate(addDays(e.target.value, paymentTerms));
              }}
              aria-invalid={Boolean(errors.issueDate)}
              required
            />
          </Field>
          <Field
            label="Due date"
            htmlFor="dueDate"
            errors={errors.dueDate}
            hint={dueTouched ? undefined : `Net ${paymentTerms} days`}
          >
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              value={dueDate}
              min={issueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setDueTouched(true);
              }}
              aria-invalid={Boolean(errors.dueDate)}
              required
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Line items"
          description="Pick a product to fill in its name and price, or type a custom item."
          action={
            <Button variant="secondary" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" aria-hidden /> Add line
            </Button>
          }
        />
        <CardBody className="flex flex-col gap-3">
          <div
            className="hidden gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_5rem_7.5rem_7rem_2.25rem]"
            aria-hidden
          >
            <span>Product</span>
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {lines.map((line, index) => {
            const product = productById.get(line.productId);
            const qty = previewQuantity(line.quantity);
            const lowStock = product && !product.isService && qty > product.stock;
            const n = index + 1;
            return (
              <div
                key={line.key}
                className="grid grid-cols-2 gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_5rem_7.5rem_7rem_2.25rem] md:items-start md:border-0 md:p-0"
              >
                <Select
                  aria-label={`Line ${n} product`}
                  className="col-span-2 md:col-span-1"
                  value={line.productId}
                  onChange={(e) => chooseProduct(line.key, e.target.value)}
                >
                  <option value="">Custom item</option>
                  {products
                    .filter((p) => !p.archived || String(p.id) === line.productId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.isService ? "" : ` · ${p.stock} in stock`}
                      </option>
                    ))}
                </Select>
                <div className="col-span-2 md:col-span-1">
                  <Input
                    aria-label={`Line ${n} description`}
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    maxLength={500}
                    required
                  />
                  {lowStock && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Only {product.stock} in stock. Sending will take stock negative.
                    </p>
                  )}
                </div>
                <Input
                  aria-label={`Line ${n} quantity`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  required
                />
                <Input
                  aria-label={`Line ${n} unit price`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                  required
                />
                <p className="flex h-9 items-center text-sm font-medium tabular-nums md:justify-end">
                  {money(lineTotal({ quantity: qty, unitPriceCents: previewCents(line.unitPrice) }))}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="justify-self-end text-muted-foreground hover:text-danger"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length === 1}
                  aria-label={`Remove line ${n}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            );
          })}

          {errors.items && (
            <ul className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {errors.items.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Notes & adjustments" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax rate (%)" htmlFor="taxRate" errors={errors.taxRate}>
              <Input
                id="taxRate"
                name="taxRate"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                aria-invalid={Boolean(errors.taxRate)}
              />
            </Field>
            <Field label="Discount" htmlFor="discount" errors={errors.discount} hint="Fixed amount, applied before tax">
              <Input
                id="discount"
                name="discount"
                inputMode="decimal"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                aria-invalid={Boolean(errors.discount)}
              />
            </Field>
            <Field label="Notes" htmlFor="notes" errors={errors.notes} className="sm:col-span-2" hint="Shown on the invoice, e.g. payment instructions.">
              <Textarea
                id="notes"
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </Field>
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Summary" />
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{money(totals.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className={cn("tabular-nums", totals.discountCents > 0 && "text-success")}>
                  {totals.discountCents > 0 ? `−${money(totals.discountCents)}` : money(0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax ({Number(taxRate) || 0}%)</dt>
                <dd className="tabular-nums">{money(totals.taxCents)}</dd>
              </div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(totals.totalCents)}</dd>
              </div>
            </dl>
            <FormMessage state={state} className="mt-4" />
            <div className="mt-4 flex flex-col gap-2">
              <SubmitButton className="w-full">{submitLabel}</SubmitButton>
              <LinkButton href={cancelHref} variant="ghost" className="w-full">
                Cancel
              </LinkButton>
            </div>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
