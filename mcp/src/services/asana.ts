// mcp/src/services/asana.ts — Asana Tasks API client

import { ASANA_API, NON_CLIENT_PROJECTS } from "../constants.js";
import type { AsanaTask, AsanaCustomField } from "../types.js";

const TASK_FIELDS = [
  "gid", "name", "assignee.name", "assignee.gid",
  "due_on", "completed", "completed_at",
  "created_at", "modified_at",
  "projects.name", "projects.gid",
  "memberships.section.name",
  "custom_fields.name", "custom_fields.display_value",
  "custom_fields.type", "custom_fields.number_value",
  "custom_fields.text_value", "custom_fields.enum_value.name",
  "parent.gid", "parent.name",
].join(",");

function headers(): HeadersInit {
  const pat = process.env.ASANA_PAT;
  if (!pat) throw new Error("ASANA_PAT is not set");
  return { Authorization: `Bearer ${pat}`, Accept: "application/json" };
}

function getWorkspace(): string {
  const ws = process.env.ASANA_WORKSPACE_GID;
  if (!ws) throw new Error("ASANA_WORKSPACE_GID is not set");
  return ws;
}

/**
 * Fetch tasks from the workspace, paginating automatically.
 */
export async function getAsanaTasks(options: {
  modifiedSince?: string;
  projectGid?: string;
  assigneeGid?: string;
  includeCompleted?: boolean;
} = {}): Promise<AsanaTask[]> {
  const workspace = getWorkspace();
  const tasks: AsanaTask[] = [];
  let offset: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      workspace,
      opt_fields: TASK_FIELDS,
      limit: "100",
    });

    if (!options.includeCompleted) params.set("completed_since", "now");
    if (options.modifiedSince)     params.set("modified_since", options.modifiedSince);
    if (options.projectGid)        params.set("project", options.projectGid);
    if (options.assigneeGid)       params.set("assignee", options.assigneeGid);
    if (offset)                    params.set("offset", offset);

    const res = await fetch(`${ASANA_API}/tasks?${params}`, { headers: headers() });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Asana API ${res.status}: ${body}`);
    }

    const data: { data: AsanaTask[]; next_page: { offset: string } | null } = await res.json();
    tasks.push(...data.data);
    offset = data.next_page?.offset;
    hasMore = !!offset;
  }

  return tasks;
}

/**
 * Fetch all workspace projects.
 */
export async function getAsanaProjects(): Promise<Array<{ gid: string; name: string }>> {
  const res = await fetch(
    `${ASANA_API}/projects?workspace=${getWorkspace()}&opt_fields=gid,name&limit=100`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Asana projects ${res.status}: ${await res.text()}`);
  const data: { data: Array<{ gid: string; name: string }> } = await res.json();
  return data.data;
}

/** Extract a custom field value by name from a task */
export function getCustomField(task: AsanaTask, fieldName: string): string | null {
  const f = task.custom_fields.find(
    (cf: AsanaCustomField) => cf.name.toLowerCase() === fieldName.toLowerCase()
  );
  if (!f) return null;
  return f.display_value ?? f.text_value ?? f.enum_value?.name ?? null;
}

/** Extract a numeric custom field value by name */
export function getCustomFieldNumber(task: AsanaTask, fieldName: string): number | null {
  const f = task.custom_fields.find(
    (cf: AsanaCustomField) => cf.name.toLowerCase() === fieldName.toLowerCase()
  );
  return f?.number_value ?? null;
}

/** Get client project names from a task (excluding intake/workflow boards) */
export function getClientProjects(task: AsanaTask): string[] {
  return task.projects
    .map(p => p.name)
    .filter(name => !NON_CLIENT_PROJECTS.has(name));
}

/** Returns true if a task is overdue relative to a reference date string (YYYY-MM-DD) */
export function isOverdue(task: AsanaTask, refDate: string): boolean {
  return !!task.due_on && task.due_on < refDate && !task.completed;
}

/** Group tasks by assignee Figma name */
export function groupByFigmaName(
  tasks: AsanaTask[],
  nameMap: Record<string, string>
): Record<string, AsanaTask[]> {
  const result: Record<string, AsanaTask[]> = {};
  for (const task of tasks) {
    const asanaName = task.assignee?.name ?? "";
    const figmaName = nameMap[asanaName] ?? asanaName;
    if (!figmaName) continue;
    (result[figmaName] ??= []).push(task);
  }
  return result;
}
