// app/api/debug/coverage/route.ts
// GET /api/debug/coverage — diagnostic for the Asana-client <-> Figma-folder
// name join behind Coverage & Balance. Reads exactly what the dashboard reads
// from KV (the latest sync + cached Asana tasks) and reports which client names
// match which Figma project/folder names, so name-taxonomy gaps are visible.
// Read-only; safe to leave in place.

import { NextRequest, NextResponse } from "next/server";
import { cacheGet, asanaCacheKey } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";
import { clientMatchesFigmaProject, NON_CLIENT_PROJECTS } from "@/lib/team-config";
import type { AsanaTask } from "@/lib/asana";
import type { FigmaDesignerActivity } from "@/lib/figma";

export const runtime = "nodejs";

interface FileStat { name: string; project: string; lastModified: string }
interface SyncResult { data: FigmaDesignerActivity[]; files?: FileStat[]; syncedAt?: string }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  const sync = await cacheGet<SyncResult>("figma:latest-sync");
  const tasks = (await cacheGet<AsanaTask[]>(asanaCacheKey())) ?? [];

  // Distinct Asana client (project) names, excluding internal buckets.
  const asanaClients = Array.from(
    new Set(
      tasks.flatMap((t) => (t.projects ?? []).map((p) => p.name))
    )
  ).filter((n) => !NON_CLIENT_PROJECTS.has(n)).sort();

  // Distinct Figma folder names seen in the sync — from per-file stats AND from
  // each designer's project list (covers both data sources the dashboard uses).
  const figmaProjects = Array.from(
    new Set([
      ...((sync?.files ?? []).map((f) => f.project)),
      ...((sync?.data ?? []).flatMap((d) => d.projects ?? [])),
    ])
  ).filter((n) => n && !NON_CLIENT_PROJECTS.has(n)).sort();

  // Match matrix
  const matchedPairs: Array<{ client: string; figma: string }> = [];
  for (const c of asanaClients) {
    for (const fp of figmaProjects) {
      if (clientMatchesFigmaProject(c, fp)) matchedPairs.push({ client: c, figma: fp });
    }
  }
  const matchedClients = new Set(matchedPairs.map((m) => m.client));
  const matchedFigma = new Set(matchedPairs.map((m) => m.figma));

  return NextResponse.json({
    syncedAt: sync?.syncedAt ?? null,
    counts: {
      asanaClients: asanaClients.length,
      figmaProjects: figmaProjects.length,
      figmaFilesInSync: sync?.files?.length ?? 0,
      tasksCached: tasks.length,
      matchedClients: matchedClients.size,
    },
    matchedPairs,
    unmatchedClients: asanaClients.filter((c) => !matchedClients.has(c)),
    unmatchedFigmaProjects: figmaProjects.filter((f) => !matchedFigma.has(f)),
    allAsanaClients: asanaClients,
    allFigmaProjects: figmaProjects,
  });
}
