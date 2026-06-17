// app/api/cron/route.ts
// GET /api/cron — Vercel cron endpoint that chains Figma sync chunks.
// Each invocation advances the sync as far as possible within the 60s limit.
// Vercel cron calls this periodically (configured in vercel.json).
// Also accepts API_SECRET auth so it can be triggered manually.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // Pro plan: orchestrate the whole sync in one cron tick

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "").trim();

  // Primary, secure path: Vercel cron auto-injects `Authorization: Bearer ${CRON_SECRET}`
  // — but ONLY when a CRON_SECRET env var exists on the project. Set it for full auth.
  if (process.env.CRON_SECRET && auth === process.env.CRON_SECRET) return true;
  // Manual / proxy triggers authenticate with API_SECRET.
  if (process.env.API_SECRET && auth === process.env.API_SECRET) return true;
  // Self-healing fallback: Vercel tags genuine cron invocations with x-vercel-cron-schedule.
  // Inbound x-vercel-* headers are stripped by Vercel, so external callers can't forge it,
  // and this endpoint only kicks off an idempotent internal sync. Keeps the pipeline alive
  // even before CRON_SECRET is configured.
  if (req.headers.get("x-vercel-cron-schedule")) return true;
  return false;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Skip auth if neither secret is configured (dev mode)
  if ((process.env.CRON_SECRET || process.env.API_SECRET) && !isAuthorized(req)) {
    console.warn(
      "[cron] Unauthorized request — no matching CRON_SECRET/API_SECRET and no x-vercel-cron-schedule header. " +
        "If this is a Vercel cron, add a CRON_SECRET env var so the request authenticates."
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const secret = process.env.API_SECRET;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const startTime = Date.now();
  const maxTime = 285_000; // 285s safety margin before 300s timeout
  const maxCalls = 20; // hard cap on iterations
  const results: Array<{ call: number; status: string; detail?: string }> = [];
  let callCount = 0;

  while (callCount < maxCalls && Date.now() - startTime < maxTime) {
    callCount++;
    try {
      const res = await fetch(`${origin}/api/figma/sync`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      const status = data.status ?? "unknown";
      results.push({ call: callCount, status, detail: data.nextStep ?? data.error });

      // 409 = lock held by another sync — wait and retry
      if (res.status === 409) {
        await new Promise(r => setTimeout(r, 10_000));
        continue;
      }

      if (status === "complete" || data.error) break;
    } catch (err) {
      results.push({ call: callCount, status: "error", detail: err instanceof Error ? err.message : "fetch failed" });
      break;
    }
  }

  return NextResponse.json({
    syncCalls: callCount,
    elapsed: `${Math.round((Date.now() - startTime) / 1000)}s`,
    results,
  });
}
