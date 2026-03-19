// app/api/auth/route.ts — verify dashboard password and set auth cookie
import { NextRequest, NextResponse } from "next/server";

async function generateToken(password: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(password));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
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

  const token = await generateToken(expected, process.env.API_SECRET ?? "di-salt");

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
