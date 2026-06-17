# AI & Data Platform Strategist Review

_Lens: Figma "Data Platform Engineer" (AI data agent, self-serve / prompt-based usage analytics, "bring data and models closer to the product experience") + "PM, AI Platform." Anchored to Figma operating realities #6 (AI-forward, data-forward) and #5 (Scale/usage insight)._

## Verdict

The **MCP server is the strategically valuable asset here, not the dashboard.** It is, in miniature, exactly what the Data Platform Engineer posting describes: a natural-language, tool-call interface over operational design data ("give me a design ops brief for Monday standup"). That is the right shape for where Figma is investing. **But the underlying metrics are not yet trustworthy enough to sit behind a self-serve AI agent.** The core unit of "work" — a Figma *version-history entry* counted as one "edit" (`lib/figma.ts:230`, `app/api/figma/sync/route.ts:215`) — is a weak, biased proxy, and the composite scores (heat, pressure, designer score, health) stack unvalidated proxies into single numbers a leader will read literally. The data layer (KV blob aggregates, no event grain, no warehouse) cannot support trustworthy self-serve analytics. Ship the MCP/NL angle; do not ship the leaderboard numbers as-is.

## Scores

| Dimension | Score | Justification |
|---|---|---|
| Figma strategic fit | **4** | NL-over-design-ops-data is squarely the Data Platform Engineer / AI Platform direction (reality #6). Loses a point because it's design-ops, not Figma *product* usage analytics (PM, Scale's actual remit). |
| Integration feasibility | **4** | MCP server already exists and speaks the right protocol; Figma is MCP-native. Clean attach point. Held back by Asana coupling and PAT-based crawl, not core-API-native telemetry. |
| Craft / native feel | **3** | Dashboard UI is on-brand (Figma palette, Inter). But emoji-laden MCP text tables (`format.ts:38-49`) and "🔴 HIGH" labels are not Figma's analytical taste bar. |
| Data trustworthiness | **2** | Version-count-as-edits is a misleading proxy; composite scores combine proxies with arbitrary weights and no confidence/null-handling discipline; `/versions` is unpaginated so active files are *undercounted*. A leader would be misled. |
| Differentiated value | **3** | The *cross-system* NL join (Figma activity × Asana delivery) is genuinely hard for Figma to build in a sprint because Figma doesn't own the Asana side. The metrics themselves are trivially replicable. |

## Top findings (ranked by leverage)

### 1. "Edits" = version-history entries is a misleading proxy for work, and it's silently undercounted
**Evidence:** Every named version returned by `/files/:key/versions` is counted as one edit — `d.edits++` per version object (`app/api/figma/sync/route.ts:215`; identical in `lib/figma.ts:230`). The Figma versions endpoint returns *named/checkpointed version-history snapshots* (autosaves plus manual saves), not keystroke- or change-level events. A designer doing an hour of dense work can produce one autosave version; a designer who manually saves named milestones produces many. So "edits" measures **save/checkpoint behavior**, not output or effort. Worse, `fetchFileVersions` makes a single `/versions` call with **no pagination cursor** (`lib/figma.ts:144`), so only the first page (~30 most recent versions) is ever seen — the *busiest* files hit the page cap first and are **systematically undercounted**, inverting the signal precisely where it matters.
**Why it misleads a leader:** Designer Score `edits*3 + comments*2 + files*2 + projects*3` (`app/dashboard.tsx:193`), the activity leaderboard, "Efficiency = edits ÷ active tasks" (`intel-tools.ts:167`), "HIGH LOAD = 8+ tasks & <15 edits" (`intel-tools.ts:168`), and "zero-edit designer" flags (`dashboard.tsx:1061`) all inherit this bias. A leader reading "Designer X has tasks but 0 edits" may conclude underperformance when X simply doesn't create named versions or works in files past the page cap.
**Recommendation:** (a) Rename "edits" to "version saves" everywhere — stop overclaiming it as work. (b) Paginate `/versions` to true completeness or explicitly cap-and-label ("≥N, sampled"). (c) Treat it as a *coarse activity-presence* signal, never a productivity/efficiency denominator. Suppress per-designer efficiency until grounded.

### 2. Composite scores stack unvalidated proxies into single authoritative-looking numbers
**Evidence:** Heat = `edits*3 + comments*1` (`dashboard.tsx:1170`); Pressure = `tasks + overdue*3 − min(edits*0.3, tasks)` (`dashboard.tsx:915`, `intel-tools.ts:79`); Health = on-time*40 + cycle(3-14d ramp)*30 + velocity(thisWeek/lastWeek)*30 (`lib/metrics.ts:89-110`). The weights (3, 2, 0.3, 40/30/30) are unsourced magic numbers with no validation against an outcome. Pressure literally *subtracts Figma version-saves from task load* — mixing two incomparable, separately-flawed proxies into one ordinal — and "High pressure ≥15 / Med ≥8" thresholds (`format.ts:38`) are absolute, so a 40-person client and a 4-person client are scored on the same scale.
**Why it misleads:** These render as crisp integers and 🔴/🟡/🟢 labels. Leaders anchor on them. A client can flip from 🔴 to 🟡 purely because a designer saved more named versions, not because delivery risk changed.
**Recommendation:** For an AI-agent surface, **expose the components, not the composite.** Let the agent answer "which clients have the most overdue tasks AND least design activity" from grounded sub-metrics rather than serving a black-box index. If a composite is kept, ship the weighting rationale and a confidence/coverage indicator inline.

### 3. KV blob aggregates can't support trustworthy self-serve analytics — Figma's direction needs event grain
**Evidence:** Sync writes a single pre-aggregated blob to KV (`figma:latest-sync`, `app/api/figma/sync/route.ts:257-263`) and weekly snapshot blobs (`snapshotCacheKey`, line 434). There is no event table, no per-version/per-comment row retained, no dimensional model. Designer↔Asana identity is resolved by name-substring matching (`dashboard.tsx:913`, `intel-tools.ts:69`) and the server even concedes it has "no reliable Asana→Figma name mapping" and falls back to raw assignee strings (`route.ts:360-361`). Cycle time is task-create→complete wall-clock with no working-day/WIP adjustment (`lib/metrics.ts:37-40`), and on-time rate silently excludes every task lacking a `due_on` (`lib/metrics.ts:63`), so the denominator is self-selected.
**Why it matters strategically:** The Data Platform Engineer mandate is *self-serve* analytics — arbitrary, ad-hoc questions. Pre-baked aggregates can only answer the questions someone hard-coded. You cannot re-slice, audit, or backfill a corrected metric without a re-crawl. Substring identity joins will silently double-count or drop people.
**Recommendation:** Persist the grain (version events, comment events, task transitions) into a real columnar store (the team's `mcp__Supabase__*` Postgres tooling is right-sized) keyed on stable IDs (Figma `user.id`, Asana `gid`), with an explicit identity-mapping table. Build aggregates as queries over that grain. This is the precondition for the MCP agent to answer questions nobody pre-computed.

## Improve (product on its own terms)

1. **Truth-in-labeling pass on every metric.** "Edits"→"version saves"; surface null/low-coverage states instead of neutral-scoring them (Health gives 20/40 for "no on-time data," `metrics.ts:95` — indistinguishable from a real 50% rate). Every composite ships with its formula and a coverage %.
2. **Make the MCP layer the product.** The three intel tools (`intel-tools.ts`) are the differentiated surface. Add `structuredContent` everywhere (already present on two of three) so an agent can reason over numbers rather than re-parse markdown, and strip emoji from machine-facing output.
3. **Ground the joins.** Replace substring matching with an explicit ID-mapping table; this single change removes a whole class of silent attribution errors that poison every downstream score.

## Integrate (path into Figma, with the specific surface)

- **Primary surface: an MCP-exposed "design ops" toolset behind Figma's AI data agent.** Figma is building exactly this (Data Platform Engineer: "AI data agent… prompt-based usage analytics"). `design-intel`'s `intel_weekly_summary` / `intel_client_pressure` / `intel_workload_balance` are a working prototype of NL-over-ops-data. The integration is not "add a dashboard tab" — it's "register these as grounded tools the agent can call, with the metrics fixed and the grain in a warehouse."
- **Secondary: feed Figma's funded usage-insight surface (PM, Scale).** The *honest* sub-metrics (active files, comment volume, version cadence by team/project) are legitimate inputs to admin usage analytics — but only the Figma-native ones; the Asana half stays external.
- **What NOT to integrate:** the composite scores and the leaderboard framing. They don't meet Figma's analytical taste bar and would generate exactly the "this metric is wrong" trust failures an AI data agent must avoid.

## Kill-shots / risks

- **Trust kill-shot:** an AI agent that confidently serves a misleading "edits"/efficiency number is *worse* than no agent — it launders a bad proxy through a trusted NL interface. Figma will not ship an agent that misranks its own designers. The metric validity must be fixed before, not after, the AI surface.
- **Strategic-scope mismatch:** Figma's analytics investment is about *Figma product usage*; this measures *design-team delivery ops* with a heavy Asana dependency Figma doesn't own. Easy build-vs-buy answer: Figma builds the Figma-native half, doesn't acquire the Asana coupling.
- **Replicability:** strip the cross-system join and every remaining metric is a few lines of SQL Figma can build in a sprint — the moat is entirely the (currently fragile) Figma×task-system join.

## Hand-off to: Platform & Extensibility Engineer

The MCP server is the asset I'd carry forward, but it rests on a PAT-based crawl with hard caps (`MAX_FILES=50`, `lib/figma.ts:87`; unpaginated `/versions`, `:144`) and a 3.2s self-throttle against Figma's ~20 req/min limit (`:86`). **Question for you:** at Figma's scale and inside Figma's own auth/rate-limit envelope, is there a first-party telemetry/event path (not the public REST `/versions` endpoint) that would give this the *true edit/event grain* my metrics need — making the proxy problem disappear rather than merely relabeled?
