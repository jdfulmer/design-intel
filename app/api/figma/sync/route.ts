// app/api/figma/sync/route.ts
// POST /api/figma/sync — chunked crawl for Vercel free tier (60s limit)
// Call repeatedly — each call does one chunk of work and saves progress to KV.
//
// Phases:
//   "projects" → fetch project file lists in batches of 15
//   "details"  → fetch versions/comments for 8 files per call
//   "done"     → sync complete, start fresh on next call

import { NextRequest, NextResponse } from "next/server";
import {
  fetchTeamProjects,
  fetchProjectFiles,
  fetchFileVersions,
  fetchFileComments,
  type FigmaDesignerActivity,
} from "@/lib/figma";
import { cacheGet, cacheSet, setTimestamp, snapshotCacheKey } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";
import { fetchAsanaTasks } from "@/lib/asana";
import type { AsanaTask } from "@/lib/asana";
import {
  avgCycleTime, onTimeRate, getMonday, formatDate,
  type WeeklySnapshot,
} from "@/lib/metrics";

export const runtime = "nodejs";
export const maxDuration = 60;

const DELAY_MS = 1500; // 1.5s between calls — ~40 req/min, moderate pace
const PROJECTS_PER_CHUNK = 15; // ~15 project-file calls × 1.5s = ~23s + overhead
const FILES_PER_CHUNK = 8; // ~8 files × 2 calls × 1.5s = ~24s + overhead

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface SyncState {
  phase: "projects" | "details" | "done";
  startTime: number;
  endTime: number;
  // All project IDs and names to crawl
  allProjects: Array<{ id: string; name: string }>;
  projectsIndexed: number;
  // Files discovered so far
  fileIndex: Array<{ key: string; name: string; projectName: string; last_modified: string }>;
  filesProcessed: number;
  // Accumulated designer activity
  designers: Record<string, { edits: number; comments: number; files: string[]; projects: string[] }>;
  // Accumulated per-file stats
  fileStats: Record<string, { key: string; project: string; edits: number; comments: number; designers: string[]; lastModified: string }>;
  updatedAt: string;
}

interface SyncResult {
  data: FigmaDesignerActivity[];
  files: Array<{ name: string; key: string; project: string; edits: number; comments: number; designers: string[]; lastModified: string }>;
  syncedAt: string;
  startTime: number;
  endTime: number;
}

const STATE_KEY = "figma:sync-state" as "figma:latest-sync";

function getTeamIds(): string[] {
  const ids = process.env.FIGMA_TEAM_IDS;
  if (!ids) throw new Error("FIGMA_TEAM_IDS is not set");
  return ids.split(",").map((id) => id.trim()).filter(Boolean);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  try {
    let state = await cacheGet<SyncState>(STATE_KEY);

    if (!state || state.phase === "done") {
      // Start fresh — fetch all project IDs first (one lightweight call per team)
      const teamIds = getTeamIds();
      const allProjects: Array<{ id: string; name: string }> = [];

      for (const teamId of teamIds) {
        const projects = await fetchTeamProjects(teamId);
        allProjects.push(...projects);
        await delay(DELAY_MS);
      }

      const now = Math.floor(Date.now() / 1000);
      state = {
        phase: "projects",
        startTime: now - 30 * 24 * 60 * 60,
        endTime: now,
        allProjects,
        projectsIndexed: 0,
        fileIndex: [],
        filesProcessed: 0,
        designers: {},
        fileStats: {},
        updatedAt: new Date().toISOString(),
      };

      await cacheSet(STATE_KEY, state);

      return NextResponse.json({
        status: "started",
        projectsFound: allProjects.length,
        nextStep: `POST again to index files (${Math.ceil(allProjects.length / PROJECTS_PER_CHUNK)} more calls)`,
      });
    }

    // ── Phase: Index project files in chunks ──
    if (state.phase === "projects") {
      const startDate = new Date(state.startTime * 1000);
      const start = state.projectsIndexed;
      const end = Math.min(start + PROJECTS_PER_CHUNK, state.allProjects.length);
      const chunk = state.allProjects.slice(start, end);

      const seen = new Set(state.fileIndex.map(f => f.key));

      for (const project of chunk) {
        const files = await fetchProjectFiles(project.id);
        for (const file of files) {
          if (!seen.has(file.key) && new Date(file.last_modified) >= startDate) {
            seen.add(file.key);
            state.fileIndex.push({
              key: file.key,
              name: file.name,
              projectName: project.name,
              last_modified: file.last_modified,
            });
          }
        }
        await delay(DELAY_MS);
      }

      state.projectsIndexed = end;
      state.updatedAt = new Date().toISOString();

      const indexingDone = state.projectsIndexed >= state.allProjects.length;

      if (indexingDone) {
        // Sort by recency and cap
        state.fileIndex.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
        state.fileIndex = state.fileIndex.slice(0, 50);
        state.phase = "details";
      }

      await cacheSet(STATE_KEY, state);

      if (indexingDone) {
        return NextResponse.json({
          status: "indexing complete",
          filesFound: state.fileIndex.length,
          projectsIndexed: state.projectsIndexed,
          nextStep: `POST again to fetch file details (${Math.ceil(state.fileIndex.length / FILES_PER_CHUNK)} more calls)`,
        });
      }

      return NextResponse.json({
        status: "indexing projects",
        projectsIndexed: state.projectsIndexed,
        totalProjects: state.allProjects.length,
        remaining: state.allProjects.length - state.projectsIndexed,
        filesFoundSoFar: state.fileIndex.length,
        nextStep: "POST again to continue indexing",
      });
    }

    // ── Phase: Fetch file details in chunks ──
    if (state.phase === "details") {
      const startDate = new Date(state.startTime * 1000);
      const endDate = new Date(state.endTime * 1000);
      const start = state.filesProcessed;
      const end = Math.min(start + FILES_PER_CHUNK, state.fileIndex.length);
      const chunk = state.fileIndex.slice(start, end);

      for (const file of chunk) {
        // Initialize per-file stats
        if (!state.fileStats[file.name]) {
          state.fileStats[file.name] = { key: file.key, project: file.projectName, edits: 0, comments: 0, designers: [], lastModified: file.last_modified };
        }
        const fs = state.fileStats[file.name];

        const versions = await fetchFileVersions(file.key);
        await delay(DELAY_MS);

        for (const v of versions) {
          const vDate = new Date(v.created_at);
          if (vDate >= startDate && vDate <= endDate) {
            const name = v.user.handle;
            if (!state.designers[name]) {
              state.designers[name] = { edits: 0, comments: 0, files: [], projects: [] };
            }
            const d = state.designers[name];
            d.edits++;
            if (!d.files.includes(file.name)) d.files.push(file.name);
            if (!d.projects.includes(file.projectName)) d.projects.push(file.projectName);
            fs.edits++;
            if (!fs.designers.includes(name)) fs.designers.push(name);
          }
        }

        const comments = await fetchFileComments(file.key);
        await delay(DELAY_MS);

        for (const c of comments) {
          const cDate = new Date(c.created_at);
          if (cDate >= startDate && cDate <= endDate) {
            const name = c.user.handle;
            if (!state.designers[name]) {
              state.designers[name] = { edits: 0, comments: 0, files: [], projects: [] };
            }
            const d = state.designers[name];
            d.comments++;
            if (!d.files.includes(file.name)) d.files.push(file.name);
            if (!d.projects.includes(file.projectName)) d.projects.push(file.projectName);
            fs.comments++;
            if (!fs.designers.includes(name)) fs.designers.push(name);
          }
        }
      }

      state.filesProcessed = end;
      state.updatedAt = new Date().toISOString();

      const isDone = state.filesProcessed >= state.fileIndex.length;
      if (isDone) state.phase = "done";

      // Publish current results (partial or final) so dashboard has data
      const activity: FigmaDesignerActivity[] = Object.entries(state.designers)
        .map(([name, d]) => ({ name, ...d }));

      const fileStatsArr = Object.entries(state.fileStats)
        .map(([name, f]) => ({ name, ...f }))
        .sort((a, b) => (b.edits * 3 + b.comments) - (a.edits * 3 + a.comments));

      await cacheSet("figma:latest-sync", {
        data: activity,
        files: fileStatsArr,
        syncedAt: new Date().toISOString(),
        startTime: state.startTime,
        endTime: state.endTime,
      } as SyncResult);
      await setTimestamp("figma");
      await cacheSet(STATE_KEY, state);

      // ── Generate weekly snapshot on sync completion ──
      if (isDone) {
        try {
          await generateWeeklySnapshot(activity);
        } catch (e) {
          console.warn("[sync] snapshot generation failed:", e);
        }

        return NextResponse.json({
          status: "complete",
          designers: activity.length,
          filesProcessed: state.filesProcessed,
          totalFiles: state.fileIndex.length,
          syncedAt: new Date().toISOString(),
          snapshotGenerated: true,
        });
      }

      return NextResponse.json({
        status: "processing files",
        filesProcessed: state.filesProcessed,
        totalFiles: state.fileIndex.length,
        remaining: state.fileIndex.length - state.filesProcessed,
        designersSoFar: activity.length,
        nextStep: "POST again to continue",
      });
    }

    return NextResponse.json({ status: "idle" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/figma/sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Snapshot Generation ────────────────────────────────────────────────────────

const NON_CLIENT_PROJECTS = new Set(["Creative Intake", "Creative Tasks", "General Tasks"]);

async function generateWeeklySnapshot(
  figmaActivity: FigmaDesignerActivity[]
): Promise<void> {
  const monday = formatDate(getMonday(new Date()));
  const key = snapshotCacheKey(monday);

  // Fetch completed tasks from last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);
  let completedTasks: AsanaTask[] = [];
  let openTasks: AsanaTask[] = [];

  try {
    const [completed, open] = await Promise.all([
      fetchAsanaTasks({ completedSince: since.toISOString() }),
      fetchAsanaTasks({}),
    ]);
    completedTasks = completed.filter((t) => t.completed);
    openTasks = open.filter((t) => !t.completed);
  } catch (e) {
    console.warn("[snapshot] Asana fetch failed, generating partial snapshot:", e);
  }

  const allTasks = [...openTasks, ...completedTasks];
  const today = new Date().toISOString().slice(0, 10);

  // Team-level metrics
  const totalEdits = figmaActivity.reduce((s, d) => s + d.edits, 0);
  const totalComments = figmaActivity.reduce((s, d) => s + d.comments, 0);
  const overdueCount = openTasks.filter(
    (t) => t.due_on && !t.completed && t.due_on < today
  ).length;

  // Per-designer metrics
  const designerMap: Record<
    string,
    { edits: number; comments: number; tasksCompleted: number; tasksActive: number; cycleTasks: Array<{ created_at: string; completed_at: string | null }> }
  > = {};

  for (const d of figmaActivity) {
    designerMap[d.name] = {
      edits: d.edits,
      comments: d.comments,
      tasksCompleted: 0,
      tasksActive: 0,
      cycleTasks: [],
    };
  }

  // We don't have a reliable Asana→Figma name mapping here on the server,
  // so designer task stats are aggregated by Asana assignee name
  const assigneeStats: Record<string, { completed: number; active: number; cycleTasks: Array<{ created_at: string; completed_at: string | null }> }> = {};
  for (const t of allTasks) {
    const name = t.assignee?.name ?? "Unassigned";
    assigneeStats[name] ??= { completed: 0, active: 0, cycleTasks: [] };
    if (t.completed) {
      assigneeStats[name].completed++;
      assigneeStats[name].cycleTasks.push({ created_at: t.created_at, completed_at: t.completed_at });
    } else {
      assigneeStats[name].active++;
    }
  }

  // Per-client metrics
  const clientMap: Record<string, { tasks: number; completed: number; overdue: number }> = {};
  for (const t of allTasks) {
    for (const p of t.projects) {
      if (NON_CLIENT_PROJECTS.has(p.name)) continue;
      clientMap[p.name] ??= { tasks: 0, completed: 0, overdue: 0 };
      clientMap[p.name].tasks++;
      if (t.completed) clientMap[p.name].completed++;
      if (t.due_on && !t.completed && t.due_on < today) clientMap[p.name].overdue++;
    }
  }

  // Match client names to Figma project edits
  const projectEdits: Record<string, number> = {};
  for (const d of figmaActivity) {
    for (const p of d.projects) {
      projectEdits[p] = (projectEdits[p] ?? 0) + d.edits;
    }
  }

  const snapshot: WeeklySnapshot = {
    weekOf: monday,
    generatedAt: new Date().toISOString(),
    team: {
      totalEdits,
      totalComments,
      tasksCompleted: completedTasks.length,
      tasksCreated: allTasks.filter(
        (t) => new Date(t.created_at) >= since
      ).length,
      avgCycleTimeDays: avgCycleTime(completedTasks),
      onTimeRate: onTimeRate(completedTasks),
      overdueCount,
      activeTaskCount: openTasks.length,
    },
    designers: Object.entries(assigneeStats)
      .map(([name, s]) => ({
        name,
        edits: designerMap[name]?.edits ?? 0,
        comments: designerMap[name]?.comments ?? 0,
        tasksCompleted: s.completed,
        tasksActive: s.active,
        avgCycleTimeDays: avgCycleTime(s.cycleTasks),
      }))
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted),
    clients: Object.entries(clientMap)
      .map(([name, c]) => {
        const matched = Object.entries(projectEdits)
          .filter(
            ([fp]) =>
              fp.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(fp.toLowerCase())
          )
          .reduce((sum, [, v]) => sum + v, 0);
        return { name, ...c, edits: matched };
      })
      .sort((a, b) => b.tasks - a.tasks)
      .slice(0, 15),
  };

  await cacheSet(key, snapshot);
  console.log(`[snapshot] Generated weekly snapshot for ${monday}`);
}
