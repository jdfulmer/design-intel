// app/api/figma/sync/route.ts
// POST /api/figma/sync — slow background crawl, stores result in KV
// Call manually or via cron. Respects Figma rate limits with 3.2s delays.

import { NextRequest, NextResponse } from "next/server";
import { fetchTeamActivity } from "@/lib/figma";
import { cacheSet, setTimestamp } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min (Vercel Pro); free tier caps at 60s

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  const now = Math.floor(Date.now() / 1000);
  const startTime = now - 30 * 24 * 60 * 60; // last 30 days

  try {
    const activity = await fetchTeamActivity(startTime, now);

    await cacheSet("figma:latest-sync", {
      data: activity,
      syncedAt: new Date().toISOString(),
      startTime,
      endTime: now,
    });
    await setTimestamp("figma");

    return NextResponse.json({
      ok: true,
      designers: activity.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/figma/sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
