# Design Intel

Figma × Asana cross-intelligence dashboard for design ops at D2E Labs / Market Defense.

**Phase 1** — Live Next.js dashboard powered by Figma Activity Logs API + Asana Tasks API, deployed to Vercel with hourly KV cache.

**Phase 2** — MCP server exposing Figma + Asana tools for Claude Code and claude.ai.

---

## Repo Structure

```
design-intel/
├── app/                      Next.js App Router
│   ├── page.tsx              Dashboard entry
│   ├── dashboard.tsx         Client component — fetches from API routes
│   ├── api/figma/            Figma activity logs route + OAuth flow
│   ├── api/asana/            Asana tasks route
│   └── api/cache/            Cache status + bust endpoint
├── lib/
│   ├── figma.ts              Figma API client + OAuth helpers
│   ├── asana.ts              Asana API client + helpers
│   ├── cache.ts              Vercel KV cache layer (1hr TTL)
│   └── auth.ts               API route bearer token guard
├── mcp/                      Phase 2 MCP server (TypeScript)
│   └── src/
│       ├── index.ts          Entry point — HTTP or stdio transport
│       ├── tools/
│       │   ├── figma-tools.ts        figma_get_activity, figma_get_designer_stats
│       │   ├── asana-tools.ts        asana_get_tasks, asana_get_overdue, asana_get_projects
│       │   └── intel-tools.ts        intel_client_pressure, intel_workload_balance, intel_weekly_summary
│       └── services/
│           ├── figma.ts      Figma API calls + aggregation
│           ├── asana.ts      Asana API calls + helpers
│           └── format.ts     Markdown table, truncation, labels
└── .env.local.example        Copy to .env.local and fill in values
```

---

## Phase 1 Setup — Live Dashboard

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

Fill in `.env.local`:

| Variable | Where to get it |
|----------|----------------|
| `FIGMA_CLIENT_ID` | figma.com/developers/apps → your app → OAuth credentials |
| `FIGMA_CLIENT_SECRET` | Same location |
| `FIGMA_ORG_ID` | Figma Admin settings URL |
| `ASANA_PAT` | app.asana.com/0/my-apps → Personal access tokens |
| `ASANA_WORKSPACE_GID` | Visit app.asana.com/api/1.0/workspaces while logged in |
| `API_SECRET` | `openssl rand -hex 32` |

### 3. Deploy to Vercel

```bash
npm install -g vercel
vercel          # first deploy — confirms your project URL
```

After the first deploy:
1. Copy the Vercel URL (e.g. `design-intel-abc123.vercel.app`)
2. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars + `.env.local`
3. Update your Figma OAuth app redirect URL: `https://your-url.vercel.app/api/figma/callback`

### 4. Attach Vercel KV (hourly cache)

In the Vercel dashboard → Storage → Create KV store → attach to this project.
Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.

### 5. Complete Figma OAuth (one-time)

Visit `https://your-url.vercel.app/api/figma/auth` in your browser while logged in as the org admin.
Figma will redirect to the callback page — **copy the tokens shown** and add them to Vercel env vars:
- `FIGMA_OAUTH_TOKEN`
- `FIGMA_OAUTH_REFRESH_TOKEN`

The tokens expire — re-run `/api/figma/auth` to refresh.

---

## Phase 2 Setup — MCP Server

```bash
cd mcp
npm install
npm run build
```

### Run locally (stdio — for Claude Code)

```bash
FIGMA_OAUTH_TOKEN=xxx ASANA_PAT=xxx ASANA_WORKSPACE_GID=xxx node dist/index.js
```

Add to `~/.claude/claude_desktop_config.json` (Claude Code):

```json
{
  "mcpServers": {
    "design-intel": {
      "command": "node",
      "args": ["/path/to/design-intel/mcp/dist/index.js"],
      "env": {
        "FIGMA_OAUTH_TOKEN": "your-token",
        "ASANA_PAT": "your-pat",
        "ASANA_WORKSPACE_GID": "your-gid"
      }
    }
  }
}
```

### Run as HTTP server (for claude.ai remote MCP)

```bash
TRANSPORT=http PORT=3001 node mcp/dist/index.js
```

Or deploy the `/mcp` directory to a separate Vercel project / Railway instance.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/figma` | GET | Fetch Figma activity logs. Params: `start`, `end` (unix), `force` |
| `/api/figma/auth` | GET | Initiate Figma OAuth flow (admin only) |
| `/api/figma/callback` | GET | OAuth callback — displays tokens for manual copy |
| `/api/asana` | GET | Fetch Asana tasks. Params: `modified_since`, `project`, `force` |
| `/api/cache` | GET | Cache timestamps (last fetch times) |
| `/api/cache` | DELETE | Bust cache — forces re-fetch on next request |

All routes require `Authorization: Bearer <API_SECRET>` header.

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `figma_get_activity` | Raw activity log events by date range / actor / event type |
| `figma_get_designer_stats` | Aggregated scores: exports, views, creates, files, clients |
| `asana_get_tasks` | Open tasks with filters: project, assignee, overdue, modified_since |
| `asana_get_overdue` | All overdue tasks sorted by most overdue |
| `asana_get_projects` | List all workspace projects with GIDs |
| `intel_client_pressure` | Client Pressure Index: task load vs Figma export volume |
| `intel_workload_balance` | Designer workload: Asana tasks vs Figma output + efficiency |
| `intel_weekly_summary` | Full design ops digest — designed for standup/exec reporting |

---

## Name Mapping

Asana and Figma use different display names for the same people.
The mapping lives in `mcp/src/constants.ts` and `app/dashboard.tsx`.
Update both if team members change names.

---

## Refreshing Data

- **Auto**: Dashboard fetches on load, caches for 1 hour via Vercel KV
- **Manual**: Click "↺ Refresh now" in the dashboard top bar
- **Force via API**: `DELETE /api/cache` then reload
- **MCP tools**: Always pull live from APIs (no cache layer in MCP)
