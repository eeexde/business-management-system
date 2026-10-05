/** Shape returned by every form Server Action, consumed by useActionState. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = {};

/** Convert a Zod error into ActionState field errors. */
export function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): ActionState {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (errors[key] ??= []).push(issue.message);
  }
  return { ok: false, errors, message: "Please fix the highlighted fields." };
}
