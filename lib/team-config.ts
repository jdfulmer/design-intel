// lib/team-config.ts — Single source of truth for team name mappings
// Used by: app/dashboard.tsx, app/api/figma/sync/route.ts
// Mirrored in: mcp/src/constants.ts (keep in sync manually — separate build)

/**
 * Asana display name -> Figma display name mapping.
 * Update this when team members join, leave, or change display names.
 */
export const DESIGN_TEAM: Record<string, string> = {
  "Joshua Fulmer":      "Joshua Fulmer",
  "Nicole Howard":      "Nicole Howard",
  "Vince Herrera":      "Vincent Herrera",
  "Abigail Roxas":      "Abigail Roxas",
  "Bianca Louise Gran": "Bianca",
  "Bianca Gran":        "Bianca",
  "Dannah Gorospe":     "dannah",
  "Enisa Celik":        "enisa",
  "Kitz MR Amago":      "Kitz",
  "Kitz Amago":         "Kitz",
  "Ricardo Rodriguez":  "Ricardo",
  "Rogerio Mitri":      "Roger Mitri",
  "Roger Mitri":        "Roger Mitri",
  "Ruth Quintana":      "Ruth",
  "Ryann Bautista":     "Ryann",
  "Ryann Christian":    "Ryann",
};

export const TEAM_FIGMA_NAMES = new Set(Object.values(DESIGN_TEAM));
export const TEAM_ASANA_NAMES = new Set(Object.keys(DESIGN_TEAM));

/** Asana -> Figma name lookup */
export function toFigmaName(asanaName: string): string {
  return DESIGN_TEAM[asanaName] ?? asanaName;
}

/** Figma -> Asana name lookup */
export function toAsanaName(figmaName: string): string {
  const entry = Object.entries(DESIGN_TEAM).find(([, fig]) => fig === figmaName);
  return entry ? entry[0] : figmaName;
}

/** Projects to exclude from client metrics */
export const NON_CLIENT_PROJECTS = new Set(["Creative Intake", "Creative Tasks", "General Tasks"]);
