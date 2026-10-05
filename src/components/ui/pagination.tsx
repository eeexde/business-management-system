import { ChevronLeft, ChevronRight } from "lucide-react";
import { toQueryString } from "@/lib/search-params";
import { buttonClasses, LinkButton } from "./button";

/**
 * Simple prev/next pagination driven by `?page=`. Server component.
 * `params` are the other query params to preserve (e.g. { q, category }).
 */
export function Pagination({
  page,
  pageSize,
  total,
  pathname,
  params = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  pathname: string;
  params?: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const href = (p: number) => `${pathname}${toQueryString({ ...params, page: p > 1 ? p : undefined })}`;
  const disabled = buttonClasses("secondary", "sm", "pointer-events-none opacity-50");

  return (
    <nav className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm" aria-label="Pagination">
      <p className="text-muted-foreground">
        {total > 0 ? `${from}–${to} of ${total}` : "No results"}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <LinkButton href={href(page - 1)} variant="secondary" size="sm" rel="prev">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
          </LinkButton>
        ) : (
          <span className={disabled} aria-disabled="true">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
          </span>
        )}
        {page < pageCount ? (
          <LinkButton href={href(page + 1)} variant="secondary" size="sm" rel="next">
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </LinkButton>
        ) : (
          <span className={disabled} aria-disabled="true">
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
