// mcp/src/services/figma.ts — Figma Activity Logs API client

import { FIGMA_API } from "../constants.js";
import type { FigmaEvent } from "../types.js";

interface FigmaActivityResponse {
  error: boolean;
  meta: {
    activity_logs: FigmaEvent[];
    cursor?: string;
    next_page?: boolean;
  };
  status: number;
}

function getToken(): string {
  const token = process.env.FIGMA_OAUTH_TOKEN;
  if (!token) {
    throw new Error(
      "FIGMA_OAUTH_TOKEN is not set. Complete the OAuth flow at /api/figma/auth on your deployed dashboard."
    );
  }
  return token;
}

/**
 * Fetch Figma activity log events for a date range.
 * Handles cursor-based pagination automatically.
 * startTime/endTime are Unix timestamps (seconds).
 */
export async function getFigmaActivity(
  startTime: number,
  endTime: number,
  eventFilter?: string[]
): Promise<FigmaEvent[]> {
  const token = getToken();
  const events: FigmaEvent[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      limit: "200",
    });
    if (eventFilter?.length) params.set("events", eventFilter.join(","));
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${FIGMA_API}/activity_logs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Figma API ${res.status}: ${body}`);
    }

    const data: FigmaActivityResponse = await res.json();
    if (data.error) throw new Error("Figma API returned error flag");

    events.push(...data.meta.activity_logs);
    cursor = data.meta.cursor;
    hasMore = data.meta.next_page === true;
  }

  return events;
}

/**
 * Compute per-actor stats from a set of events.
 */
export function aggregateByActor(events: FigmaEvent[]): Record<string, {
  views: number; exports: number; creates: number; renames: number;
  files: Set<string>; teams: Set<string>;
}> {
  const map: Record<string, ReturnType<typeof aggregateByActor>[string]> = {};

  for (const e of events) {
    const name = e.actor.name;
    if (!name) continue;
    if (!map[name]) {
      map[name] = { views: 0, exports: 0, creates: 0, renames: 0, files: new Set(), teams: new Set() };
    }
    const s = map[name];
    if (e.event_type === "fig_file_view")   s.views++;
    if (e.event_type === "fig_file_export") s.exports++;
    if (e.event_type === "fig_file_create") s.creates++;
    if (e.event_type === "fig_file_rename") s.renames++;
    const entityName = e.entity?.name;
    if (entityName) s.files.add(entityName);
    const team = (e.details as Record<string, string> | undefined)?.team_name;
    if (team) s.teams.add(team);
  }

  return map;
}

/**
 * Compute composite designer score.
 * exports×3 + views×0.5 + creates×5 + files×2 + clients×3
 */
export function designerScore(stats: {
  exports: number; views: number; creates: number;
  fileCount: number; teamCount: number;
}): number {
  return Math.round(
    stats.exports * 3 +
    stats.views * 0.5 +
    stats.creates * 5 +
    stats.fileCount * 2 +
    stats.teamCount * 3
  );
}
