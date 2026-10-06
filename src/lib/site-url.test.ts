import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./site-url";

describe("resolveSiteUrl", () => {
  it("uses SITE_URL when valid", () => {
    expect(resolveSiteUrl({ SITE_URL: "https://bizdesk.example.com" }).href).toBe("https://bizdesk.example.com/");
  });

  it("adds https:// when the scheme is missing", () => {
    expect(resolveSiteUrl({ SITE_URL: "bizdesk.vercel.app" }).href).toBe("https://bizdesk.vercel.app/");
  });

  it("falls back to Vercel's production domain when SITE_URL is invalid or a placeholder", () => {
    const env = { SITE_URL: "https://<project-name>.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "bms.vercel.app" };
    expect(resolveSiteUrl(env).href).toBe("https://bms.vercel.app/");
  });

  it("falls back to localhost when nothing usable is set", () => {
    expect(resolveSiteUrl({ SITE_URL: "not a url" }).href).toBe("http://localhost:3000/");
    expect(resolveSiteUrl({}).href).toBe("http://localhost:3000/");
  });
});
