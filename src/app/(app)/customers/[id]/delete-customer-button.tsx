"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormMessage } from "@/components/ui/form-message";
import type { ActionState } from "@/lib/action-state";
import { deleteCustomer } from "../actions";

/** Two-click delete. Redirects on success; shows the server's message when blocked. */
export function DeleteCustomerButton({ id }: { id: number }) {
  const [state, setState] = useState<ActionState>();
  return (
    <div className="flex flex-col items-end gap-2">
      <ConfirmButton size="md" confirmText="Delete customer?" action={async () => setState(await deleteCustomer(id))}>
        <Trash2 className="h-4 w-4" aria-hidden /> Delete
      </ConfirmButton>
      <FormMessage state={state} className="max-w-sm" />
    </div>
  );
}
