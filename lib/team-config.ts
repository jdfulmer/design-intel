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

/** Get all team member Asana names involved in a task (assignee + followers) */
export function getTeamMembers(task: { assignee: { name: string } | null; followers?: Array<{ name: string }> }): string[] {
  const names: string[] = [];
  if (task.assignee && TEAM_ASANA_NAMES.has(task.assignee.name)) {
    names.push(task.assignee.name);
  }
  for (const f of task.followers ?? []) {
    if (TEAM_ASANA_NAMES.has(f.name) && !names.includes(f.name)) {
      names.push(f.name);
    }
  }
  return names;
}

/** Check if any team member is involved in a task (assigned or collaborating) */
export function isTeamInvolved(task: { assignee: { name: string } | null; followers?: Array<{ name: string }> }): boolean {
  if (task.assignee && TEAM_ASANA_NAMES.has(task.assignee.name)) return true;
  for (const f of task.followers ?? []) {
    if (TEAM_ASANA_NAMES.has(f.name)) return true;
  }
  return false;
}

/** Projects to exclude from client metrics */
export const NON_CLIENT_PROJECTS = new Set(["Creative Intake", "Creative Tasks", "General Tasks"]);

// ── Client (Asana) <-> Figma project-name matching ───────────────────────────
//
// Asana client/project names and Figma folder names rarely match exactly. The
// shop names projects "Brand + Channel" ("LaVanilla Amazon"), while the Figma
// folder might be "Amazon - LaVanilla" or just "LaVanilla". Raw substring
// matching misses these. We compare normalized TOKEN SETS instead, and require a
// shared *distinctive* (non-channel) token so two different brands on the same
// channel ("LaVanilla Amazon" vs "BrandX Amazon") never collapse together.

/** Channel/format words too generic to match clients on by themselves. */
const GENERIC_PROJECT_TOKENS = new Set([
  "amazon", "walmart", "target", "etsy", "shopify", "ebay", "tiktok", "instagram",
  "web", "website", "site", "social", "email", "ad", "ads", "advertising",
  "campaign", "creative", "design", "designs", "assets", "asset", "brand",
  "branding", "content", "marketing", "general", "misc", "q1", "q2", "q3", "q4",
  "2024", "2025", "2026", "the", "and", "for", "of",
]);

/**
 * Explicit overrides for clients whose Figma folder the token matcher can't
 * infer (codenames, abbreviations, genuinely ambiguous names). Map an Asana
 * client name to one or more Figma project-name fragments. Leave empty unless
 * you spot a specific mismatch — token matching handles the common
 * "Brand + Channel" cases on its own.
 */
export const CLIENT_FIGMA_ALIASES: Record<string, string[]> = {
  // Skacel distributes the HiKoo yarn and addi needle lines.
  "Skacel": ["Hikoo", "Addi Needles"],
  // Warner Bros franchises tracked as separate Figma folders.
  "Warner Brothers - Discovery": ["DC Comics", "Lord of the Rings", "Wizarding World"],
};

function normalizeTokens(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // split camelCase: "ThisWorks" -> "This Works"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isSubset(small: string[], large: Set<string>): boolean {
  return small.every((t) => large.has(t));
}

/**
 * Does a Figma project/folder name refer to the same client as an Asana project
 * name? Order- and punctuation-insensitive; guards against matching on channel
 * words alone; honors CLIENT_FIGMA_ALIASES overrides.
 */
export function clientMatchesFigmaProject(clientName: string, figmaProject: string): boolean {
  if (!clientName || !figmaProject) return false;

  const clientTokens = normalizeTokens(clientName);
  const figmaTokens = normalizeTokens(figmaProject);
  if (clientTokens.length === 0 || figmaTokens.length === 0) return false;

  const figmaSet = new Set(figmaTokens);

  // 1) Explicit alias overrides — match if the Figma name contains any alias.
  const aliases = CLIENT_FIGMA_ALIASES[clientName];
  if (aliases) {
    for (const alias of aliases) {
      const aliasTokens = normalizeTokens(alias);
      if (aliasTokens.length > 0 && isSubset(aliasTokens, figmaSet)) return true;
    }
  }

  // 2) Token-set match: one set is a subset of the other (order/punctuation
  //    insensitive), AND they share at least one distinctive (non-channel)
  //    token so "LaVanilla Amazon" and "BrandX Amazon" never merge.
  const clientSet = new Set(clientTokens);
  const subset = isSubset(clientTokens, figmaSet) || isSubset(figmaTokens, clientSet);
  if (!subset) return false;

  return clientTokens.some((t) => figmaSet.has(t) && !GENERIC_PROJECT_TOKENS.has(t));
}
