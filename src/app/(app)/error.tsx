"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-danger/10 p-4">
        <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>}
      </div>
      <Button variant="secondary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
