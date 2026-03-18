// app/api/figma/sync/route.ts
// POST /api/figma/sync — chunked crawl that fits within 60s free tier limit
// Call multiple times — each call processes the next batch and saves progress.
// Phase 1: fetch all project file lists → store file index
// Phase 2+: fetch versions/comments for N files per call → merge into results

import { NextRequest, NextResponse } from "next/server";
import {
  fetchTeamProjects,
  fetchProjectFiles,
  fetchFileVersions,
  fetchFileComments,
  type FigmaDesignerActivity,
  type FigmaFileInfo,
} from "@/lib/figma";
import { cacheGet, cacheSet, setTimestamp } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const DELAY_MS = 3200;
const FILES_PER_CHUNK = 8; // ~8 files × 2 calls × 3.2s = ~51s + overhead ≈ 58s

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface SyncState {
  phase: "files" | "details" | "done";
  startTime: number;
  endTime: number;
  // All files to process (built in phase "files")
  fileIndex: Array<{ key: string; name: string; projectName: string; last_modified: string }>;
  // How many files we've processed so far
  filesProcessed: number;
  // Accumulated designer activity
  designers: Record<string, { edits: number; comments: number; files: string[]; projects: string[] }>;
  updatedAt: string;
}

interface SyncResult {
  data: FigmaDesignerActivity[];
  syncedAt: string;
  startTime: number;
  endTime: number;
}

function getTeamIds(): string[] {
  const ids = process.env.FIGMA_TEAM_IDS;
  if (!ids) throw new Error("FIGMA_TEAM_IDS is not set");
  return ids.split(",").map((id) => id.trim()).filter(Boolean);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  try {
    // Load existing sync state or start fresh
    let state = await cacheGet<SyncState>("figma:sync-state" as "figma:latest-sync");

    if (!state || state.phase === "done") {
      // Start a new sync
      const now = Math.floor(Date.now() / 1000);
      state = {
        phase: "files",
        startTime: now - 30 * 24 * 60 * 60,
        endTime: now,
        fileIndex: [],
        filesProcessed: 0,
        designers: {},
        updatedAt: new Date().toISOString(),
      };
    }

    if (state.phase === "files") {
      // Phase 1: Build the file index from all teams/projects
      const teamIds = getTeamIds();
      const fileMap: Map<string, { key: string; name: string; projectName: string; last_modified: string }> = new Map();
      const startDate = new Date(state.startTime * 1000);

      for (const teamId of teamIds) {
        const projects = await fetchTeamProjects(teamId);
        await delay(DELAY_MS);

        for (const project of projects) {
          const files = await fetchProjectFiles(project.id);
          for (const file of files) {
            if (!fileMap.has(file.key) && new Date(file.last_modified) >= startDate) {
              fileMap.set(file.key, {
                key: file.key,
                name: file.name,
                projectName: project.name,
                last_modified: file.last_modified,
              });
            }
          }
          await delay(DELAY_MS);
        }
      }

      // Sort by recency, cap at 50
      const sorted = Array.from(fileMap.values())
        .sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime())
        .slice(0, 50);

      state.fileIndex = sorted;
      state.phase = "details";
      state.updatedAt = new Date().toISOString();

      // Save progress
      await cacheSet("figma:sync-state" as "figma:latest-sync", state);

      return NextResponse.json({
        status: "indexing complete",
        filesFound: sorted.length,
        nextStep: "POST again to start fetching file details",
      });
    }

    if (state.phase === "details") {
      // Phase 2+: Process the next chunk of files
      const startDate = new Date(state.startTime * 1000);
      const endDate = new Date(state.endTime * 1000);
      const start = state.filesProcessed;
      const end = Math.min(start + FILES_PER_CHUNK, state.fileIndex.length);
      const chunk = state.fileIndex.slice(start, end);

      for (const file of chunk) {
        // Versions
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
          }
        }

        // Comments
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
          }
        }
      }

      state.filesProcessed = end;
      state.updatedAt = new Date().toISOString();

      const isDone = state.filesProcessed >= state.fileIndex.length;

      if (isDone) {
        state.phase = "done";
      }

      // Save progress
      await cacheSet("figma:sync-state" as "figma:latest-sync", state);

      // If done, also publish the final result to the main cache key
      if (isDone) {
        const activity: FigmaDesignerActivity[] = Object.entries(state.designers)
          .map(([name, d]) => ({ name, ...d }));

        const result: SyncResult = {
          data: activity,
          syncedAt: new Date().toISOString(),
          startTime: state.startTime,
          endTime: state.endTime,
        };
        await cacheSet("figma:latest-sync", result);
        await setTimestamp("figma");

        return NextResponse.json({
          status: "complete",
          designers: activity.length,
          filesProcessed: state.filesProcessed,
          totalFiles: state.fileIndex.length,
          syncedAt: result.syncedAt,
        });
      }

      // Also publish partial results so dashboard shows something
      const partialActivity: FigmaDesignerActivity[] = Object.entries(state.designers)
        .map(([name, d]) => ({ name, ...d }));

      await cacheSet("figma:latest-sync", {
        data: partialActivity,
        syncedAt: new Date().toISOString(),
        startTime: state.startTime,
        endTime: state.endTime,
      } as SyncResult);
      await setTimestamp("figma");

      return NextResponse.json({
        status: "in progress",
        filesProcessed: state.filesProcessed,
        totalFiles: state.fileIndex.length,
        remaining: state.fileIndex.length - state.filesProcessed,
        designersSoFar: partialActivity.length,
        nextStep: "POST again to continue",
      });
    }

    return NextResponse.json({ status: "idle", message: "Sync already complete. POST again to start fresh." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/figma/sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
