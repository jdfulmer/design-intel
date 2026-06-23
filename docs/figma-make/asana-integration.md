# Live Asana Linking — Figma Make Demo

This is the **priority integration** for the demo: real Asana task + priority data flowing
into the Figma Make prototype. Per the chosen approach, the demo reads through the
**existing Vercel `/api/data` proxy** — no Asana token lives in the prototype, and no
changes to the Vercel app are required.

---

## Why the proxy (and not direct Asana)

- The Asana Personal Access Token stays **server-side** in Vercel env vars. The prototype
  never sees it.
- The proxy already aggregates Asana across all projects, validates with Zod, and caches
  (1h open tasks / 6h completed), so the demo is fast and won't hit Asana rate limits.
- **No Vercel changes needed.** These routes are already deployed.

### One thing to know (open proxy)

`middleware.ts` lets all `/api/*` routes through the password gate, and `/api/data` adds the
bearer token server-side rather than requiring it from the caller. **Net effect: `GET
{BASE_URL}/api/data?source=asana` is publicly readable.** That's exactly why the demo can
fetch it directly with no auth — convenient here, but worth a follow-up (origin allowlist or
a read-only demo token) before sharing the prototype widely. Tracked in the PRD risks section.

---

## Base URL

```
BASE_URL = your Vercel deployment, e.g. https://design-intel.vercel.app
```

Set this as a single variable in Figma Make so it's swappable.

---

## Endpoints the demo consumes

All are `GET`, return JSON, no auth header required from the prototype.

| Purpose | Request | Response shape |
|---|---|---|
| **Open tasks** (Tasks, Pressure, Workload, Flags) | `GET {BASE_URL}/api/data?source=asana` | `{ data: AsanaTask[], source }` |
| **Completed tasks 30d** (delivery metrics) | `GET {BASE_URL}/api/data?source=completed&include_completed=30d` | `{ data: AsanaTask[], source }` |
| **Figma activity** (Activity, joins) | `GET {BASE_URL}/api/data?source=figma` | `{ data: FigmaDesignerActivity[], files: [...], syncedAt }` |
| **Weekly snapshots** (Trends) | `GET {BASE_URL}/api/data?source=snapshots` | `{ data: WeeklySnapshot[] }` |
| **Cache timestamps** (freshness label) | `GET {BASE_URL}/api/data?source=cache` | `{ figma, asana }` |

`AsanaTask`, `FigmaDesignerActivity`, and `WeeklySnapshot` shapes — with realistic values —
are in [`sample-data.json`](./sample-data.json). The seed data matches these responses 1:1,
so the demo can boot on the seed and swap to live by flipping `USE_LIVE = true`.

---

## The `AsanaTask` fields the demo needs

```ts
{
  gid: string,                 // -> deep link: https://app.asana.com/0/0/{gid}
  name: string,
  assignee: { gid, name } | null,
  followers: { gid, name }[],  // collaborators count toward team involvement
  due_on: string | null,       // "YYYY-MM-DD" — overdue = due_on < today && !completed
  completed: boolean,
  completed_at: string | null, // drives cycle time + on-time
  created_at: string,
  projects: { gid, name }[],   // first project = "client" (minus nonClientProjects)
  memberships: [{ section: { name } }],
  custom_fields: [...]         // see below
}
```

### Priority / status comes from custom fields

Read these by name (case-insensitive), preferring `display_value`:

| Field | Type | Used for |
|---|---|---|
| **Task Progress** | enum | Status pill / priority lane (e.g. In Progress, In Review, Blocked, Done) |
| **Type of Creative** | enum | Tasks view "by creative type" breakdown |
| **Total ASINs** | number | Scope/size indicator on task rows |

Helper logic (from `lib/asana.ts`):
```
getCustomField(task, "Task Progress")  // display_value ?? text_value ?? enum_value.name
```

---

## Joining Asana people to Figma people

Asana and Figma use different display names. Join through the `teamConfig.map` in
`sample-data.json` (source: `lib/team-config.ts`). Example: Asana **"Vince Herrera"** →
Figma **"Vincent Herrera"**. Apply the map before computing per-designer Workload/Activity.

---

## Deep links (make every row clickable)

- **Asana task:** `https://app.asana.com/0/0/{task.gid}`
- **Figma file:** `https://www.figma.com/design/{key}/{slug}`

---

## Refresh / freshness

- Poll `source=asana` on load and on a manual **Refresh** button.
- Show "Updated Xm ago" from `source=cache` timestamps.
- To force-bypass cache during a live demo: append `&force=true` to `source=asana`.
