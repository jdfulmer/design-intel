// mcp/src/tools/asana-tools.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAsanaTasks, getAsanaProjects, getClientProjects, isOverdue, getCustomField, getCustomFieldNumber,
} from "../services/asana.js";
import { truncate, fmt, fmtDate, mdTable } from "../services/format.js";

const TODAY = new Date().toISOString().slice(0, 10);

export function registerAsanaTools(server: McpServer): void {

  // ── asana_get_tasks ───────────────────────────────────────────────────────
  server.registerTool(
    "asana_get_tasks",
    {
      title: "Get Asana Tasks",
      description: `Fetch open tasks from the Asana workspace with optional filters.
Only returns incomplete tasks by default (completed_since=now).

Args:
  - project_name (string, optional): Filter to tasks in a project matching this name.
  - assignee_name (string, optional): Filter to tasks assigned to this person.
  - overdue_only (boolean, optional): Only return tasks past their due date. Default false.
  - modified_since (string, optional): ISO date — only tasks modified after this date.

Returns: Task list with name, assignee, due date, progress, client projects, creative type, ASIN count.`,
      inputSchema: z.object({
        project_name: z.string().optional()
          .describe("Filter by project name (partial match)"),
        assignee_name: z.string().optional()
          .describe("Filter by assignee name (partial match)"),
        overdue_only: z.boolean().optional().default(false)
          .describe("Only return overdue tasks"),
        modified_since: z.string().optional()
          .describe("ISO date YYYY-MM-DD — only return tasks modified after this"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ project_name, assignee_name, overdue_only, modified_since }) => {
      let tasks = await getAsanaTasks({ modifiedSince: modified_since });

      if (project_name) {
        tasks = tasks.filter(t =>
          t.projects.some(p => p.name.toLowerCase().includes(project_name.toLowerCase()))
        );
      }
      if (assignee_name) {
        tasks = tasks.filter(t =>
          (t.assignee?.name ?? "").toLowerCase().includes(assignee_name.toLowerCase())
        );
      }
      if (overdue_only) {
        tasks = tasks.filter(t => isOverdue(t, TODAY));
      }

      if (!tasks.length) {
        return { content: [{ type: "text" as const, text: "No tasks found matching these filters." }] };
      }

      const rows = tasks.map(t => [
        t.name.slice(0, 50),
        t.assignee?.name ?? "Unassigned",
        t.due_on ?? "—",
        getCustomField(t, "Task Progress") ?? "—",
        getClientProjects(t).join(", ") || "—",
        getCustomField(t, "Type of Creative") ?? "—",
        String(getCustomFieldNumber(t, "Total # of ASINs") ?? "—"),
      ]);

      const text = truncate(
        `## Asana Tasks (${fmt(tasks.length)} results)\n\n` +
        mdTable(["Task", "Assignee", "Due", "Progress", "Client", "Type", "ASINs"], rows)
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { total: tasks.length, tasks },
      };
    }
  );

  // ── asana_get_overdue ─────────────────────────────────────────────────────
  server.registerTool(
    "asana_get_overdue",
    {
      title: "Get Overdue Tasks",
      description: `Fetch all overdue open tasks — tasks where due_on < today and not completed.
Sorted by most overdue first.

Args:
  - assignee_name (string, optional): Filter to one assignee.

Returns: Overdue task list with name, assignee, due date, days overdue, client, creative type.`,
      inputSchema: z.object({
        assignee_name: z.string().optional()
          .describe("Filter to a specific assignee"),
      }).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ assignee_name }) => {
      let tasks = await getAsanaTasks();
      tasks = tasks.filter(t => isOverdue(t, TODAY));

      if (assignee_name) {
        tasks = tasks.filter(t =>
          (t.assignee?.name ?? "").toLowerCase().includes(assignee_name.toLowerCase())
        );
      }

      tasks.sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));

      if (!tasks.length) {
        return { content: [{ type: "text" as const, text: "No overdue tasks found." }] };
      }

      const rows = tasks.map(t => {
        const daysOverdue = t.due_on
          ? Math.floor((Date.now() - new Date(t.due_on).getTime()) / 86400000)
          : "?";
        return [
          t.name.slice(0, 48),
          t.assignee?.name ?? "—",
          t.due_on ?? "—",
          String(daysOverdue),
          getClientProjects(t).join(", ") || "—",
          getCustomField(t, "Type of Creative") ?? "—",
        ];
      });

      const text = truncate(
        `## Overdue Tasks (${fmt(tasks.length)})\n\n` +
        mdTable(["Task", "Assignee", "Due", "Days Over", "Client", "Type"], rows)
      );

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { total: tasks.length, tasks },
      };
    }
  );

  // ── asana_get_projects ────────────────────────────────────────────────────
  server.registerTool(
    "asana_get_projects",
    {
      title: "List Asana Projects",
      description: `List all projects in the Asana workspace.
Useful for finding project names and GIDs for use with other tools.`,
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const projects = await getAsanaProjects();
      const rows = projects.map(p => [p.gid, p.name]);
      const text = truncate(
        `## Asana Projects (${projects.length})\n\n` +
        mdTable(["GID", "Name"], rows)
      );
      return {
        content: [{ type: "text" as const, text }],
        structuredContent: { projects },
      };
    }
  );
}
