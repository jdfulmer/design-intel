"use client";
// app/dashboard.tsx
// Design Intel — design ops intelligence dashboard

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DesignerActivity {
  name: string;
  edits: number;
  comments: number;
  files: string[];
  projects: string[];
}

interface AsanaTask {
  gid: string;
  name: string;
  assignee: { gid: string; name: string } | null;
  due_on: string | null;
  completed: boolean;
  projects: Array<{ gid: string; name: string }>;
  custom_fields: Array<{ name: string; display_value: string | null; number_value?: number | null }>;
}

interface DataSource {
  figmaActivity: DesignerActivity[] | null;
  asanaTasks: AsanaTask[] | null;
  figmaFiles: string[];
  asanaFiles: string[];
  lastFetched: { figma: string | null; asana: string | null };
  mode: "api" | "csv" | "mixed" | "empty";
}

// ── Name Mapping ──────────────────────────────────────────────────────────────
const ASANA_TO_FIGMA: Record<string, string> = {
  "Vince Herrera":      "Vincent Herrera",
  "Nicole Howard":      "Nicole Howard",
  "Bianca Louise Gran": "Bianca",
  "Enisa Celik":        "enisa",
  "Kitz MR Amago":      "Kitz",
  "Dannah Gorospe":     "dannah",
  "Ricardo Rodriguez":  "Ricardo",
  "Ryann Christian":    "Ryann",
  "Roger Mitri":        "Roger Mitri",
  "Donna Diego":        "Donna  Diego",
  "Joshua Fulmer":      "Joshua Fulmer",
};

const NON_CLIENT_PROJECTS = new Set(["Creative Intake", "Creative Tasks", "General Tasks"]);

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG      = "#0a0f0d";
const SURFACE = "#0e1512";
const ACCENT  = "#10b981";
const ACCENT2 = "#34d399";
const MUTED   = "#6b8c7a";
const TEXT    = "#e2e8e4";
const DIM     = "#3d5a4a";
const BORDER  = "#1e2d26";
const DANGER  = "#ef4444";
const WARN    = "#f59e0b";
const PANEL   = "#111b17";

const FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";
const FONT_SANS = "'DM Sans', 'Inter', system-ui, sans-serif";

// ── Utilities ─────────────────────────────────────────────────────────────────

function designerScore(d: DesignerActivity): number {
  return Math.round(d.edits * 3 + d.comments * 2 + d.files.length * 2 + d.projects.length * 3);
}

function isOverdue(task: AsanaTask): boolean {
  if (!task.due_on || task.completed) return false;
  return new Date(task.due_on) < new Date(new Date().toISOString().slice(0, 10));
}

function pressureLabel(score: number): { text: string; color: string } {
  if (score >= 15) return { text: "HIGH", color: DANGER };
  if (score >= 8) return { text: "MED", color: WARN };
  return { text: "LOW", color: ACCENT };
}

function effLabel(eff: number | null): { text: string; color: string } {
  if (eff === null) return { text: "—", color: DIM };
  if (eff > 3) return { text: "HIGH THRU", color: ACCENT2 };
  if (eff >= 1) return { text: "On track", color: ACCENT };
  return { text: "Behind", color: WARN };
}

function fmt(n: number): string {
  return n.toLocaleString();
}

// ── Dashboard Entry ───────────────────────────────────────────────────────────

export default function DesignIntelDashboard() {
  const [source, setSource] = useState<DataSource>({
    figmaActivity: null,
    asanaTasks: null,
    figmaFiles: [],
    asanaFiles: [],
    lastFetched: { figma: null, asana: null },
    mode: "empty",
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFromApi = useCallback(async (force = false) => {
    setRefreshing(true);
    setApiError(null);

    try {
      const headers: HeadersInit = {};
      const secret = process.env.NEXT_PUBLIC_API_SECRET;
      if (secret) headers["Authorization"] = `Bearer ${secret}`;

      const [figmaRes, asanaRes, cacheRes] = await Promise.allSettled([
        fetch(`/api/figma${force ? "?force=true" : ""}`, { headers }),
        fetch(`/api/asana${force ? "?force=true" : ""}`, { headers }),
        fetch("/api/cache", { headers }),
      ]);

      const figmaData = figmaRes.status === "fulfilled" && figmaRes.value.ok
        ? (await figmaRes.value.json()).data as DesignerActivity[]
        : null;

      const asanaData = asanaRes.status === "fulfilled" && asanaRes.value.ok
        ? (await asanaRes.value.json()).data as AsanaTask[]
        : null;

      const cacheData = cacheRes.status === "fulfilled" && cacheRes.value.ok
        ? await cacheRes.value.json()
        : null;

      if (!figmaData && !asanaData) {
        setApiError("No data returned. Check env vars.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setSource(prev => ({
        ...prev,
        figmaActivity: figmaData ?? prev.figmaActivity,
        asanaTasks: asanaData ?? prev.asanaTasks,
        figmaFiles: figmaData ? ["Live · Figma API"] : prev.figmaFiles,
        asanaFiles: asanaData ? ["Live · Asana API"] : prev.asanaFiles,
        lastFetched: {
          figma: cacheData?.figma ?? null,
          asana: cacheData?.asana ?? null,
        },
        mode: figmaData && asanaData ? "api"
          : figmaData || asanaData ? "mixed"
          : prev.mode,
      }));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Fetch failed");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFromApi(); }, [fetchFromApi]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", background: BG, display: "flex",
        alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
        fontFamily: FONT,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
        `}</style>
        <div style={{
          width: 32, height: 32, border: `2px solid ${BORDER}`,
          borderTopColor: ACCENT, borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <div style={{ color: MUTED, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
          Fetching live data
        </div>
      </div>
    );
  }

  return (
    <DashboardCore
      figmaActivity={source.figmaActivity}
      asanaTasks={source.asanaTasks}
      figmaFileNames={source.figmaFiles}
      lastFetched={source.lastFetched}
      apiError={apiError}
      refreshing={refreshing}
      onRefresh={() => fetchFromApi(true)}
    />
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 130 }}>
      <div style={{
        fontFamily: FONT, fontSize: 11, color: MUTED, letterSpacing: 1.5,
        textTransform: "uppercase", marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT, fontSize: 28, fontWeight: 700,
        color: accent ? ACCENT : TEXT, lineHeight: 1,
      }}>{typeof value === "number" ? fmt(value) : value}</div>
      {sub && <div style={{
        fontFamily: FONT, fontSize: 11, color: DIM, marginTop: 4,
      }}>{sub}</div>}
    </div>
  );
}

// ── Panel Wrapper ─────────────────────────────────────────────────────────────

function Panel({ title, children, span }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{
      background: PANEL,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: "20px 22px",
      gridColumn: span ? `span ${span}` : undefined,
    }}>
      <div style={{
        fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600,
        color: MUTED, letterSpacing: 0.5, textTransform: "uppercase",
        marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 3, height: 14, background: ACCENT, borderRadius: 2 }} />
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Rank Badge ────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const isTop = rank === 1;
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT, fontSize: 11, fontWeight: 700,
      background: isTop ? ACCENT : "transparent",
      color: isTop ? BG : DIM,
      border: isTop ? "none" : `1px solid ${BORDER}`,
    }}>
      {rank}
    </div>
  );
}

// ── Pressure Bar ──────────────────────────────────────────────────────────────

function PressureBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min((score / Math.max(max, 1)) * 100, 100);
  const { color } = pressureLabel(score);
  return (
    <div style={{ width: "100%", height: 4, background: BORDER, borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color, borderRadius: 2,
        transition: "width 0.6s ease",
      }} />
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6,
      padding: "8px 12px", fontFamily: FONT, fontSize: 11,
    }}>
      <div style={{ color: TEXT, fontWeight: 600 }}>{label}</div>
      <div style={{ color: ACCENT }}>{fmt(payload[0].value)} tasks</div>
    </div>
  );
}

// ── Dashboard Core ────────────────────────────────────────────────────────────

function DashboardCore({
  figmaActivity,
  asanaTasks,
  figmaFileNames,
  lastFetched,
  apiError,
  refreshing,
  onRefresh,
}: {
  figmaActivity: DesignerActivity[] | null;
  asanaTasks: AsanaTask[] | null;
  figmaFileNames: string[];
  lastFetched: { figma: string | null; asana: string | null };
  apiError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const hasLiveData = figmaFileNames.some(f => f.startsWith("Live"));
  const tasks = asanaTasks ?? [];

  // ── Computed data ──────────────────────────────────────────────────────────

  const designers = useMemo(() => {
    if (!figmaActivity) return [];
    return figmaActivity
      .map(d => ({ ...d, score: designerScore(d) }))
      .sort((a, b) => b.score - a.score);
  }, [figmaActivity]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(isOverdue).length;
    const byAssignee: Record<string, { total: number; overdue: number }> = {};
    const byProject: Record<string, number> = {};

    for (const t of tasks) {
      const name = t.assignee?.name ?? "Unassigned";
      byAssignee[name] ??= { total: 0, overdue: 0 };
      byAssignee[name].total++;
      if (isOverdue(t)) byAssignee[name].overdue++;

      for (const p of t.projects) {
        if (!NON_CLIENT_PROJECTS.has(p.name)) {
          byProject[p.name] = (byProject[p.name] ?? 0) + 1;
        }
      }
    }

    const topAssignees = Object.entries(byAssignee)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.total - a.total);

    const topProjects = Object.entries(byProject)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return { total, overdue, topAssignees, topProjects };
  }, [tasks]);

  const clientPressure = useMemo(() => {
    const clientMap: Record<string, { tasks: number; overdue: number }> = {};
    for (const t of tasks) {
      for (const p of t.projects) {
        if (NON_CLIENT_PROJECTS.has(p.name)) continue;
        clientMap[p.name] ??= { tasks: 0, overdue: 0 };
        clientMap[p.name].tasks++;
        if (isOverdue(t)) clientMap[p.name].overdue++;
      }
    }

    const figmaProjectEdits: Record<string, number> = {};
    if (figmaActivity) {
      for (const d of figmaActivity) {
        for (const p of d.projects) {
          figmaProjectEdits[p] = (figmaProjectEdits[p] ?? 0) + d.edits;
        }
      }
    }

    return Object.entries(clientMap)
      .map(([name, c]) => {
        const matchedEdits = Object.entries(figmaProjectEdits)
          .filter(([fp]) => fp.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(fp.toLowerCase()))
          .reduce((sum, [, v]) => sum + v, 0);
        const score = c.tasks + c.overdue * 3 - Math.min(matchedEdits * 0.3, c.tasks);
        return { name, ...c, matchedEdits, pressureScore: Math.round(score) };
      })
      .sort((a, b) => b.pressureScore - a.pressureScore)
      .slice(0, 10);
  }, [tasks, figmaActivity]);

  const workloadBalance = useMemo(() => {
    const tasksByFigmaName: Record<string, { active: number; overdue: number; clients: Set<string> }> = {};
    for (const t of tasks) {
      const asanaName = t.assignee?.name ?? "";
      const figmaName = ASANA_TO_FIGMA[asanaName] ?? asanaName;
      if (!figmaName) continue;
      tasksByFigmaName[figmaName] ??= { active: 0, overdue: 0, clients: new Set() };
      tasksByFigmaName[figmaName].active++;
      if (isOverdue(t)) tasksByFigmaName[figmaName].overdue++;
      for (const p of t.projects) {
        if (!NON_CLIENT_PROJECTS.has(p.name)) tasksByFigmaName[figmaName].clients.add(p.name);
      }
    }

    const allNames = new Set([
      ...(figmaActivity?.map(d => d.name) ?? []),
      ...Object.keys(tasksByFigmaName),
    ]);

    return Array.from(allNames).map(name => {
      const f = figmaActivity?.find(d => d.name === name);
      const edits = f?.edits ?? 0;
      const a = tasksByFigmaName[name] ?? { active: 0, overdue: 0, clients: new Set() };
      const efficiency = a.active > 0 ? parseFloat((edits / a.active).toFixed(1)) : null;
      const highLoad = a.active >= 8 && edits < 15;
      const highThru = efficiency !== null && efficiency > 3;
      return { name, edits, activeTasks: a.active, overdue: a.overdue, efficiency, highLoad, highThru };
    })
    .filter(d => d.activeTasks > 0 || d.edits > 0)
    .sort((a, b) => b.activeTasks - a.activeTasks);
  }, [tasks, figmaActivity]);

  const maxPressure = clientPressure.length ? Math.max(...clientPressure.map(c => c.pressureScore)) : 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: FONT_SANS }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 8px ${ACCENT}33; } 50% { box-shadow: 0 0 16px ${ACCENT}55; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: BG,
            animation: "glow 3s ease infinite",
          }}>D</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, letterSpacing: -0.3 }}>
              Design Intel
            </div>
            <div style={{ fontSize: 11, color: MUTED, fontFamily: FONT }}>
              Market Defense — Design Ops
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {hasLiveData && !apiError && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: FONT }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", background: ACCENT,
                boxShadow: `0 0 6px ${ACCENT}`,
              }} />
              <span style={{ color: ACCENT }}>LIVE</span>
              {lastFetched.figma && (
                <span style={{ color: DIM }}>Figma {new Date(lastFetched.figma).toLocaleTimeString()}</span>
              )}
              {lastFetched.asana && (
                <span style={{ color: DIM }}>Asana {new Date(lastFetched.asana).toLocaleTimeString()}</span>
              )}
            </div>
          )}
          {apiError && (
            <span style={{ color: DANGER, fontSize: 11, fontFamily: FONT }}>{apiError}</span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              background: "transparent", border: `1px solid ${BORDER}`,
              color: refreshing ? MUTED : TEXT, borderRadius: 7,
              padding: "6px 14px", fontSize: 11, fontFamily: FONT,
              cursor: refreshing ? "not-allowed" : "pointer", fontWeight: 500,
              transition: "all 0.2s",
            }}
          >
            {refreshing ? "Syncing…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{
        padding: "24px 32px", display: "flex", gap: 32, flexWrap: "wrap",
        borderBottom: `1px solid ${BORDER}`,
        animation: "fadeIn 0.4s ease",
      }}>
        <Stat label="Designers" value={designers.length} accent />
        <Stat label="Total Edits" value={designers.reduce((s, d) => s + d.edits, 0)} />
        <Stat label="Comments" value={designers.reduce((s, d) => s + d.comments, 0)} />
        <Stat label="Open Tasks" value={taskStats.total} />
        <Stat label="Overdue" value={taskStats.overdue} sub={taskStats.total > 0 ? `${((taskStats.overdue / taskStats.total) * 100).toFixed(0)}% of total` : undefined} />
        <Stat
          label="Files Active"
          value={figmaActivity ? new Set(figmaActivity.flatMap(d => d.files)).size : 0}
        />
      </div>

      {/* ── Grid ── */}
      <div style={{
        padding: "24px 32px", display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20, animation: "fadeIn 0.5s ease 0.1s both",
      }}>

        {/* ── 1. Designer Leaderboard ── */}
        <Panel title="Designer Activity">
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {designers.map((d, i) => (
              <div key={d.name} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 0",
                borderBottom: i < designers.length - 1 ? `1px solid ${BORDER}` : "none",
              }}>
                <RankBadge rank={i + 1} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: i === 0 ? ACCENT : TEXT,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: DIM, fontFamily: FONT }}>
                    {d.projects.length} project{d.projects.length !== 1 ? "s" : ""} · {d.files.length} file{d.files.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FONT, fontSize: 11, color: MUTED }}>edits</div>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: TEXT }}>{d.edits}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FONT, fontSize: 11, color: MUTED }}>comments</div>
                    <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: TEXT }}>{d.comments}</div>
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 16, fontWeight: 700,
                    color: i === 0 ? ACCENT : ACCENT2,
                    minWidth: 42, textAlign: "right",
                  }}>{d.score}</div>
                </div>
              </div>
            ))}
            {designers.length === 0 && (
              <div style={{ color: DIM, fontSize: 12, fontFamily: FONT, padding: 16, textAlign: "center" }}>
                Waiting for Figma data…
              </div>
            )}
          </div>
        </Panel>

        {/* ── 2. Task Overview ── */}
        <Panel title="Task Overview">
          {taskStats.topProjects.length > 0 && (
            <div style={{ height: 180, marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskStats.topProjects.map(([name, count]) => ({
                  name: name.length > 16 ? name.slice(0, 14) + "…" : name,
                  count,
                }))} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name" tick={{ fill: DIM, fontSize: 10, fontFamily: FONT }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis tick={{ fill: DIM, fontSize: 10, fontFamily: FONT }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: `${ACCENT}11` }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {taskStats.topProjects.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? ACCENT : `${ACCENT}88`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{ fontSize: 11, fontFamily: FONT, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            By Assignee
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {taskStats.topAssignees.slice(0, 10).map((a) => (
              <div key={a.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderBottom: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 12, color: TEXT, fontWeight: 500 }}>{a.name}</span>
                <div style={{ display: "flex", gap: 12, fontFamily: FONT, fontSize: 12 }}>
                  <span style={{ color: TEXT }}>{a.total}</span>
                  {a.overdue > 0 && (
                    <span style={{ color: DANGER }}>{a.overdue} overdue</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {tasks.length === 0 && (
            <div style={{ color: DIM, fontSize: 12, fontFamily: FONT, padding: 16, textAlign: "center" }}>
              Waiting for Asana data…
            </div>
          )}
        </Panel>

        {/* ── 3. Client Pressure ── */}
        <Panel title="Client Pressure Index">
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {clientPressure.map((c, i) => {
              const p = pressureLabel(c.pressureScore);
              return (
                <div key={c.name} style={{
                  padding: "10px 0",
                  borderBottom: i < clientPressure.length - 1 ? `1px solid ${BORDER}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{c.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: DIM }}>
                        {c.tasks} tasks · {c.overdue} overdue · {c.matchedEdits} edits
                      </span>
                      <span style={{
                        fontFamily: FONT, fontSize: 10, fontWeight: 700,
                        color: p.color, padding: "2px 6px",
                        border: `1px solid ${p.color}44`,
                        borderRadius: 4, letterSpacing: 1,
                      }}>{p.text}</span>
                    </div>
                  </div>
                  <PressureBar score={c.pressureScore} max={maxPressure} />
                </div>
              );
            })}
            {clientPressure.length === 0 && (
              <div style={{ color: DIM, fontSize: 12, fontFamily: FONT, padding: 16, textAlign: "center" }}>
                Need both Figma + Asana data
              </div>
            )}
          </div>
        </Panel>

        {/* ── 4. Workload Balance ── */}
        <Panel title="Workload Balance">
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 60px 80px",
              gap: 0, fontSize: 10, fontFamily: FONT, color: MUTED,
              textTransform: "uppercase", letterSpacing: 1,
              padding: "0 0 8px", borderBottom: `1px solid ${BORDER}`,
            }}>
              <span>Designer</span>
              <span style={{ textAlign: "right" }}>Tasks</span>
              <span style={{ textAlign: "right" }}>Overdue</span>
              <span style={{ textAlign: "right" }}>Edits</span>
              <span style={{ textAlign: "right" }}>Eff.</span>
              <span style={{ textAlign: "right" }}>Status</span>
            </div>
            {workloadBalance.map((d) => {
              const eff = effLabel(d.efficiency);
              return (
                <div key={d.name} style={{
                  display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 60px 80px",
                  gap: 0, padding: "8px 0", borderBottom: `1px solid ${BORDER}`,
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.name}
                    {d.highLoad && <span style={{ color: DANGER, fontSize: 10, marginLeft: 6 }}>!</span>}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: TEXT, textAlign: "right" }}>{d.activeTasks}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: d.overdue > 0 ? DANGER : DIM, textAlign: "right" }}>{d.overdue}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: ACCENT, textAlign: "right" }}>{d.edits}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: TEXT, textAlign: "right" }}>
                    {d.efficiency !== null ? `${d.efficiency}×` : "—"}
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 600,
                    color: d.highLoad ? DANGER : eff.color,
                    textAlign: "right", letterSpacing: 0.5,
                  }}>
                    {d.highLoad ? "HIGH LOAD" : d.highThru ? "HIGH THRU" : eff.text}
                  </div>
                </div>
              );
            })}
            {workloadBalance.length === 0 && (
              <div style={{ color: DIM, fontSize: 12, fontFamily: FONT, padding: 16, textAlign: "center" }}>
                Need both Figma + Asana data
              </div>
            )}
          </div>
        </Panel>

      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: "16px 32px", borderTop: `1px solid ${BORDER}`,
        display: "flex", justifyContent: "space-between",
        fontFamily: FONT, fontSize: 11, color: DIM,
      }}>
        <span>Design Intel v2.0 — D2E Labs</span>
        <span>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
    </div>
  );
}
