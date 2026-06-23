# Figma Make Demo Kit

Everything needed to rebuild the Design Intel dashboard as an **interactive, live demo inside
Figma Make** — no code, runs in Figma's native environment. Live task/priority data flows in
from Asana through the existing Vercel `/api/data` proxy (no Vercel changes, no token in the
prototype).

## Files

| File | What it is |
|---|---|
| [`PROMPT.md`](./PROMPT.md) | The copy-paste Figma Make prompt + a follow-up prompt to switch from seed data to live Asana. **Start here.** |
| [`design-tokens.json`](./design-tokens.json) | Colors (light/dark), typography, radius, severity + avatar palettes — extracted from `app/dashboard.tsx`. Attach as context in Figma Make. |
| [`sample-data.json`](./sample-data.json) | Seed data that matches the live proxy responses 1:1, so the demo boots instantly and swaps to live with no shape changes. Attach as context. |
| [`asana-integration.md`](./asana-integration.md) | The priority piece: exact live-Asana endpoint contract, custom-field → priority mapping, people-name join, deep links, and the open-proxy security note. |

## Quick start

1. Open Figma Make (Pro seat ✓).
2. Attach `design-tokens.json` and `sample-data.json` as context.
3. Paste the prompt from `PROMPT.md`, replacing `{BASE_URL}` with your Vercel URL.
4. Once it looks right, paste the "switch to LIVE Asana data" follow-up prompt.

## Prerequisites for the live feed

- The Design Intel Vercel app is deployed and its env vars (`ASANA_PAT`,
  `ASANA_WORKSPACE_GID`, `API_SECRET`) are set.
- You know your deployment URL for `{BASE_URL}`.
