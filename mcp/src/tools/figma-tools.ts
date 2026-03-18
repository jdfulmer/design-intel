// mcp/src/tools/figma-tools.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFigmaActivity, aggregateByActor, designerScore } from "../services/figma.js";
import { truncate, fmt, mdTable, fmtDate } from "../services/format.js";

const DEFAULT_DAYS = 30;

function defaultRange(): { startTime: number; endTime: number } {
  const now = Math.floor(Date.now() / 1000);
  return { startTime: now - DEFAULT_DAYS * 86400, endTime: now };
}

export function registerFigmaTools(server: McpServer): void {

  // ── figma_get_activity ────────────────────────────────────────────────────
  server.registerTool(
    "figma_get_activity",
    {
      title: "Get Figma Activity",
      description: `Fetch raw Figma activity log events for a date range.
Returns a list of events with actor name, event type, timestamp, and file/team info.

Args:
  - start_date (string, optional): ISO date YYYY-MM-DD. Defaults to 30 days ago.
  - end_date (string, optional): ISO date YYYY-MM-DD. Defaults to today.
  - event_types (string[], optional): Filter to specific event types e.g. ["fig_file_export","fig_file_create"]
  - actor_name (string, optional): Filter to a specific designer by name.

Returns: Array of events with id, timestamp, event_type, actor.name, entity.name.
Use figma_get_designer_stats for pre-aggregated scores.`,
      inputSchema: z.object({
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
          .describe("Start date YYYY-MM-DD (default: 30 days ago)"),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
          .describe("End date YYYY-MM-DD (default: today)"),
        event_types: z.array(z.string()).optional()
          .describe("Filter to specific event types e.g. ['fig_file_export']"),
        actor_name: z.string().optional()
          .describe("Filter to a specific actor by display name"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ start_date, end_date, event_types, actor_name }) => {
      const { startTime, endTime } = defaultRange();
      const st = start_date ? Math.floor(new Date(start_date).getTime() / 1000) : startTime;
      const et = end_date   ? Math.floor(new Date(end_date + "T23:59:59Z").getTime() / 1000) : endTime;

      let events = await getFigmaActivity(st, et, event_types);
      if (actor_name) {
        events = events.filter(e =>
          e.actor.name.toLowerCase().includes(actor_name.toLowerCase())
        );
      }

      const summary = `${fmt(events.length)} events from ${fmtDate(start_date ?? null)} to ${fmtDate(end_date ?? null)}`;
      const rows = events.slice(0, 200).map(e => [
        fmtDate(e.timestamp),
        e.event_type,
        e.actor.name,
        e.entity?.name ?? "—",
      ]);

      const text = truncate(
        `## Figma Activity\n${summary}\n\n` +
        mdTable(["Date", "Event", "Actor", "File/Entity"], rows) +
        (events.length > 200 ? `\n\n_Showing 200 of ${fmt(events.length)} — use date filters to narrow._` : "")
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { total: events.length, events: events.slice(0, 200) },
      };
    }
  );

  // ── figma_get_designer_stats ──────────────────────────────────────────────
  server.registerTool(
    "figma_get_designer_stats",
    {
      title: "Get Designer Stats",
      description: `Get aggregated Figma activity stats and composite score for one or all designers.
Score formula: exports×3 + views×0.5 + creates×5 + files×2 + clients×3.

Args:
  - designer_name (string, optional): Filter to one designer. Omit for all.
  - start_date (string, optional): ISO date YYYY-MM-DD. Defaults to 30 days ago.
  - end_date (string, optional): ISO date YYYY-MM-DD. Defaults to today.

Returns: Table with name, score, exports, views, creates, file count, client count.`,
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

      const events = await getFigmaActivity(st, et);
      const byActor = aggregateByActor(events);

      let entries = Object.entries(byActor)
        .map(([name, s]) => ({
          name,
          exports: s.exports,
          views: s.views,
          creates: s.creates,
          fileCount: s.files.size,
          teamCount: s.teams.size,
          score: designerScore({ exports: s.exports, views: s.views, creates: s.creates, fileCount: s.files.size, teamCount: s.teams.size }),
        }))
        .sort((a, b) => b.score - a.score);

      if (designer_name) {
        entries = entries.filter(e => e.name.toLowerCase().includes(designer_name.toLowerCase()));
      }

      if (!entries.length) {
        return { content: [{ type: "text" as const, text: "No matching designers found in this date range." }] };
      }

      const rows = entries.map(e => [
        e.name, String(e.score), fmt(e.exports), fmt(e.views), fmt(e.creates), String(e.fileCount), String(e.teamCount),
      ]);

      const text = truncate(
        `## Designer Stats (${fmtDate(start_date ?? null)} → ${fmtDate(end_date ?? null)})\n\n` +
        mdTable(["Designer", "Score", "Exports", "Views", "Creates", "Files", "Clients"], rows)
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { designers: entries },
      };
    }
  );
}
