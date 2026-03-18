// app/api/asana/route.ts
// GET /api/asana?modified_since=<ISO>&force=true
// GET /api/asana?include_completed=30d — completed tasks from last 30 days

import { NextRequest, NextResponse } from "next/server";
import { fetchAsanaTasks } from "@/lib/asana";
import { cacheGet, cacheSet, asanaCacheKey, completedCacheKey, setTimestamp } from "@/lib/cache";
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
  const includeCompleted = searchParams.get("include_completed");

  // ── Completed tasks mode ──
  if (includeCompleted) {
    const days = includeCompleted === "30d" ? 30 : parseInt(includeCompleted, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const cacheKey = completedCacheKey(sinceStr);

    if (!force) {
      const cached = await cacheGet<AsanaTask[]>(cacheKey);
      if (cached) {
        return NextResponse.json({ data: cached, source: "cache" });
      }
    }

    try {
      const tasks = await fetchAsanaTasks({
        completedSince: since.toISOString(),
        projectGid,
      });
      // Filter to only completed tasks
      const completed = tasks.filter((t) => t.completed);
      await cacheSet(cacheKey, completed);
      return NextResponse.json({ data: completed, source: "api" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[/api/asana?include_completed]", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Standard open tasks mode ──
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
