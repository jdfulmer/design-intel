// mcp/src/tools/intel-tools.ts — Cross-system intelligence tools

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFigmaActivity, aggregateByActor, designerScore } from "../services/figma.js";
import { getAsanaTasks, getClientProjects, isOverdue, getCustomField, getCustomFieldNumber } from "../services/asana.js";
import { ASANA_TO_FIGMA } from "../constants.js";
import { truncate, fmt, fmtRatio, mdTable, pressureLabel, efficiencyLabel } from "../services/format.js";

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_DAYS = 30;

function defaultFigmaRange() {
  const now = Math.floor(Date.now() / 1000);
  return { startTime: now - DEFAULT_DAYS * 86400, endTime: now };
}

export function registerIntelTools(server: McpServer): void {

  // ── intel_client_pressure ──────────────────────────────────────────────────
  server.registerTool(
    "intel_client_pressure",
    {
      title: "Client Pressure Index",
      description: `Cross-reference Asana task load vs Figma export output per client.
Pressure score = open tasks + overdue×3 − min(exports×0.5, tasks).
High pressure = many tasks, few exports. Low pressure = exports flowing.

Args:
  - client_name (string, optional): Focus on one client (partial name match).
  - figma_days (number, optional): Days of Figma history to use. Default 30.

Returns: Ranked client table with task count, overdue, Figma exports, pressure score, and level.`,
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
      const [tasks, events] = await Promise.all([
        getAsanaTasks(),
        getFigmaActivity(now - days * 86400, now),
      ]);

      // Build client map from Asana
      const clientMap: Record<string, { tasks: number; overdue: number; inProgress: number; designers: Set<string> }> = {};
      for (const task of tasks) {
        const clients = getClientProjects(task);
        for (const c of clients) {
          clientMap[c] ??= { tasks: 0, overdue: 0, inProgress: 0, designers: new Set() };
          clientMap[c].tasks++;
          if (isOverdue(task, TODAY)) clientMap[c].overdue++;
          if (getCustomField(task, "Task Progress") === "In Progress") clientMap[c].inProgress++;
          const figmaName = ASANA_TO_FIGMA[task.assignee?.name ?? ""] ?? task.assignee?.name ?? "";
          if (figmaName) clientMap[c].designers.add(figmaName);
        }
      }

      // Tally Figma exports per team name (partial match)
      const exportsByTeam: Record<string, number> = {};
      for (const e of events) {
        if (e.event_type !== "fig_file_export") continue;
        const team = (e.details as Record<string, string> | undefined)?.team_name ?? "";
        if (team) exportsByTeam[team] = (exportsByTeam[team] ?? 0) + 1;
      }

      // Merge Figma exports into client map
      const rows = Object.entries(clientMap).map(([name, c]) => {
        const figmaExports = Object.entries(exportsByTeam)
          .filter(([t]) => t.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(t.toLowerCase()))
          .reduce((sum, [, v]) => sum + v, 0);
        const pressureScore = c.tasks + c.overdue * 3 - Math.min(figmaExports * 0.5, c.tasks);
        return { name, ...c, designerCount: c.designers.size, figmaExports, pressureScore };
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
        String(r.figmaExports),
        String(r.designerCount),
        `${Math.round(r.pressureScore)}  ${pressureLabel(r.pressureScore)}`,
      ]);

      const text = truncate(
        `## Client Pressure Index (last ${days} days of Figma)\n\n` +
        mdTable(["Client", "Tasks", "Overdue", "Active", "Exports", "Designers", "Pressure"], tableRows)
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
      description: `Compare each designer's Asana task load against their Figma output score.
Efficiency = Figma exports ÷ active Asana tasks (exports per task).
Flags HIGH LOAD (8+ active tasks, <20 exports) and HIGH THRU (efficiency >3).

Args:
  - designer_name (string, optional): Focus on one designer.
  - figma_days (number, optional): Days of Figma history. Default 30.

Returns: Per-designer table with active tasks, overdue, Figma score, exports, efficiency.`,
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
      const [tasks, events] = await Promise.all([
        getAsanaTasks(),
        getFigmaActivity(now - days * 86400, now),
      ]);

      const figmaByActor = aggregateByActor(events);

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
      const allNames = new Set([...Object.keys(figmaByActor), ...Object.keys(taskMap)]);
      let rows = [...allNames].map(name => {
        const f = figmaByActor[name] ?? { exports: 0, views: 0, creates: 0, files: new Set(), teams: new Set() };
        const a = taskMap[name] ?? { active: 0, overdue: 0, clients: new Set() };
        const score = designerScore({ exports: f.exports, views: f.views, creates: f.creates, fileCount: f.files.size, teamCount: f.teams.size });
        const efficiency: number | null = a.active > 0 ? parseFloat((f.exports / a.active).toFixed(1)) : null;
        const highLoad = a.active >= 8 && f.exports < 20;
        const highThru = efficiency !== null && efficiency > 3;
        return { name, figmaScore: score, exports: f.exports, active: a.active, overdue: a.overdue, efficiency, highLoad, highThru, clientCount: a.clients.size };
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
        fmt(r.exports),
        fmtRatio(r.efficiency),
        efficiencyLabel(r.efficiency) + (r.highLoad ? " ⚠ HIGH LOAD" : "") + (r.highThru ? " ⚡" : ""),
      ]);

      const text = truncate(
        `## Designer Workload Balance (last ${days} days)\n\n` +
        mdTable(["Designer", "Active Tasks", "Overdue", "Figma Score", "Exports", "Efficiency", "Status"], tableRows)
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
- Overdue tasks with Figma activity status
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
      const [tasks, events] = await Promise.all([
        getAsanaTasks(),
        getFigmaActivity(now - windowDays * 86400, now),
      ]);

      const figmaByActor = aggregateByActor(events);
      const overdueTasks = tasks.filter(t => isOverdue(t, TODAY));

      // ── Top designers ──
      const designers = Object.entries(figmaByActor)
        .map(([name, s]) => ({
          name,
          score: designerScore({ exports: s.exports, views: s.views, creates: s.creates, fileCount: s.files.size, teamCount: s.teams.size }),
          exports: s.exports,
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
      for (const [name, s] of Object.entries(figmaByActor)) {
        const taskStats = (() => {
          const figmaName = name;
          let active = 0;
          for (const t of tasks) {
            const fn = ASANA_TO_FIGMA[t.assignee?.name ?? ""] ?? t.assignee?.name ?? "";
            if (fn === figmaName) active++;
          }
          return active;
        })();
        if (taskStats >= 8 && s.exports < 20) {
          flags.push(`⚠ ${name} has ${taskStats} tasks but only ${s.exports} exports this period`);
        }
      }

      // ── Total ASIN count ──
      const totalAsins = tasks.reduce((sum, t) => sum + (getCustomFieldNumber(t, "Total # of ASINs") ?? 0), 0);

      const report = [
        `# Design Ops Brief — ${TODAY}`,
        `_Last ${windowDays} days of Figma · ${tasks.length} open Asana tasks · ${fmt(events.length)} Figma events_`,
        "",
        "## 🎨 Top Designers This Period",
        mdTable(["Designer", "Score", "Exports"], designers.map(d => [d.name, String(d.score), fmt(d.exports)])),
        "",
        "## 🔥 Client Pressure",
        mdTable(["Client", "Tasks", "Overdue", "Pressure"], topClients.map(c => [c.name, String(c.tasks), String(c.overdue), pressureLabel(c.pressure)])),
        "",
        "## 🛠 Creative Type Breakdown",
        types.map(([t, n]) => `- **${t}**: ${n} task${n !== 1 ? "s" : ""}`).join("\n"),
        "",
        `## 📦 Total ASINs In Flight: ${Math.round(totalAsins)}`,
        "",
        ...(flags.length ? ["## 🚨 Flags", ...flags.map(f => `- ${f}`)] : ["## ✅ No critical flags"]),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: truncate(report) }],
        structuredContent: {
          summary_date: TODAY,
          window_days: windowDays,
          figma_events: events.length,
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
