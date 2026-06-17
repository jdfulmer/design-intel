# Enterprise & Admin Insights PM Review

## Verdict

design-intel is a genuinely useful agency-ops dashboard, but as a candidate for Figma's enterprise admin/insights surface it is **a thin, taste-passing skin over metrics Figma cannot trust and a moat Figma does not want**. The "insight" half is plausible (cycle time, on-time, overdue clustering); the "control" half — the actual mandate of *PM, Scale* ("insight **and** control around their usage of Figma… best-in-class administrative experiences that scale") — is entirely absent. The Figma+Asana cross-tool layer is the only differentiated idea, and inside Figma it reads as a strategic liability (hard dependency on a competitor's PM tool) rather than a moat. Recommend: **harvest the cross-tool "delivery health" concept as a Dev-Mode-adjacent insight, do not adopt the product or its metrics.**

## Scores

| Dimension | Score | Justification |
|---|---|---|
| Figma strategic fit | 3/5 | Targets a real funded lane (Scale/Admin usage insight), but delivers insight-only; zero admin/control, which is the heart of the *PM, Scale* charter. |
| Integration feasibility | 2/5 | Auth is a shared password + single bearer secret (`lib/auth.ts:5-20`) — no SSO/SCIM/RBAC; it attaches as an external Vercel app, not a native admin surface. |
| Craft / native feel | 4/5 | Figma-token palette, Inter, light/dark, drill-downs (`app/dashboard.tsx:113-168`) — the one area that would pass the taste bar. |
| Data trustworthiness | 2/5 | "Edits" = version-history entries (`lib/figma.ts:225-233`); `MAX_FILES=50` truncation (`lib/figma.ts:87`); substring client matching (`app/dashboard.tsx:912-913`). Misleading at enterprise scale. |
| Differentiated value | 2/5 | The only non-trivial idea is cross-tool Figma↔Asana correlation; Figma already owns native org analytics and would build the rest in a sprint. |

## Top findings (ranked by leverage)

1. **"Insight without control" misses the literal mandate of *PM, Scale*.**
   *Evidence:* Every surface is read-only analytics — activity, pressure, workload, flags (`app/dashboard.tsx:1314-1320`). There is no seat management, no permission/access view, no policy or governance action anywhere in the app. *PM, Scale* is explicitly "insight **AND** control… administrative experiences." *Recommendation:* If pursued, the highest-leverage add is one control loop — e.g. surface a stale/over-licensed-seat signal and let an admin act on it. Without control, this is a BI widget, not an admin product.

2. **The enterprise metrics are not defensible because the underlying signal is wrong.**
   *Evidence:* "Edits" is the count of Figma **version-history** entries in a date window (`lib/figma.ts:225-233`, `app/api/figma/sync/route.ts:207-221`), not real edit volume — named checkpoints and autosaves, hugely noisy per-user. The crawl is hard-capped at 50 files (`lib/figma.ts:87`, `sync/route.ts:162`), so any real enterprise org silently truncates and every downstream score (pressure `dashboard.tsx:915`, bus-factor `dashboard.tsx:1051-1053`) is computed on a partial slice. *Recommendation:* A Head of Design who catches one wrong "0 edits, overloaded" call on a real designer never trusts the tool again. Do not expose these as enterprise metrics; if integrated, replace the edit proxy with Figma's internal activity events.

3. **The Figma+Asana cross-tool angle is a liability inside Figma, not a moat.**
   *Evidence:* Identity resolution is a hand-maintained Asana→Figma name dict (`lib/team-config.ts:9-26`, duplicated into the MCP per the comment at line 3) and client↔project linkage is `toLowerCase().includes()` substring matching (`dashboard.tsx:912-913`; mirrored in snapshots `sync/route.ts:421-427`). It hard-depends on Asana, a PM-tool competitor. *Recommendation:* Figma's enterprise buyers run mixed stacks (Jira, Linear, Asana). Owning a brittle Asana coupling is off-strategy. Keep the *concept* (design activity ↔ delivery status) but make the delivery side pluggable, not Asana-wired.

4. **Auth is below enterprise table stakes.**
   *Evidence:* `lib/auth.ts` is a single shared `API_SECRET` bearer plus a password middleware — no SSO, SCIM, org scoping, or role separation. *Recommendation:* Non-negotiable rebuild before any enterprise context; cite to Platform/Extensibility Engineer for the full security pass.

5. **Live dashboard and weekly history disagree on identity.**
   *Evidence:* The snapshot generator explicitly notes it has "no reliable Asana→Figma name mapping here on the server" and aggregates by raw Asana assignee (`sync/route.ts:360-372`), while the live dashboard maps through `team-config` (`dashboard.tsx:921-936`). Trends and the live view will name and credit people differently. *Recommendation:* Single source of identity before any leadership-facing rollout.

## Improve (product on its own terms)

- Replace version-count "edits" with a defensible activity signal and show a data-confidence/coverage indicator (e.g. "50 of 312 files sampled") so buyers know the denominator.
- Make the delivery-tool side an adapter (Asana/Jira/Linear) instead of hard-wiring Asana; unify identity resolution between live and snapshot paths.
- Add at least one *control* action (seat hygiene, access review) to earn the "admin experience" framing.

## Integrate (path into Figma, with the specific surface)

- **Do not** adopt as a core-app admin feature. Per charter operating reality #4, external value should first be a *platform* surface.
- **Recommended slice:** ship the cross-tool "delivery health" view as a **Dev-Mode-adjacent / org-analytics companion widget** that reads Figma activity natively and accepts an external delivery feed via adapter. This honors *Run with it* (one shippable slice) and feeds the funded Scale/Admin lane without importing the Asana dependency or the untrustworthy edit metric.
- The MCP server is the more interesting integration vector (natural-language usage queries) — hand that evaluation to the AI & Data Strategist.

## Kill-shots / risks

- **Build-vs-buy:** Figma already ships native org/usage analytics; the read-only insight half is a sprint, not an acquisition. Only the cross-tool concept is differentiated, and it's the part Figma least wants to own.
- **Trust kill-shot:** version-history-as-edits + 50-file cap will produce visibly wrong leadership calls at enterprise scale.
- **Strategic-conflict kill-shot:** hard Asana coupling inside Figma.
- **Security kill-shot:** shared-secret auth is disqualifying for an admin surface.

## Hand-off to: Platform & Extensibility Engineer

Can the version-history endpoint and team-crawl be re-architected to (a) lift the 50-file cap within Figma's rate limits and (b) source a real edit/activity signal natively — and what is the minimum auth model (SSO/SCIM) to make any admin surface viable? Your answer determines whether finding #2 and #4 are fixable or fatal.
