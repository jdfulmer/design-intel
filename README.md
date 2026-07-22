# Design Intel

Figma activity next to your task data, so you can catch deadlines before they slip and notice when someone is getting buried. Built on Figma's own platform.

**One dashboard, eight views, and you can just ask it questions.**

## Views

| View | Question it answers |
|---|---|
| Coverage | Is every active project getting attention, or going dark? |
| Activity | Who is doing the work, and which files are heating up? |
| Tasks | What is getting delivered, by project, type, and person? |
| Pressure | Which clients are about to boil over? |
| Workload | Who is overloaded, and who has room to take more? |
| Trends | How is the team's pace trending, week over week? |
| Flags | Early operational warnings |
| At Risk | Work due soon that has gone quiet — owner-nudged before it slips |
| Ask | Plain-English queries against the data, powered by Claude |

## The math (simple, explainable)

- **Client Pressure Index** = `tasks + overdue×3 − min(edits×0.3, tasks)`
- **Activity Score** = `edits×3 + comments×2 + files×2 + projects×3` — still computed for live sorting fallback, no longer displayed in the UI (see 2.5.0)
- **File Heat** = `edits×3 + comments`
- **Health Score (0-100)** = `on-time×0.4 + cycle-time×0.3 + velocity×0.3`

All in `lib/metrics.ts`, covered by `tests/metrics.test.ts`.

## Quick start

```bash
npm install
cp .env.example .env    # add ANTHROPIC_API_KEY for the Ask view
npm run dev
```

Open http://localhost:3000. The dashboard runs on the demo dataset out of the box. `/connect` shows the onboarding flow.

## Ask Design Intel

The Ask view posts to `app/api/ask/route.ts`, which calls Claude server-side with the dataset in context and returns structured JSON: an answer, the MCP-style tools it drew from, and entity cards. The API key never reaches the client.

## Architecture

```
app/
  page.tsx            → renders the dashboard
  connect/page.tsx    → onboarding (Step 2 of 3)
  api/ask/route.ts    → Claude proxy, zod-validated
components/
  Dashboard.jsx       → the entire client app (views, panels, shell)
lib/
  tokens.ts           → one token system, light + dark
  data.ts             → demo dataset (matches the Figma file)
  metrics.ts          → the formulas
  figma.ts            → Phase 2 adapter (REST: versions, comments)
  asana.ts            → Phase 2 adapter (tasks, assignees, due dates)
tests/
  metrics.test.ts     → formula coverage
```

## Phase 2 checklist

- [x] Wire live aggregation into `/api/data` (`lib/aggregate.ts`, in-memory cache; Vercel KV later)
- [x] `Dashboard.jsx` fetches `/api/data` at runtime (demo fallback when creds absent)
- [ ] OAuth on `/connect` instead of env tokens
- [ ] Standalone TypeScript MCP server exposing get_activity / get_tasks / get_pressure_index / get_workload / get_flags
- [ ] At Risk push: Slack DM owner nudge → SLA escalation to design lead

## Research

Design Intel has an active UXR loop (started 2026-07-21: Google Form survey, n=5 at kickoff, moderated sessions to follow). Feature changes are gated on it — findings get logged, but structural changes wait for sufficient signal rather than shipping on the first batch. Directional so far: workload balance is the top-ranked value, composite scoring of individuals is a distrust vector (false positives on at-risk calls named explicitly), and nudge acceptance depends entirely on tone and frequency.

## Changelog

### 2.5.0
- Removed per-designer Score (leaderboard block + detail-panel chip); leaderboard now sorts by edits. Aligns the product with its own "protect, don't rank" principle and the UXR distrust signal.
- Project/client references are now clickable across At Risk cards, Flags rows, and detail-panel tasks; unified hover affordance (di-row + pointer if and only if a click target exists). Flags carry an explicit `entityRef` instead of string matching. Detail-panel deadline items stay static by rule: they always belong to the entity already open.
- UXR feedback loop started 2026-07-21 (n=5, Google Form); findings logged, structural changes deferred pending more responses + moderated sessions.

### 2.4.1
- Four public Figma demo files wired to hot files; Open in Figma button in the file panel; live mode derives file URLs from Figma file keys.

### 2.4.0
- Coverage panel simplified, Trends/Flags methodology panels, Cold Deadlines renamed At Risk with red treatment, nav count badge, critical-item stripe. Ask connected to the Anthropic API.

## Deploy

```bash
vercel deploy
vercel env add ANTHROPIC_API_KEY
```

---
Joshua Fulmer · j.d.fulmer@gmail.com · joshuafulmer.com
