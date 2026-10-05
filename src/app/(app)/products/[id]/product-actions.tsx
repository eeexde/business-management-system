"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormMessage } from "@/components/ui/form-message";
import type { ActionState } from "@/lib/action-state";
import { deleteProduct, setProductArchived } from "../actions";

/**
 * Archive/restore (always available to writers) and hard delete (only offered when the
 * product isn't on any invoice; the server re-checks).
 */
export function ProductActions({
  id,
  archived,
  canArchive,
  canDelete,
}: {
  id: number;
  archived: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const [state, setState] = useState<ActionState>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {canArchive && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => startTransition(async () => setState(await setProductArchived(id, !archived)))}
          >
            {archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
            {archived ? "Restore" : "Archive"}
          </Button>
        )}
        {canDelete && (
          <ConfirmButton size="md" confirmText="Delete product?" action={async () => setState(await deleteProduct(id))}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </ConfirmButton>
        )}
      </div>
      <FormMessage state={state} className="max-w-sm" />
    </div>
  );
}
