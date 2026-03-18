// app/api/figma/route.ts
// GET /api/figma?start=<unix>&end=<unix>&force=true

import { NextRequest, NextResponse } from "next/server";
import { fetchTeamActivity } from "@/lib/figma";
import { cacheGet, cacheSet, figmaCacheKey, setTimestamp } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";
import type { FigmaDesignerActivity } from "@/lib/figma";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const force = searchParams.get("force") === "true";

  // Default to last 30 days if no range specified
  const now = Math.floor(Date.now() / 1000);
  const startTime = parseInt(searchParams.get("start") ?? String(now - 30 * 24 * 60 * 60));
  const endTime   = parseInt(searchParams.get("end")   ?? String(now));

  if (isNaN(startTime) || isNaN(endTime)) {
    return NextResponse.json({ error: "Invalid start/end timestamps" }, { status: 400 });
  }

  const cacheKey = figmaCacheKey(startTime, endTime);

  // Return cached data if available and not forcing refresh
  if (!force) {
    const cached = await cacheGet<FigmaDesignerActivity[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ data: cached, source: "cache" });
    }
  }

  try {
    const activity = await fetchTeamActivity(startTime, endTime);
    await cacheSet(cacheKey, activity);
    await setTimestamp("figma");
    return NextResponse.json({ data: activity, source: "api" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/figma]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
