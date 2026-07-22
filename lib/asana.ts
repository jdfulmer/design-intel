/* Asana adapter — Phase 2.
   Reads tasks, assignees, and due dates. Requires ASANA_TOKEN + ASANA_WORKSPACE_GID.
   Falls back to the demo dataset when unset. */

const BASE = "https://app.asana.com/api/1.0";

function headers() {
  const token = process.env.ASANA_TOKEN;
  if (!token) throw new Error("ASANA_TOKEN is not set");
  return { Authorization: `Bearer ${token}` };
}

export const asanaConfigured = () => Boolean(process.env.ASANA_TOKEN && process.env.ASANA_WORKSPACE_GID);

export async function getProjects() {
  const res = await fetch(`${BASE}/projects?workspace=${process.env.ASANA_WORKSPACE_GID}&archived=false`, { headers: headers(), next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Asana projects: ${res.status}`);
  return res.json();
}

export async function getProjectTasks(projectGid: string) {
  const fields = "name,assignee.name,due_on,completed,completed_at,created_at,memberships.section.name";
  const res = await fetch(`${BASE}/tasks?project=${projectGid}&opt_fields=${fields}`, { headers: headers(), next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Asana tasks: ${res.status}`);
  return res.json();
}

/* TODO Phase 2: join tasks to Figma files by project mapping, compute overdue,
   cycle time (completed_at − created_at), and per-client pressureIndex from lib/metrics. */
