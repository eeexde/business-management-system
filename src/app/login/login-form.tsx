"use client";

import { useActionState, useRef } from "react";
import { Field, Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { login } from "./actions";

const DEMO_PASSWORD = "demo1234";

const DEMO_ACCOUNTS = [
  { email: "demo@bizdesk.app", name: "Alex Morgan", role: "Admin", can: "Everything, including team and settings" },
  { email: "priya@bizdesk.app", name: "Priya Shah", role: "Manager", can: "All customers, stock, invoices and reports" },
  { email: "sam@bizdesk.app", name: "Sam Lee", role: "Staff", can: "Customers, expenses and tasks" },
] as const;

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  /** Fill the form with a demo account and submit it in one click. */
  function signInAs(email: string) {
    if (!emailRef.current || !passwordRef.current) return;
    emailRef.current.value = email;
    passwordRef.current.value = DEMO_PASSWORD;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="demo-accounts">
        <h2 id="demo-accounts" className="text-sm font-semibold">
          Try a demo account
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Each role sees different tools.</p>
        <ul className="mt-3 divide-y overflow-hidden rounded-lg border bg-card">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                disabled={pending}
                onClick={() => signInAs(a.email)}
                aria-label={`Sign in as ${a.role.toLowerCase()}, ${a.name}`}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-60",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.can}</span>
                </span>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {a.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or sign in with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form ref={formRef} action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="email">
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <FormMessage state={state} />
        <SubmitButton pendingText="Signing in…" className="w-full">
          Sign in
        </SubmitButton>
      </form>
    </div>
  );
}
