// @ts-nocheck
// mcp/src/tools/figma-tools.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTeamActivity, designerScore } from "../services/figma.js";
import { truncate, fmt, mdTable, fmtDate } from "../services/format.js";

const DEFAULT_DAYS = 30;

function defaultRange(): { startTime: number; endTime: number } {
  const now = Math.floor(Date.now() / 1000);
  return { startTime: now - DEFAULT_DAYS * 86400, endTime: now };
}

export function registerFigmaTools(server: McpServer): void {

  // ── figma_get_team_activity ────────────────────────────────────────────────
  server.registerTool(
    "figma_get_team_activity",
    {
      title: "Get Figma Team Activity",
      description: `Fetch designer activity across the Figma team for a date range.
Crawls team projects → files → version history + comments.
Returns per-designer aggregated edits, comments, files touched, and projects.

Args:
  - start_date (string, optional): ISO date YYYY-MM-DD. Defaults to 30 days ago.
  - end_date (string, optional): ISO date YYYY-MM-DD. Defaults to today.
  - designer_name (string, optional): Filter to a specific designer by name.

Returns: Table with designer name, edits, comments, files, and projects.
Use figma_get_designer_stats for composite scores.`,
      inputSchema: z.object({
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
          .describe("Start date YYYY-MM-DD (default: 30 days ago)"),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
          .describe("End date YYYY-MM-DD (default: today)"),
        designer_name: z.string().optional()
          .describe("Filter to a specific designer by display name"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ start_date, end_date, designer_name }) => {
      const { startTime, endTime } = defaultRange();
      const st = start_date ? Math.floor(new Date(start_date).getTime() / 1000) : startTime;
      const et = end_date   ? Math.floor(new Date(end_date + "T23:59:59Z").getTime() / 1000) : endTime;

      let activity = await getTeamActivity(st, et);
      if (designer_name) {
        activity = activity.filter(d =>
          d.name.toLowerCase().includes(designer_name.toLowerCase())
        );
      }

      const summary = `${fmt(activity.length)} designers from ${fmtDate(start_date ?? null)} to ${fmtDate(end_date ?? null)}`;
      const rows = activity
        .sort((a, b) => b.edits - a.edits)
        .map(d => [
          d.name,
          String(d.edits),
          String(d.comments),
          String(d.files.length),
          d.projects.join(", ") || "—",
        ]);

      const text = truncate(
        `## Figma Team Activity\n${summary}\n\n` +
        mdTable(["Designer", "Edits", "Comments", "Files", "Projects"], rows)
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { total: activity.length, designers: activity },
      };
    }
  );

  // ── figma_get_designer_stats ──────────────────────────────────────────────
  server.registerTool(
    "figma_get_designer_stats",
    {
      title: "Get Designer Stats",
      description: `Get aggregated Figma activity stats and composite score for one or all designers.
Score formula: edits×3 + comments×2 + files×2 + projects×3.

Args:
  - designer_name (string, optional): Filter to one designer. Omit for all.
  - start_date (string, optional): ISO date YYYY-MM-DD. Defaults to 30 days ago.
  - end_date (string, optional): ISO date YYYY-MM-DD. Defaults to today.

Returns: Table with name, score, edits, comments, file count, project count.`,
      inputSchema: z.object({
        designer_name: z.string().optional()
          .describe("Filter to a specific designer by name"),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
          .describe("Start date YYYY-MM-DD"),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
          .describe("End date YYYY-MM-DD"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ designer_name, start_date, end_date }) => {
      const { startTime, endTime } = defaultRange();
      const st = start_date ? Math.floor(new Date(start_date).getTime() / 1000) : startTime;
      const et = end_date   ? Math.floor(new Date(end_date + "T23:59:59Z").getTime() / 1000) : endTime;

      const activity = await getTeamActivity(st, et);

      let entries = activity
        .map(d => ({
          name: d.name,
          edits: d.edits,
          comments: d.comments,
          fileCount: d.files.length,
          projectCount: d.projects.length,
          score: designerScore({ edits: d.edits, comments: d.comments, fileCount: d.files.length, projectCount: d.projects.length }),
        }))
        .sort((a, b) => b.score - a.score);

      if (designer_name) {
        entries = entries.filter(e => e.name.toLowerCase().includes(designer_name.toLowerCase()));
      }

      if (!entries.length) {
        return { content: [{ type: "text" as const, text: "No matching designers found in this date range." }] };
      }

      const rows = entries.map(e => [
        e.name, String(e.score), fmt(e.edits), fmt(e.comments), String(e.fileCount), String(e.projectCount),
      ]);

      const text = truncate(
        `## Designer Stats (${fmtDate(start_date ?? null)} → ${fmtDate(end_date ?? null)})\n\n` +
        mdTable(["Designer", "Score", "Edits", "Comments", "Files", "Projects"], rows)
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { designers: entries },
      };
    }
  );
}
