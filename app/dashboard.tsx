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

// ── Design Team ───────────────────────────────────────────────────────────────
// Asana display name → Figma handle. Only these people appear in the dashboard.

const DESIGN_TEAM: Record<string, string> = {
  "Joshua Fulmer":      "Joshua Fulmer",
  "Nicole Howard":      "Nicole Howard",
  "Vince Herrera":      "Vincent Herrera",
  "Abigail Roxas":      "Abigail Roxas",
  "Bianca Louise Gran": "Bianca",
  "Bianca Gran":        "Bianca",
  "Dannah Gorospe":     "dannah",
  "Enisa Celik":        "enisa",
  "Kitz MR Amago":      "Kitz",
  "Kitz Amago":         "Kitz",
  "Ricardo Rodriguez":  "Ricardo",
  "Rogerio Mitri":      "Roger Mitri",
  "Roger Mitri":        "Roger Mitri",
  "Ruth Quintana":      "Ruth",
  "Ryann Bautista":     "Ryann",
  "Ryann Christian":    "Ryann",
};

// All Figma handles that belong to the design team
const TEAM_FIGMA_NAMES = new Set(Object.values(DESIGN_TEAM));

// All Asana names that belong to the design team
const TEAM_ASANA_NAMES = new Set(Object.keys(DESIGN_TEAM));

function isTeamTask(task: AsanaTask): boolean {
  return task.assignee !== null && TEAM_ASANA_NAMES.has(task.assignee.name);
}

function toFigmaName(asanaName: string): string {
  return DESIGN_TEAM[asanaName] ?? asanaName;
}

const NON_CLIENT_PROJECTS = new Set(["Creative Intake", "Creative Tasks", "General Tasks"]);

// ── Theme — Market Defense ────────────────────────────────────────────────────
const BG      = "#000000";
const SURFACE = "#0A0A0A";
const CREAM   = "#F5F3F1";
const WHITE   = "#FFFFFF";
const TEXT    = "#F5F3F1";
const TEXT2   = "#B1B1B1";
const DIM     = "#818181";
const DARK    = "#191919";
const BORDER  = "#2A2A2A";
const DANGER  = "#DC2626";
const WARN    = "#D97706";
const OK      = "#16A34A";

const FONT = "'Söhne Mono', 'SF Mono', 'Menlo', monospace";
const FONT_SANS = "'Söhne', 'Helvetica Neue', 'Arial', sans-serif";

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
  return { text: "LOW", color: OK };
}

function effLabel(eff: number | null): { text: string; color: string } {
  if (eff === null) return { text: "—", color: DIM };
  if (eff > 3) return { text: "HIGH THRU", color: OK };
  if (eff >= 1) return { text: "On track", color: TEXT2 };
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
        alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20,
        fontFamily: FONT_SANS,
      }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{
          width: 28, height: 28, border: `1.5px solid ${BORDER}`,
          borderTopColor: CREAM, borderRadius: "50%",
          animation: "spin 0.9s linear infinite",
        }} />
        <div style={{ color: DIM, fontSize: 13, fontWeight: 500, letterSpacing: 1 }}>
          Loading
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

function Stat({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{
        fontSize: 11, color: DIM, letterSpacing: 0.5,
        textTransform: "uppercase", marginBottom: 8, fontWeight: 500,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT, fontSize: 32, fontWeight: 400,
        color: highlight ? WHITE : CREAM, lineHeight: 1, letterSpacing: -1,
      }}>{typeof value === "number" ? fmt(value) : value}</div>
      {sub && <div style={{
        fontSize: 11, color: DIM, marginTop: 6,
      }}>{sub}</div>}
    </div>
  );
}

// ── Panel Wrapper ─────────────────────────────────────────────────────────────

function Panel({ title, children, span }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 0,
      padding: "24px 24px",
      gridColumn: span ? `span ${span}` : undefined,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 500, letterSpacing: 1.5,
        color: DIM, textTransform: "uppercase",
        marginBottom: 20, paddingBottom: 12,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Pressure Bar ──────────────────────────────────────────────────────────────

function PressureBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min((score / Math.max(max, 1)) * 100, 100);
  const { color } = pressureLabel(score);
  return (
    <div style={{ width: "100%", height: 2, background: BORDER, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color,
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
      background: DARK, border: `1px solid ${BORDER}`, borderRadius: 0,
      padding: "8px 14px", fontFamily: FONT, fontSize: 11,
    }}>
      <div style={{ color: CREAM, fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ color: DIM }}>{fmt(payload[0].value)} tasks</div>
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

  // Filter to design team only
  const teamTasks = useMemo(() => (asanaTasks ?? []).filter(isTeamTask), [asanaTasks]);

  const teamFigma = useMemo(() => {
    if (!figmaActivity) return [];
    return figmaActivity.filter(d => TEAM_FIGMA_NAMES.has(d.name));
  }, [figmaActivity]);

  // ── Computed data ──────────────────────────────────────────────────────────

  const designers = useMemo(() => {
    return teamFigma
      .map(d => ({ ...d, score: designerScore(d) }))
      .sort((a, b) => b.score - a.score);
  }, [teamFigma]);

  const taskStats = useMemo(() => {
    const total = teamTasks.length;
    const overdue = teamTasks.filter(isOverdue).length;
    const byAssignee: Record<string, { total: number; overdue: number }> = {};
    const byProject: Record<string, number> = {};

    for (const t of teamTasks) {
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
  }, [teamTasks]);

  const clientPressure = useMemo(() => {
    const clientMap: Record<string, { tasks: number; overdue: number }> = {};
    for (const t of teamTasks) {
      for (const p of t.projects) {
        if (NON_CLIENT_PROJECTS.has(p.name)) continue;
        clientMap[p.name] ??= { tasks: 0, overdue: 0 };
        clientMap[p.name].tasks++;
        if (isOverdue(t)) clientMap[p.name].overdue++;
      }
    }

    const figmaProjectEdits: Record<string, number> = {};
    for (const d of teamFigma) {
      for (const p of d.projects) {
        figmaProjectEdits[p] = (figmaProjectEdits[p] ?? 0) + d.edits;
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
  }, [teamTasks, teamFigma]);

  const workloadBalance = useMemo(() => {
    const tasksByFigmaName: Record<string, { active: number; overdue: number }> = {};
    for (const t of teamTasks) {
      const figmaName = toFigmaName(t.assignee?.name ?? "");
      if (!figmaName) continue;
      tasksByFigmaName[figmaName] ??= { active: 0, overdue: 0 };
      tasksByFigmaName[figmaName].active++;
      if (isOverdue(t)) tasksByFigmaName[figmaName].overdue++;
    }

    const allNames = new Set([
      ...teamFigma.map(d => d.name),
      ...Object.keys(tasksByFigmaName),
    ]);

    return Array.from(allNames).map(name => {
      const f = teamFigma.find(d => d.name === name);
      const edits = f?.edits ?? 0;
      const a = tasksByFigmaName[name] ?? { active: 0, overdue: 0 };
      const efficiency = a.active > 0 ? parseFloat((edits / a.active).toFixed(1)) : null;
      const highLoad = a.active >= 8 && edits < 15;
      const highThru = efficiency !== null && efficiency > 3;
      return { name, edits, activeTasks: a.active, overdue: a.overdue, efficiency, highLoad, highThru };
    })
    .filter(d => d.activeTasks > 0 || d.edits > 0)
    .sort((a, b) => b.activeTasks - a.activeTasks);
  }, [teamTasks, teamFigma]);

  const maxPressure = clientPressure.length ? Math.max(...clientPressure.map(c => c.pressureScore)) : 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: FONT_SANS, color: TEXT }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: WHITE, letterSpacing: -0.5 }}>
            Design Intel
          </span>
          <span style={{ fontSize: 12, color: DIM, fontWeight: 400, borderLeft: `1px solid ${BORDER}`, paddingLeft: 16 }}>
            Market Defense
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {hasLiveData && !apiError && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%", background: OK,
              }} />
              <span style={{ color: DIM, fontFamily: FONT, fontSize: 11 }}>
                Live
                {lastFetched.figma && ` · Figma ${new Date(lastFetched.figma).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                {lastFetched.asana && ` · Asana ${new Date(lastFetched.asana).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </div>
          )}
          {apiError && (
            <span style={{ color: DANGER, fontSize: 11, fontFamily: FONT }}>{apiError}</span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              background: refreshing ? "transparent" : CREAM,
              border: refreshing ? `1px solid ${BORDER}` : "none",
              color: refreshing ? DIM : BG,
              borderRadius: 0, padding: "7px 18px",
              fontSize: 12, fontWeight: 500,
              cursor: refreshing ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              fontFamily: FONT_SANS,
            }}
          >
            {refreshing ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{
        padding: "32px 40px", display: "flex", gap: 48, flexWrap: "wrap",
        borderBottom: `1px solid ${BORDER}`,
        animation: "fadeIn 0.4s ease",
      }}>
        <Stat label="Team Members" value={designers.length} highlight />
        <Stat label="Total Edits" value={designers.reduce((s, d) => s + d.edits, 0)} />
        <Stat label="Comments" value={designers.reduce((s, d) => s + d.comments, 0)} />
        <Stat label="Assigned Tasks" value={taskStats.total} />
        <Stat
          label="Overdue"
          value={taskStats.overdue}
          sub={taskStats.total > 0 ? `${((taskStats.overdue / taskStats.total) * 100).toFixed(0)}% of assigned` : undefined}
        />
        <Stat
          label="Active Files"
          value={teamFigma.length > 0 ? new Set(teamFigma.flatMap(d => d.files)).size : 0}
        />
      </div>

      {/* ── Grid ── */}
      <div style={{
        padding: "32px 40px", display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 1, background: BORDER,
        animation: "fadeIn 0.5s ease 0.1s both",
      }}>

        {/* ── 1. Designer Leaderboard ── */}
        <Panel title="Designer Activity">
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {designers.map((d, i) => (
              <div key={d.name} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 0",
                borderBottom: i < designers.length - 1 ? `1px solid ${BORDER}` : "none",
              }}>
                <div style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  color: i === 0 ? WHITE : DIM, width: 20, textAlign: "center",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500,
                    color: i === 0 ? WHITE : CREAM,
                  }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>
                    {d.projects.length} project{d.projects.length !== 1 ? "s" : ""} · {d.files.length} file{d.files.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, alignItems: "baseline", flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 400, color: CREAM }}>{d.edits}</div>
                    <div style={{ fontSize: 10, color: DIM }}>edits</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 400, color: CREAM }}>{d.comments}</div>
                    <div style={{ fontSize: 10, color: DIM }}>comments</div>
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 13, fontWeight: 500,
                    color: BG, background: i === 0 ? CREAM : DARK,
                    padding: "4px 10px",
                    minWidth: 48, textAlign: "center",
                    ...(i !== 0 ? { color: DIM } : {}),
                  }}>{d.score}</div>
                </div>
              </div>
            ))}
            {designers.length === 0 && (
              <div style={{ color: DIM, fontSize: 12, padding: 24, textAlign: "center" }}>
                Waiting for Figma data…
              </div>
            )}
          </div>
        </Panel>

        {/* ── 2. Task Overview ── */}
        <Panel title="Task Overview — Design Team">
          {taskStats.topProjects.length > 0 && (
            <div style={{ height: 180, marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskStats.topProjects.map(([name, count]) => ({
                  name: name.length > 14 ? name.slice(0, 12) + "…" : name,
                  count,
                }))} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name" tick={{ fill: DIM, fontSize: 10, fontFamily: FONT }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis tick={{ fill: DIM, fontSize: 10, fontFamily: FONT }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: `${CREAM}08` }} />
                  <Bar dataKey="count" radius={[0, 0, 0, 0]} maxBarSize={28}>
                    {taskStats.topProjects.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? CREAM : `${CREAM}40`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={{
            fontSize: 10, color: DIM, marginBottom: 10,
            textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 500,
          }}>
            By Assignee
          </div>
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {taskStats.topAssignees.map((a) => (
              <div key={a.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 0", borderBottom: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 13, color: CREAM, fontWeight: 400 }}>{a.name}</span>
                <div style={{ display: "flex", gap: 14, fontFamily: FONT, fontSize: 12, alignItems: "center" }}>
                  <span style={{ color: CREAM }}>{a.total}</span>
                  {a.overdue > 0 && (
                    <span style={{
                      color: DANGER, fontSize: 10, fontWeight: 500,
                      padding: "1px 6px", border: `1px solid ${DANGER}33`,
                    }}>{a.overdue} overdue</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {teamTasks.length === 0 && (
            <div style={{ color: DIM, fontSize: 12, padding: 24, textAlign: "center" }}>
              Waiting for Asana data…
            </div>
          )}
        </Panel>

        {/* ── 3. Client Pressure ── */}
        <Panel title="Client Pressure Index">
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {clientPressure.map((c, i) => {
              const p = pressureLabel(c.pressureScore);
              return (
                <div key={c.name} style={{
                  padding: "12px 0",
                  borderBottom: i < clientPressure.length - 1 ? `1px solid ${BORDER}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: CREAM }}>{c.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: DIM }}>
                        {c.tasks} tasks · {c.overdue} overdue · {c.matchedEdits} edits
                      </span>
                      <span style={{
                        fontFamily: FONT, fontSize: 10, fontWeight: 600,
                        color: p.color, padding: "2px 8px",
                        border: `1px solid ${p.color}55`,
                        letterSpacing: 1,
                      }}>{p.text}</span>
                    </div>
                  </div>
                  <PressureBar score={c.pressureScore} max={maxPressure} />
                </div>
              );
            })}
            {clientPressure.length === 0 && (
              <div style={{ color: DIM, fontSize: 12, padding: 24, textAlign: "center" }}>
                Need both Figma + Asana data
              </div>
            )}
          </div>
        </Panel>

        {/* ── 4. Workload Balance ── */}
        <Panel title="Workload Balance">
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px 80px",
              gap: 0, fontSize: 10, color: DIM,
              textTransform: "uppercase", letterSpacing: 1, fontWeight: 500,
              padding: "0 0 10px", borderBottom: `1px solid ${BORDER}`,
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
                  display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px 80px",
                  gap: 0, padding: "10px 0", borderBottom: `1px solid ${BORDER}`,
                  alignItems: "center",
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 400, color: CREAM,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {d.name}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: CREAM, textAlign: "right" }}>{d.activeTasks}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: d.overdue > 0 ? DANGER : DIM, textAlign: "right" }}>{d.overdue}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: CREAM, textAlign: "right" }}>{d.edits}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: TEXT2, textAlign: "right" }}>
                    {d.efficiency !== null ? `${d.efficiency}×` : "—"}
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 500,
                    color: d.highLoad ? DANGER : eff.color,
                    textAlign: "right", letterSpacing: 0.5,
                  }}>
                    {d.highLoad ? "HIGH LOAD" : d.highThru ? "HIGH THRU" : eff.text}
                  </div>
                </div>
              );
            })}
            {workloadBalance.length === 0 && (
              <div style={{ color: DIM, fontSize: 12, padding: 24, textAlign: "center" }}>
                Need both Figma + Asana data
              </div>
            )}
          </div>
        </Panel>

      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: "20px 40px", borderTop: `1px solid ${BORDER}`,
        display: "flex", justifyContent: "space-between",
        fontSize: 11, color: DIM,
      }}>
        <span>Design Intel — D2E Labs</span>
        <span>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
    </div>
  );
}
