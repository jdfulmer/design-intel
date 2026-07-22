export interface Designer {
  id: string; initials: string; name: string; color: string;
  projects: number; edits: number; comments: number; files: number;
  score: number; active: number; overdue: number;
  efficiency: string; cycle: string; flag: string | null;
  cap: [number, number];
}

export interface Client {
  id: string; initials: string; name: string;
  tasks: number; overdue: number; edits: number;
  pi: number; band: "High" | "Med" | "Low"; designers: number;
}

export interface HotFile {
  id: string; name: string; client: string;
  edits: number; comments: number; heat: number;
  contributors: { i: string; n: string; e: string }[];
  activity: { t: string; w: string }[];
}

export interface ColdDeadline {
  id: string; title: string; client: string; pri: "P0" | "P1" | "P2";
  band: "Critical" | "High" | "Watch" | "Needs link";
  chips: string[]; actions: string[];
}

export interface CoverageRow {
  proj: string; client: string; team: string[]; open: number;
  last: string; status: "Healthy" | "Going quiet" | "No coverage";
}

export interface Flag { t: string; d: string; sev: "Danger" | "Warn" | "Info" | "Ok"; entityRef?: { entityType: "client" | "designer"; entityId: string } }

export interface AskResponse {
  answer: string;
  tools: string[];
  entities: { initials: string; name: string; meta: string; tag?: string; tone?: string }[];
}
