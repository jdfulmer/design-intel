/* Demo dataset — a product design org at a company like Figma.
   Product areas stand in as "clients". All scores follow lib/metrics formulas.
   Swapped for live adapters via lib/aggregate.ts when creds are configured. */

export const DATA = {
  designers: [
    { id: "mc", initials: "MC", name: "Maya Chen", color: "#0D99FF", projects: 2, edits: 52, comments: 14, files: 3, score: 196, active: 6, overdue: 1, efficiency: "8.7×", cycle: "4.8d", flag: "High output", cap: [6, 8] },
    { id: "jr", initials: "JR", name: "Jordan Reyes", color: "#9747FF", projects: 1, edits: 38, comments: 9, files: 2, score: 139, active: 4, overdue: 0, efficiency: "9.5×", cycle: "4.2d", flag: "High output", cap: [4, 8] },
    { id: "pp", initials: "PP", name: "Priya Patel", color: "#14AE5C", projects: 2, edits: 21, comments: 18, files: 3, score: 111, active: 5, overdue: 0, efficiency: "4.2×", cycle: "5.6d", flag: "High output", cap: [5, 8] },
    { id: "ev", initials: "EV", name: "Elena Vasquez", color: "#00A2C2", projects: 1, edits: 16, comments: 6, files: 2, score: 67, active: 3, overdue: 0, efficiency: "5.3×", cycle: "5.1d", flag: "High output", cap: [3, 8] },
    { id: "so", initials: "SO", name: "Sam Okafor", color: "#F24822", projects: 1, edits: 11, comments: 4, files: 1, score: 46, active: 9, overdue: 3, efficiency: "1.2×", cycle: "7.4d", flag: "High load", cap: [9, 8] },
    { id: "tn", initials: "TN", name: "Tom Nakamura", color: "#FFA629", projects: 1, edits: 4, comments: 2, files: 1, score: 21, active: 7, overdue: 2, efficiency: "0.6×", cycle: "6.8d", flag: null, cap: [7, 8] },
  ],
  leaderboardIds: ["mc", "jr", "pp", "ev", "so"],
  clients: [
    { id: "dev-mode", initials: "DM", name: "Dev Mode", tasks: 11, overdue: 3, edits: 15, pi: 16, band: "High", designers: 2 },
    { id: "mobile", initials: "MO", name: "Mobile", tasks: 8, overdue: 2, edits: 10, pi: 11, band: "High", designers: 1 },
    { id: "figjam", initials: "FJ", name: "FigJam", tasks: 7, overdue: 1, edits: 12, pi: 6, band: "Med", designers: 2 },
    { id: "slides", initials: "SL", name: "Slides", tasks: 5, overdue: 1, edits: 20, pi: 3, band: "Low", designers: 1 },
    { id: "design-systems", initials: "DS", name: "Design Systems", tasks: 6, overdue: 0, edits: 48, pi: 0, band: "Low", designers: 2 },
    { id: "growth", initials: "GO", name: "Growth & Onboarding", tasks: 4, overdue: 0, edits: 16, pi: 0, band: "Low", designers: 0 },
  ],
  hotFiles: [
    { id: "devmode-inspect", figmaUrl: "https://www.figma.com/design/Q6qUQsEEJmHF2CxX7a73md/Config-keynote-demo-flows?node-id=2-4&t=vLDJaC4VsIdnZaVb-1", name: "Dev Mode — Inspect Panel v3", client: "Dev Mode", edits: 24, comments: 9, heat: 81, contributors: [{ i: "MC", n: "Maya Chen", e: "14 edits" }, { i: "JR", n: "Jordan Reyes", e: "7 edits" }, { i: "SO", n: "Sam Okafor", e: "3 edits" }], activity: [{ t: "Maya iterated the props panel", w: "2h ago" }, { t: "Jordan left 4 crit comments", w: "5h ago" }, { t: "Sam updated code-connect frames", w: "1d ago" }] },
    { id: "ds-library", figmaUrl: "https://www.figma.com/design/q5NxYskqGsxkYb4kYxahmk/DS-%E2%80%94-Component-Library-Refresh?node-id=2-4&t=jdVpNaNwxS9saIUB-1", name: "DS — Component Library Refresh", client: "Design Systems", edits: 22, comments: 6, heat: 72, contributors: [{ i: "PP", n: "Priya Patel", e: "15 edits" }, { i: "EV", n: "Elena Vasquez", e: "7 edits" }], activity: [{ t: "Priya restructured button variants", w: "3h ago" }, { t: "Elena annotated token usage", w: "1d ago" }] },
    { id: "figjam-templates", figmaUrl: "https://www.figma.com/board/BW90qAfh4wHxUAqsJLodRN/FigJam-%E2%80%94-Board-Templates-Kit?node-id=0-1&t=QzaUcW7rik9tYt1G-1", name: "FigJam — Board Templates Kit", client: "FigJam", edits: 12, comments: 8, heat: 44, contributors: [{ i: "JR", n: "Jordan Reyes", e: "8 edits" }, { i: "PP", n: "Priya Patel", e: "4 edits" }], activity: [{ t: "Jordan shipped 3 new templates", w: "6h ago" }, { t: "Priya left async crit notes", w: "2d ago" }] },
    { id: "mobile-touch", figmaUrl: "https://www.figma.com/design/MzLovKoTrt4QYBTMD4SCaC/Mobile-%E2%80%94-Editor-Touch-Patterns?node-id=2-4&t=2STCACZWXSJqAm25-1", name: "Mobile — Editor Touch Patterns", client: "Mobile", edits: 10, comments: 2, heat: 32, contributors: [{ i: "SO", n: "Sam Okafor", e: "10 edits" }], activity: [{ t: "Sam explored gesture affordances", w: "3d ago" }] },
  ],
  taskMetrics: [
    { label: "Completed · 30d", value: "41", tone: "text" },
    { label: "On-time rate", value: "78%", tone: "green" },
    { label: "Avg cycle time", value: "5.3d", tone: "text" },
    { label: "Velocity WoW", value: "−18%", tone: "red" },
  ],
  byProject: [["Dev Mode", 11], ["Mobile", 8], ["FigJam", 7], ["Design Systems", 6], ["Slides", 5], ["Growth & Onboarding", 4]],
  byType: [["Product Specs", 34], ["Prototypes", 26], ["Design Explorations", 22], ["Research Synthesis", 18]],
  byAssignee: [
    { i: "SO", n: "Sam Okafor", active: 9, note: "3 overdue", tone: "red" },
    { i: "TN", n: "Tom Nakamura", active: 7, note: "2 overdue", tone: "red" },
    { i: "MC", n: "Maya Chen", active: 6, note: "1 overdue", tone: "red" },
    { i: "PP", n: "Priya Patel", active: 5, note: "on track", tone: "green" },
  ],
  trends: [
    { label: "Tasks completed / week", value: "9", delta: "−18%", tone: "red", pts: [12, 11, 13, 12, 11, 10, 11, 9] },
    { label: "Avg cycle time", value: "5.3d", delta: "+15%", tone: "red", pts: [4.4, 4.6, 4.5, 4.7, 4.9, 5.0, 5.1, 5.3] },
    { label: "On-time delivery", value: "78%", delta: "−6%", tone: "red", pts: [86, 84, 85, 83, 82, 81, 80, 78] },
    { label: "Figma edits / week", value: "31", delta: "+7%", tone: "green", pts: [27, 25, 29, 28, 30, 29, 29, 31] },
  ],
  flags: [
    { t: "Overdue clustering", d: "Dev Mode has 3 overdue tasks ahead of the Config demo", sev: "Danger", entityRef: { entityType: "client", entityId: "dev-mode" } },
    { t: "High load imbalance", d: "Sam Okafor: 9 tasks, only 11 Figma edits", sev: "Danger", entityRef: { entityType: "designer", entityId: "so" } },
    { t: "Velocity drop", d: "Team throughput down 18% week-over-week", sev: "Warn" },
    { t: "Stale overdue", d: "Mobile offline editing spec is 15 days past due", sev: "Warn", entityRef: { entityType: "client", entityId: "mobile" } },
    { t: "Bus factor", d: "Slides is served by a single designer with 5 tasks", sev: "Info", entityRef: { entityType: "client", entityId: "slides" } },
    { t: "Coverage healthy", d: "No zero-edit designers this week", sev: "Ok" },
  ],
  coldDeadlines: [
    { id: "cd1", title: "Config keynote demo flows", client: "Dev Mode", pri: "P0", band: "Critical", chips: ["Due in 2d", "Untouched 6d", "Not started"], actions: ["I've got this", "Snooze", "Reassign"] },
    { id: "cd2", title: "Mobile editor touch spec", client: "Mobile", pri: "P1", band: "High", chips: ["Due in 4d", "Quiet 9d", "In progress"], actions: ["I've got this", "Snooze", "Reassign"] },
    { id: "cd3", title: "Slides transitions polish", client: "Slides", pri: "P2", band: "Watch", chips: ["Due in 6d", "Quiet 5d"], actions: ["I've got this", "Snooze", "Reassign"] },
    { id: "cd4", title: "Onboarding checklist redesign", client: "Growth & Onboarding", pri: "P1", band: "Needs link", chips: ["Due in 5d", "No Figma file linked"], actions: ["Link file", "Dismiss"] },
  ],
  coldSuppressed: { title: "DS tokens migration guide", client: "Design Systems", pri: "P1", note: "In review — on track · suppressed by status guard" },
  coverage: [
    { proj: "Inspect Panel v3", client: "Dev Mode", team: ["MC", "JR"], open: 11, last: "active today", status: "Healthy" },
    { proj: "Editor Touch Patterns", client: "Mobile", team: ["SO"], open: 8, last: "quiet 9d", status: "Going quiet" },
    { proj: "Board Templates Kit", client: "FigJam", team: ["JR", "PP"], open: 7, last: "active 6h", status: "Healthy" },
    { proj: "Component Library Refresh", client: "Design Systems", team: ["PP", "EV"], open: 6, last: "active 1d", status: "Healthy" },
    { proj: "Transitions Polish", client: "Slides", team: ["TN"], open: 5, last: "active 4d", status: "Healthy" },
    { proj: "Onboarding Checklist", client: "Growth & Onboarding", team: [], open: 4, last: "no owner", status: "No coverage" },
  ],
  balance: [
    { i: "SO", n: "Sam Okafor", cap: [9, 8], status: "Overloaded" },
    { i: "TN", n: "Tom Nakamura", cap: [7, 8], status: "Balanced" },
    { i: "MC", n: "Maya Chen", cap: [6, 8], status: "Balanced" },
    { i: "JR", n: "Jordan Reyes", cap: [4, 8], status: "Balanced" },
    { i: "EV", n: "Elena Vasquez", cap: [3, 8], status: "Has room" },
  ],
  designerTasks: {
    mc: [{ t: "Config keynote demo flows", s: "In Review", c: "dev-mode" }, { t: "Inspect Panel v3 spec", s: "In Progress", c: "dev-mode" }],
    jr: [{ t: "Board Templates Kit", s: "In Progress", c: "figjam" }],
    pp: [{ t: "Component Library Refresh", s: "In Progress", c: "design-systems" }, { t: "DS tokens migration guide", s: "In Review", c: "design-systems" }],
    ev: [{ t: "DS icon set expansion", s: "In Progress", c: "design-systems" }],
    so: [{ t: "Mobile editor touch spec", s: "In Progress", c: "mobile" }, { t: "Offline editing spec", s: "Not started", c: "mobile" }],
    tn: [{ t: "Slides transitions polish", s: "In Progress", c: "slides" }],
  },
  clientDeadlines: {
    "dev-mode": [{ t: "Config keynote demo flows", s: "Overdue", tone: "red" }, { t: "Inspect Panel v3 spec", s: "Due 2d", tone: "amber" }, { t: "Editor a11y audit", s: "Due 5d", tone: "text2" }],
    mobile: [{ t: "Offline editing spec", s: "Overdue", tone: "red" }, { t: "Editor touch spec", s: "Due 4d", tone: "text2" }],
    figjam: [{ t: "Board Templates Kit", s: "Due 6d", tone: "text2" }],
    slides: [{ t: "Transitions polish", s: "Due 6d", tone: "text2" }],
    "design-systems": [{ t: "DS tokens migration guide", s: "Due 8d", tone: "text2" }],
    growth: [{ t: "Onboarding checklist redesign", s: "Due 5d", tone: "text2" }],
  },
};

export const NAV_META = {
  coverage: "Coverage", activity: "Activity", tasks: "Tasks", pressure: "Pressure",
  workload: "Workload", trends: "Trends", flags: "Flags", cold: "At Risk", ask: "Ask",
};
