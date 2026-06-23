# Figma Make Prompt — Design Intel Dashboard Demo

How to use:
1. Open **Figma Make** (paid seat required — you're on Pro ✓).
2. Attach the two exports as context: [`design-tokens.json`](./design-tokens.json) and
   [`sample-data.json`](./sample-data.json).
3. Paste the prompt below. Replace `{BASE_URL}` with your Vercel URL
   (e.g. `https://design-intel.vercel.app`).
4. After the first generation, follow up with the "live data" instruction at the bottom
   to switch from seed data to the real Asana feed.

---

## PROMPT (copy everything in the block)

```
Build an interactive, data-connected operations dashboard called "Design Intel". It gives a
design lead real-time visibility into a creative team by combining Asana task data with Figma
activity. Match the attached design-tokens.json EXACTLY and seed it with sample-data.json.

DESIGN SYSTEM (from design-tokens.json)
- Font: Inter. Use the type scale in the file (metric values 22/600 with -0.5 letter-spacing,
  section titles 14/600, body 12-13).
- Use Figma's official light/dark token sets. Default to LIGHT. Add a theme toggle in the
  sidebar footer that persists to localStorage.
- Brand accents: blue #0D99FF, green #14AE5C, red #F24822, orange #FFA629, purple #7B61FF.
- Severity colors per the "severity" map (danger/warn/ok/info), theme-aware.
- Corner radius 6-8px, generous whitespace, crisp 1px borders using the border token.

LAYOUT — three panels
1. Left sidebar: "Design Intel" wordmark, nav for the six views (Activity, Tasks, Pressure,
   Workload, Trends, Flags), and a footer with the theme toggle + "Updated Xm ago".
2. Center: the active view.
3. Right contextual detail panel (Figma-style properties panel): when a designer or client is
   selected, show their stats, tasks, files, and clients. Empty state when nothing selected.
- Breadcrumb across the top: "Design Intel / {View} / {SelectedEntity}", segments clickable.
- Mobile responsive: at <=768px collapse the sidebar into a hamburger drawer and stack panels.

THE SIX VIEWS

1) Activity — designer leaderboard ranked by composite score:
   edits*3 + comments*2 + files*2 + projects*3. Show per designer: edits, comments, files
   touched, project count, colored avatar (use avatarColors). Below it, "Hottest Files"
   ranked by heat = edits*3 + comments, each row links to the Figma file.

2) Tasks — delivery metrics from Asana. Top metric cards: tasks completed (30d), on-time
   rate %, avg cycle time (days), week-over-week velocity. Then three breakdowns:
   by project (bar chart), by assignee (with overdue counts), by creative type (progress
   bars, from the "Type of Creative" custom field). Each task row links to Asana and shows a
   status pill from the "Task Progress" custom field.

3) Pressure — Client Pressure Index per client:
   pressure = tasks + overdue*3 - min(edits*0.3, tasks).
   Cross-references Asana load against Figma edits. Label each client High / Med / Low with a
   horizontal bar. (First non-excluded project on a task = its client; exclude the
   nonClientProjects list.)

4) Workload — per-designer efficiency. Columns: active tasks, overdue count, Figma edits,
   efficiency ratio (edits / tasks), avg cycle time. Flag "High load" when 8+ tasks AND
   <15 edits (red); flag "High output" when efficiency > 3x (green).

5) Trends — historical line charts from weekly snapshots: tasks completed/week, avg cycle
   time, on-time %, total Figma edits over time. If fewer than 2 snapshots, show an empty
   state: "Trends need 2+ weekly syncs."

6) Flags — operational alerts with severity (Danger/Warn/Ok/Info):
   - Overdue clustering: a client with 3+ overdue tasks.
   - Bus factor: a client served by a single designer with 3+ tasks.
   - Zero-edit designers: 5+ tasks but 0 Figma edits.
   - High load imbalance: 8+ tasks with <15 edits.
   - Velocity drop: 50%+ week-over-week decline.
   - Stale overdue: tasks 14+ days past due.
   - No Figma activity: a client with 3+ tasks but no matching edits.

METRIC DEFINITIONS (compute these in code)
- Cycle time (days) = (completed_at - created_at) / 1 day, floored at 0.
- Avg cycle time = mean cycle time over tasks that have completed_at.
- On-time rate = (completed tasks where completed date <= due_on) / (completed tasks with a
  due date). Range 0-1, show as %.
- Overdue = due_on < today AND not completed.
- Velocity (WoW) = thisWeek tasksCompleted vs lastWeek from snapshots.
- Composite health score (0-100): on-time 40pts (null=20), cycle 30pts (3d=30 down to 14d+=0,
  null=15), velocity 30pts (thisWeek/lastWeek*15, capped 30; null=15).

INTERACTIONS
- Drill-down filtering: click a designer to filter clients/tasks to them; click a client to
  filter designers to them. Reflect the selection in the breadcrumb and detail panel.
- Every Asana task row links to https://app.asana.com/0/0/{gid}.
- Every Figma file row links to https://www.figma.com/design/{key}/{slug}.
- Refresh button re-fetches data and updates the "Updated Xm ago" label.

DATA
- Boot from the attached sample-data.json. Each top-level key (asana, completed, figma,
  snapshots) matches a live endpoint response 1:1.
- Join Asana people to Figma people using teamConfig.map before per-designer math.
- Priority/status for a task comes from its "Task Progress" custom field (read display_value).

Make it feel like a polished internal tool: fast, legible, calm. Light theme first.
```

---

## Follow-up prompt — switch to LIVE Asana data

Paste this after the first version generates and looks right:

```
Now wire the dashboard to live data instead of the seed file. Add a single config variable
BASE_URL = "{BASE_URL}". Fetch on load and on Refresh:

- Open tasks:   GET {BASE_URL}/api/data?source=asana                      -> { data: AsanaTask[] }
- Completed:    GET {BASE_URL}/api/data?source=completed&include_completed=30d -> { data: AsanaTask[] }
- Figma:        GET {BASE_URL}/api/data?source=figma                      -> { data, files, syncedAt }
- Snapshots:    GET {BASE_URL}/api/data?source=snapshots                  -> { data: WeeklySnapshot[] }
- Freshness:    GET {BASE_URL}/api/data?source=cache                      -> { figma, asana }

No auth header is needed. The response shapes are identical to sample-data.json's asana/
completed/figma/snapshots keys, so reuse the same render code. Keep the seed file as the
fallback if a fetch fails, and show a small "live / sample" indicator. Prioritize the Asana
task + priority feed: Tasks, Pressure, Workload, and Flags should all read from the live
source=asana response.
```

See [`asana-integration.md`](./asana-integration.md) for the full endpoint contract, the
custom-field priority mapping, and the open-proxy security note.
