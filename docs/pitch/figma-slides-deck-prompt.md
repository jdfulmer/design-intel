# Figma Slides Deck — Build Prompt

A copy-paste prompt to generate a **Figma Slides** deck about Design Intel, used as a live
"quick reference" while talking with people who work at Figma. Goal: spark an ideation
conversation and earn an interview. Positioning spans **Product Design, Product, and Design
Advocacy/DevRel**; balance is **product story first, with a clear "how I think" thread and a
soft ask.** Two ideas run through the whole deck: protecting the work (deadlines that are
slipping) and protecting the people (designers who are getting overloaded).

House style: plain, spoken language, not buzzwords. **No em dashes anywhere** (use commas,
colons, or periods).

## Before you run it, fill these placeholders
- `{{BACKGROUND}}` one line on your current role/background (e.g. "design ops lead managing a
  remote creative team"). Used on the "How I work" slide.
- `{{LIVE_URL}}` your deployed dashboard URL (default: design-intel-mu.vercel.app).
- `{{CONTACT}}` how you want to be reached. Default: j.d.fulmer@gmail.com · www.joshuafulmer.com.
- Screenshots: export frames from the Figma file
  `https://www.figma.com/design/aRRPpCVHQ1FTitidbeYBLO` and drop them in where the prompt marks
  `[INSERT SCREENSHOT]`.

---

## PROMPT (copy everything in the block)

```
Build a Figma Slides presentation titled "Design Intel", a tight, visual, talking-deck I'll use
as a quick reference while chatting with people who work at Figma. Audience: Figma designers,
PMs, and design advocates. Purpose: spark an ideation conversation and lead toward an interview.
Tone: confident, concrete, and curious, not a hard sell. Use plain, spoken language, not
buzzwords. NO em dashes anywhere. Keep on-slide text minimal (it's a deck I talk over); put the
detail in speaker notes.

THROUGHLINE: protect the work and protect the people. Catch deadlines before they slip, and
notice when a designer is getting buried, both before they become a problem.

PRESENTER
Joshua Fulmer. Background: {{BACKGROUND}}. Open to Product Design, Product, and Design Advocacy
roles at Figma. Contact: {{CONTACT}}.

VISUAL SYSTEM (match Design Intel's production tokens so the deck *is* the product's design language)
- Font: Inter. Big, confident headlines (Bold, ~40 to 56px); body 18 to 22px; captions 13 to 15px.
- Light theme. Background #FFFFFF; surfaces #F5F5F5; borders #E6E6E6.
- Text: primary #000000E5, secondary #00000080, tertiary #0000004D.
- Brand accents (use sparingly, one accent per slide): blue #0D99FF, green #14AE5C,
  orange #F5A623, purple #7B61FF, red #DC3412.
- Generous whitespace, 6 to 8px corner radii, crisp 1px borders. 16:9. A thin footer with
  "Design Intel" left and slide number right. One idea per slide.

DECK STRUCTURE (15 slides). For each: on-slide content, then SPEAKER NOTES.

1) TITLE
   - Kicker: "HELP YOUR DESIGN TEAM SHIP WITHOUT BURNING OUT". Title: "Design Intel".
   - Subhead: "It puts your Figma activity next to your task data, so you can catch deadlines
     before they slip and notice when someone is getting buried. Built on Figma's own platform."
   - Small: Joshua Fulmer · {{CONTACT}}.
   - NOTES: "I built a tool that shows design leads what is really happening on their team. It
     catches deadlines before they slip and notices when someone is getting buried. And I built
     it on Figma's own platform."

2) THE PROBLEM
   - Headline: "Design leads are flying blind between standups."
   - 3 bullets: "You find out someone is overloaded only after they are already buried." ·
     "A deadline can slip with nobody having even opened the file yet." · "Momentum quietly drops,
     then shows up later as missed work."
   - NOTES: Standups lag and spreadsheets go stale. There is no early warning when a designer is
     getting overloaded or when a deadline is about to slip.

3) THE INSIGHT
   - Headline: "The truth lives in two tools that never talk."
   - Visual: Figma (who's doing the work) + a task tool (what's committed and due) leading to
     Design Intel (what's really going on).
   - Caption: "Nobody puts Figma activity next to what's actually due. That connection is the
     whole idea."

4) WHAT IT IS
   - Headline: "One dashboard, six views, and you can just ask it questions."
   - Three chips: Live Dashboard (Next.js + Vercel) · MCP Server (ask it questions in plain
     English) · Figma Make (interactive demo, live data).
   - [INSERT SCREENSHOT: a dashboard view, light]
   - NOTES: It's real and deployed, not a mockup. Password gated, works on mobile, light and dark.

5) THE VIEWS
   - Headline: "Six views that protect the work, and the people."
   - 2x3 grid: Coverage (is every active project getting attention, or going dark?) · Tasks
     (what's getting delivered, by project, type, and person) · Pressure (which clients are about
     to boil over) · Workload (who's overloaded, and who has room to take more) · Trends (how the
     team's pace is trending, week over week) · Flags (early warnings, like a deadline no one has
     opened).
   - NOTES: Each view answers a real question a lead asks. The throughline is protection.

6) COLD DEADLINES  (protection centerpiece)
   - Kicker: "THE ONE THAT MATTERS MOST". Headline: "Catch a deadline before anyone notices it's
     slipping."
   - Sub: "The flag designers actually asked for: work that's due soon and has gone quiet."
   - Mini table of flagged rows with "why" chips and a risk pill: a Critical row (Due in 2d,
     Untouched 6d), a High row (Due in 4d, Quiet 11d), and a Healthy row (In review, on track) to
     show it won't cry wolf.
   - Rule line: "Flagged when it's due soon and the file has gone quiet. Never when it's in
     review, or someone is already on it."
   - NOTES: This is the heart of it. Edit counts are not the signal; a deadline nobody has opened
     is. And it stays quiet when the work is in review or someone is clearly on it, so people
     trust it.

7) HOW IT GOT HERE  (process)
   - Headline: "Feedback shaped it. So I reshaped it."
   - Three steps: 1 Designers spoke up (edit counts miss the point; a deadline nobody opened is
     the real risk) · 2 I stress-tested it (what about false alarms? what about privacy?) ·
     3 Rebuilt as v2 (flags that explain themselves, gentle owner-first nudges, signals about the
     work, never a score on a person).
   - Takeaway: "Listen, pressure-test, ship. Then do it again."
   - NOTES: Shows how I work, not just what I made. Real feedback, honest self-critique, then a rebuild.

8) IT THINKS IN METRICS
   - Headline: "Simple math you can actually explain."
   - Three formulas: Client Pressure Index = tasks + overdue×3 − min(edits×0.3, tasks);
     Activity score = edits×3 + comments×2 + files×2 + projects×3;
     Health score (0 to 100) = on-time 40 + cycle 30 + velocity 30.
   - Caption: "Every number is easy to explain, and the formulas can grow to weight things like
     revenue when a team needs it."

9) BUILT *ON* FIGMA  (the slide for this room)
   - Headline: "I didn't just design for Figma. I built with it."
   - Four points: Design tokens (official light/dark token system) · Plugin API (the whole design
     file generated from code) · Figma Make (the live, clickable demo) · MCP server (ask the data
     questions in plain English, through Claude).
   - NOTES: The design language is Figma's token system; I generated the design file from code
     through the Plugin API; the live demo runs in Figma Make; the data is queryable through Claude.

10) DESIGN-SYSTEM FIDELITY
   - Headline: "Same tokens, light and dark, end to end."
   - [INSERT SCREENSHOT: one view in light beside the same view in dark]
   - Caption: "Light and dark come from one set of tokens, not a second coat of paint."

11) ONE PRODUCT, FOUR FORMS
   - Headline: "Code, design, and AI, all the same product."
   - Horizontal flow: Dashboard code, to Figma frames (Plugin API), to Figma Make (interactive),
     to Claude (queries via MCP).
   - NOTES: The same product lives as production code, as a Figma design, as a clickable Make
     prototype, and as data you can ask questions of.

12) HOW I WORK
   - Headline: "What this says about how I work."
   - 3 short points: I ship real things · I think in tokens, formulas, and systems · I'm fluent
     across design, product, and scrappy with code.
   - Sub-line: "{{BACKGROUND}}."

13) WHERE IT COULD GO  (ideation fuel)
   - Headline: "If we built on this together…"
   - 3 provocations: built to live inside Figma's platform (an admin/leadership surface) ·
     customizable by customer or industry · room to grow (more integrations beyond Asana, Monday,
     Atlassian). This is just the ideation phase.
   - NOTES: A conversation starter, not a roadmap. Invite them to push back.

14) THE ASK
   - Headline: "I'd love a conversation."
   - Line: "I'm exploring Product Design, Product, and Design Advocacy roles at Figma, and I'd love
     30 minutes to trade ideas."
   - {{CONTACT}}
   - NOTES: Warm and low pressure. A chat, not a job demand.

15) APPENDIX / LINKS
   - Tech stack: Next.js 14, React, TypeScript, Vercel KV, Figma REST + Plugin API, Asana API,
     Zod, Vitest (50 tests), TypeScript MCP server.
   - Links: Live dashboard {{LIVE_URL}} · Figma design file
     figma.com/design/aRRPpCVHQ1FTitidbeYBLO · Repo github.com/jdfulmer/design-intel
   - NOTES: Backup detail for the engineering minded. Only open if someone asks.

DELIVERABLE
- A clean Figma Slides deck, 15 slides, consistent master layout, Inter throughout, light theme
  with one accent color per slide, footer with slide numbers. No em dashes. Leave clearly-marked
  image placeholders where screenshots go. Put all the talking points in speaker notes.
```

---

## Notes
- This is written for **Figma Slides**. The same structure works as a Claude HTML artifact if you
  ever want a self-contained browser deck; just change the first line.
- The deck has two peaks: slide 6 (**Cold Deadlines**, the protection payoff) and slide 9 (**Built
  on Figma**, the slide that earns this room). Everything before each one sets it up.
- Keep it to ~15 slides. It's a reference you talk over, not a document.
