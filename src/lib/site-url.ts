/**
 * Absolute base URL of the deployed site (used for Open Graph image URLs).
 * Order: SITE_URL, then Vercel's production domain, then localhost.
 * Values without a scheme get https:// and anything unparseable is ignored rather than
 * failing the build over a link-preview setting.
 */
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): URL {
  for (const raw of [env.SITE_URL, env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (url.hostname.includes(".") || url.hostname === "localhost") return url;
    } catch {
      // Ignore malformed values and try the next source.
    }
  }
  return new URL("http://localhost:3000");
}
