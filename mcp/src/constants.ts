// mcp/src/constants.ts

export const FIGMA_API = "https://api.figma.com/v1";
export const ASANA_API = "https://app.asana.com/api/1.0";

// Maps Asana full names → Figma display names
// Keep in sync with the dashboard ASANA_TO_FIGMA map
export const ASANA_TO_FIGMA: Record<string, string> = {
  "Vince Herrera":      "Vincent Herrera",
  "Nicole Howard":      "Nicole Howard",
  "Bianca Louise Gran": "Bianca",
  "Enisa Celik":        "enisa",
  "Kitz MR Amago":      "Kitz",
  "Dannah Gorospe":     "dannah",
  "Ricardo Rodriguez":  "Ricardo",
  "Ryann Christian":    "Ryann",
  "Roger Mitri":        "Roger Mitri",
  "Donna Diego":        "Donna  Diego",
  "Joshua Fulmer":      "Joshua Fulmer",
};

// Reverse: Figma name → Asana full name
export const FIGMA_TO_ASANA: Record<string, string> = Object.fromEntries(
  Object.entries(ASANA_TO_FIGMA).map(([a, f]) => [f, a])
);

// Asana project names that are intake/workflow boards, not client names
export const NON_CLIENT_PROJECTS = new Set([
  "Creative Intake",
  "Creative Tasks",
  "General Tasks",
]);

// Figma events that indicate output (used for scoring)
export const OUTPUT_EVENTS = new Set([
  "fig_file_export",
  "fig_file_create",
]);

export const MAX_RESPONSE_CHARS = 8000;
