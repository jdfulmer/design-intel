# Figma Slides Deck — Build Prompt

A copy-paste prompt to generate a **Figma Slides** deck about Design Intel, used as a live
"quick reference" while talking with people who work at Figma. Goal: spark an ideation
conversation and earn an interview. Positioning spans **Product Design, Product, and Design
Advocacy/DevRel**; balance is **product story first, with a clear "how I think" thread and a
soft ask.**

## Before you run it — fill these placeholders
- `{{BACKGROUND}}` — one line on your current role/background (e.g. "design ops lead managing a
  remote creative team"). Used on the "How I work" slide.
- `{{LIVE_URL}}` — your deployed dashboard URL (or remove the reference if not shareable).
- `{{CONTACT}}` — how you want to be reached (email/LinkedIn). Default: j.d.fulmer@gmail.com.
- Screenshots: export the six dashboard frames (light, and a couple dark) from the Figma file
  `https://www.figma.com/design/aRRPpCVHQ1FTitidbeYBLO` and have them ready to drop in where the
  prompt marks `[INSERT SCREENSHOT]`.

---

## PROMPT (copy everything in the block)

```
Build a Figma Slides presentation titled "Design Intel" — a tight, visual, talking-deck I'll use
as a quick reference while chatting with people who work at Figma. Audience: Figma designers,
PMs, and design advocates. Purpose: spark an ideation conversation and lead toward an interview.
Tone: confident, concrete, curious — not a hard sell. Keep on-slide text minimal (it's a deck I
talk over); put the detail in speaker notes.

PRESENTER
Joshua Fulmer. Background: {{BACKGROUND}}. Open to Product Design, Product, and Design Advocacy
roles at Figma. Contact: {{CONTACT}}.

VISUAL SYSTEM (match Design Intel's production tokens so the deck *is* the product's design language)
- Font: Inter. Big, confident headlines (Bold, ~40–56px); body 18–22px; captions 13–15px.
- Light theme. Background #FFFFFF; surfaces #F5F5F5; borders #E6E6E6.
- Text: primary #000000E5, secondary #00000080, tertiary #0000004D.
- Brand accents (use sparingly, one accent per slide): blue #0D99FF, green #14AE5C,
  orange #FFA629, purple #7B61FF, red #F24822.
- Generous whitespace, 6–8px corner radii, crisp 1px borders. 16:9. A thin footer with
  "Design Intel" left and slide number right. One idea per slide.

DECK STRUCTURE (13 slides). For each: on-slide content, then SPEAKER NOTES.

1) TITLE
   - "Design Intel" + subhead: "Operational intelligence for design teams — built on Figma."
   - Small: Joshua Fulmer · {{CONTACT}}.
   - NOTES: One sentence — "I built a tool that shows design leads what's actually happening on
     their team by connecting Figma activity with Asana tasks — and I built it using Figma's own
     platform. I'd love to think out loud with you about it."

2) THE PROBLEM
   - Headline: "Design leads are flying blind between standups."
   - 3 bullets: workload imbalances surface too late · client pressure is invisible · velocity
     drops go unnoticed until they hurt.
   - NOTES: Standups are lagging and subjective; spreadsheets go stale. There's no early warning
     for an overloaded designer or a client about to blow a deadline.

3) THE INSIGHT
   - Headline: "The truth lives in two tools that never talk."
   - Visual: Figma logo + Asana logo with a connector → "Design Intel".
   - Caption: "Figma = who's doing the work. Asana = what's committed & due. Join them and
     operational reality appears."
   - NOTES: Nobody cross-references Figma version history against Asana load. That join is the
     whole product.

4) WHAT IT IS
   - Headline: "One dashboard. Six intelligence views. Plus an AI layer."
   - Three chips: Live Dashboard (Next.js + Vercel) · MCP Server (ask Claude in natural language)
     · Figma Make demo (interactive, live data).
   - [INSERT SCREENSHOT: Activity view, light]
   - NOTES: It's real and deployed, not a mockup. Password-gated, mobile-responsive, light/dark.

5) THE SIX VIEWS
   - 2x3 grid of small labeled tiles: Activity · Tasks · Pressure · Workload · Trends · Flags,
     each with a one-line "what it surfaces."
   - [INSERT SCREENSHOT montage: 2–3 view thumbnails]
   - NOTES: Activity = who's active; Tasks = delivery metrics; Pressure = client risk; Workload =
     who's overloaded vs. has capacity; Trends = week-over-week; Flags = proactive alerts.

6) IT THINKS IN METRICS
   - Headline: "Opinionated, transparent formulas."
   - Show 3 formulas cleanly typeset:
       Client Pressure Index = tasks + overdue×3 − min(edits×0.3, tasks)
       Activity score = edits×3 + comments×2 + files×2 + projects×3
       Health score (0–100) = on-time 40 + cycle 30 + velocity 30
   - Caption: "Every number is explainable on the surface — no black boxes."
   - NOTES: Designed the formulas to be defensible and legible; surfaces the formula next to the
     result so leads trust it.

7) BUILT *ON* FIGMA  ← the slide for this room
   - Headline: "I didn't just design for Figma. I built with Figma's newest platform surfaces."
   - Four points: Design tokens (official light/dark system) · Code-to-design via the Plugin API ·
     Figma Make for the interactive live-data demo · An MCP server for natural-language queries.
   - NOTES: This is the meta-point. The dashboard's whole design language is Figma's token system;
     I generated the design file from code through the Plugin API; the interactive demo runs in
     Figma Make wired to live Asana; and the data is queryable by Claude via MCP.

8) DESIGN-SYSTEM FIDELITY
   - Headline: "Same tokens, light and dark, end to end."
   - [INSERT SCREENSHOT: one view in light beside the same view in dark]
   - Caption: "Inter + Figma's token sets, with brand accents reserved for signal."
   - NOTES: Light/dark parity wasn't bolted on — it's one token map. Color is used as signal
     (severity, accents), never decoration.

9) CODE ↔ DESIGN ↔ AI, ROUND-TRIP
   - Headline: "The convergence Figma keeps talking about — running end to end."
   - Horizontal flow: Dashboard code → Figma frames (Plugin API) → Figma Make (interactive) →
     Claude via MCP.
   - NOTES: This is Figma's thesis made literal. The same product exists as production code, as a
     Figma design, as an interactive Make prototype, and as an AI-queryable dataset.

10) HOW I WORK (the candidate thread, kept light)
   - Headline: "What this says about how I work."
   - 3 short points: I ship real things · I think in systems and metrics · I'm fluent across
     design, product, and code.
   - Sub-line: "{{BACKGROUND}}."
   - NOTES: I scoped, designed, built, and deployed this solo — and reached for Figma's newest
     tools because that's how I learn a platform: by building something real on it.

11) WHERE IT COULD GO (ideation fuel)
   - Headline: "If we riffed on this together…"
   - 3 provocations: package the views as reusable Figma components / a Community plugin · a
     Widget that lives on the canvas for design-ops standups · Make templates so any team wires
     their own Figma + PM data.
   - NOTES: Invite them to push back and add ideas — this slide is a conversation starter, not a
     roadmap.

12) THE ASK
   - Headline: "I'd love a conversation."
   - Line: "I'm exploring Product Design, Product, and Design Advocacy roles at Figma — and I'd
     value 30 minutes to trade ideas."
   - {{CONTACT}} · github.com/jdfulmer/design-intel
   - NOTES: Make the ask explicit but low-pressure: a chat, not a job demand.

13) APPENDIX / LINKS
   - Tech stack: Next.js 14, React, Vercel KV, Figma REST API, Asana API, Zod, Vitest (50 tests),
     TypeScript MCP server.
   - Links: Live dashboard {{LIVE_URL}} · Figma design file
     https://www.figma.com/design/aRRPpCVHQ1FTitidbeYBLO · Repo github.com/jdfulmer/design-intel
   - NOTES: Backup detail for the engineering-minded; only open if asked.

DELIVERABLE
- A clean Figma Slides deck, 13 slides, consistent master layout, Inter throughout, light theme
  with one accent color per slide, footer with slide numbers. Leave clearly-marked image
  placeholders where screenshots go. Put all the talking points in speaker notes.
```

---

## Notes
- This is written for **Figma Slides**. If you ever want a self-contained browser deck instead,
  the same structure works as a Claude HTML artifact — just change the first line.
- The deck deliberately peaks at slide 7 ("Built on Figma") — that's the slide that earns the
  room's attention. Slides 8–9 reinforce it; everything before sets it up.
- Keep it to ~13 slides. It's a reference you talk over, not a document.
