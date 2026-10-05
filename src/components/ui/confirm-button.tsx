"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonSize } from "./button";

/**
 * Two-step destructive button (no browser confirm dialog). First click arms it,
 * second click runs the action. Disarms after 4 seconds.
 */
export function ConfirmButton({
  action,
  children,
  confirmText = "Click to confirm",
  size = "sm",
  className,
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
  confirmText?: string;
  size?: ButtonSize;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={armed ? "danger" : "secondary"}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
          return;
        }
        startTransition(async () => {
          await action();
          setArmed(false);
        });
      }}
    >
      {pending ? "Working…" : armed ? confirmText : children}
    </Button>
  );
}
