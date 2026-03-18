// app/api/snapshots/route.ts
// GET /api/snapshots — returns last 12 weekly snapshots from KV

import { NextRequest, NextResponse } from "next/server";
import { cacheGetMany, getRecentMondays, snapshotCacheKey } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";
import type { WeeklySnapshot } from "@/lib/metrics";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  try {
    const mondays = getRecentMondays(12);
    const keys = mondays.map(snapshotCacheKey);
    const results = await cacheGetMany<WeeklySnapshot>(keys);

    // Filter out nulls, keep in chronological order (oldest first)
    const snapshots = results
      .filter((s): s is WeeklySnapshot => s !== null)
      .reverse();

    return NextResponse.json({ data: snapshots });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/snapshots]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
