# Design Intel — Product Requirements Document

**Status:** Living document · **Last updated:** 2026-06-23 · **Owner:** Joshua Fulmer

---

## 1. Summary

Design Intel is a cross-platform design-operations intelligence tool. It connects **Figma
activity** with **Asana task management** to surface workload imbalances, client pressure,
delivery trends, and operational risks across a design team — real-time visibility into what's
actually happening, not just what's in a standup.

## 2. Problem

Design leads and ops managers lack a single view that ties *who is doing the work* (Figma) to
*what is committed and due* (Asana). Standups are lagging and subjective; spreadsheets go
stale. There's no early warning for overloaded designers, single-points-of-failure on a
client, or silent velocity drops.

## 3. Target users

- **Design leads** — balance workload, spot burnout/overload, defend timelines.
- **Ops / delivery managers** — track on-time rate, cycle time, client pressure.
- **The team** — a shared, honest picture of the week.

## 4. Goals & non-goals

**Goals**
- One dashboard joining Figma + Asana, refreshed automatically.
- Surface risk proactively via Flags (overdue clustering, bus factor, velocity drop, etc.).
- Natural-language access to the same data via an MCP server.
- A shareable, interactive demo of the experience that runs in Figma's native environment.

**Non-goals**
- Not a project-management replacement (Asana stays the system of record).
- Not a Figma design tool; it reads activity, it doesn't edit designs.
- No per-seat user accounts in v1 (single shared password gate).

## 5. Data model & sources

| Source | Via | Key data |
|---|---|---|
| Figma | REST API (PAT) | version history → edits, comments, files/projects per designer |
| Asana | Tasks API (PAT) | assignee, followers, due/completion, projects, sections, custom fields |

**Asana custom fields used:** `Task Progress` (status/priority), `Type of Creative`,
`Total ASINs`.

**People join:** Figma and Asana display names differ; the canonical map lives in
`lib/team-config.ts` (mirrored in `mcp/src/constants.ts`). Non-client projects
(`Creative Intake`, `Creative Tasks`, `General Tasks`) are excluded from client metrics.

Full shapes: see `docs/figma-make/sample-data.json` (`AsanaTask`, `FigmaDesignerActivity`,
`WeeklySnapshot`).

## 6. Metric definitions (source of truth: `lib/metrics.ts`)

- **Cycle time (days)** = (completed_at − created_at) / 1 day, floored at 0.
- **Avg cycle time** = mean over tasks with `completed_at`.
- **On-time rate** = completed-by-due-date ÷ completed-with-a-due-date (0–1).
- **Overdue** = `due_on < today` AND not completed.
- **Velocity (WoW)** = this week vs last week tasks completed (from snapshots).
- **Composite health score (0–100)** = on-time 40pts (null→20) + cycle 30pts (3d→30,
  14d+→0, null→15) + velocity 30pts (ratio×15, capped 30; null→15).
- **Activity composite** = `edits×3 + comments×2 + files×2 + projects×3`.
- **File heat** = `edits×3 + comments`.
- **Client Pressure Index** = `tasks + overdue×3 − min(edits×0.3, tasks)`.
- **Workload flags** = High load (8+ tasks & <15 edits), High output (efficiency >3×).

## 7. Phases

### Phase 1 — Live Dashboard (shipped)
Next.js + Vercel. Password-gated, mobile-responsive, light/dark (Figma token system).
Six views: **Activity, Tasks, Pressure, Workload, Trends, Flags**, plus a three-panel layout
with drill-down filtering, a contextual detail panel, breadcrumbs, and deep links to Asana/
Figma. Server-side proxy keeps secrets out of the browser; chunked Figma sync with a
distributed KV lock; Zod-validated responses; HMAC-SHA256 auth; 50 tests.

### Phase 2 — MCP Server (shipped)
Eight tools over the same data for natural-language queries in Claude Code / claude.ai:
`figma_get_team_activity`, `figma_get_designer_stats`, `asana_get_tasks`,
`asana_get_overdue`, `asana_get_projects`, `intel_client_pressure`,
`intel_workload_balance`, `intel_weekly_summary`. stdio + HTTP transport.

### Phase 3 — Figma Make Interactive Demo (in progress)
An interactive, data-connected demo of the dashboard built in **Figma Make**, running in
Figma's native environment — for stakeholder walkthroughs and design alignment without a code
deploy.

**Requirements**
- Recreate all six views and the three-panel layout using the production design tokens.
- **Prioritize live Asana task + priority data**: Tasks, Pressure, Workload, and Flags read
  from live Asana.
- Live data flows through the **existing Vercel `/api/data` proxy** — no Asana token in the
  prototype, no Vercel changes. Boots from seed data, swaps to live via a `BASE_URL` config.
- Deliverables live in `docs/figma-make/`: prompt, design-tokens export, sample-data export,
  Asana integration spec.

**Acceptance**
- Demo renders all six views from seed data with correct tokens/typography.
- Flipping to live shows real open tasks, statuses (from `Task Progress`), and overdue counts.
- Task rows deep-link to Asana; file rows deep-link to Figma.
- Works on desktop and the 768px mobile breakpoint.

## 8. Non-functional requirements

- **Security:** HMAC-SHA256 cookie auth; bearer-protected internal API routes; secrets
  server-side only; Zod validation on all external responses.
- **Performance:** caching (1h standard, 24h Figma sync, 6h completed, 90d snapshots);
  chunked sync within Vercel's 60s free-tier limit; Figma 20 req/min respected.
- **Reliability:** distributed KV lock prevents concurrent-sync corruption.

## 9. Risks & open items

- **Open data proxy:** `middleware.ts` lets all `/api/*` through the password gate and
  `/api/data` adds the bearer server-side — so `/api/data?source=asana` is **publicly
  readable**. This is what lets the Figma Make demo fetch with no auth, but before sharing the
  prototype widely, add an origin allowlist or a scoped read-only demo token. *(Owner: TBD)*
- **Name-map drift:** `lib/team-config.ts` and `mcp/src/constants.ts` are maintained
  separately; keep them in sync when the team changes.
- **Trends cold start:** charts need 2+ weekly snapshots before they populate.

## 10. References

- Code: `app/` (dashboard + API), `lib/` (clients, metrics, config), `mcp/` (MCP server).
- Demo kit: `docs/figma-make/` (`README.md`, `PROMPT.md`, `design-tokens.json`,
  `sample-data.json`, `asana-integration.md`).
