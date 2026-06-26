// app/api/debug/coverage/route.ts
// GET /api/debug/coverage — diagnostic for the Asana-client <-> Figma-folder
// name join behind Coverage & Balance. Reads exactly what the dashboard reads
// from KV (the latest sync + cached Asana tasks) and reports which client names
// match which Figma project/folder names, so name-taxonomy gaps are visible.
// Read-only; safe to leave in place.

import { NextRequest, NextResponse } from "next/server";
import { cacheGet, asanaCacheKey } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";
import { clientMatchesFigmaProject, isNonClientProject } from "@/lib/team-config";
import { fetchAsanaTasks, type AsanaTask } from "@/lib/asana";
import { fetchTeamProjects, fetchProjectFiles, fetchProjectInfo, type FigmaDesignerActivity } from "@/lib/figma";

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
  ).filter((n) => !isNonClientProject(n)).sort();

  // Distinct Figma folder names seen in the sync — from per-file stats AND from
  // each designer's project list (covers both data sources the dashboard uses).
  const figmaProjects = Array.from(
    new Set([
      ...((sync?.files ?? []).map((f) => f.project)),
      ...((sync?.data ?? []).flatMap((d) => d.projects ?? [])),
    ])
  ).filter((n) => n && !isNonClientProject(n)).sort();

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
  const allProjects: Array<{ id: string; name: string }> = [];
  for (const teamId of teamIds) {
    try {
      const projects = await fetchTeamProjects(teamId);
      allProjects.push(...projects);
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

  // ── Peek inside catch-all folders ───────────────────────────────────────────
  // Hypothesis: client work is filed as FILES inside broad project folders
  // (e.g. "Amazon Assets"), so the client name never appears at the folder
  // level we match on. List files for projects matching the probe terms.
  // ?probe=amazon,asset  overrides the default terms. ?findFile=lavanila filters
  // returned file names to that substring (across ALL projects, capped).
  const { searchParams } = req.nextUrl;
  const probeTerms = (searchParams.get("probe") ?? "amazon,asset,template,collaboration,creative,portfolio,pixlfirst,d2e,market defense")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const findFile = (searchParams.get("findFile") ?? "").trim().toLowerCase();

  // Stay well under Figma's ~20 req/min: cap the number of projects we open.
  const catchAll = allProjects.filter((p) => probeTerms.some((t) => p.name.toLowerCase().includes(t)));
  const probeTargets = (findFile
    // Name search: catch-all folders first (most likely home), then the rest.
    ? [...catchAll, ...allProjects.filter((p) => !catchAll.includes(p))]
    : catchAll
  ).slice(0, 18);

  const probedProjectFiles: Array<{ project: string; files: Array<{ name: string; last_modified: string }> }> = [];
  const fileNameMatches: Array<{ project: string; file: string; last_modified: string }> = [];
  for (const proj of probeTargets) {
    try {
      const files = await fetchProjectFiles(proj.id);
      if (findFile) {
        for (const f of files) {
          if (f.name.toLowerCase().includes(findFile)) {
            fileNameMatches.push({ project: proj.name, file: f.name, last_modified: f.last_modified });
          }
        }
      } else {
        probedProjectFiles.push({
          project: proj.name,
          files: files.slice(0, 60).map((f) => ({ name: f.name, last_modified: f.last_modified })),
        });
      }
    } catch { /* skip on error */ }
  }

  // Which Asana clients have NO matching project anywhere in the tracked teams
  // (vs. just no recent edit)? These are the real "team not tracked" candidates.
  const clientsWithNoTrackedFolder = asanaClients.filter(
    (c) => !allTrackedFigmaProjects.some((fp) => clientMatchesFigmaProject(c, fp))
  );

  // ── Probe an arbitrary (possibly untracked) team / project ──────────────────
  // ?testTeam=<id> verifies a team ID is valid and lists its folders.
  // ?testProject=<id> lists a folder's files. Used to confirm where a client's
  // work lives before adding the team to FIGMA_TEAM_IDS.
  const testTeam = searchParams.get("testTeam");
  const testProject = searchParams.get("testProject");
  let testTeamResult: unknown = null;
  let testProjectResult: unknown = null;
  if (testTeam) {
    try {
      const ps = await fetchTeamProjects(testTeam);
      testTeamResult = {
        teamId: testTeam,
        alreadyTracked: teamIds.includes(testTeam),
        projectCount: ps.length,
        projects: ps.map((p) => ({ id: p.id, name: p.name })),
      };
    } catch (e) {
      testTeamResult = { teamId: testTeam, error: e instanceof Error ? e.message : "fetch failed" };
    }
  }
  if (testProject) {
    try {
      const info = await fetchProjectInfo(testProject);
      // Which Asana clients would this folder name match? Confirms the matcher
      // will catch it once the project is crawled.
      const wouldMatchClients = asanaClients.filter((c) => clientMatchesFigmaProject(c, info.name));
      testProjectResult = {
        projectId: testProject,
        folderName: info.name,
        wouldMatchClients,
        fileCount: info.files.length,
        files: info.files.map((f) => ({ name: f.name, last_modified: f.last_modified })),
      };
    } catch (e) {
      testProjectResult = { projectId: testProject, error: e instanceof Error ? e.message : "fetch failed" };
    }
  }

  return NextResponse.json({
    syncedAt: sync?.syncedAt ?? null,
    asanaSource,
    testTeam: testTeamResult,
    testProject: testProjectResult,
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
    // File-structure probe (does client work live as files inside catch-all folders?)
    probeTerms,
    findFile: findFile || null,
    probedProjectFiles,
    fileNameMatches,
    allAsanaClients: asanaClients,
    allFigmaProjects: figmaProjects,
  });
}
