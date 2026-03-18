// app/api/asana/route.ts
// GET /api/asana?modified_since=<ISO>&force=true

import { NextRequest, NextResponse } from "next/server";
import { fetchAsanaTasks } from "@/lib/asana";
import { cacheGet, cacheSet, asanaCacheKey, setTimestamp } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";
import type { AsanaTask } from "@/lib/asana";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const force = searchParams.get("force") === "true";
  const modifiedSince = searchParams.get("modified_since") ?? undefined;
  const projectGid = searchParams.get("project") ?? undefined;

  const cacheKey = asanaCacheKey(modifiedSince);

  if (!force) {
    const cached = await cacheGet<AsanaTask[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ data: cached, source: "cache" });
    }
  }

  try {
    const tasks = await fetchAsanaTasks({ modifiedSince, projectGid });
    await cacheSet(cacheKey, tasks);
    await setTimestamp("asana");
    return NextResponse.json({ data: tasks, source: "api" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/asana]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
