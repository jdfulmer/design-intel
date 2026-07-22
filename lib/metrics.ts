/* Simple math you can actually explain. */

/** Client Pressure Index: tasks + overdue×3 − min(edits×0.3, tasks) */
export function pressureIndex(tasks: number, overdue: number, edits: number): number {
  return Math.round(tasks + overdue * 3 - Math.min(edits * 0.3, tasks));
}

/** Activity Score: edits×3 + comments×2 + files×2 + projects×3 */
export function activityScore(edits: number, comments: number, files: number, projects: number): number {
  return edits * 3 + comments * 2 + files * 2 + projects * 3;
}

/** File Heat: edits×3 + comments */
export function fileHeat(edits: number, comments: number): number {
  return edits * 3 + comments;
}

/** Health Score (0–100): on-time weighted 40, cycle-time 30, velocity 30 */
export function healthScore(onTimePct: number, cycleScore: number, velocityScore: number): number {
  return Math.round(onTimePct * 0.4 + cycleScore * 0.3 + velocityScore * 0.3);
}

/** Efficiency: edits ÷ active tasks */
export function efficiency(edits: number, active: number): number {
  return active === 0 ? 0 : Math.round((edits / active) * 10) / 10;
}

export function pressureBand(pi: number): "High" | "Med" | "Low" {
  if (pi >= 10) return "High";
  if (pi >= 5) return "Med";
  return "Low";
}

/** Cold deadline banding — the flag designers actually asked for. */
export function coldBand(daysToDue: number, quietDays: number, started: boolean, hasFile: boolean, suppressed: boolean) {
  if (!hasFile) return "Needs link";
  if (suppressed) return null; // status In Review+, recent checkpoint, or acknowledged
  if (daysToDue <= 2 && quietDays >= 5 && !started) return "Critical";
  if (daysToDue <= 5 && quietDays >= 7) return "High";
  if (daysToDue <= 7 && quietDays >= 5) return "Watch";
  return null;
}
