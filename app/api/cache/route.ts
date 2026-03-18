// app/api/cache/route.ts
// GET /api/cache — returns last fetch timestamps + cache status
// DELETE /api/cache — busts both caches (forces next load to re-fetch)

import { NextRequest, NextResponse } from "next/server";
import { getTimestamps, cacheDel } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  const timestamps = await getTimestamps();
  return NextResponse.json({
    figma: timestamps.figma ?? null,
    asana: timestamps.asana ?? null,
    now: new Date().toISOString(),
  });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  await cacheDel("cache:timestamps");
  return NextResponse.json({ ok: true, message: "Cache cleared — next request will re-fetch from APIs" });
}
