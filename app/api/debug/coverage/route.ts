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
import { fetchAsanaTasks, type AsanaTask } from "@/lib/asana";
import { fetchTeamProjects, type FigmaDesignerActivity } from "@/lib/figma";

export const runtime = "nodejs";
export const maxDuration = 60;

interface FileStat { name: string; project: string; lastModified: string }
interface SyncResult { data: FigmaDesignerActivity[]; files?: FileStat[]; syncedAt?: string }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  const sync = await cacheGet<SyncResult>("figma:latest-sync");
  // Asana payloads can exceed the KV value limit, so the cache write often
  // fails and "asana:tasks:all" is empty. Read the cache first, but fall back
  // to a live fetch (same as the dashboard) so client names are always present.
  let tasks = (await cacheGet<AsanaTask[]>(asanaCacheKey())) ?? [];
  let asanaSource: "cache" | "live" | "error" = "cache";
  if (tasks.length === 0) {
    try {
      tasks = await fetchAsanaTasks({});
      asanaSource = "live";
    } catch {
      asanaSource = "error";
    }
  }

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

  // ── Tracked-team coverage ──────────────────────────────────────────────────
  // The sync only surfaces folders with a file edited in the last 30 days. To
  // tell "tracked but quiet" from "team not tracked at all", list EVERY project
  // across the configured teams (live, lightweight — one call per team).
  const teamIds = (process.env.FIGMA_TEAM_IDS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const teams: Array<{ teamId: string; projectCount: number; projects: string[]; error?: string }> = [];
  for (const teamId of teamIds) {
    try {
      const projects = await fetchTeamProjects(teamId);
      teams.push({
        teamId,
        projectCount: projects.length,
        projects: projects.map((p) => p.name).sort(),
      });
    } catch (e) {
      teams.push({ teamId, projectCount: 0, projects: [], error: e instanceof Error ? e.message : "fetch failed" });
    }
  }
  const allTrackedFigmaProjects = Array.from(
    new Set(teams.flatMap((t) => t.projects))
  ).sort();

  // Which Asana clients have NO matching project anywhere in the tracked teams
  // (vs. just no recent edit)? These are the real "team not tracked" candidates.
  const clientsWithNoTrackedFolder = asanaClients.filter(
    (c) => !allTrackedFigmaProjects.some((fp) => clientMatchesFigmaProject(c, fp))
  );

  return NextResponse.json({
    syncedAt: sync?.syncedAt ?? null,
    asanaSource,
    counts: {
      asanaClients: asanaClients.length,
      figmaProjects: figmaProjects.length,
      figmaFilesInSync: sync?.files?.length ?? 0,
      tasksCached: tasks.length,
      matchedClients: matchedClients.size,
      trackedTeams: teams.length,
      trackedFigmaProjects: allTrackedFigmaProjects.length,
    },
    matchedPairs,
    unmatchedClients: asanaClients.filter((c) => !matchedClients.has(c)),
    unmatchedFigmaProjects: figmaProjects.filter((f) => !matchedFigma.has(f)),
    // Coverage investigation:
    teams,
    allTrackedFigmaProjects,
    clientsWithNoTrackedFolder,
    allAsanaClients: asanaClients,
    allFigmaProjects: figmaProjects,
  });
}
