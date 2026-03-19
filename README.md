# Design Intel

Cross-platform design operations intelligence — connects Figma activity data with Asana task management to surface workload imbalances, client pressure, delivery trends, and operational risks across your design team.

Built for design leads and ops managers who need real-time visibility into what's actually happening, not just what's in a standup.

---

## What It Does

**Phase 1 — Live Dashboard** (Next.js + Vercel)
A password-protected, mobile-responsive dashboard with light/dark theme support that syncs Figma version history and Asana tasks into six intelligence views: Activity, Tasks, Pressure, Workload, Trends, and Flags. Includes a contextual detail panel that shows properties for selected designers or clients.

**Phase 2 — MCP Server** (Claude Code + claude.ai)
Eight tools that let Claude query your design ops data directly — ask natural language questions about team workload, client pressure, overdue tasks, and weekly summaries.

---

## Dashboard Views

### Activity
Designer leaderboard ranked by a composite score (`edits×3 + comments×2 + files×2 + projects×3`). Shows per-designer edits, comments, and files touched. Includes a "Hottest Files" section ranking files by heat score (`edits×3 + comments`), with clickable links to Figma.

### Tasks
Delivery metrics at a glance — tasks completed (30d), on-time rate, average cycle time, and week-over-week velocity. Breaks down tasks by project (bar chart), assignee (with overdue counts), and creative type (with progress bars).

### Pressure
Client Pressure Index — cross-references Asana task load against Figma edit volume per client. Formula: `tasks + overdue×3 − min(edits×0.3, tasks)`. Flags clients as High/Med/Low pressure with visual bars.

### Workload
Per-designer efficiency analysis — active tasks, overdue count, Figma edits, efficiency ratio (edits ÷ tasks), and cycle time. Flags "High load" (8+ tasks, <15 edits) and "High output" (efficiency >3×).

### Trends
Historical line charts (requires 2+ weekly syncs): tasks completed/week, average cycle time, on-time percentage, and total Figma edits over time.

### Flags
Operational alerts with severity levels (Danger, Warn, Ok, Info):
- **Overdue clustering** — client with 3+ overdue tasks
- **Bus factor** — client served by a single designer with 3+ tasks
- **Zero-edit designers** — 5+ tasks but 0 Figma edits
- **High load imbalance** — 8+ tasks with <15 edits
- **Velocity drop** — 50%+ week-over-week decline
- **Stale overdue** — tasks 14+ days past due
- **No Figma activity** — client with 3+ tasks but no matching edits

### Interactive Features
- **Three-panel layout** — sidebar navigation, main content, and contextual detail panel for selected entities
- **Drill-down filtering** — click a designer to see only their clients/tasks, or click a client to see only their designers
- **Detail panel** — shows stats, tasks, files, and clients for the selected designer or client (Figma-style properties panel)
- **Breadcrumb navigation** — "Design Intel / Activity / Nicole Howard" with clickable segments
- **Deep linking** — all Asana tasks and Figma files are clickable links to their source
- **Light/dark theme** — defaults to light (Figma's official token system), toggle in sidebar footer, persists to localStorage
- **Mobile responsive** — hamburger nav, drawer sidebar, stacked layouts at 768px

---

## Repo Structure

```
design-intel/
├── app/
│   ├── page.tsx                  Dashboard entry point
│   ├── dashboard.tsx             Main dashboard UI (all 6 tabs + detail panel)
│   ├── layout.tsx                Root layout
│   ├── login/page.tsx            Password login page
│   └── api/
│       ├── data/route.ts         GET/DELETE — server-side proxy (keeps secrets out of browser)
│       ├── figma/route.ts        GET  — cached Figma activity
│       ├── figma/sync/route.ts   POST — chunked Figma crawl (with distributed lock)
│       ├── asana/route.ts        GET  — Asana tasks (open + completed)
│       ├── auth/route.ts         POST — password verification (HMAC-SHA256)
│       ├── cache/route.ts        GET/DELETE — cache status + bust
│       └── snapshots/route.ts    GET  — weekly trend data
├── lib/
│   ├── figma.ts                  Figma REST API client (PAT auth, Zod-validated responses)
│   ├── asana.ts                  Asana API client (pagination cap, Zod-validated responses)
│   ├── cache.ts                  Vercel KV cache layer (1hr TTL, custom TTL support)
│   ├── auth.ts                   API route bearer token guard (required in production)
│   ├── metrics.ts                Delivery analytics + weekly snapshots
│   └── team-config.ts            Team name mappings + project config (single source of truth)
├── mcp/
│   └── src/
│       ├── index.ts              MCP server (stdio or HTTP transport)
│       ├── constants.ts          Name mappings (synced from lib/team-config.ts)
│       ├── tools/
│       │   ├── figma-tools.ts    figma_get_team_activity, figma_get_designer_stats
│       │   ├── asana-tools.ts    asana_get_tasks, asana_get_overdue, asana_get_projects
│       │   └── intel-tools.ts    intel_client_pressure, intel_workload_balance, intel_weekly_summary
│       └── services/
│           ├── figma.ts          Figma API calls + aggregation
│           ├── asana.ts          Asana API calls + helpers
│           └── format.ts         Markdown tables, truncation, labels
├── __tests__/
│   ├── metrics.test.ts           42 tests — cycle time, on-time rate, health score, flags
│   └── auth.test.ts              8 tests — bearer validation, dev mode, edge cases
├── middleware.ts                 Password gate (HMAC-SHA256 cookie auth)
├── vitest.config.ts              Test configuration
└── .env.local.example            Environment variable template
```

---

## Setup

### 1. Clone + install

```bash
git clone https://github.com/jdfulmer/design-intel
cd design-intel
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

| Variable | Required | Where to get it |
|----------|----------|----------------|
| `FIGMA_PAT` | Yes | figma.com/settings → Personal access tokens |
| `FIGMA_TEAM_IDS` | Yes | Figma URL: `figma.com/files/team/TEAM_ID/...` (comma-separated) |
| `ASANA_PAT` | Yes | app.asana.com/0/my-apps → Personal access tokens |
| `ASANA_WORKSPACE_GID` | Yes | Visit `app.asana.com/api/1.0/workspaces` while logged in |
| `API_SECRET` | Yes | `openssl rand -hex 32` — protects API routes (required in production) |
| `DASHBOARD_PASSWORD` | No | Set to require login; leave empty for open access |
| `NEXT_PUBLIC_APP_URL` | No | Your Vercel deployment URL (set after first deploy) |

### 3. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

After the first deploy, copy the Vercel URL and set `NEXT_PUBLIC_APP_URL` in Vercel env vars.

### 4. Attach Vercel KV

In the Vercel dashboard → Storage → Create KV store → attach to this project. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

### 5. Run locally (dev)

```bash
npm run dev
```

### 6. Run tests

```bash
npm test           # single run
npm run test:watch # watch mode
```

---

## How It Works

### Figma Sync

The dashboard crawls Figma using standard REST API endpoints (no Enterprise plan required):

```
Team → Projects → Files → Version History + Comments
```

- **Version history** → who saved changes, when (maps to "edits")
- **Comments** → who reviewed or gave feedback
- **File/project structure** → which files and projects each designer touched

The sync runs in chunks to stay within Vercel's 60-second free tier limit, respects Figma's 20 req/min rate limit with built-in delays, and uses a distributed KV lock to prevent concurrent syncs from corrupting state. All API responses are validated with Zod schemas.

### Asana Integration

Pulls tasks with full metadata: assignee, due dates, completion status, custom fields (Task Progress, Type of Creative, Total ASINs), and project memberships. Pagination is capped at 1,000 results to prevent memory/timeout issues. Responses are Zod-validated.

### Caching

| Data | TTL |
|------|-----|
| Standard requests | 1 hour |
| Figma sync results | 24 hours |
| Completed tasks | 6 hours |
| Weekly snapshots | 90 days |
| Sync lock | 5 minutes |

Cache can be busted manually via the dashboard refresh button or `DELETE /api/cache`.

### Team Configuration

Figma and Asana use different display names for the same people. The canonical mapping lives in `lib/team-config.ts`. The MCP server keeps a synced copy in `mcp/src/constants.ts` (separate build). Update `lib/team-config.ts` when team members join, leave, or change display names.

### Security

- **Authentication**: HMAC-SHA256 cookie auth with timing-safe comparison (replaced FNV-1a)
- **API protection**: Bearer token required on all API routes; `API_SECRET` must be set in production
- **Secret isolation**: Dashboard uses a server-side proxy (`/api/data`) — no secrets in the browser
- **Error handling**: Differentiated error messages (401/429/5xx/network) instead of generic "Fetch failed"

---

## API Routes

All internal routes require `Authorization: Bearer <API_SECRET>` header. The dashboard uses `/api/data` as a server-side proxy.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/data` | GET | Server-side proxy — adds auth header, forwards to internal routes |
| `/api/data` | DELETE | Proxy for cache bust (`source=cache-bust`) |
| `/api/figma` | GET | Cached Figma designer activity |
| `/api/figma/sync` | POST | Trigger chunked Figma crawl (with distributed lock) |
| `/api/asana` | GET | Asana tasks. Params: `modified_since`, `project`, `include_completed`, `force` |
| `/api/auth` | POST | Password login — sets HMAC-SHA256 auth cookie |
| `/api/cache` | GET | Cache timestamps (last Figma/Asana fetch times) |
| `/api/cache` | DELETE | Bust cache — forces re-fetch on next request |
| `/api/snapshots` | GET | Last 12 weekly snapshots for trend charts |

---

## MCP Server (Phase 2)

### Build + run

```bash
cd mcp
npm install
npm run build
```

### stdio mode (Claude Code)

```bash
FIGMA_PAT=xxx FIGMA_TEAM_IDS=xxx ASANA_PAT=xxx ASANA_WORKSPACE_GID=xxx node dist/index.js
```

Add to your Claude Code MCP config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "design-intel": {
      "command": "node",
      "args": ["/path/to/design-intel/mcp/dist/index.js"],
      "env": {
        "FIGMA_PAT": "your-figma-pat",
        "FIGMA_TEAM_IDS": "your-team-id",
        "ASANA_PAT": "your-asana-pat",
        "ASANA_WORKSPACE_GID": "your-gid"
      }
    }
  }
}
```

### HTTP mode (remote / claude.ai)

```bash
TRANSPORT=http PORT=3001 node mcp/dist/index.js
```

Deploy the `/mcp` directory to Vercel, Railway, or any Node.js host.

### Available Tools

| Tool | What it answers |
|------|----------------|
| `figma_get_team_activity` | "What has each designer been working on this week?" |
| `figma_get_designer_stats` | "Who are the most active designers this month?" |
| `asana_get_tasks` | "What are Nicole's open tasks?" / "Show me overdue tasks on Project X" |
| `asana_get_overdue` | "What's overdue right now, sorted by urgency?" |
| `asana_get_projects` | "What projects exist in the workspace?" |
| `intel_client_pressure` | "Which clients are under the most pressure?" |
| `intel_workload_balance` | "Who's overloaded vs. who has capacity?" |
| `intel_weekly_summary` | "Give me a standup-ready ops brief for this week" |

All tools return markdown tables and support name-based filtering (partial match).

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Recharts, CSS custom properties (Figma token system)
- **Backend**: Next.js API routes, Vercel KV (Redis)
- **APIs**: Figma REST API (PAT auth), Asana Tasks API (PAT auth)
- **Validation**: Zod schemas on all external API responses
- **Auth**: HMAC-SHA256 cookie auth, bearer token API protection
- **Testing**: Vitest (50 tests across metrics + auth)
- **MCP**: TypeScript, stdio + HTTP transport
- **Deploy**: Vercel (free tier compatible with chunked sync + distributed lock)
