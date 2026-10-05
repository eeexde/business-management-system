const FALLBACK = "/dashboard";
const BASE = "http://bizdesk.invalid";

/**
 * Only allow same-origin relative redirects. Rejects "//evil.com", "/\evil.com",
 * control characters, and paths that normalize into a protocol-relative URL
 * (e.g. "/.//evil.com" whose pathname becomes "//evil.com").
 */
export function safeNext(next: string | undefined | null): string {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f]/.test(next)) return FALLBACK;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return FALLBACK;
    const result = `${url.pathname}${url.search}${url.hash}`;
    // Validate the value we actually return, and re-resolve it to be certain.
    if (!result.startsWith("/") || result.startsWith("//")) return FALLBACK;
    if (new URL(result, BASE).origin !== BASE) return FALLBACK;
    return result;
  } catch {
    return FALLBACK;
  }
}
