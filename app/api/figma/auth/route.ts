// app/api/figma/auth/route.ts
// GET /api/figma/auth — initiates OAuth flow (visit in browser once)

import { NextRequest, NextResponse } from "next/server";
import { buildOAuthUrl } from "@/lib/figma";
import crypto from "crypto";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const state = crypto.randomBytes(16).toString("hex");
  const url = buildOAuthUrl(state);

  // In production you'd store state in a cookie/session to verify on callback
  // For an internal tool used by one admin, a redirect is sufficient
  return NextResponse.redirect(url);
}
