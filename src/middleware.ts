import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that do not require authentication
const PUBLIC_PATHS = ["/", "/login", "/register", "/shared", "/api/auth", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow API routes with Authorization header (API key auth)
  if (
    pathname.startsWith("/api/") &&
    request.headers.get("authorization")
  ) {
    return NextResponse.next();
  }

  // Refresh Supabase session and check authentication
  const { user, response } = await updateSession(request);

  if (!user) {
    // API routes must reach their own auth wrapper and return a JSON 401 —
    // never a 307 HTML redirect to /login (audit-01 Codex MUST-FIX 1).
    // Page routes redirect to /login as before.
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
