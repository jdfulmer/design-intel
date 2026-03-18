// lib/figma.ts — Figma REST API client (standard endpoints, PAT auth)

export interface FigmaProject {
  id: string;
  name: string;
}

export interface FigmaFileInfo {
  key: string;
  name: string;
  last_modified: string;
  thumbnail_url?: string;
}

export interface FigmaVersion {
  id: string;
  created_at: string;
  label: string;
  description: string;
  user: { id: string; handle: string; img_url: string };
}

export interface FigmaComment {
  id: string;
  created_at: string;
  message: string;
  user: { id: string; handle: string; img_url: string };
}

export interface FigmaDesignerActivity {
  name: string;
  edits: number;
  comments: number;
  files: string[];
  projects: string[];
}

const FIGMA_API = "https://api.figma.com/v1";
const REQUEST_DELAY_MS = 3200; // ~18 requests/min — stays under Figma's 20/min limit
const MAX_FILES = 50;

function getToken(): string {
  const token = process.env.FIGMA_PAT;
  if (!token) throw new Error("FIGMA_PAT is not set");
  return token;
}

function getTeamIds(): string[] {
  const ids = process.env.FIGMA_TEAM_IDS;
  if (!ids) throw new Error("FIGMA_TEAM_IDS is not set");
  return ids.split(",").map((id) => id.trim()).filter(Boolean);
}

async function figmaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    headers: { "X-Figma-Token": getToken() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status}: ${body}`);
  }
  return res.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchTeamProjects(teamId: string): Promise<FigmaProject[]> {
  const data = await figmaFetch<{ projects: FigmaProject[] }>(
    `/teams/${teamId}/projects`
  );
  return data.projects;
}

export async function fetchProjectFiles(
  projectId: string
): Promise<FigmaFileInfo[]> {
  const data = await figmaFetch<{
    files: Array<{
      key: string;
      name: string;
      last_modified: string;
      thumbnail_url?: string;
    }>;
  }>(`/projects/${projectId}/files`);
  return data.files;
}

export async function fetchFileVersions(
  fileKey: string
): Promise<FigmaVersion[]> {
  const data = await figmaFetch<{
    versions: FigmaVersion[];
  }>(`/files/${fileKey}/versions`);
  return data.versions;
}

export async function fetchFileComments(
  fileKey: string
): Promise<FigmaComment[]> {
  const data = await figmaFetch<{
    comments: FigmaComment[];
  }>(`/files/${fileKey}/comments`);
  return data.comments;
}

/**
 * Crawl team hierarchy and aggregate designer activity within a date range.
 * startTime/endTime are Unix timestamps (seconds).
 */
export async function fetchTeamActivity(
  startTime: number,
  endTime: number
): Promise<FigmaDesignerActivity[]> {
  const startDate = new Date(startTime * 1000);
  const endDate = new Date(endTime * 1000);

  // Step 1: Get all projects across all teams
  const teamIds = getTeamIds();
  const projects: FigmaProject[] = [];
  for (const teamId of teamIds) {
    const teamProjects = await fetchTeamProjects(teamId);
    projects.push(...teamProjects);
    await delay(REQUEST_DELAY_MS);
  }

  // Step 2: Get all files across projects, sorted by last_modified desc
  const fileProjectMap: Map<string, { file: FigmaFileInfo; projectName: string }> = new Map();
  for (const project of projects) {
    const files = await fetchProjectFiles(project.id);
    for (const file of files) {
      if (!fileProjectMap.has(file.key)) {
        fileProjectMap.set(file.key, { file, projectName: project.name });
      }
    }
    await delay(REQUEST_DELAY_MS);
  }

  // Only include files modified within the date range, sorted by recency, capped
  const allFiles = Array.from(fileProjectMap.entries())
    .filter(([, { file }]) => new Date(file.last_modified) >= startDate)
    .sort((a, b) => new Date(b[1].file.last_modified).getTime() - new Date(a[1].file.last_modified).getTime())
    .slice(0, MAX_FILES);

  // Step 3: Fetch versions and comments for each file
  const designerMap: Map<string, {
    edits: number;
    comments: number;
    files: Set<string>;
    projects: Set<string>;
  }> = new Map();

  function getOrCreate(name: string) {
    let entry = designerMap.get(name);
    if (!entry) {
      entry = { edits: 0, comments: 0, files: new Set(), projects: new Set() };
      designerMap.set(name, entry);
    }
    return entry;
  }

  for (const [fileKey, { file, projectName }] of allFiles) {
    // Fetch versions
    const versions = await fetchFileVersions(fileKey);
    await delay(REQUEST_DELAY_MS);

    for (const v of versions) {
      const vDate = new Date(v.created_at);
      if (vDate >= startDate && vDate <= endDate) {
        const entry = getOrCreate(v.user.handle);
        entry.edits++;
        entry.files.add(file.name);
        entry.projects.add(projectName);
      }
    }

    // Fetch comments
    const comments = await fetchFileComments(fileKey);
    await delay(REQUEST_DELAY_MS);

    for (const c of comments) {
      const cDate = new Date(c.created_at);
      if (cDate >= startDate && cDate <= endDate) {
        const entry = getOrCreate(c.user.handle);
        entry.comments++;
        entry.files.add(file.name);
        entry.projects.add(projectName);
      }
    }
  }

  // Convert to array
  return Array.from(designerMap.entries()).map(([name, data]) => ({
    name,
    edits: data.edits,
    comments: data.comments,
    files: Array.from(data.files),
    projects: Array.from(data.projects),
  }));
}
