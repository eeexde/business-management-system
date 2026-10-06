import { cn } from "@/lib/utils";

/**
 * BizDesk mark: a ledger page, three ruled lines with the last one short, like a running total.
 * Inherits colour from `currentColor` for the tile and uses the primary green for the rules.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("h-8 w-8", className)}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="8" y="9" width="16" height="2.5" rx="1.25" fill="var(--primary)" />
      <rect x="8" y="14.75" width="16" height="2.5" rx="1.25" fill="var(--primary)" opacity="0.7" />
      <rect x="8" y="20.5" width="9" height="2.5" rx="1.25" fill="var(--amber)" />
    </svg>
  );
}
