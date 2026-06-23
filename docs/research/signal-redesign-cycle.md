# Signal redesign — from edit-volume to deadline-neglect

A worked product cycle: real feedback → leadership appraisal → build → UX research → v2. It's
documented here because the *process* is as much the portfolio artifact as the screens. All
screens live in the Figma file
([aRRPpCVHQ1FTitidbeYBLO](https://www.figma.com/design/aRRPpCVHQ1FTitidbeYBLO)).

## 1. The trigger
Product designers gave blunt feedback: **raw design "clicks" (edit volume) aren't the signal.**
A more useful flag is **an upcoming deadline that hasn't even been looked at** — work that's due
soon and going quiet. The original product over-indexed on edits (Activity leaderboard, file
"heat," even the Pressure Index), so this challenged the core thesis.

## 2. Leadership appraisal (4 lenses)
Four senior perspectives independently ranked the most valuable edits. They converged:
- **Unanimous #1:** make the deadline-neglect reframe the hero — show *one decision deeply*, not
  twelve thin views.
- Stop over-indexing on edit volume; reframe the leaderboard.
- Wire the product views to the design system (variables/components) — partially deferred.
- Rebuild the chart-less **Trends** view into real charts.
- Add "what / why / action" narrative so it reads as judgment, not a gallery.

## 3. Built (round 1)
- **Case-study hero** ("From edit-volume to deadline-neglect"): old signal → user insight → redesign.
- **Trends** rebuilt into real baselined bar charts (light + dark) with reconciled numbers.
- Renamed the working page `Page 1` → `Product`.

## 4. UX research (5 synthesized personas)
Design Manager, Agency Creative Director, skeptical Senior IC, Design Ops Lead, VP/Head of Design.
Verdict: **cautious yes**, gated on two things — false-positive rate and not scoring individuals.
Themes:
1. **False positives kill it.** "No activity" is noisy (paper, FigJam, pairing, thinking). And the
   Figma↔Asana link is dirty — "Untouched" must never actually mean "we couldn't find the file."
2. **The leaderboard contradicts the pivot.** Ranking by edits while preaching "clicks aren't the
   signal" reads as an apology that changes nothing.
3. **Protect, don't target.** Team/work-level by default; individual drill-down gated; transparency
   for ICs.
4. **Alerts need actions.** Ping owner / snooze / "I've got this" — make it a workflow.
5. **Tunable + push.** A Slack/email digest beats a dashboard nobody opens.

## 5. Decisions locked
- **Rule (Theme 1):** a small rules engine, not one boolean.

  | Tier | Trigger |
  |---|---|
  | Critical | due ≤ 2d · quiet ≥ 5d · not started |
  | High | due ≤ 5d · quiet ≥ 7d |
  | Watch | due ≤ 7d · quiet ≥ 5d |
  | Suppressed | status In Review+, recent checkpoint, or acknowledged |
  | Needs link | no Figma file attached — never shown as "untouched" |

  Inactivity windows scale to the work (assignment→due span), not a fixed number.
- **Routing (Theme 4):** **owner-first** nudge → **auto-escalate** to the lead if unacknowledged →
  resolve on action. Delivered via **Slack + email**.
- **Surfacing order (Theme 5):** **risk severity first, then PM priority** (P0 → P2). "Value" source
  is configurable (PM priority default; revenue/client-tier optional "agency mode").
- **Posture (Theme 3):** nobody is scored; every signal is about work and capacity.

## 6. Built (round 2 / v2)
- **Cold Deadlines v2** — the rules engine made visible: tiered "why" chips, the Healthy and
  Needs-link states, P0–P2 weighting, and inline **I've got this / Snooze / Reassign**. The panel
  documents the rules, routing, and sort order.
- **Push card** — Slack-style **owner nudge (T+0)** → **auto-escalation (T+4h, no ack)** to the
  design lead, both channels, with inline actions and the "protect the work, don't score people" framing.
- **Coverage & Balance** — the leaderboard reframed: **project coverage** (is every project
  attended to? — including a "No coverage" flag for ownerless work) and **team balance** (capacity
  bars for load-shifting). No edit-ranking anywhere.

## 7. Open / next
- Wire the product views to consume the variables + component instances (theming demo already
  proves the pattern).
- Tunable thresholds UI; the Friday digest surface.
- Link-coverage / confidence indicator on the Figma↔Asana join.
