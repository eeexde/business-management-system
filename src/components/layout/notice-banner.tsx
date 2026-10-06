"use client";

import { ShieldAlert, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const NOTICES: Record<string, string> = {
  forbidden: "You don't have permission to do that. Ask an admin if you need access.",
};

/** App-wide banner for `?notice=` codes set by server-side permission redirects. */
export function NoticeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const message = NOTICES[searchParams.get("notice") ?? ""];
  if (!message) return null;

  const dismiss = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const next = params.toString();
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{message}</p>
      <button type="button" onClick={dismiss} className="rounded p-0.5 hover:bg-warning/10" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
