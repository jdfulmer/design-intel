// app/api/cron/route.ts
// GET /api/cron — Vercel cron endpoint that chains Figma sync chunks.
// Each invocation advances the sync as far as possible within the 60s limit.
// Vercel cron calls this periodically (configured in vercel.json).
// Also accepts API_SECRET auth so it can be triggered manually.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!auth) return false;
  // Accept either CRON_SECRET (Vercel cron) or API_SECRET (manual/proxy)
  if (process.env.CRON_SECRET && auth === process.env.CRON_SECRET) return true;
  if (process.env.API_SECRET && auth === process.env.API_SECRET) return true;
  return false;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Skip auth if neither secret is configured (dev mode)
  if ((process.env.CRON_SECRET || process.env.API_SECRET) && !isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const secret = process.env.API_SECRET;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const startTime = Date.now();
  const maxTime = 55_000; // 55s safety margin before 60s timeout
  const maxCalls = 15; // hard cap on iterations
  const results: Array<{ call: number; status: string; detail?: string }> = [];
  let callCount = 0;
  let lastStatus = "";

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

      // If status hasn't changed, sync isn't progressing (e.g. no KV) — stop
      if (status === lastStatus) break;
      lastStatus = status;

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
