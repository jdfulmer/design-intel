// mcp/src/types.ts — shared TypeScript interfaces

export interface FigmaEvent {
  id: string;
  timestamp: string;
  event_type: string;
  actor: { id: string; name: string; email: string };
  entity?: { id: string; name: string; type: string };
  details?: Record<string, unknown>;
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
  exports: number;
  views: number;
  creates: number;
  fileCount: number;
  teamCount: number;
  taskTotal: number;
  taskActive: number;
  taskOverdue: number;
  efficiency: number | null; // exports per active task
}

export interface ClientPressure {
  name: string;
  tasks: number;
  overdue: number;
  inProgress: number;
  figmaExports: number;
  designerCount: number;
  pressureScore: number;
}

export interface WorkloadSummary {
  designer: string;
  figmaScore: number;
  figmaExports: number;
  taskActive: number;
  taskOverdue: number;
  efficiency: number | null;
  topClients: string[];
}
