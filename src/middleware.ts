import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that do not require authentication
const PUBLIC_PATHS = ["/", "/login", "/register", "/shared", "/api/auth", "/api/health", "/auth/callback"];

// Static-asset file extensions served from /public. We allow these through
// WITHOUT auth using a precise extension allowlist — NOT a blanket
// `pathname.includes(".")`, which would let any dotted path (e.g.
// "/api/users/foo.bar" or "/secret.page") bypass authentication entirely.
const STATIC_ASSET_EXTENSIONS = [
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".css",
  ".js",
  ".map",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".txt",
  ".webmanifest",
  ".json",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function isStaticAsset(pathname: string): boolean {
  const lastSegment = pathname.substring(pathname.lastIndexOf("/") + 1);
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex <= 0) {
    return false;
  }
  const ext = lastSegment.substring(dotIndex).toLowerCase();
  return STATIC_ASSET_EXTENSIONS.includes(ext);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and framework/static assets. Static assets are matched
  // by a precise extension allowlist (see isStaticAsset) rather than treating
  // the mere presence of a "." in the path as a bypass.
  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    isStaticAsset(pathname)
  ) {
    return NextResponse.next();
  }

  // For API routes, defer real credential validation to the route wrappers
  // (withAgentAuth / withTenant / withAdmin), which validate the API key or
  // session. We forward API requests here without redirecting to /login so the
  // wrappers can return a proper JSON 401 instead of an HTML redirect.
  //
  // IMPORTANT: header *presence* is NOT treated as a pass for non-/api paths —
  // an Authorization header on a page route must still go through the session
  // check below. (Previously any request with an Authorization header was
  // forwarded, letting header presence bypass page auth.)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Refresh Supabase session and check authentication
  const { user, response } = await updateSession(request);

  if (!user) {
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
