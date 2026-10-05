"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { changePassword, updateProfile } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState(updateProfile, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="profile-name" errors={state.errors?.name}>
        <Input
          id="profile-name"
          name="name"
          autoComplete="name"
          defaultValue={name}
          required
          aria-invalid={state.errors?.name ? true : undefined}
        />
      </Field>
      <Field label="Email" htmlFor="profile-email" hint="Ask an admin to change your sign-in email.">
        <Input id="profile-email" value={email} readOnly disabled />
      </Field>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>Save name</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  const err = (n: string) => state.errors?.[n];

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <Field label="Current password" htmlFor="currentPassword" errors={err("currentPassword")}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={err("currentPassword") ? true : undefined}
        />
      </Field>
      <Field label="New password" htmlFor="newPassword" errors={err("newPassword")} hint="At least 8 characters.">
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={err("newPassword") ? true : undefined}
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" errors={err("confirmPassword")}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={err("confirmPassword") ? true : undefined}
        />
      </Field>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Updating…">Change password</SubmitButton>
      </div>
    </form>
  );
}
