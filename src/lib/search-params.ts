/** Helpers for reading `searchParams` (Record<string, string | string[] | undefined>) in pages. */
export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a search param, trimmed; undefined when missing or blank. */
export function getParam(params: SearchParams, key: string): string | undefined {
  const raw = params[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : undefined;
}

/** 1-based page number from `?page=`, defaulting to 1 for missing or invalid values. */
export function getPage(params: SearchParams): number {
  const n = Number.parseInt(getParam(params, "page") ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Build a query string from params, dropping empty values. Returns "" or "?a=b". */
export function toQueryString(params: Record<string, string | number | undefined | null>) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") usp.set(key, String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
