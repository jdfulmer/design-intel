// @ts-nocheck
// mcp/src/tools/intel-tools.ts — Cross-system intelligence tools

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTeamActivity, designerScore } from "../services/figma.js";
import { getAsanaTasks, getClientProjects, isOverdue, getCustomField, getCustomFieldNumber } from "../services/asana.js";
import { ASANA_TO_FIGMA } from "../constants.js";
import { truncate, fmt, fmtRatio, mdTable, pressureLabel, efficiencyLabel } from "../services/format.js";
import type { FigmaDesignerActivity } from "../types.js";

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_DAYS = 30;

/** Build a lookup from Figma display name → activity */
function activityByName(activity: FigmaDesignerActivity[]): Map<string, FigmaDesignerActivity> {
  return new Map(activity.map(d => [d.name, d]));
}

export function registerIntelTools(server: McpServer): void {

  // ── intel_client_pressure ──────────────────────────────────────────────────
  server.registerTool(
    "intel_client_pressure",
    {
      title: "Client Pressure Index",
      description: `Cross-reference Asana task load vs Figma edit output per client.
Pressure score = open tasks + overdue×3 − min(edits×0.3, tasks).
High pressure = many tasks, few edits. Low pressure = edits flowing.

Args:
  - client_name (string, optional): Focus on one client (partial name match).
  - figma_days (number, optional): Days of Figma history to use. Default 30.

Returns: Ranked client table with task count, overdue, Figma edits, pressure score, and level.`,
      inputSchema: z.object({
        client_name: z.string().optional()
          .describe("Filter to a specific client by name (partial match)"),
        figma_days: z.number().int().min(1).max(90).optional().default(30)
          .describe("Days of Figma history to include (default: 30)"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ client_name, figma_days }) => {
      const days = figma_days ?? DEFAULT_DAYS;
      const now = Math.floor(Date.now() / 1000);
      const [tasks, activity] = await Promise.all([
        getAsanaTasks(),
        getTeamActivity(now - days * 86400, now),
      ]);

      const figmaMap = activityByName(activity);

      // Build client map from Asana
      const clientMap: Record<string, { tasks: number; overdue: number; inProgress: number; designers: Set<string>; edits: number }> = {};
      for (const task of tasks) {
        const clients = getClientProjects(task);
        for (const c of clients) {
          clientMap[c] ??= { tasks: 0, overdue: 0, inProgress: 0, designers: new Set(), edits: 0 };
          clientMap[c].tasks++;
          if (isOverdue(task, TODAY)) clientMap[c].overdue++;
          if (getCustomField(task, "Task Progress") === "In Progress") clientMap[c].inProgress++;
          const figmaName = ASANA_TO_FIGMA[task.assignee?.name ?? ""] ?? task.assignee?.name ?? "";
          if (figmaName) {
            clientMap[c].designers.add(figmaName);
            // Sum edits from this designer's Figma activity on files in matching projects
            const fa = figmaMap.get(figmaName);
            if (fa) {
              const hasProjectMatch = fa.projects.some(p =>
                p.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(p.toLowerCase())
              );
              if (hasProjectMatch) clientMap[c].edits += fa.edits;
            }
          }
        }
      }

      const rows = Object.entries(clientMap).map(([name, c]) => {
        const pressureScore = c.tasks + c.overdue * 3 - Math.min(c.edits * 0.3, c.tasks);
        return { name, ...c, designerCount: c.designers.size, figmaEdits: c.edits, pressureScore };
      }).sort((a, b) => b.pressureScore - a.pressureScore);

      const filtered = client_name
        ? rows.filter(r => r.name.toLowerCase().includes(client_name.toLowerCase()))
        : rows;

      if (!filtered.length) {
        return { content: [{ type: "text" as const, text: "No matching clients found." }] };
      }

      const tableRows = filtered.map(r => [
        r.name,
        String(r.tasks),
        String(r.overdue),
        String(r.inProgress),
        String(r.figmaEdits),
        String(r.designerCount),
        `${Math.round(r.pressureScore)}  ${pressureLabel(r.pressureScore)}`,
      ]);

      const text = truncate(
        `## Client Pressure Index (last ${days} days of Figma)\n\n` +
        mdTable(["Client", "Tasks", "Overdue", "Active", "Edits", "Designers", "Pressure"], tableRows)
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { clients: filtered.map(r => ({ ...r, designers: [...r.designers] })) },
      };
    }
  );

  // ── intel_workload_balance ─────────────────────────────────────────────────
  server.registerTool(
    "intel_workload_balance",
    {
      title: "Designer Workload Balance",
      description: `Compare each designer's Asana task load against their Figma edit output.
Efficiency = Figma edits ÷ active Asana tasks.
Flags HIGH LOAD (8+ active tasks, <15 edits) and HIGH THRU (efficiency >3).

Args:
  - designer_name (string, optional): Focus on one designer.
  - figma_days (number, optional): Days of Figma history. Default 30.

Returns: Per-designer table with active tasks, overdue, Figma score, edits, efficiency.`,
      inputSchema: z.object({
        designer_name: z.string().optional()
          .describe("Filter to a specific designer"),
        figma_days: z.number().int().min(1).max(90).optional().default(30)
          .describe("Days of Figma history to include (default: 30)"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ designer_name, figma_days }) => {
      const days = figma_days ?? DEFAULT_DAYS;
      const now = Math.floor(Date.now() / 1000);
      const [tasks, activity] = await Promise.all([
        getAsanaTasks(),
        getTeamActivity(now - days * 86400, now),
      ]);

      const figmaMap = activityByName(activity);

      // Build per-figma-name task stats
      const taskMap: Record<string, { active: number; overdue: number; clients: Set<string> }> = {};
      for (const task of tasks) {
        const figmaName = ASANA_TO_FIGMA[task.assignee?.name ?? ""] ?? task.assignee?.name ?? "";
        if (!figmaName) continue;
        taskMap[figmaName] ??= { active: 0, overdue: 0, clients: new Set() };
        const progress = getCustomField(task, "Task Progress") ?? "";
        if (progress === "In Progress" || progress === "" || progress === "Not Started") taskMap[figmaName].active++;
        if (isOverdue(task, TODAY)) taskMap[figmaName].overdue++;
        getClientProjects(task).forEach(c => taskMap[figmaName].clients.add(c));
      }

      // Merge Figma + Asana
      const allNames = new Set([...figmaMap.keys(), ...Object.keys(taskMap)]);
      let rows = [...allNames].map(name => {
        const f = figmaMap.get(name);
        const edits = f?.edits ?? 0;
        const comments = f?.comments ?? 0;
        const fileCount = f?.files.length ?? 0;
        const projectCount = f?.projects.length ?? 0;
        const a = taskMap[name] ?? { active: 0, overdue: 0, clients: new Set() };
        const score = designerScore({ edits, comments, fileCount, projectCount });
        const efficiency: number | null = a.active > 0 ? parseFloat((edits / a.active).toFixed(1)) : null;
        const highLoad = a.active >= 8 && edits < 15;
        const highThru = efficiency !== null && efficiency > 3;
        return { name, figmaScore: score, edits, active: a.active, overdue: a.overdue, efficiency, highLoad, highThru, clientCount: a.clients.size };
      }).sort((a, b) => b.active - a.active);

      if (designer_name) {
        rows = rows.filter(r => r.name.toLowerCase().includes(designer_name.toLowerCase()));
      }

      if (!rows.length) {
        return { content: [{ type: "text" as const, text: "No matching designers found." }] };
      }

      const tableRows = rows.map(r => [
        r.name,
        String(r.active),
        String(r.overdue),
        String(r.figmaScore),
        fmt(r.edits),
        fmtRatio(r.efficiency),
        efficiencyLabel(r.efficiency) + (r.highLoad ? " ⚠ HIGH LOAD" : "") + (r.highThru ? " ⚡" : ""),
      ]);

      const text = truncate(
        `## Designer Workload Balance (last ${days} days)\n\n` +
        mdTable(["Designer", "Active Tasks", "Overdue", "Figma Score", "Edits", "Efficiency", "Status"], tableRows)
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { designers: rows },
      };
    }
  );

  // ── intel_weekly_summary ──────────────────────────────────────────────────
  server.registerTool(
    "intel_weekly_summary",
    {
      title: "Weekly Design Ops Summary",
      description: `Generate a full cross-system design ops digest for standup or exec reporting.
Pulls the last 7 days of Figma activity + all open Asana tasks.
Returns a structured markdown report covering:
- Top designers by output this week
- Clients with highest task pressure
- Overdue tasks
- Creative type breakdown
- Team workload flags

Args: none required.

Best used as: "Give me a design ops brief for Monday standup" or "What's the team status this week?"`,
      inputSchema: z.object({
        days: z.number().int().min(1).max(14).optional().default(7)
          .describe("Days of Figma history to include in the summary (default: 7)"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ days }) => {
      const windowDays = days ?? 7;
      const now = Math.floor(Date.now() / 1000);
      const [tasks, activity] = await Promise.all([
        getAsanaTasks(),
        getTeamActivity(now - windowDays * 86400, now),
      ]);

      const figmaMap = activityByName(activity);
      const overdueTasks = tasks.filter(t => isOverdue(t, TODAY));

      // ── Top designers ──
      const designers = activity
        .map(d => ({
          name: d.name,
          score: designerScore({ edits: d.edits, comments: d.comments, fileCount: d.files.length, projectCount: d.projects.length }),
          edits: d.edits,
          comments: d.comments,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // ── Client pressure ──
      const clientMap: Record<string, { tasks: number; overdue: number }> = {};
      for (const task of tasks) {
        for (const c of getClientProjects(task)) {
          clientMap[c] ??= { tasks: 0, overdue: 0 };
          clientMap[c].tasks++;
          if (isOverdue(task, TODAY)) clientMap[c].overdue++;
        }
      }
      const topClients = Object.entries(clientMap)
        .map(([name, c]) => ({ name, ...c, pressure: c.tasks + c.overdue * 3 }))
        .sort((a, b) => b.pressure - a.pressure)
        .slice(0, 5);

      // ── Creative type breakdown ──
      const typeMap: Record<string, number> = {};
      for (const task of tasks) {
        const type = getCustomField(task, "Type of Creative") ?? "Other";
        typeMap[type] = (typeMap[type] ?? 0) + 1;
      }
      const types = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);

      // ── Workload flags ──
      const flags: string[] = [];
      if (overdueTasks.length > 0) {
        flags.push(`⚠ ${overdueTasks.length} overdue task(s) — top: ${overdueTasks[0]?.name?.slice(0, 40)}`);
      }
      for (const [name, fa] of figmaMap.entries()) {
        let active = 0;
        for (const t of tasks) {
          const fn = ASANA_TO_FIGMA[t.assignee?.name ?? ""] ?? t.assignee?.name ?? "";
          if (fn === name) active++;
        }
        if (active >= 8 && fa.edits < 15) {
          flags.push(`⚠ ${name} has ${active} tasks but only ${fa.edits} edits this period`);
        }
      }

      // ── Total ASIN count ──
      const totalAsins = tasks.reduce((sum, t) => sum + (getCustomFieldNumber(t, "Total # of ASINs") ?? 0), 0);

      const totalEdits = activity.reduce((sum, d) => sum + d.edits, 0);
      const totalComments = activity.reduce((sum, d) => sum + d.comments, 0);

      const report = [
        `# Design Ops Brief — ${TODAY}`,
        `_Last ${windowDays} days · ${tasks.length} open Asana tasks · ${fmt(totalEdits)} Figma edits · ${fmt(totalComments)} comments_`,
        "",
        "## Top Designers This Period",
        mdTable(["Designer", "Score", "Edits", "Comments"], designers.map(d => [d.name, String(d.score), fmt(d.edits), fmt(d.comments)])),
        "",
        "## Client Pressure",
        mdTable(["Client", "Tasks", "Overdue", "Pressure"], topClients.map(c => [c.name, String(c.tasks), String(c.overdue), pressureLabel(c.pressure)])),
        "",
        "## Creative Type Breakdown",
        types.map(([t, n]) => `- **${t}**: ${n} task${n !== 1 ? "s" : ""}`).join("\n"),
        "",
        `## Total ASINs In Flight: ${Math.round(totalAsins)}`,
        "",
        ...(flags.length ? ["## Flags", ...flags.map(f => `- ${f}`)] : ["## No critical flags"]),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: truncate(report) }],
        structuredContent: {
          summary_date: TODAY,
          window_days: windowDays,
          total_edits: totalEdits,
          total_comments: totalComments,
          open_tasks: tasks.length,
          overdue_tasks: overdueTasks.length,
          top_designers: designers,
          top_clients: topClients,
          creative_types: types,
          total_asins: Math.round(totalAsins),
          flags,
        },
      };
    }
  );
}
