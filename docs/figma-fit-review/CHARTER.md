# Design Intel → Figma Fit Review — Team Charter

**Date:** 2026-06-17
**Lead:** Synthesis owner (orchestrating agent)
**Subject under review:** `design-intel` — a design-operations intelligence dashboard that
cross-references Figma activity (file edits, comments, version history via the Figma REST API)
with Asana tasks to surface designer workload, cycle time, on-time rate, bus-factor risk,
overdue clustering, "hottest files," and weekly snapshots. Ships with an MCP server exposing
Figma + Asana intelligence tools. Deployed on Vercel (Next.js 14 + Vercel KV).

## Mission of this team

Decide, with evidence, **how `design-intel` could improve and how it could integrate into
Figma** — as a feature, a platform extension, an internal tool, or an acquisition-style capability.
Every recommendation must be tied to (a) a real Figma operating reality and (b) a real Figma
hiring signal, so the conclusions reflect where Figma is actually investing.

## How Figma actually operates (the lens every reviewer anchors to)

These are the operating realities recommendations must respect:

1. **Web-first, multiplayer by default.** Real-time collaboration is the core primitive. Anything
   bolted on should feel native to a shared, always-live canvas — not a separate BI silo.
2. **Design is a team sport.** Figma sells to *teams* (PM + eng + design + content), increasingly
   to *enterprises*. Cross-functional workflow is the product, not a side feature.
3. **Craft culture.** High bar on polish, clarity, and "does this feel like Figma." Dashboards that
   look like generic analytics will be rejected on taste alone.
4. **Extensibility & community.** Plugins, widgets, Community files, the REST API, Dev Mode, and
   Code Connect are how third-party value reaches users. Most external ideas should first be
   evaluated as *platform* surfaces, not core-app features.
5. **Enterprise scale & control.** Orgs, admin, SCIM, security, and **usage insight/analytics**
   are an active, funded investment area (see PM, Scale).
6. **AI-forward, data-forward.** Figma is building an AI data agent and self-serve analytics
   (see Data Platform Engineer). Natural-language access to operational data is strategic.
7. **Figma values to honor in tone & recommendation:** *Run with it* (bias to action / shippable
   slices), *Hold it loosely* (strong opinions, weakly held), *Love your craft*, *Play*,
   *Grow as you go*, *Build community*.

## Real Figma hiring signal (grounding evidence — June 2026)

Reviewers must cite these where relevant:

- **PM, Scale** — *"equip companies with better insight and control around their usage of Figma…
  best-in-class administrative experiences that scale."*
- **Design Program Manager, Platform** — *"clear rhythms for collaboration, review, tracking, and
  leadership approval… high-leverage frameworks and rituals… experimenting with modern tooling
  (AI orchestration, API usage, workflow automation)."*
- **Data Platform Engineer** — *"AI data agent to enable self-serve analytics… prompt-based usage
  analytics… bring data and models closer to the product experience."*
- **PM, AI Platform / AI Growth**, **PM, Design Tools**, **Manager, Data Science – AI Product**.

## Operating guidelines for every team member

1. **Evidence or it didn't happen.** Every technical claim cites a repo path + line
   (`file.ts:NN`). Every strategic claim cites a Figma operating reality (above) or a hiring signal.
2. **Stay in your lane, then connect.** Review through your assigned lens first; end with one
   explicit hand-off to another reviewer's lane.
3. **Separate "improve" from "integrate."** Always answer both: how the product gets better on its
   own terms, and how/whether it belongs inside Figma.
4. **Rank by leverage, not effort.** Recommend the smallest change with the largest strategic payoff.
5. **Name the kill-shots.** State what would make Figma *not* pursue this (taste, security,
   strategic conflict, build-vs-buy).
6. **Be concrete and shippable.** Prefer "ship X as a Dev-Mode-adjacent widget" over "explore
   synergies."

## Shared scoring rubric (each reviewer scores 1–5, with a one-line justification)

| Dimension | What it measures |
|---|---|
| **Figma strategic fit** | Does this serve a funded Figma direction (Scale/Admin, Design Ops, AI/Data, Platform)? |
| **Integration feasibility** | How cleanly does it attach to a real Figma surface (REST API, plugin/widget, Dev Mode, admin, MCP)? |
| **Craft / native feel** | Would it pass Figma's taste bar? |
| **Data trustworthiness** | Are the metrics valid, defensible, and not misleading? |
| **Differentiated value** | Does it do something Figma can't trivially build in a sprint? |

## Required output format (each reviewer writes `docs/figma-fit-review/<role>.md`)

```
# <Role> Review
## Verdict (2-3 sentences)
## Scores (table, 1-5 + justification per dimension)
## Top findings (3-5, each: finding → evidence → recommendation, ranked by leverage)
## Improve (product on its own terms)
## Integrate (path into Figma, with the specific surface)
## Kill-shots / risks
## Hand-off to: <other reviewer + the question for them>
```

## The team (4 reviewers + lead synthesizer)

1. **Enterprise & Admin Insights PM** — grounds in *PM, Scale*. Owns: usage insight & control,
   enterprise buyer needs, fit with Figma's admin/analytics surface.
2. **Design Program Manager / Design Ops Lead** — grounds in *Design Program Manager, Platform*.
   Owns: do the metrics drive real rituals (review/tracking/leadership approval); is it actionable.
3. **Platform & Extensibility Engineer** — grounds in plugins/widgets/REST API/Dev Mode/Code Connect.
   Owns: technical integration paths, API-usage correctness, rate limits, auth/security, the MCP server.
4. **AI & Data Platform Strategist** — grounds in *Data Platform Engineer* + *PM, AI Platform*.
   Owns: metric validity, the MCP/AI-data-agent angle, natural-language self-serve analytics.

The **lead** sets this charter, integrates the four reviews, resolves conflicts, and produces
`SYNTHESIS.md` with a single recommendation and a sequenced roadmap.
