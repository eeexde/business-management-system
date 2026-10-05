"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteTask } from "./actions";

export function DeleteTaskButton({ id }: { id: number }) {
  const [error, setError] = useState<string>();
  return (
    <div className="flex items-center gap-2">
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <ConfirmButton
        confirmText="Click to delete"
        action={async () => {
          // Redirects on success; only returns when something went wrong.
          const result = await deleteTask(id);
          if (result && !result.ok) setError(result.message);
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden /> Delete
      </ConfirmButton>
    </div>
  );
}
