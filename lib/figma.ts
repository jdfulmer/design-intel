/* Figma adapter — Phase 2.
   Reads version history, edits, and comments via the Figma REST API.
   Requires FIGMA_TOKEN + FIGMA_TEAM_ID. Falls back to the demo dataset when unset. */

const BASE = "https://api.figma.com/v1";

function headers() {
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw new Error("FIGMA_TOKEN is not set");
  return { "X-Figma-Token": token };
}

export const figmaConfigured = () => Boolean(process.env.FIGMA_TOKEN && process.env.FIGMA_TEAM_ID);

export async function getTeamProjects() {
  const res = await fetch(`${BASE}/teams/${process.env.FIGMA_TEAM_ID}/projects`, { headers: headers(), next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Figma projects: ${res.status}`);
  return res.json();
}

export async function getProjectFiles(projectId: string) {
  const res = await fetch(`${BASE}/projects/${projectId}/files`, { headers: headers(), next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Figma files: ${res.status}`);
  return res.json();
}

export async function getFileVersions(fileKey: string) {
  const res = await fetch(`${BASE}/files/${fileKey}/versions`, { headers: headers(), next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Figma versions: ${res.status}`);
  return res.json();
}

export async function getFileComments(fileKey: string) {
  const res = await fetch(`${BASE}/files/${fileKey}/comments`, { headers: headers(), next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Figma comments: ${res.status}`);
  return res.json();
}

/* TODO Phase 2: aggregate versions+comments per user per week into
   Designer.edits / .comments / .files, then run lib/metrics activityScore + fileHeat. */
