// mcp/src/types.ts — shared TypeScript interfaces

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
  file_key: string;
}

export interface FigmaDesignerActivity {
  name: string;
  edits: number;
  comments: number;
  files: string[];
  projects: string[];
}

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

export interface DesignerStats {
  name: string;
  figmaScore: number;
  edits: number;
  comments: number;
  fileCount: number;
  projectCount: number;
  taskTotal: number;
  taskActive: number;
  taskOverdue: number;
  efficiency: number | null; // edits per active task
}

export interface ClientPressure {
  name: string;
  tasks: number;
  overdue: number;
  inProgress: number;
  figmaEdits: number;
  designerCount: number;
  pressureScore: number;
}

export interface WorkloadSummary {
  designer: string;
  figmaScore: number;
  figmaEdits: number;
  taskActive: number;
  taskOverdue: number;
  efficiency: number | null;
  topClients: string[];
}
