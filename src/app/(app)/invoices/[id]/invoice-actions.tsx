"use client";

import { Ban, Copy, Pencil, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormMessage } from "@/components/ui/form-message";
import type { ActionState } from "@/lib/action-state";
import { deleteInvoice, duplicateInvoice, markInvoiceSent, voidInvoice } from "../actions";
import { PrintButton } from "./print-button";

/** Status-dependent action bar for the invoice detail page (hidden when printing). */
export function InvoiceActions({
  id,
  canEdit,
  canSend,
  canVoid,
  canDuplicate,
  canDelete,
  voidBlockedReason,
}: {
  id: number;
  canEdit: boolean;
  canSend: boolean;
  canVoid: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  /** Shown instead of the Void button when voiding is not allowed for a reason worth explaining. */
  voidBlockedReason?: string;
}) {
  const [result, setResult] = useState<ActionState>();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionState>) {
    startTransition(async () => {
      setResult(await action());
    });
  }

  return (
    <div className="no-print flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canSend && (
          <Button onClick={() => run(() => markInvoiceSent(id))} disabled={pending}>
            <Send className="h-4 w-4" aria-hidden /> {pending ? "Working…" : "Mark as sent"}
          </Button>
        )}
        {canEdit && (
          <LinkButton href={`/invoices/${id}/edit`} variant="secondary">
            <Pencil className="h-4 w-4" aria-hidden /> Edit
          </LinkButton>
        )}
        <PrintButton />
        {canDuplicate && (
          <Button variant="secondary" onClick={() => run(() => duplicateInvoice(id))} disabled={pending}>
            <Copy className="h-4 w-4" aria-hidden /> Duplicate
          </Button>
        )}
        {canVoid && (
          <ConfirmButton size="md" action={async () => setResult(await voidInvoice(id))} confirmText="Confirm void">
            <Ban className="h-4 w-4" aria-hidden /> Void
          </ConfirmButton>
        )}
        {canDelete && (
          <ConfirmButton size="md" action={async () => setResult(await deleteInvoice(id))} confirmText="Confirm delete">
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </ConfirmButton>
        )}
      </div>
      {!canVoid && voidBlockedReason && <p className="text-xs text-muted-foreground">{voidBlockedReason}</p>}
      {result?.message && (
        <FormMessage
          state={result}
          className={result.ok && result.message.includes("Warning") ? "bg-warning/10 text-warning" : undefined}
        />
      )}
    </div>
  );
}
