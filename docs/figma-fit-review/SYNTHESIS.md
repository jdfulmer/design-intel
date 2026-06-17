# Design Intel → Figma Fit — Lead Synthesis

**Date:** 2026-06-17 · **Inputs:** 4 reviews in this folder (01–04) · **Method:** charter rubric, evidence-cited.

## One-line recommendation

**Do not pitch design-intel to Figma as a product or adopt its metrics. Pitch the two assets buried
inside it — (1) the MCP / natural-language interface to design-ops data, and (2) the cross-tool
"delivery health" concept — but only after fixing a shared, fatal data-trust problem and an auth
kill-shot.** Sequence below.

## Consensus scorecard (avg of 4 reviewers, 1–5)

| Dimension | Ent. PM | DPM | Platform | AI/Data | **Avg** | Read |
|---|:--:|:--:|:--:|:--:|:--:|---|
| Figma strategic fit | 3 | 4 | 3 | 4 | **3.5** | Right lanes — Scale/Admin, Design Ops, AI/Data are all funded. |
| Integration feasibility | 2 | 3 | 2 | 4 | **2.75** | Attaches as an external app; auth/architecture not Figma-native. |
| Craft / native feel | 4 | 4 | 2 | 3 | **3.25** | Visually on-brand; architecturally *not* native (see conflict §). |
| **Data trustworthiness** | 2 | 2 | 2 | 2 | **2.0** | **Unanimous. The headline problem.** |
| Differentiated value | 2 | 4 | 3 | 3 | **3.0** | Only the cross-tool correlation + MCP/NL angle are non-trivial. |

## What all four reviewers agree on (act on these first)

1. **The metrics are not defensible — unanimous 2/5.** "Edits" = Figma version-history entries
   (`app/api/figma/sync/route.ts:215`, `lib/figma.ts:230`), a biased proxy for "work"; `/versions`
   is unpaginated (`lib/figma.ts:144`) and the crawl is capped at 50 files (`lib/figma.ts:87`), so
   the *busiest* files are **undercounted**. Composite scores — heat = `edits*3+comments`
   (`dashboard.tsx:1170`), "pressure" (`dashboard.tsx:915`), health (`lib/metrics.ts:89`) — stack
   unvalidated proxies with magic-number weights into authoritative-looking integers leaders read
   literally. **No leadership readout should ship on these numbers until they're rebuilt.**
2. **Identity join is broken.** Figma↔Asana correlation relies on a hand-kept name dictionary +
   substring matching (`lib/team-config.ts:9-26`, `dashboard.tsx:913`); the server itself concedes
   it has "no reliable Asana→Figma name map" and the weekly snapshot consequently **zeros per-designer
   edits** (`app/api/figma/sync/route.ts:360-372`). This is a correctness bug, not just a limitation.
3. **The MCP server is the most strategic asset — and it's unauthenticated.** Reviewers 03 and 04
   independently flag that the MCP/NL angle is a working prototype of Figma's *Data Platform Engineer*
   "AI data agent / self-serve analytics" vision — but the HTTP transport ships with **no auth**
   (`mcp/src/index.ts:35-43`) while holding a Figma PAT. Enterprise kill-shot; fix before any demo.
4. **Polling is the wrong architecture for Figma.** A serial team→file→version crawl re-run every 2h
   (`vercel.json:6`) should be **Figma webhooks**; there's no 429/backoff/retry — any non-2xx just
   throws (`lib/figma.ts:106-109`).
5. **It diagnoses but never prescribes or pushes.** Flags state conditions, not actions
   (`dashboard.tsx:1012-1116`); `topAlert`/weekly snapshots are computed but only render in-app
   (`sync/route.ts:434`) — no Slack/email digest, no recommendation/owner. This is precisely the
   "rituals + workflow automation" the *Design Program Manager, Platform* role exists to build.

## Conflicts, resolved

- **Craft score split (4/4 vs 2/3).** Not a real disagreement: the UI is *visually* Figma-native
  (tokens, Inter, light/dark, clean drill-downs) but *architecturally* a separate web app, not a
  surface inside Figma. **Resolution: on-brand skin, off-platform substance.** Craft is an asset for
  a standalone tool, neutral-to-negative as evidence it belongs *inside* Figma.
- **"Harvest the concept" (01) vs "ship the MCP" (04) vs "rebuild on webhooks + fold into Figma's
  MCP" (03) vs "add rituals" (02).** These compose rather than conflict. The product-as-a-whole is
  not a Figma feature (01 is right); the *cross-tool delivery-health concept* + the *MCP/NL interface*
  are the assets (04); they must be re-platformed on webhooks and Figma's own MCP (03) and only
  become valuable once they drive rituals/automation (02). The roadmap below sequences exactly that.

## Where it integrates into Figma (the honest answer)

- **Primary lane — PM, Scale (Enterprise Admin Insights).** Figma is funding "insight *and control*
  over usage of Figma." design-intel delivers the *insight* half and **none of the control half**
  (no seats/permissions/policy). It's a partial fit, and Figma could rebuild the insight half in a
  sprint. *Not* a standalone pitch.
- **Strategic wedge — AI Data Agent / self-serve analytics (Data Platform Engineer + PM, AI Platform).**
  The MCP server is a credible prototype of "prompt-based usage analytics." This is the one place
  design-intel does something Figma hasn't trivially shipped. **Lead with this.**
- **Differentiator — cross-tool (Figma + project tool) delivery health.** Figma sees the *design*
  side; the value is correlating it with delivery/PM data. Inside Figma this is also a *liability*
  (hard Asana dependency, off-strategy) unless generalized to a connector model. Treat as a concept,
  not the current Asana-coupled code.

## Sequenced roadmap

**Phase 0 — Earn the right (fix kill-shots; nothing ships before this):**
1. Authenticate the MCP HTTP transport (`mcp/src/index.ts`); scope the Figma token per request.
2. Rebuild the identity join on stable IDs (Figma user id ↔ Asana gid), kill substring matching;
   fix the snapshot per-designer-edit zeroing bug.
3. Stop overclaiming on metrics: relabel "edits" as "version checkpoints," paginate `/versions`,
   remove the 50-file cap or make it explicit, and show confidence/coverage on every composite.

**Phase 1 — Prove the wedge:**
4. Promote the **MCP/NL interface** to the headline: "ask your design-ops data in plain language."
   Align tool surface with Figma's own MCP conventions.
5. Replace the polling crawler with **Figma webhooks** + incremental event grain (lands in a warehouse,
   not KV blobs) so self-serve analytics is trustworthy.

**Phase 2 — Make it native & actionable:**
6. Attach to a real Figma surface: an **admin/Scale insights** panel and/or a Dev-Mode-adjacent view;
   fold the intel tools into Figma's MCP rather than a separate server.
7. Add the **ritual layer** (Monday leadership digest, red-severity alerts, recommendation+owner on
   every flag) — the DPM "rituals + workflow automation" mandate.

**Phase 3 — Generalize:** connector model beyond Asana (Jira/Linear) so cross-tool delivery health
isn't single-vendor-coupled.

## Bottom line

The dashboard is a well-crafted agency tool. Its *future inside Figma* is not the dashboard — it's
the **MCP-powered, natural-language, cross-tool design-ops analytics layer**, rebuilt on trustworthy
data and Figma-native plumbing. Fix the data and the auth first; everything strategic depends on it.
