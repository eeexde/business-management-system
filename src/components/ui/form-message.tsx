import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

/** Shows the top-level message from an ActionState (success or error). */
export function FormMessage({ state, className }: { state: ActionState | undefined; className?: string }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        state.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
        className,
      )}
    >
      {state.message}
    </p>
  );
}
