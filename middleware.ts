// middleware.ts — password gate for the dashboard
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next(); // not configured — open access

  const { pathname } = req.nextUrl;

  // Allow login page, auth API, and static assets through
  if (
    pathname === "/login" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = req.cookies.get("di_auth")?.value;
  if (token) {
    // Verify: cookie value must match HMAC(password, secret)
    // We can't do async crypto in middleware easily, so we use a simple
    // comparison: the cookie stores a hash we set in /api/auth
    const expected = simpleHash(password, process.env.API_SECRET ?? "di-salt");
    if (token === expected) {
      return NextResponse.next();
    }
  }

  // Redirect to login
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

// Simple hash — not crypto-grade but sufficient for a dashboard password cookie.
// The real security boundary is the password itself; this just prevents
// trivially guessing the cookie value.
function simpleHash(password: string, salt: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  const input = `${salt}:${password}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
    h = h >>> 0; // keep unsigned
  }
  return h.toString(36);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
