// lib/metrics.ts — Pure metric functions for delivery analytics
// Used by both client (dashboard) and server (sync snapshot generation)

export interface WeeklySnapshot {
  weekOf: string; // "2026-03-16" (Monday)
  generatedAt: string;
  team: {
    totalEdits: number;
    totalComments: number;
    tasksCompleted: number;
    tasksCreated: number;
    avgCycleTimeDays: number | null;
    onTimeRate: number | null; // 0-1
    overdueCount: number;
    activeTaskCount: number;
  };
  designers: Array<{
    name: string;
    edits: number;
    comments: number;
    tasksCompleted: number;
    tasksActive: number;
    avgCycleTimeDays: number | null;
  }>;
  clients: Array<{
    name: string;
    tasks: number;
    completed: number;
    overdue: number;
    edits: number;
  }>;
}

// ── Cycle Time ───────────────────────────────────────────────────────────────

/** Days between task creation and completion */
export function cycleTimeDays(createdAt: string, completedAt: string): number {
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

/** Average cycle time in days for tasks that have completed_at */
export function avgCycleTime(
  tasks: Array<{ created_at: string; completed_at: string | null }>
): number | null {
  const done = tasks.filter(
    (t): t is { created_at: string; completed_at: string } => !!t.completed_at
  );
  if (done.length === 0) return null;
  const total = done.reduce(
    (sum, t) => sum + cycleTimeDays(t.created_at, t.completed_at),
    0
  );
  return parseFloat((total / done.length).toFixed(1));
}

// ── On-Time Rate ─────────────────────────────────────────────────────────────

/** Fraction of completed tasks finished by their due date (0-1, null if no data) */
export function onTimeRate(
  tasks: Array<{ due_on: string | null; completed_at: string | null }>
): number | null {
  const withDue = tasks.filter((t) => t.completed_at && t.due_on);
  if (withDue.length === 0) return null;
  const onTime = withDue.filter((t) => {
    const doneDate = new Date(t.completed_at!).toISOString().slice(0, 10);
    return doneDate <= t.due_on!;
  });
  return parseFloat((onTime.length / withDue.length).toFixed(2));
}

// ── Throughput ────────────────────────────────────────────────────────────────

/** Count of tasks completed */
export function throughput(
  tasks: Array<{ completed_at: string | null }>
): number {
  return tasks.filter((t) => t.completed_at).length;
}

// ── Health Score ──────────────────────────────────────────────────────────────

/**
 * Composite health score (0-100)
 *  - On-time %: 40pts (null → neutral 20)
 *  - Cycle time: 30pts (3d = 30, 14d+ = 0, null → neutral 15)
 *  - Velocity trend: 30pts (thisWeek/lastWeek ratio, null → neutral 15)
 */
export function healthScore(
  onTime: number | null,
  avgCycle: number | null,
  thisWeek: number,
  lastWeek: number
): number {
  const onTimePts = onTime !== null ? onTime * 40 : 20;

  const cyclePts =
    avgCycle !== null
      ? Math.max(0, 30 - ((Math.max(avgCycle, 3) - 3) / 11) * 30)
      : 15;

  let velPts = 15;
  if (lastWeek > 0) {
    velPts = Math.min(30, Math.max(0, (thisWeek / lastWeek) * 15));
  } else if (thisWeek > 0) {
    velPts = 25;
  }

  return Math.round(Math.min(100, Math.max(0, onTimePts + cyclePts + velPts)));
}

// ── Top Alert ────────────────────────────────────────────────────────────────

export function topAlert(
  overdueCount: number,
  highLoadDesigners: string[],
  highPressureClients: string[]
): { text: string; severity: "red" | "orange" | "green" } {
  if (overdueCount >= 5)
    return { text: `${overdueCount} tasks overdue`, severity: "red" };
  if (highLoadDesigners.length > 0)
    return {
      text: `${highLoadDesigners[0]} overloaded (${highLoadDesigners.length} total)`,
      severity: "red",
    };
  if (overdueCount > 0)
    return {
      text: `${overdueCount} task${overdueCount > 1 ? "s" : ""} overdue`,
      severity: "orange",
    };
  if (highPressureClients.length > 0)
    return { text: `${highPressureClients[0]} high pressure`, severity: "orange" };
  return { text: "All clear", severity: "green" };
}

// ── Week Helpers ──────────────────────────────────────────────────────────────

/** Get the Monday of the week for a given date */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a Date as YYYY-MM-DD */
export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
