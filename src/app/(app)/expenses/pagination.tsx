import { ChevronLeft, ChevronRight } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

/** Prev/next links that keep the current search params and only change ?page=. */
export function Pagination({
  page,
  pageSize,
  total,
  pathname,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  pathname: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (p > 1) search.set("page", String(p));
    const qs = search.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm" aria-label="Pagination">
      <p className="text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <LinkButton href={href(page - 1)} variant="secondary" size="sm" rel="prev">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
          </LinkButton>
        ) : null}
        {page < pages ? (
          <LinkButton href={href(page + 1)} variant="secondary" size="sm" rel="next">
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </LinkButton>
        ) : null}
      </div>
    </nav>
  );
}
