// app/api/cron/route.ts
// GET /api/cron — Vercel cron endpoint that chains Figma sync chunks.
// Each invocation advances the sync as far as possible within the 60s limit.
// Vercel cron calls this periodically (configured in vercel.json).

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret if configured (Vercel sets this automatically)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const origin = req.nextUrl.origin;
  const secret = process.env.API_SECRET;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const startTime = Date.now();
  const maxTime = 55_000; // 55s safety margin before 60s timeout
  const results: Array<{ call: number; status: string; detail?: string }> = [];
  let callCount = 0;

  while (Date.now() - startTime < maxTime) {
    callCount++;
    try {
      const res = await fetch(`${origin}/api/figma/sync`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      results.push({ call: callCount, status: data.status ?? "unknown", detail: data.nextStep ?? data.error });

      if (data.status === "complete" || data.error) break;
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
