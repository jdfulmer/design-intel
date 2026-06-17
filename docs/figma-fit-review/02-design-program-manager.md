# Design Program Manager / Design Ops Lead Review

*Lens: Figma "Design Program Manager, Platform" — clear rhythms for collaboration, review, tracking, and leadership approval; high-leverage frameworks and rituals; experimenting with modern tooling (AI orchestration, API usage, workflow automation).*

## Verdict (2-3 sentences)

As the practitioner who would actually run a design org with this, `design-intel` already computes the *right* signals — overdue clustering, bus factor, cycle time, on-time rate, workload imbalance, velocity drop (`app/dashboard.tsx:1012-1116`). That is rare and valuable: most "design analytics" never get past edit counts. But it stops one step short of being operational: it **describes problems without prescribing actions, never leaves the dashboard (no alerting, no readout, no narrative), and several headline numbers use arbitrary thresholds I could not defend to leadership.** It is a strong diagnostic surface and a weak ritual engine — fixable, and the fix is exactly the "rituals + workflow automation" the JD is hiring for.

## Scores

| Dimension | Score | Justification |
|---|---|---|
| Figma strategic fit | 4 | Directly serves the Design Program Manager / Design Ops mandate (review/tracking/leadership-approval rhythms); the signal set is what a DPM staffs and prioritizes on. |
| Integration feasibility | 3 | Rituals need *push* surfaces (Slack/email digest, FigJam readout, calendar-triggered standup view). Today it is pull-only; the flag/snapshot logic is portable but no delivery channel exists. |
| Craft / native feel | 4 | Figma-native theming, flags with drill-down to tasks (`dashboard.tsx:1030-1034`), clean tabs. Loses a point: numbers-only, no narrative, no "so what." |
| Data trustworthiness | 2 | Right *concepts*, shaky *definitions*: arbitrary load thresholds, mixed-unit pressure score, and a snapshot bug that zeros per-designer edits. I would not put these in a leadership readout unannotated. |
| Differentiated value | 4 | Cross-referencing Figma version history against Asana ownership to produce bus-factor and overdue-clustering flags is genuinely hard to reproduce in a sprint; it is the cross-tool join that matters. |

## Top findings (ranked by leverage)

### 1. Flags diagnose but do not prescribe — no recommendation, no owner, no next action
**Finding:** The flags engine is the heart of the product for a DPM, and it is good: overdue clustering at ≥3 per client (`dashboard.tsx:1027-1035`), bus factor (single designer + ≥3 tasks, `1051-1058`), zero-edit-with-load designers (`1061-1066`), overload (`1069-1074`), velocity drop ≥50% (`1077-1085`), stale 14+ days (`1088-1099`). But every flag states a *condition*, not an *action*. Only the bus-factor flag ends with weak guidance — "consider cross-coverage" (`1057`). No flag names who should act, what to reassign, or by when.
**Evidence:** `Flag` type (`dashboard.tsx:39-45`) has `title`/`detail`/`tasks` but no `recommendation`, `owner`, or `dueBy` field. `topAlert` (`lib/metrics.ts:114-134`) likewise returns text + severity only.
**Recommendation:** Add a `recommendation` + suggested-owner to each flag. For overdue clustering: "Reassign 2 of N from {overloaded designer} to {lowest-load designer}." For bus factor: name a specific shadow. This converts a dashboard into a standup agenda — the single highest-leverage change for ritual fit.

### 2. Everything is pull, nothing is pushed — there is no ritual delivery channel
**Finding:** A DPM lives in standups, Slack, and weekly leadership readouts, not in a dashboard tab. This tool requires someone to remember to open it. `topAlert` computes a single headline severity (`metrics.ts:114-134`) but it only renders in-app; weekly snapshots are generated (`sync/route.ts:311-435`) but only stored to KV and rendered in the Trends tab — they are never sent anywhere.
**Evidence:** Snapshot is written with `cacheSet(key, snapshot)` (`sync/route.ts:434`) and consumed only by the dashboard. No email/Slack/webhook emit path exists in the sync route.
**Recommendation:** On snapshot completion, emit a Monday-morning digest (Slack/email) and a "today's flags" alert when severity is red. This is literally the JD's "rituals… workflow automation." Highest integration leverage; reuses existing computed objects.

### 3. The snapshot is numbers, not narrative — unusable as a leadership readout
**Finding:** The weekly snapshot is the natural artifact for "leadership approval" rhythms, but it is a bag of integers (`team.totalEdits`, `onTimeRate`, `overdueCount`, etc., `metrics.ts:4-32`). There is no week-over-week delta prose, no "what changed and why it matters." A DPM cannot paste this into a review without rewriting it by hand.
**Evidence:** `generateWeeklySnapshot` (`sync/route.ts:311-435`) produces only numeric fields; no `summary`/`highlights`/`risks` narrative is generated.
**Recommendation:** Generate a 3-bullet narrative per snapshot (top win, top risk, staffing watch) — ideally via the existing MCP/LLM path so it is one prompt over the already-computed snapshot. This is the natural hook into Figma's "AI data agent / prompt-based usage analytics" direction.

### 4. Trust gaps in the headline metrics I would actually staff on
**Finding:** The *concepts* are the ones I trust; several *definitions* I do not.
- **Workload "highLoad" = `active >= 8 && edits < 15`** (`dashboard.tsx:967`): hard-coded thresholds with no per-person baseline or role weighting. An IC doing deep work on one file looks "overloaded with no output." I would not staff off this without a baseline.
- **Pressure score = `tasks + overdue*3 - min(edits*0.3, tasks)`** (`dashboard.tsx:915`): mixes incommensurable units (task counts vs. Figma version events) into one integer. Directionally readable, not defensible to leadership.
- **"Edits" = version-history entries** (`sync/route.ts:207-220`): a coarse activity proxy, not output; autosave cadence varies wildly by working style.
- **Cycle time = created → completed** (`metrics.ts:37-40`): this is intake-to-done, not active work time; a task sitting in a backlog inflates it. Fine if *labeled* as lead time, misleading if called "cycle time."
- **Snapshot per-designer edits are usually 0** — a real defect: snapshot designer rows are keyed by Asana assignee name (`sync/route.ts:360-372`) but edits are looked up from `designerMap` keyed by *Figma* handle (`sync/route.ts:409-413`), and the code itself flags "no reliable Asana→Figma name mapping here on the server" (`sync/route.ts:360-361`). So leadership trend lines understate design activity.
**Evidence:** Cited inline above.
**Recommendation:** (a) Replace fixed thresholds with rolling per-person baselines (flag deviation, not absolute count). (b) Relabel "cycle time" as "lead time," or compute active time from first-edit→completion. (c) Fix the snapshot name-mapping by importing `toFigmaName` server-side (it already exists in `lib/team-config.ts:32`). (d) Caveat the pressure score in-UI as a heuristic.

### 5. On-time rate is the one number I trust as-is
**Finding:** `onTimeRate` (`metrics.ts:60-70`) compares completion date to due date as date-only strings and excludes tasks with no due date — exactly right; it avoids timezone false-negatives and does not penalize undated work.
**Evidence:** `metrics.ts:63-69`.
**Recommendation:** Lead leadership readouts with on-time rate + overdue clustering; treat workload/pressure as supporting color until thresholds are baselined.

## Improve (product on its own terms)

1. **Make flags actionable** — add recommendation + suggested owner + suggested reassignment to each flag (finding 1). Turns the Flags tab into a standup script.
2. **Ship a digest** — Monday snapshot to Slack/email; red-severity alert on detection (finding 2).
3. **Add narrative** — 3-bullet auto-summary per snapshot (finding 3).
4. **Baseline the thresholds** — rolling per-person/per-team baselines instead of `active>=8 && edits<15`; relabel lead time; fix the snapshot edit-attribution bug (finding 4).
5. **Capacity view** — the workload tab has active/overdue/efficiency (`dashboard.tsx:949-969`) but no *capacity target*. Add a per-person WIP target so "overloaded" means "over their stated capacity," not over a global constant — that is what a DPM actually uses for staffing calls.

## Integrate (path into Figma, with the specific surface)

- **FigJam weekly-review widget / readout** is the most ritual-native surface: the snapshot + 3-bullet narrative rendered as a board a team reviews live, honoring "multiplayer by default." Generate it from the existing snapshot object via the Figma MCP `generate_diagram`/FigJam tools.
- **Slack digest via workflow automation** for the push channel (finding 2) — this is the JD's "experiment with modern tooling… workflow automation" almost verbatim.
- **MCP-backed natural-language readout** ("what's at risk this week, who's overloaded") plugs the narrative gap (finding 3) into Figma's AI-data-agent direction — hand-off to the AI/Data reviewer.

## Kill-shots / risks

- **Trust kill-shot:** if leadership ever catches the snapshot zeroing designer edits (`sync/route.ts:360-372`) or the mixed-unit pressure score, the whole tool loses credibility in one readout. Fix data trust *before* pitching it as a ritual engine.
- **Surface conflict:** Figma already ships usage analytics for admins (PM, Scale). A *team-delivery* ritual layer (this) is differentiated, but a generic dashboard is not — lead with flags + readout, not charts.
- **Small-team coupling:** all logic assumes a hand-maintained Asana↔Figma name map (`team-config.ts:9-26`) and Asana as the task source. Inside Figma this would need to bind to native projects/assignment, not Asana.

## Hand-off to:

**AI & Data Platform Strategist** — Can the weekly snapshot narrative + the per-flag recommendation be generated reliably through the MCP/AI-data-agent path (prompt-over-computed-snapshot), so the "rituals" layer is LLM-authored rather than templated? And does the metric set survive your validity bar well enough to feed an NL "what's at risk this week" query?
