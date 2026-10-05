"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ROLES, type Role } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { ROLE_DESCRIPTIONS } from "@/lib/settings";
import { changeUserRole, createUser, removeUser } from "./actions";

export function AddUserForm() {
  const [state, action] = useActionState(createUser, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  const err = (n: string) => state.errors?.[n];

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="new-name" errors={err("name")}>
          <Input id="new-name" name="name" required aria-invalid={err("name") ? true : undefined} />
        </Field>
        <Field label="Email" htmlFor="new-email" errors={err("email")}>
          <Input id="new-email" name="email" type="email" required aria-invalid={err("email") ? true : undefined} />
        </Field>
        <Field label="Role" htmlFor="new-role" errors={err("role")}>
          <Select id="new-role" name="role" defaultValue="staff">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0]!.toUpperCase() + r.slice(1)}: {ROLE_DESCRIPTIONS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Temporary password"
          htmlFor="new-password"
          errors={err("password")}
          hint="Share it privately; they can change it under My account."
        >
          <Input
            id="new-password"
            name="password"
            type="text"
            autoComplete="off"
            minLength={8}
            required
            aria-invalid={err("password") ? true : undefined}
          />
        </Field>
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Adding…">Add team member</SubmitButton>
      </div>
    </form>
  );
}

/** Role dropdown plus remove button for one team member; shows errors inline. */
export function MemberControls({ userId, role, isSelf }: { userId: number; role: Role; isSelf: boolean }) {
  const [result, setResult] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Role"
          className="h-8 w-auto text-xs"
          value={role}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as Role;
            startTransition(async () => setResult(await changeUserRole(userId, next)));
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r[0]!.toUpperCase() + r.slice(1)}
            </option>
          ))}
        </Select>
        {!isSelf && (
          <ConfirmButton action={async () => setResult(await removeUser(userId))} confirmText="Remove?">
            Remove
          </ConfirmButton>
        )}
      </div>
      {result.message && !result.ok && (
        <p role="alert" className="text-xs text-danger">
          {result.message}
        </p>
      )}
    </div>
  );
}
