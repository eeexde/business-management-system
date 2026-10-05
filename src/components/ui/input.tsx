import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(base, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(base, "min-h-20 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(base, "h-9 pr-8", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

/** Label + control + error messages. Pass the field's errors from ActionState. */
export function Field({
  label,
  htmlFor,
  errors,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !errors?.length && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="text-xs text-danger" id={`${htmlFor}-error`}>
          {e}
        </p>
      ))}
    </div>
  );
}
