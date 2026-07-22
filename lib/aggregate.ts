/* Aggregation engine — joins Figma activity with Asana tasks into the
   dashboard dataset shape. Falls back to the demo dataset when creds are
   missing or any upstream call fails. Cached in-memory for 5 minutes. */

import { DATA as DEMO } from "./data";
import { DESIGNERS, CLIENTS, EXCLUDED_PROJECTS, CREATIVE_TYPE_FIELD, THRESHOLDS, matchClient } from "./config";
import { pressureIndex, activityScore, fileHeat, efficiency, pressureBand, coldBand } from "./metrics";

type Dataset = typeof DEMO;
interface CacheEntry { at: number; source: "live" | "demo"; data: Dataset; note?: string }

let cache: CacheEntry | null = null;
const TTL = 5 * 60 * 1000;

const FIGMA = "https://api.figma.com/v1";
const ASANA = "https://app.asana.com/api/1.0";

const day = 86400000;
const daysAgo = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / day) : Infinity);
const ago = (iso: string | null | undefined) => {
  const d = daysAgo(iso);
  if (d === Infinity) return "never";
  if (d <= 0) return "active today";
  if (d === 1) return "active 1d";
  return `active ${d}d`;
};

async function fig(path: string) {
  const res = await fetch(`${FIGMA}${path}`, { headers: { "X-Figma-Token": process.env.FIGMA_TOKEN! }, cache: "no-store" });
  if (!res.ok) throw new Error(`Figma ${path}: ${res.status}`);
  return res.json();
}

async function asa(path: string) {
  const res = await fetch(`${ASANA}${path}`, { headers: { Authorization: `Bearer ${process.env.ASANA_TOKEN}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Asana ${path}: ${res.status}`);
  return res.json();
}

const configured = () =>
  Boolean(process.env.FIGMA_TOKEN && process.env.FIGMA_TEAM_ID && process.env.ASANA_TOKEN && process.env.ASANA_WORKSPACE_GID);

export async function getData(force = false): Promise<CacheEntry> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache;
  if (!configured()) {
    cache = { at: Date.now(), source: "demo", data: DEMO, note: "Live creds not configured" };
    return cache;
  }
  try {
    cache = { at: Date.now(), source: "live", data: await buildLive() };
  } catch (e) {
    cache = { at: Date.now(), source: "demo", data: DEMO, note: e instanceof Error ? e.message : "aggregation failed" };
  }
  return cache;
}

async function buildLive(): Promise<Dataset> {
  const cutoff = Date.now() - THRESHOLDS.lookbackDays * day;

  /* ── Asana: projects + tasks ── */
  const projRes = await asa(`/projects?workspace=${process.env.ASANA_WORKSPACE_GID}&archived=false&opt_fields=name`);
  const projects: { gid: string; name: string }[] = (projRes.data ?? []).filter(
    (p: { name: string }) => !EXCLUDED_PROJECTS.some((x) => p.name.includes(x))
  );

  interface Task {
    name: string; assignee: string | null; due: string | null; completedAt: string | null;
    createdAt: string; completed: boolean; client: string | null; type: string | null; progress: string | null;
  }
  const tasks: Task[] = [];
  const fields = "name,assignee.name,due_on,completed,completed_at,created_at,custom_fields.name,custom_fields.display_value";
  for (const p of projects) {
    const client = matchClient(p.name)?.name ?? (CLIENTS.length ? null : p.name);
    const tRes = await asa(`/tasks?project=${p.gid}&opt_fields=${fields}&limit=100`);
    for (const t of tRes.data ?? []) {
      const cf = (t.custom_fields ?? []) as { name: string; display_value: string | null }[];
      tasks.push({
        name: t.name,
        assignee: t.assignee?.name ?? null,
        due: t.due_on ?? null,
        completedAt: t.completed_at ?? null,
        createdAt: t.created_at,
        completed: Boolean(t.completed),
        client,
        type: cf.find((f) => f.name === CREATIVE_TYPE_FIELD)?.display_value ?? null,
        progress: cf.find((f) => f.name === "Task Progress")?.display_value ?? null,
      });
    }
  }
  const open = tasks.filter((t) => !t.completed && t.client);
  const isOverdue = (t: Task) => Boolean(t.due && !t.completed && new Date(t.due).getTime() < Date.now());

  /* ── Figma: team → projects → recent files → versions + comments ── */
  const teamProj = await fig(`/teams/${process.env.FIGMA_TEAM_ID}/projects`);
  interface FFile { key: string; name: string; project: string; lastModified: string }
  let files: FFile[] = [];
  for (const p of teamProj.projects ?? []) {
    const fRes = await fig(`/projects/${p.id}/files`);
    for (const f of fRes.files ?? []) files.push({ key: f.key, name: f.name, project: p.name, lastModified: f.last_modified });
  }
  files = files
    .filter((f) => new Date(f.lastModified).getTime() > cutoff)
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified))
    .slice(0, THRESHOLDS.maxFilesScanned);

  interface FileStat { file: FFile; client: string | null; edits: number; comments: number; byUser: Record<string, { e: number; c: number }>; lastActivity: string; events: { t: string; w: string; at: number }[] }
  const fileStats: FileStat[] = [];
  const weekEdits: Record<string, number> = {};
  const wk = (iso: string) => {
    const d = new Date(iso);
    const w = Math.floor((Date.now() - d.getTime()) / (7 * day));
    return String(Math.min(7, Math.max(0, w)));
  };

  for (const f of files) {
    const [vRes, cRes] = await Promise.all([
      fig(`/files/${f.key}/versions`).catch(() => ({ versions: [] })),
      fig(`/files/${f.key}/comments`).catch(() => ({ comments: [] })),
    ]);
    const byUser: Record<string, { e: number; c: number }> = {};
    const events: FileStat["events"] = [];
    let last = f.lastModified;
    let e = 0, c = 0;
    for (const v of vRes.versions ?? []) {
      if (new Date(v.created_at).getTime() < cutoff) continue;
      e++;
      const u = v.user?.handle ?? "unknown";
      (byUser[u] ??= { e: 0, c: 0 }).e++;
      weekEdits[wk(v.created_at)] = (weekEdits[wk(v.created_at)] ?? 0) + 1;
      if (v.created_at > last) last = v.created_at;
      events.push({ t: `${u} saved a version`, w: `${daysAgo(v.created_at)}d ago`, at: new Date(v.created_at).getTime() });
    }
    for (const cm of cRes.comments ?? []) {
      if (new Date(cm.created_at).getTime() < cutoff) continue;
      c++;
      const u = cm.user?.handle ?? "unknown";
      (byUser[u] ??= { e: 0, c: 0 }).c++;
      events.push({ t: `${u} commented`, w: `${daysAgo(cm.created_at)}d ago`, at: new Date(cm.created_at).getTime() });
    }
    fileStats.push({
      file: f,
      client: matchClient(`${f.project} ${f.name}`)?.name ?? null,
      edits: e, comments: c, byUser, lastActivity: last,
      events: events.sort((a, b) => b.at - a.at).slice(0, 3),
    });
  }

  /* ── Designers ── */
  const designers = DESIGNERS.map((d) => {
    let edits = 0, comments = 0, filesTouched = 0;
    const projSet = new Set<string>();
    for (const fs of fileStats) {
      const u = fs.byUser[d.figma];
      if (u) { edits += u.e; comments += u.c; filesTouched++; projSet.add(fs.file.project); }
    }
    const mine = open.filter((t) => t.assignee === d.asana);
    const od = mine.filter(isOverdue).length;
    const eff = efficiency(edits, mine.length);
    const done = tasks.filter((t) => t.assignee === d.asana && t.completed && t.completedAt && new Date(t.completedAt).getTime() > cutoff);
    const cycles = done.filter((t) => t.completedAt).map((t) => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / day);
    const cyc = cycles.length ? (cycles.reduce((a, b) => a + b, 0) / cycles.length).toFixed(1) : "—";
    return {
      id: d.initials.toLowerCase(), initials: d.initials, name: d.display, color: d.color,
      projects: projSet.size || 1, edits, comments, files: filesTouched,
      score: activityScore(edits, comments, filesTouched, projSet.size || 1),
      active: mine.length, overdue: od,
      efficiency: mine.length ? `${eff}×` : "—", cycle: cyc === "—" ? "—" : `${cyc}d`,
      flag: mine.length >= 8 && edits < 10 ? "High load" : eff >= 3 ? "High output" : null,
      cap: [mine.length, d.capacity] as [number, number],
    };
  });
  const leaderboardIds = [...designers].sort((a, b) => b.edits - a.edits).slice(0, 6).map((d) => d.id); // UXR: sort by edits; score removed from UI

  /* ── Clients ── */
  const clientNames = CLIENTS.length ? CLIENTS.map((c) => c.name) : [...new Set(open.map((t) => t.client).filter(Boolean))] as string[];
  const clients = clientNames.map((name) => {
    const ct = open.filter((t) => t.client === name);
    const od = ct.filter(isOverdue).length;
    const ce = fileStats.filter((f) => f.client === name).reduce((a, f) => a + f.edits, 0);
    const pi = pressureIndex(ct.length, od, ce);
    const dset = new Set(ct.map((t) => t.assignee).filter(Boolean));
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      initials: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      name, tasks: ct.length, overdue: od, edits: ce, pi, band: pressureBand(pi), designers: dset.size,
    };
  }).sort((a, b) => b.pi - a.pi);

  /* ── Hot files ── */
  const hotFiles = [...fileStats]
    .map((fs) => ({ fs, heat: fileHeat(fs.edits, fs.comments) }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 5)
    .map(({ fs, heat }) => ({
      id: fs.file.key, name: fs.file.name, client: fs.client ?? fs.file.project,
      figmaUrl: `https://www.figma.com/design/${fs.file.key}`,
      edits: fs.edits, comments: fs.comments, heat,
      contributors: Object.entries(fs.byUser).sort((a, b) => b[1].e - a[1].e).slice(0, 3).map(([u, s]) => {
        const d = DESIGNERS.find((x) => x.figma === u);
        return { i: d?.initials ?? u.slice(0, 2).toUpperCase(), n: d?.display ?? u, e: `${s.e} edits` };
      }),
      activity: fs.events.map((e) => ({ t: e.t, w: e.w })),
    }));

  /* ── Task metrics + trends ── */
  const done30 = tasks.filter((t) => t.completed && t.completedAt && new Date(t.completedAt).getTime() > cutoff);
  const onTime = done30.filter((t) => !t.due || (t.completedAt! <= `${t.due}T23:59:59Z`));
  const cycles = done30.map((t) => (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / day);
  const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;

  const wkDone: number[] = Array(8).fill(0);
  const wkOnTime: number[] = Array(8).fill(0);
  const wkCycle: number[][] = Array.from({ length: 8 }, () => []);
  for (const t of tasks.filter((x) => x.completed && x.completedAt)) {
    const w = Math.floor((Date.now() - new Date(t.completedAt!).getTime()) / (7 * day));
    if (w < 0 || w > 7) continue;
    const i = 7 - w;
    wkDone[i]++;
    if (!t.due || t.completedAt! <= `${t.due}T23:59:59Z`) wkOnTime[i]++;
    wkCycle[i].push((new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / day);
  }
  const wkEditsArr = Array.from({ length: 8 }, (_, i) => weekEdits[String(7 - i)] ?? 0);
  const pct = (arr: number[]) => {
    const [prev, curr] = [arr[arr.length - 2] || 0, arr[arr.length - 1] || 0];
    if (!prev) return curr ? "+100%" : "0%";
    const p = Math.round(((curr - prev) / prev) * 100);
    return `${p >= 0 ? "+" : "−"}${Math.abs(p)}%`;
  };
  const velocity = pct(wkDone);
  const cycleSeries = wkCycle.map((c) => (c.length ? Number((c.reduce((a, b) => a + b, 0) / c.length).toFixed(1)) : 0));
  const onTimeSeries = wkDone.map((d, i) => (d ? Math.round((wkOnTime[i] / d) * 100) : 0));

  const taskMetrics = [
    { label: "Completed · 30d", value: String(done30.length), tone: "text" },
    { label: "On-time rate", value: done30.length ? `${Math.round((onTime.length / done30.length) * 100)}%` : "—", tone: "green" },
    { label: "Avg cycle time", value: avgCycle ? `${avgCycle.toFixed(1)}d` : "—", tone: "text" },
    { label: "Velocity WoW", value: velocity, tone: velocity.startsWith("−") ? "red" : "green" },
  ];
  const trends = [
    { label: "Tasks completed / week", value: String(wkDone[7]), delta: pct(wkDone), tone: pct(wkDone).startsWith("−") ? "red" : "green", pts: wkDone },
    { label: "Avg cycle time", value: `${cycleSeries[7]}d`, delta: pct(cycleSeries), tone: pct(cycleSeries).startsWith("+") ? "red" : "green", pts: cycleSeries },
    { label: "On-time delivery", value: `${onTimeSeries[7]}%`, delta: pct(onTimeSeries), tone: pct(onTimeSeries).startsWith("−") ? "red" : "green", pts: onTimeSeries },
    { label: "Figma edits / week", value: String(wkEditsArr[7]), delta: pct(wkEditsArr), tone: pct(wkEditsArr).startsWith("−") ? "red" : "green", pts: wkEditsArr },
  ];

  /* ── Breakdown lists ── */
  const byProject = clients.slice(0, 6).map((c) => [c.name, c.tasks] as [string, number]);
  const typeCounts: Record<string, number> = {};
  for (const t of open) if (t.type) typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
  const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0) || 1;
  const byType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([n, v]) => [n, Math.round((v / typeTotal) * 100)] as [string, number]);
  const byAssignee = designers.filter((d) => d.active > 0).sort((a, b) => b.active - a.active).slice(0, 6).map((d) => ({
    i: d.initials, n: d.name, active: d.active,
    note: d.overdue ? `${d.overdue} overdue` : "on track", tone: d.overdue ? "red" : "green",
  }));

  /* ── Client Figma activity map (for cold + coverage) ── */
  const clientLast: Record<string, string> = {};
  for (const fs of fileStats) {
    if (!fs.client) continue;
    if (!clientLast[fs.client] || fs.lastActivity > clientLast[fs.client]) clientLast[fs.client] = fs.lastActivity;
  }

  /* ── Cold deadlines ── */
  const coldDeadlines = open
    .filter((t) => t.due)
    .map((t) => {
      const dd = Math.ceil((new Date(t.due!).getTime() - Date.now()) / day);
      const quiet = t.client && clientLast[t.client] ? daysAgo(clientLast[t.client]) : 999;
      const hasFile = Boolean(t.client && clientLast[t.client]);
      const started = t.progress ? t.progress !== "Not Started" : true;
      const suppressed = t.progress === "In Review" || t.progress === "Done";
      const band = coldBand(dd, quiet, started, hasFile, suppressed);
      return band ? {
        id: `${t.name}-${t.due}`.slice(0, 60), title: t.name, client: t.client ?? "Unmapped",
        pri: (dd <= 2 ? "P0" : dd <= 5 ? "P1" : "P2") as "P0" | "P1" | "P2", band,
        chips: [
          dd < 0 ? `Overdue ${-dd}d` : `Due in ${dd}d`,
          hasFile ? (quiet > 900 ? "No recent activity" : `Quiet ${quiet}d`) : "No Figma file linked",
          ...(t.progress ? [t.progress] : []),
        ],
        actions: band === "Needs link" ? ["Link file", "Dismiss"] : ["I've got this", "Snooze", "Reassign"],
      } : null;
    })
    .filter(Boolean)
    .slice(0, 8) as unknown as Dataset["coldDeadlines"];

  /* ── Coverage + balance ── */
  const coverage = clients.slice(0, 8).map((c) => {
    const team = [...new Set(open.filter((t) => t.client === c.name && t.assignee).map((t) => DESIGNERS.find((d) => d.asana === t.assignee)?.initials ?? t.assignee!.slice(0, 2).toUpperCase()))];
    const lastIso = clientLast[c.name];
    const quiet = lastIso ? daysAgo(lastIso) : Infinity;
    const status = team.length === 0 ? "No coverage" : quiet >= THRESHOLDS.coverageDarkDays ? "Going quiet" : "Healthy";
    return { proj: c.name, client: c.name, team: team.slice(0, 3), open: c.tasks, last: team.length === 0 ? "no owner" : quiet === Infinity ? "no activity" : quiet >= THRESHOLDS.quietDays ? `quiet ${quiet}d` : ago(lastIso), status };
  }) as unknown as Dataset["coverage"];
  const balance = designers.filter((d) => d.active > 0).sort((a, b) => b.active - a.active).slice(0, 6).map((d) => ({
    i: d.initials, n: d.name, cap: d.cap,
    status: d.cap[0] > d.cap[1] ? "Overloaded" : d.cap[0] <= d.cap[1] / 2 ? "Has room" : "Balanced",
  }));

  /* ── Flags ── */
  const flags: Dataset["flags"] = [];
  for (const c of clients) if (c.overdue >= 3) flags.push({ t: "Overdue clustering", d: `${c.name} has ${c.overdue} overdue tasks`, sev: "Danger", entityRef: { entityType: "client", entityId: c.id } });
  for (const d of designers) if (d.flag === "High load") flags.push({ t: "High load imbalance", d: `${d.name}: ${d.active} tasks, only ${d.edits} Figma edits`, sev: "Danger", entityRef: { entityType: "designer", entityId: d.id } });
  if (velocity.startsWith("−") && Math.abs(parseInt(velocity.replace(/[−%+]/g, ""))) >= 20) flags.push({ t: "Velocity drop", d: `Team throughput down ${velocity.replace("−", "")} week-over-week`, sev: "Warn" });
  for (const t of open) { const od = t.due ? Math.floor((Date.now() - new Date(t.due).getTime()) / day) : 0; if (od >= 14) { flags.push({ t: "Stale overdue", d: `${t.name} is ${od} days past due`, sev: "Warn", ...(t.client ? { entityRef: { entityType: "client" as const, entityId: t.client.toLowerCase().replace(/[^a-z0-9]+/g, "-") } } : {}) }); break; } }
  for (const c of clients) if (c.designers === 1 && c.tasks >= 4) { flags.push({ t: "Bus factor", d: `${c.name} is served by a single designer with ${c.tasks} tasks`, sev: "Info", entityRef: { entityType: "client", entityId: c.id } }); break; }
  if (!designers.some((d) => d.active > 0 && d.edits === 0)) flags.push({ t: "Coverage healthy", d: "No zero-edit designers this week", sev: "Ok" });

  /* ── Panel detail maps ── */
  const designerTasks: Record<string, { t: string; s: string; c?: string }[]> = {};
  for (const d of designers) {
    designerTasks[d.id] = open.filter((t) => t.assignee === DESIGNERS.find((x) => x.initials === d.initials)?.asana)
      .slice(0, 4).map((t) => ({ t: t.name, s: t.progress ?? (isOverdue(t) ? "Overdue" : "In Progress"), c: t.client ? t.client.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined }));
  }
  const clientDeadlines: Record<string, { t: string; s: string; tone: string }[]> = {};
  for (const c of clients) {
    clientDeadlines[c.id] = open.filter((t) => t.client === c.name && t.due)
      .sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 4)
      .map((t) => {
        const dd = Math.ceil((new Date(t.due!).getTime() - Date.now()) / day);
        return { t: t.name, s: dd < 0 ? "Overdue" : `Due ${dd}d`, tone: dd < 0 ? "red" : dd <= 2 ? "amber" : "text2" };
      });
  }

  return {
    ...DEMO,
    designers, leaderboardIds, clients, hotFiles, taskMetrics,
    byProject, byType: byType.length ? byType : DEMO.byType, byAssignee,
    trends, flags: flags.slice(0, 8), coldDeadlines,
    coldSuppressed: { title: "Status-guarded tasks", client: "All clients", pri: "P1", note: "In Review / Done tasks suppressed by status guard" },
    coverage, balance, designerTasks, clientDeadlines,
  } as unknown as Dataset;
}
