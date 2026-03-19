// mcp/src/constants.ts

export const FIGMA_API = "https://api.figma.com/v1";
export const ASANA_API = "https://app.asana.com/api/1.0";

// Maps Asana full names → Figma display names (design team only)
// SOURCE OF TRUTH: lib/team-config.ts — keep in sync
export const ASANA_TO_FIGMA: Record<string, string> = {
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

// Reverse: Figma name → Asana full name
export const FIGMA_TO_ASANA: Record<string, string> = Object.fromEntries(
  Object.entries(ASANA_TO_FIGMA).map(([a, f]) => [f, a])
);

// Asana project names that are intake/workflow boards, not client names
// SOURCE OF TRUTH: lib/team-config.ts — keep in sync
export const NON_CLIENT_PROJECTS = new Set([
  "Creative Intake",
  "Creative Tasks",
  "General Tasks",
]);

export const MAX_RESPONSE_CHARS = 8000;
