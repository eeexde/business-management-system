import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

/**
 * Optimistic auth check: redirect signed-out visitors based on the cookie only. Real checks
 * happen in requireUser(). Signed-in visitors on /login are redirected by the login page itself,
 * after verifying the session against the DB (a revoked cookie must not bounce back here).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !session) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
