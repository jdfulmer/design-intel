# Platform & Extensibility Engineer Review

## Verdict

The Figma integration is a **polling crawler over the public REST API with a personal access token** — architecturally the opposite of how value reaches Figma users (plugins, widgets, Dev Mode, webhooks, OAuth/org-scoped apps). The code is competent for a small-team side tool (Zod validation and graceful degradation in `lib/figma.ts`, chunked-with-lock crawl in `app/api/figma/sync/route.ts`), but it will not survive Figma scale, and the data primitives it depends on (version-history "edits" as an activity proxy) are not available through any first-class extension surface. The MCP server is the most strategically interesting and most reusable asset, but it ships with an **unauthenticated HTTP endpoint** that disqualifies it for enterprise as-is. Recommend: keep as an internal/admin REST integration; rebuild the activity signal on **webhooks**; reposition the MCP tools to ride Figma's own MCP rather than compete with it.

## Scores

| Dimension | Score | Justification |
|---|---|---|
| Figma strategic fit | 3/5 | Usage-insight/analytics is funded (PM, Scale), and the NL/MCP angle maps to the Data Platform "AI data agent" — but it sits in a BI silo, not the live canvas (operating reality #1). |
| Integration feasibility | 2/5 | Attaches only via PAT + public REST polling (`lib/figma.ts:90,103`). No OAuth, no org scoping, no webhooks, no plugin/widget/Dev-Mode surface. PAT auth is a hard blocker for any multi-org product. |
| Craft / native feel | 2/5 | Nothing renders inside Figma; it is an external Next.js dashboard. No canvas, multiplayer, or Dev Mode presence to judge against Figma's taste bar. |
| Data trustworthiness | 2/5 | "Edits" = count of named version-history entries (`lib/figma.ts:225-232`), capped at 50 files (`:201`) and 30 days. Most edits never produce a named version, so the core metric systematically undercounts and is comparable only within the sampled set. |
| Differentiated value | 3/5 | Figma↔Asana cross-correlation + packaged MCP tools (`mcp/src/tools/intel-tools.ts`) is real glue Figma wouldn't build in a sprint; the underlying crawl, however, is trivially replicable. |

## Top findings (ranked by leverage)

### 1. Polling the public REST API is the wrong architecture inside Figma — use webhooks
**Evidence:** `fetchTeamActivity` walks teams → projects → files → versions → comments serially with hardcoded `delay` between every call (`lib/figma.ts:182,194,223,237`), then caps at `MAX_FILES = 50` (`:87,:201`). The whole crawl is re-run from scratch each cron tick every 2 hours (`vercel.json:6`, `app/api/figma/sync/route.ts:94`). This is O(files × 2) sequential REST calls bounded only by a 50-file cap, and it re-fetches unchanged history every run.
**Why it breaks at scale:** A real Figma org has thousands of files. At ~18-60 req/min self-throttling (`lib/figma.ts:86`, `sync/route.ts:30`) a full crawl of a large org would take hours and still miss everything past file #50. The data is also already stale by design (2-hour cron).
**Recommendation:** Replace the crawler with **Figma webhooks** (`FILE_UPDATE`, `FILE_VERSION_UPDATE`, `FILE_COMMENT`, `LIBRARY_PUBLISH`). Maintain an event-sourced activity store and reconcile periodically. This is the only architecture that is both current and scalable, and it aligns with Figma's event-driven, multiplayer-by-default reality (charter operating reality #1).

### 2. The MCP HTTP transport is unauthenticated — enterprise kill-shot
**Evidence:** `mcp/src/index.ts:35-43` mounts `POST /mcp` with `sessionIdGenerator: undefined` and **no auth middleware whatsoever**. Anyone who can reach the host can invoke every tool, each of which calls Figma/Asana with the server's PAT (`mcp/src/services/figma.ts:16`). Compare the REST routes, which at least gate on `requireApiSecret` (`app/api/figma/sync/route.ts:72`, `lib/auth.ts`). The MCP server has no equivalent.
**Recommendation:** Before this is presentable for enterprise, the HTTP transport needs bearer/OAuth auth, origin allowlisting, and per-caller token scoping. This is the single most important fix for the most strategically valuable asset.

### 3. No rate-limit (429) or retry handling — the resilience story is missing
**Evidence:** `figmaFetch` treats any non-2xx identically: read the body and `throw` (`lib/figma.ts:106-109`; same in `mcp/src/services/figma.ts:31-35`). There is **no 429 detection, no `Retry-After`, no backoff, no pagination follow**. Rate limiting is "prevented" only by fixed `setTimeout` delays tuned to a guessed limit ("~18 requests/min … under Figma's 20/min", `lib/figma.ts:86`). One transient 429 or 5xx aborts the entire chunk and bubbles a 500 (`sync/route.ts:299-304`). The Zod layer is genuinely good (`lib/figma.ts:42-83`, `safeParse` + warn + `[]` fallback) — but it only covers schema drift, not transport failure.
**Recommendation:** Add `Retry-After`-aware exponential backoff on 429/5xx and follow pagination cursors where the endpoints return them. Until then the crawl is brittle to any throttling, which Figma's API does enforce.

### 4. Cron auth has a deliberate forgeable-header fallback
**Evidence:** `app/api/cron/route.ts:24` accepts any request bearing `x-vercel-cron-schedule` as authorized. The comment (`:20-23`) argues Vercel strips inbound `x-vercel-*` headers so it can't be forged — true *on Vercel's edge*, but it makes correctness depend entirely on the hosting platform's header hygiene, and the route then self-calls `/api/figma/sync` with the real `API_SECRET` (`:39-41`). The recent commit `5a43bd4` ("cron 401") shows this path is actively churning. Acceptable as a self-healing bootstrap for a personal deploy; not acceptable for anything Figma would run.
**Recommendation:** Drop the header fallback; require `CRON_SECRET`. Fine for now, must go for enterprise.

### 5. Two divergent Figma clients — the dashboard's is hardened, the MCP's is not
**Evidence:** `lib/figma.ts` validates with Zod and returns `[]` on bad data; `mcp/src/services/figma.ts:42-47` does raw `data.projects` with no validation, no `cache: no-store`, a different `REQUEST_DELAY_MS` (500 vs 3200), and a different `MAX_FILES` (25 vs 50). The crawl logic is otherwise copy-pasted. The MCP tools are also `// @ts-nocheck` (`mcp/src/tools/*.ts:1`), disabling type safety on the surface most likely to be reused.
**Recommendation:** Extract one shared, validated, retrying Figma client and consume it from both. Remove `@ts-nocheck`. The SDK bump to `@modelcontextprotocol/sdk ^1.29.0` (`mcp/package.json:12`) is current and good; the stateless `enableJsonResponse` transport is a reasonable pattern — but it needs the auth from finding #2.

## Improve (product on its own terms)

- **Webhooks over polling** (finding #1): event-driven freshness instead of a 2-hour stale snapshot, and removes the 50-file ceiling.
- **One shared, resilient Figma client** with Zod + 429/5xx backoff + pagination (findings #3, #5).
- **Auth the MCP HTTP endpoint** (finding #2) and remove `@ts-nocheck`.
- **Fix the activity proxy:** named version-history entries undercount real edits; either label the metric honestly ("named checkpoints") or move to webhook `FILE_UPDATE` deltas for a defensible signal.

## Integrate (path into Figma, with the specific surface)

Ranked by feasibility:

1. **Admin/org REST integration (most realistic).** This is fundamentally an analytics back-end. It belongs behind Figma's **org admin + Analytics API** surface (charter: PM, Scale — "insight and control around usage"), authenticated via an **OAuth2 org-scoped app, not a PAT**. The crawler becomes a webhook consumer feeding admin usage insight.
2. **MCP tools folded into Figma's own MCP.** Figma is shipping its own MCP server (the Figma MCP tools present in this very environment). A standalone competing server is strategically redundant; the *cross-system intel tools* (`intel_client_pressure`, `intel_workload_balance`, `intel_weekly_summary` in `mcp/src/tools/intel-tools.ts`) are the differentiated part and could ship as capabilities riding Figma's MCP / AI data agent (charter: Data Platform Engineer — "prompt-based usage analytics").
3. **Dev Mode panel / widget (weakest fit).** The data is org-level operations, not file-level design context, so it does not belong on the canvas or in Dev Mode. A FigJam weekly-snapshot widget is the only canvas-native slice worth a small bet.

The Asana coupling (`mcp/src/constants.ts:8-25` hardcodes a 16-person name map) is the part Figma would *not* take — it's specific to one team's workflow, not a platform primitive.

## Kill-shots / risks

- **PAT-only auth** (`lib/figma.ts:90`): no multi-org product can ship on a single personal token. Hard blocker until OAuth.
- **Unauthenticated MCP HTTP endpoint** (`mcp/src/index.ts:35`): enterprise-disqualifying as written.
- **Strategic redundancy:** Figma ships its own MCP server; a parallel one is build-vs-buy on the wrong side.
- **Scale:** 50-file cap + serial polling (`lib/figma.ts:201`) cannot represent a real org.
- **Metric validity:** version-history "edits" is a weak proxy (finding #4) — see Data Platform reviewer.

## Hand-off to: AI & Data Platform Strategist

The MCP tools are the most reusable asset here, but they rest on a metric I've flagged as structurally undercounting: "edits" = named version-history entries, sampled from at most 50 files over 30 days (`lib/figma.ts:201,225-232`). **Is this signal defensible enough to feed a natural-language self-serve analytics / AI-data-agent surface, or does the NL layer launder a biased sample into confident-sounding answers?** If we move to webhook `FILE_UPDATE` deltas (my finding #1), does that give you a metric you'd trust to expose through Figma's AI data agent?
