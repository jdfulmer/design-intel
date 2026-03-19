// app/api/auth/route.ts — verify dashboard password and set auth cookie
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function generateToken(password: string, secret: string): string {
  return createHmac("sha256", secret).update(password).digest("hex");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Password not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const password = body?.password;

  if (!password || password !== expected) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = generateToken(expected, process.env.API_SECRET ?? "di-salt");

  const res = NextResponse.json({ ok: true });
  res.cookies.set("di_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
