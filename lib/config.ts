/* Live-data configuration.
   DESIGNERS: validated Asana <-> Figma identity map (9 designers).
   CLIENTS: drop the full client list here. Each entry name-matches against
   Asana project names AND Figma project/file names (case-insensitive, alias-aware).
   If CLIENTS is empty, every Asana project except EXCLUDED_PROJECTS becomes a client. */

export interface DesignerConfig {
  asana: string;      // exact Asana assignee name
  figma: string;      // Figma handle as it appears in version history / comments
  display: string;    // what the dashboard shows
  initials: string;
  color: string;
  capacity: number;   // healthy active-task ceiling
}

export const DESIGNERS: DesignerConfig[] = [
  { asana: "Vince Herrera",      figma: "Vincent Herrera", display: "Vincent Herrera", initials: "VH", color: "#14AE5C", capacity: 8 },
  { asana: "Nicole Howard",      figma: "Nicole Howard",   display: "Nicole Howard",   initials: "NH", color: "#0D99FF", capacity: 8 },
  { asana: "Bianca Louise Gran", figma: "Bianca",          display: "Bianca Gran",     initials: "BG", color: "#F24822", capacity: 8 },
  { asana: "Enisa Celik",        figma: "enisa",           display: "Enisa Celik",     initials: "EC", color: "#00A2C2", capacity: 8 },
  { asana: "Kitz MR Amago",      figma: "Kitz",            display: "Kitz Amago",      initials: "KA", color: "#FFA629", capacity: 8 },
  { asana: "Dannah Gorospe",     figma: "dannah",          display: "Dannah Gorospe",  initials: "DG", color: "#9747FF", capacity: 8 },
  { asana: "Ricardo Rodriguez",  figma: "Ricardo",         display: "Ricardo Rodriguez", initials: "RR", color: "#0D99FF", capacity: 8 },
  { asana: "Ryann Christian",    figma: "Ryann",           display: "Ryann Christian", initials: "RC", color: "#14AE5C", capacity: 8 },
  { asana: "Roger Mitri",        figma: "Roger Mitri",     display: "Roger Mitri",     initials: "RM", color: "#9747FF", capacity: 8 },
];

export interface ClientConfig {
  name: string;       // display name
  aliases?: string[]; // additional strings that identify this client in Asana/Figma names
}

/* PASTE THE FULL CLIENT LIST HERE. Seeded with the clients already validated
   in the Asana <-> Figma cross-reference. */
export const CLIENTS: ClientConfig[] = [
  { name: "SLIP" },
  { name: "Skacel" },
  { name: "Roebic" },
  { name: "A La Maison", aliases: ["ALM"] },
  { name: "Donnamax" },
  { name: "Warner Bros. Discovery", aliases: ["Warner Brothers - Discovery", "WBD", "Warner"] },
  { name: "Art Brand Studios", aliases: ["ABS"] },
];

/* Asana projects that are workflow lanes, not clients. */
export const EXCLUDED_PROJECTS = ["Creative Intake"];

/* Asana custom field that carries creative type (PDP Imagery, Brand Store, Premium A+, ...). */
export const CREATIVE_TYPE_FIELD = "Creative Type";

/* Cold-deadline + coverage thresholds (mirrors lib/metrics coldBand). */
export const THRESHOLDS = {
  quietDays: 5,          // no Figma activity for this many days = going quiet
  coverageDarkDays: 10,  // project with open tasks and no activity this long = going dark
  maxFilesScanned: 40,   // cap Figma API fan-out per refresh
  lookbackDays: 30,      // activity window for scores
};

export function matchClient(text: string): ClientConfig | null {
  const t = text.toLowerCase();
  for (const c of CLIENTS) {
    if (t.includes(c.name.toLowerCase())) return c;
    for (const a of c.aliases ?? []) if (t.includes(a.toLowerCase())) return c;
  }
  return null;
}
