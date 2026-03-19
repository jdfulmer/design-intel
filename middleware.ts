// middleware.ts — password gate for the dashboard
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

function generateToken(password: string, secret: string): string {
  return createHmac("sha256", secret).update(password).digest("hex");
}

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
    const expected = generateToken(password, process.env.API_SECRET ?? "di-salt");
    // Timing-safe comparison to prevent timing attacks
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    if (tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.next();
    }
  }

  // Redirect to login
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
