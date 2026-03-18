// lib/auth.ts — simple bearer token guard for API routes

import { NextRequest, NextResponse } from "next/server";

export function requireApiSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.API_SECRET;
  if (!secret) return null; // not configured — skip guard in dev

  const auth = req.headers.get("authorization");
  const token = auth?.replace("Bearer ", "").trim();

  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // authorized
}
