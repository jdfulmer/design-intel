// lib/asana.ts — Asana Tasks API client

import { z } from 'zod';

export interface AsanaTask {
  gid: string;
  name: string;
  assignee: { gid: string; name: string } | null;
  due_on: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  modified_at: string;
  projects: Array<{ gid: string; name: string }>;
  memberships: Array<{ section: { gid: string; name: string } | null }>;
  custom_fields: AsanaCustomField[];
  parent: { gid: string; name: string } | null;
  dependencies: Array<{ gid: string }>;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  display_value: string | null;
  type: string;
  number_value?: number | null;
  text_value?: string | null;
  enum_value?: { gid: string; name: string } | null;
}

const ASANA_API = "https://app.asana.com/api/1.0";

// Fields to request — keeps responses lean
const TASK_FIELDS = [
  "gid", "name", "assignee.name", "assignee.gid",
  "due_on", "completed", "completed_at",
  "created_at", "modified_at",
  "projects.name", "projects.gid",
  "memberships.section.name",
  "custom_fields.name", "custom_fields.display_value",
  "custom_fields.type", "custom_fields.number_value",
  "custom_fields.text_value", "custom_fields.enum_value.name",
  "parent.name", "parent.gid",
  "dependencies.gid",
].join(",");

const AsanaTasksResponse = z.object({
  data: z.array(z.any()).default([]),
  next_page: z.union([z.object({ offset: z.string() }), z.null()]).optional(),
});

function headers(): HeadersInit {
  const pat = process.env.ASANA_PAT;
  if (!pat) throw new Error("ASANA_PAT is not set");
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/json",
  };
}

/**
 * Fetch all tasks in the workspace, with optional filters.
 * Handles Asana cursor-based pagination automatically.
 */
export async function fetchAsanaTasks(options: {
  modifiedSince?: string; // ISO date string — only tasks modified after this
  projectGid?: string;    // filter to a specific project
  assigneeGid?: string;   // filter to a specific assignee
  completedSince?: string; // "now" excludes completed, ISO date for since
  maxResults?: number;     // cap on total results (default 1000)
} = {}): Promise<AsanaTask[]> {
  const workspace = process.env.ASANA_WORKSPACE_GID;
  if (!workspace) throw new Error("ASANA_WORKSPACE_GID is not set");

  // Asana /tasks requires project, section, or assignee+workspace.
  // If no project or assignee specified, fetch all projects and aggregate.
  if (!options.projectGid && !options.assigneeGid) {
    const projects = await fetchAsanaProjects();
    const seen = new Set<string>();
    const allTasks: AsanaTask[] = [];
    for (const project of projects) {
      const tasks = await fetchAsanaTasks({ ...options, projectGid: project.gid });
      for (const t of tasks) {
        if (!seen.has(t.gid)) {
          seen.add(t.gid);
          allTasks.push(t);
        }
      }
    }
    return allTasks;
  }

  const maxResults = options.maxResults ?? 1000;
  const tasks: AsanaTask[] = [];
  let offset: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      opt_fields: TASK_FIELDS,
      limit: "100",
      completed_since: options.completedSince ?? "now", // exclude completed by default
    });

    if (options.projectGid)    params.set("project", options.projectGid);
    if (options.assigneeGid) {
      params.set("assignee", options.assigneeGid);
      params.set("workspace", workspace);
    }
    if (options.modifiedSince) params.set("modified_since", options.modifiedSince);
    if (offset)                params.set("offset", offset);

    const res = await fetch(`${ASANA_API}/tasks?${params}`, {
      headers: headers(),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Asana API error ${res.status}: ${body}`);
    }

    const raw = await res.json();
    const parsed = AsanaTasksResponse.safeParse(raw);

    if (!parsed.success) {
      console.warn('[asana] Response validation failed, returning empty array:', parsed.error.message);
      return [];
    }

    tasks.push(...parsed.data.data);

    if (tasks.length >= maxResults) {
      console.warn(`[asana] Reached maxResults cap (${maxResults}), stopping pagination`);
      break;
    }

    if (parsed.data.next_page?.offset) {
      offset = parsed.data.next_page.offset;
    } else {
      hasMore = false;
    }
  }

  return tasks;
}

/**
 * Fetch all projects in the workspace.
 */
export async function fetchAsanaProjects(): Promise<Array<{ gid: string; name: string }>> {
  const workspace = process.env.ASANA_WORKSPACE_GID;
  if (!workspace) throw new Error("ASANA_WORKSPACE_GID is not set");

  const res = await fetch(
    `${ASANA_API}/projects?workspace=${workspace}&opt_fields=gid,name&limit=100`,
    { headers: headers() }
  );

  if (!res.ok) throw new Error(`Asana projects error ${res.status}: ${await res.text()}`);
  const data: { data: Array<{ gid: string; name: string }> } = await res.json();
  return data.data;
}

/**
 * Helper: extract a custom field value by name from a task.
 */
export function getCustomField(task: AsanaTask, fieldName: string): string | null {
  const field = task.custom_fields.find(
    (f) => f.name.toLowerCase() === fieldName.toLowerCase()
  );
  if (!field) return null;
  return field.display_value ?? field.text_value ?? field.enum_value?.name ?? null;
}

/**
 * Helper: extract numeric custom field value by name.
 */
export function getCustomFieldNumber(task: AsanaTask, fieldName: string): number | null {
  const field = task.custom_fields.find(
    (f) => f.name.toLowerCase() === fieldName.toLowerCase()
  );
  return field?.number_value ?? null;
}
