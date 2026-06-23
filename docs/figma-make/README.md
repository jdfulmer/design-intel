# Figma Make Demo Kit

Everything needed to rebuild the Design Intel dashboard as an **interactive, live demo inside
Figma Make** — no code, runs in Figma's native environment. Live task/priority data flows in
from Asana through the existing Vercel `/api/data` proxy (no Vercel changes, no token in the
prototype).

## Files

| File | What it is |
|---|---|
| [`PROMPT.md`](./PROMPT.md) | The copy-paste Figma Make prompt + a follow-up prompt to switch from seed data to live Asana. **Start here.** |
| [`design-tokens.json`](./design-tokens.json) | Colors (light/dark), typography, radius, severity + avatar palettes — extracted from `app/dashboard.tsx`. Attach as context in Figma Make. |
| [`sample-data.json`](./sample-data.json) | Seed data that matches the live proxy responses 1:1, so the demo boots instantly and swaps to live with no shape changes. Attach as context. |
| [`asana-integration.md`](./asana-integration.md) | The priority piece: exact live-Asana endpoint contract, custom-field → priority mapping, people-name join, deep links, and the open-proxy security note. |

## Figma design file

A hand-built Figma design of the product, generated from code through the Plugin API and used both
as a visual starting point for Figma Make and as a portfolio piece:
**https://www.figma.com/design/aRRPpCVHQ1FTitidbeYBLO** — "Design Intel — Dashboard Demo".

Everything is built from the sample data using the production design tokens (Inter + Figma's
official light/dark token sets) in the three-panel layout.

**Product page**
- **Six views, light + dark** — Activity (leaderboard + hottest files), Tasks (delivery metrics +
  project/creative/assignee breakdowns), Pressure (client pressure index), Workload (per-designer
  balance), Trends (real weekly bar charts — throughput, cycle time, on-time %, edits), Flags
  (severity-coded alerts). Light row on top, dark row below.
- **Drill-down detail panels** — fill the contextual right panel: **Designer** (on Activity),
  **Client** (on Pressure — pressure index, a breakdown that sums to the headline, deadlines) and
  **File** (on Activity — edits/comments/heat/contributors + a recent-activity feed).
- **Responsive · onboarding · states** — a mobile Activity screen (390×844) with a bottom tab bar,
  an onboarding **Connect** flow (Figma + Asana OAuth, read-only), and **loading / empty / error**
  states.
- **Ask Design Intel** — a natural-language query screen that visualizes the MCP layer: a grounded
  answer with an inline data card and source chips, plus a panel listing which MCP tools fired.

**Signal redesign (product-feedback driven)** — see [`docs/research/signal-redesign-cycle.md`](../research/signal-redesign-cycle.md) for the full story:
- **Case study** (top of file) — "From edit-volume to deadline-neglect": old signal → user insight → redesign.
- **Cold Deadlines** (concept + **v2**) — flags work that's due soon and going quiet. v2 is the
  rules engine made visible: tiered flags with "why" chips, a **Healthy** (status-guard) and
  **Needs-link** state, PM-priority weighting, and inline **I've got this / Snooze / Reassign** actions.
- **Push to stakeholder** — Slack/email **owner nudge → auto-escalation** to the lead, with inline actions.
- **Coverage & Balance** — the leaderboard reframed away from edit-ranking to *project coverage*
  (is every project attended to?) and *team balance* (capacity, for load-shifting — not scoring).

**Page 2 — Design System**
- **Color tokens as Figma variables** — one collection with **Light and Dark modes** and 11
  semantic tokens (`color/bg`, `color/surface`, `color/border`, `color/text*`, `color/accent`,
  `color/success`, `color/warning`, `color/danger`, `color/violet`). Swatches are bound to the
  variables, so switching mode reflows them.
- **Type scale** (Inter) and **component sets with variants** — `Pill` (property: Severity =
  Danger/Warn/Info/Ok), `Button` (property: Style = Primary/Secondary), plus `StatCard` and
  `Avatar` components.
- **Theming demo** — one variable-bound dashboard card shown in **Light** and explicit **Dark**
  mode side by side, proving the whole token set (including mode-specific values like
  `color/danger`) drives both themes from a single definition.

## Quick start

1. Open Figma Make (Pro seat ✓).
2. Attach `design-tokens.json` and `sample-data.json` as context.
3. Paste the prompt from `PROMPT.md`, replacing `{BASE_URL}` with your Vercel URL.
4. Once it looks right, paste the "switch to LIVE Asana data" follow-up prompt.

## Prerequisites for the live feed

- The Design Intel Vercel app is deployed and its env vars (`ASANA_PAT`,
  `ASANA_WORKSPACE_GID`, `API_SECRET`) are set.
- You know your deployment URL for `{BASE_URL}`.
