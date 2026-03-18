"use client";
// app/dashboard.tsx — Design Intel dashboard (Figma admin aesthetic)

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from "recharts";
import {
  avgCycleTime, onTimeRate, throughput, healthScore, topAlert,
  type WeeklySnapshot,
} from "@/lib/metrics";

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
  completed_at: string | null;
  created_at: string;
  projects: Array<{ gid: string; name: string }>;
  custom_fields: Array<{ name: string; display_value: string | null; number_value?: number | null }>;
}

interface DataSource {
  figmaActivity: DesignerActivity[] | null;
  asanaTasks: AsanaTask[] | null;
  completedTasks: AsanaTask[] | null;
  snapshots: WeeklySnapshot[];
  figmaFiles: string[];
  asanaFiles: string[];
  lastFetched: { figma: string | null; asana: string | null };
  mode: "api" | "csv" | "mixed" | "empty";
}

// ── Design Team ───────────────────────────────────────────────────────────────

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

const TEAM_FIGMA_NAMES = new Set(Object.values(DESIGN_TEAM));
const TEAM_ASANA_NAMES = new Set(Object.keys(DESIGN_TEAM));

function isTeamTask(task: AsanaTask): boolean {
  return task.assignee !== null && TEAM_ASANA_NAMES.has(task.assignee.name);
}

function toFigmaName(asanaName: string): string {
  return DESIGN_TEAM[asanaName] ?? asanaName;
}

const NON_CLIENT_PROJECTS = new Set(["Creative Intake", "Creative Tasks", "General Tasks"]);

// ── Figma Theme ───────────────────────────────────────────────────────────────

const BG       = "#1E1E1E";
const SURFACE  = "#2C2C2C";
const ELEVATED = "#383838";
const HOVER    = "#444444";
const BORDER   = "#444444";
const DIVIDER  = "#333333";

const T1       = "#FFFFFF";
const T2       = "rgba(255,255,255,0.8)";
const T3       = "rgba(255,255,255,0.4)";
const T4       = "rgba(255,255,255,0.2)";

const BLUE     = "#0D99FF";  // Figma primary blue
const GREEN    = "#14AE5C";  // Figma success
const RED      = "#F24822";  // Figma error/warning
const ORANGE   = "#FFA629";  // Figma caution
const PURPLE   = "#7B61FF";  // Figma purple (variables)

const FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// ── Utilities ─────────────────────────────────────────────────────────────────

function designerScore(d: DesignerActivity): number {
  return Math.round(d.edits * 3 + d.comments * 2 + d.files.length * 2 + d.projects.length * 3);
}

function isOverdue(task: AsanaTask): boolean {
  if (!task.due_on || task.completed) return false;
  return new Date(task.due_on) < new Date(new Date().toISOString().slice(0, 10));
}

function pressureLabel(score: number): { text: string; color: string; bg: string } {
  if (score >= 15) return { text: "High", color: RED, bg: "rgba(242,72,34,0.12)" };
  if (score >= 8) return { text: "Med", color: ORANGE, bg: "rgba(255,166,41,0.12)" };
  return { text: "Low", color: GREEN, bg: "rgba(20,174,92,0.12)" };
}

function effLabel(eff: number | null): { text: string; color: string } {
  if (eff === null) return { text: "—", color: T4 };
  if (eff > 3) return { text: "High output", color: GREEN };
  if (eff >= 1) return { text: "On track", color: BLUE };
  return { text: "Behind", color: ORANGE };
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Dashboard Entry ───────────────────────────────────────────────────────────

export default function DesignIntelDashboard() {
  const [source, setSource] = useState<DataSource>({
    figmaActivity: null, asanaTasks: null,
    completedTasks: null, snapshots: [],
    figmaFiles: [], asanaFiles: [],
    lastFetched: { figma: null, asana: null },
    mode: "empty",
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"activity" | "tasks" | "pressure" | "workload" | "trends">("activity");

  const fetchFromApi = useCallback(async (force = false) => {
    setRefreshing(true);
    setApiError(null);
    try {
      const headers: HeadersInit = {};
      const secret = process.env.NEXT_PUBLIC_API_SECRET;
      if (secret) headers["Authorization"] = `Bearer ${secret}`;

      const [figmaRes, asanaRes, completedRes, snapshotsRes, cacheRes] = await Promise.allSettled([
        fetch(`/api/figma${force ? "?force=true" : ""}`, { headers }),
        fetch(`/api/asana${force ? "?force=true" : ""}`, { headers }),
        fetch(`/api/asana?include_completed=30d${force ? "&force=true" : ""}`, { headers }),
        fetch("/api/snapshots", { headers }),
        fetch("/api/cache", { headers }),
      ]);

      const figmaData = figmaRes.status === "fulfilled" && figmaRes.value.ok
        ? (await figmaRes.value.json()).data as DesignerActivity[] : null;
      const asanaData = asanaRes.status === "fulfilled" && asanaRes.value.ok
        ? (await asanaRes.value.json()).data as AsanaTask[] : null;
      const completedData = completedRes.status === "fulfilled" && completedRes.value.ok
        ? (await completedRes.value.json()).data as AsanaTask[] : null;
      const snapshotsData = snapshotsRes.status === "fulfilled" && snapshotsRes.value.ok
        ? (await snapshotsRes.value.json()).data as WeeklySnapshot[] : [];
      const cacheData = cacheRes.status === "fulfilled" && cacheRes.value.ok
        ? await cacheRes.value.json() : null;

      if (!figmaData && !asanaData) {
        setApiError("No data returned. Check env vars.");
        setLoading(false); setRefreshing(false); return;
      }

      setSource(prev => ({
        ...prev,
        figmaActivity: figmaData ?? prev.figmaActivity,
        asanaTasks: asanaData ?? prev.asanaTasks,
        completedTasks: completedData ?? prev.completedTasks,
        snapshots: snapshotsData.length > 0 ? snapshotsData : prev.snapshots,
        figmaFiles: figmaData ? ["Live"] : prev.figmaFiles,
        asanaFiles: asanaData ? ["Live"] : prev.asanaFiles,
        lastFetched: { figma: cacheData?.figma ?? null, asana: cacheData?.asana ?? null },
        mode: figmaData && asanaData ? "api" : figmaData || asanaData ? "mixed" : prev.mode,
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
        alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12,
        fontFamily: FONT,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{
          width: 24, height: 24, border: `2px solid ${DIVIDER}`,
          borderTopColor: BLUE, borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <div style={{ color: T3, fontSize: 12, fontWeight: 500 }}>Loading dashboard…</div>
      </div>
    );
  }

  return (
    <DashboardShell
      source={source}
      apiError={apiError}
      refreshing={refreshing}
      onRefresh={() => fetchFromApi(true)}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [BLUE, PURPLE, GREEN, "#E04678", ORANGE, "#00B8D9", "#6554C0", "#36B37E"];

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: color, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, color: "#fff", flexShrink: 0,
      letterSpacing: -0.3,
    }}>{initials(name)}</div>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: SURFACE, borderRadius: 8, padding: "12px 16px",
      flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: T3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color ?? T1, letterSpacing: -0.5 }}>
        {typeof value === "number" ? fmt(value) : value}
      </div>
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      padding: "8px 0", marginRight: 24,
      fontSize: 13, fontWeight: 500, fontFamily: FONT,
      color: active ? T1 : T3,
      borderBottom: active ? `2px solid ${BLUE}` : "2px solid transparent",
      transition: "all 0.15s",
    }}>{label}</button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color,
      background: bg, borderRadius: 4,
      padding: "2px 6px", letterSpacing: 0.2,
    }}>{text}</span>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 6,
      padding: "8px 12px", fontSize: 12, fontFamily: FONT,
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      <div style={{ color: T1, fontWeight: 500 }}>{label}</div>
      <div style={{ color: BLUE, marginTop: 2 }}>{fmt(payload[0].value)} tasks</div>
    </div>
  );
}

// ── Pressure Bar ──────────────────────────────────────────────────────────────

function PressureBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min((score / Math.max(max, 1)) * 100, 100);
  const { color } = pressureLabel(score);
  return (
    <div style={{ width: "100%", height: 3, background: DIVIDER, borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ── Dashboard Shell ───────────────────────────────────────────────────────────

function DashboardShell({
  source, apiError, refreshing, onRefresh, activeTab, setActiveTab,
}: {
  source: DataSource;
  apiError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  activeTab: string;
  setActiveTab: (t: "activity" | "tasks" | "pressure" | "workload" | "trends") => void;
}) {
  const hasLiveData = source.figmaFiles.some(f => f === "Live");
  const teamTasks = useMemo(() => (source.asanaTasks ?? []).filter(isTeamTask), [source.asanaTasks]);
  const teamFigma = useMemo(() => {
    if (!source.figmaActivity) return [];
    return source.figmaActivity.filter(d => TEAM_FIGMA_NAMES.has(d.name));
  }, [source.figmaActivity]);

  const designers = useMemo(() => {
    return teamFigma.map(d => ({ ...d, score: designerScore(d) })).sort((a, b) => b.score - a.score);
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
        if (!NON_CLIENT_PROJECTS.has(p.name)) byProject[p.name] = (byProject[p.name] ?? 0) + 1;
      }
    }
    return {
      total, overdue,
      topAssignees: Object.entries(byAssignee).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.total - a.total),
      topProjects: Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
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
    const figmaEdits: Record<string, number> = {};
    for (const d of teamFigma) {
      for (const p of d.projects) figmaEdits[p] = (figmaEdits[p] ?? 0) + d.edits;
    }
    return Object.entries(clientMap).map(([name, c]) => {
      const matched = Object.entries(figmaEdits)
        .filter(([fp]) => fp.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(fp.toLowerCase()))
        .reduce((sum, [, v]) => sum + v, 0);
      const score = c.tasks + c.overdue * 3 - Math.min(matched * 0.3, c.tasks);
      return { name, ...c, matchedEdits: matched, pressureScore: Math.round(score) };
    }).sort((a, b) => b.pressureScore - a.pressureScore).slice(0, 12);
  }, [teamTasks, teamFigma]);

  const workload = useMemo(() => {
    const byName: Record<string, { active: number; overdue: number }> = {};
    for (const t of teamTasks) {
      const fn = toFigmaName(t.assignee?.name ?? "");
      if (!fn) continue;
      byName[fn] ??= { active: 0, overdue: 0 };
      byName[fn].active++;
      if (isOverdue(t)) byName[fn].overdue++;
    }
    const allNames = new Set([...teamFigma.map(d => d.name), ...Object.keys(byName)]);
    return Array.from(allNames).map(name => {
      const f = teamFigma.find(d => d.name === name);
      const edits = f?.edits ?? 0;
      const a = byName[name] ?? { active: 0, overdue: 0 };
      const eff = a.active > 0 ? parseFloat((edits / a.active).toFixed(1)) : null;
      return { name, edits, active: a.active, overdue: a.overdue, efficiency: eff, highLoad: a.active >= 8 && edits < 15, highThru: eff !== null && eff > 3 };
    }).filter(d => d.active > 0 || d.edits > 0).sort((a, b) => b.active - a.active);
  }, [teamTasks, teamFigma]);

  // ── Delivery Metrics (V1) ──────────────────────────────────────────────────
  const completedTasks = useMemo(() => source.completedTasks ?? [], [source.completedTasks]);

  const deliveryMetrics = useMemo(() => {
    const onTime = onTimeRate(completedTasks);
    const avgCycle = avgCycleTime(completedTasks);
    const total = throughput(completedTasks);

    // This week vs last week
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const thisWeek = completedTasks.filter(t => t.completed_at && new Date(t.completed_at) >= weekAgo).length;
    const lastWeek = completedTasks.filter(t => t.completed_at && new Date(t.completed_at) >= twoWeeksAgo && new Date(t.completed_at) < weekAgo).length;
    const weekDelta = thisWeek - lastWeek;

    const health = healthScore(onTime, avgCycle, thisWeek, lastWeek);

    // Top alert
    const highLoad = workload.filter(d => d.highLoad).map(d => d.name);
    const highPressure = clientPressure.filter(c => c.pressureScore >= 15).map(c => c.name);
    const alert = topAlert(taskStats.overdue, highLoad, highPressure);

    return { onTime, avgCycle, total, thisWeek, lastWeek, weekDelta, health, alert };
  }, [completedTasks, workload, clientPressure, taskStats.overdue]);

  // Per-designer cycle time for workload tab
  const designerCycleTime = useMemo(() => {
    const byAssignee: Record<string, Array<{ created_at: string; completed_at: string | null }>> = {};
    for (const t of completedTasks) {
      const name = t.assignee?.name ?? "Unassigned";
      byAssignee[name] ??= [];
      byAssignee[name].push({ created_at: t.created_at, completed_at: t.completed_at });
    }
    const result: Record<string, number | null> = {};
    for (const [name, tasks] of Object.entries(byAssignee)) {
      result[name] = avgCycleTime(tasks);
    }
    return result;
  }, [completedTasks]);

  const maxPressure = clientPressure.length ? Math.max(...clientPressure.map(c => c.pressureScore)) : 1;

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: FONT, color: T1, display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${ELEVATED}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${HOVER}; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: 240, background: SURFACE, borderRight: `1px solid ${DIVIDER}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: "16px 16px", display: "flex", alignItems: "center", gap: 10,
          borderBottom: `1px solid ${DIVIDER}`,
        }}>
          <svg width="20" height="20" viewBox="0 0 38 57" fill="none">
            <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/>
            <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83"/>
            <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262"/>
            <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/>
            <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Design Intel</span>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: T3, padding: "8px 8px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Dashboard
          </div>
          {([
            { id: "activity", label: "Activity", icon: "◆" },
            { id: "tasks", label: "Tasks", icon: "☐" },
            { id: "pressure", label: "Client Pressure", icon: "▲" },
            { id: "workload", label: "Workload", icon: "⊞" },
            { id: "trends", label: "Trends", icon: "◈" },
          ] as const).map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "7px 8px", marginBottom: 1,
              background: activeTab === item.id ? ELEVATED : "transparent",
              border: "none", borderRadius: 6, cursor: "pointer",
              fontSize: 13, fontWeight: 500, fontFamily: FONT,
              color: activeTab === item.id ? T1 : T2,
              transition: "all 0.1s",
            }}>
              <span style={{ fontSize: 11, opacity: 0.6, width: 16, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div style={{ fontSize: 11, fontWeight: 500, color: T3, padding: "16px 8px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Team ({designers.length})
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {designers.map(d => (
              <div key={d.name} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 8px", borderRadius: 6,
              }}>
                <Avatar name={d.name} size={22} />
                <span style={{ fontSize: 12, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
              </div>
            ))}
          </div>
        </nav>

        {/* Status */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${DIVIDER}`,
          fontSize: 11, color: T3, display: "flex", alignItems: "center", gap: 6,
        }}>
          {hasLiveData && !apiError && (
            <>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN }} />
              <span>Connected</span>
            </>
          )}
          {apiError && <span style={{ color: RED }}>Error: {apiError}</span>}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Header bar */}
        <div style={{
          padding: "12px 24px", borderBottom: `1px solid ${DIVIDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Tab label="Activity" active={activeTab === "activity"} onClick={() => setActiveTab("activity")} />
            <Tab label="Tasks" active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} />
            <Tab label="Client Pressure" active={activeTab === "pressure"} onClick={() => setActiveTab("pressure")} />
            <Tab label="Workload" active={activeTab === "workload"} onClick={() => setActiveTab("workload")} />
            <Tab label="Trends" active={activeTab === "trends"} onClick={() => setActiveTab("trends")} />
          </div>
          <button onClick={onRefresh} disabled={refreshing} style={{
            background: BLUE, color: "#fff", border: "none", borderRadius: 6,
            padding: "6px 12px", fontSize: 12, fontWeight: 500, fontFamily: FONT,
            cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.5 : 1,
          }}>
            {refreshing ? "Syncing…" : "Refresh data"}
          </button>
        </div>

        {/* ── Executive Summary Card ── */}
        <div style={{
          margin: "16px 24px 0", padding: 16,
          background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`,
          display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap",
        }}>
          {/* Health Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 120 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 24,
              background: deliveryMetrics.health >= 70 ? "rgba(20,174,92,0.15)" : deliveryMetrics.health >= 40 ? "rgba(255,166,41,0.15)" : "rgba(242,72,34,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700,
              color: deliveryMetrics.health >= 70 ? GREEN : deliveryMetrics.health >= 40 ? ORANGE : RED,
            }}>
              {deliveryMetrics.health}
            </div>
            <div>
              <div style={{ fontSize: 11, color: T3, fontWeight: 500 }}>Health Score</div>
              <div style={{ fontSize: 12, color: T2, fontWeight: 500 }}>
                {deliveryMetrics.health >= 70 ? "Healthy" : deliveryMetrics.health >= 40 ? "Needs attention" : "At risk"}
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 36, background: DIVIDER }} />

          {/* On-time % */}
          <div style={{ minWidth: 80 }}>
            <div style={{ fontSize: 11, color: T3, fontWeight: 500 }}>On-time</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: T1 }}>
              {deliveryMetrics.onTime !== null ? `${Math.round(deliveryMetrics.onTime * 100)}%` : "—"}
            </div>
          </div>

          {/* Avg Cycle Time */}
          <div style={{ minWidth: 80 }}>
            <div style={{ fontSize: 11, color: T3, fontWeight: 500 }}>Avg cycle</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: T1 }}>
              {deliveryMetrics.avgCycle !== null ? `${deliveryMetrics.avgCycle}d` : "—"}
            </div>
          </div>

          {/* This week vs last */}
          <div style={{ minWidth: 100 }}>
            <div style={{ fontSize: 11, color: T3, fontWeight: 500 }}>This week</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: T1 }}>{deliveryMetrics.thisWeek}</span>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: deliveryMetrics.weekDelta > 0 ? GREEN : deliveryMetrics.weekDelta < 0 ? RED : T3,
              }}>
                {deliveryMetrics.weekDelta > 0 ? `▲ ${deliveryMetrics.weekDelta}` : deliveryMetrics.weekDelta < 0 ? `▼ ${Math.abs(deliveryMetrics.weekDelta)}` : "—"}
              </span>
              <span style={{ fontSize: 11, color: T3 }}>vs last</span>
            </div>
          </div>

          <div style={{ width: 1, height: 36, background: DIVIDER }} />

          {/* Top Alert */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: T3, fontWeight: 500, marginBottom: 2 }}>Top alert</div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: deliveryMetrics.alert.severity === "red" ? RED : deliveryMetrics.alert.severity === "orange" ? ORANGE : GREEN,
            }}>
              {deliveryMetrics.alert.severity !== "green" && "⚠ "}{deliveryMetrics.alert.text}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: "20px 24px", display: "flex", gap: 12, flexWrap: "wrap", animation: "fadeIn 0.3s ease" }}>
          <StatPill label="Team members" value={designers.length} color={BLUE} />
          <StatPill label="Figma edits" value={designers.reduce((s, d) => s + d.edits, 0)} />
          <StatPill label="Comments" value={designers.reduce((s, d) => s + d.comments, 0)} />
          <StatPill label="Assigned tasks" value={taskStats.total} />
          <StatPill label="Overdue" value={taskStats.overdue} color={taskStats.overdue > 0 ? RED : undefined} />
          <StatPill label="Active files" value={teamFigma.length > 0 ? new Set(teamFigma.flatMap(d => d.files)).size : 0} />
        </div>

        {/* Tab Content */}
        <div style={{ padding: "0 24px 24px", animation: "fadeIn 0.2s ease" }}>

          {/* ── Activity Tab ── */}
          {activeTab === "activity" && (
            <div style={{ background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 64px",
                padding: "10px 16px", fontSize: 11, fontWeight: 500, color: T3,
                borderBottom: `1px solid ${DIVIDER}`, background: SURFACE,
              }}>
                <span>#</span><span>Designer</span>
                <span style={{ textAlign: "right" }}>Edits</span>
                <span style={{ textAlign: "right" }}>Comments</span>
                <span style={{ textAlign: "right" }}>Files</span>
                <span style={{ textAlign: "right" }}>Score</span>
              </div>
              {designers.map((d, i) => (
                <div key={d.name} style={{
                  display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 64px",
                  padding: "10px 16px", alignItems: "center",
                  borderBottom: i < designers.length - 1 ? `1px solid ${DIVIDER}` : "none",
                  transition: "background 0.1s",
                }}>
                  <span style={{ fontSize: 12, color: T3, fontWeight: 500 }}>{i + 1}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={d.name} size={28} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: T3 }}>
                        {d.projects.join(", ").slice(0, 50)}{d.projects.join(", ").length > 50 ? "…" : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: T1 }}>{d.edits}</div>
                  <div style={{ textAlign: "right", fontSize: 13, color: T2 }}>{d.comments}</div>
                  <div style={{ textAlign: "right", fontSize: 13, color: T3 }}>{d.files.length}</div>
                  <div style={{
                    textAlign: "right", fontSize: 13, fontWeight: 600,
                    color: i === 0 ? BLUE : T1,
                  }}>{d.score}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tasks Tab ── */}
          {activeTab === "tasks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Delivery metrics row */}
              <div style={{ display: "flex", gap: 12 }}>
                <StatPill label="Completed (30d)" value={deliveryMetrics.total} color={GREEN} />
                <StatPill
                  label="On-time rate"
                  value={deliveryMetrics.onTime !== null ? `${Math.round(deliveryMetrics.onTime * 100)}%` : "—"}
                  color={deliveryMetrics.onTime !== null && deliveryMetrics.onTime >= 0.8 ? GREEN : deliveryMetrics.onTime !== null && deliveryMetrics.onTime >= 0.5 ? ORANGE : undefined}
                />
                <StatPill
                  label="Avg cycle time"
                  value={deliveryMetrics.avgCycle !== null ? `${deliveryMetrics.avgCycle}d` : "—"}
                />
                <StatPill
                  label="This week"
                  value={`${deliveryMetrics.thisWeek} tasks`}
                  color={deliveryMetrics.weekDelta > 0 ? GREEN : deliveryMetrics.weekDelta < 0 ? RED : undefined}
                />
              </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1, background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T2, marginBottom: 12 }}>Tasks by project</div>
                {taskStats.topProjects.length > 0 && (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskStats.topProjects.map(([name, count]) => ({
                        name: name.length > 14 ? name.slice(0, 12) + "…" : name, count,
                      }))} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                          {taskStats.topProjects.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? BLUE : `${BLUE}66`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div style={{ width: 340, background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T2, marginBottom: 12 }}>By assignee</div>
                {taskStats.topAssignees.map(a => (
                  <div key={a.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 0", borderBottom: `1px solid ${DIVIDER}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={a.name} size={22} />
                      <span style={{ fontSize: 12, color: T1 }}>{a.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: T1 }}>{a.total}</span>
                      {a.overdue > 0 && <Badge text={`${a.overdue} overdue`} color={RED} bg="rgba(242,72,34,0.12)" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}

          {/* ── Pressure Tab ── */}
          {activeTab === "pressure" && (
            <div style={{ background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 80px",
                padding: "10px 16px", fontSize: 11, fontWeight: 500, color: T3,
                borderBottom: `1px solid ${DIVIDER}`,
              }}>
                <span>Client</span>
                <span style={{ textAlign: "right" }}>Tasks</span>
                <span style={{ textAlign: "right" }}>Overdue</span>
                <span style={{ textAlign: "right" }}>Edits</span>
                <span style={{ textAlign: "right" }}>Pressure</span>
              </div>
              {clientPressure.map((c, i) => {
                const p = pressureLabel(c.pressureScore);
                return (
                  <div key={c.name}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 80px",
                      padding: "12px 16px", alignItems: "center",
                      borderBottom: i < clientPressure.length - 1 ? `1px solid ${DIVIDER}` : "none",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{c.name}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: T2 }}>{c.tasks}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: c.overdue > 0 ? RED : T3 }}>{c.overdue}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: c.matchedEdits > 0 ? GREEN : T3 }}>{c.matchedEdits}</span>
                      <div style={{ textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <Badge text={p.text} color={p.color} bg={p.bg} />
                      </div>
                    </div>
                    <div style={{ padding: "0 16px 8px" }}>
                      <PressureBar score={c.pressureScore} max={maxPressure} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Workload Tab ── */}
          {activeTab === "workload" && (
            <div style={{ background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 64px 64px 64px 64px 72px 100px",
                padding: "10px 16px", fontSize: 11, fontWeight: 500, color: T3,
                borderBottom: `1px solid ${DIVIDER}`,
              }}>
                <span>Designer</span>
                <span style={{ textAlign: "right" }}>Tasks</span>
                <span style={{ textAlign: "right" }}>Overdue</span>
                <span style={{ textAlign: "right" }}>Edits</span>
                <span style={{ textAlign: "right" }}>Eff.</span>
                <span style={{ textAlign: "right" }}>Cycle</span>
                <span style={{ textAlign: "right" }}>Status</span>
              </div>
              {workload.map((d, i) => {
                const eff = effLabel(d.efficiency);
                // Look up cycle time by original Asana name
                const asanaName = Object.entries(DESIGN_TEAM).find(([, fig]) => fig === d.name)?.[0] ?? d.name;
                const cycle = designerCycleTime[asanaName] ?? designerCycleTime[d.name];
                return (
                  <div key={d.name} style={{
                    display: "grid", gridTemplateColumns: "1fr 64px 64px 64px 64px 72px 100px",
                    padding: "10px 16px", alignItems: "center",
                    borderBottom: i < workload.length - 1 ? `1px solid ${DIVIDER}` : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={d.name} size={24} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: T1 }}>{d.name}</span>
                    </div>
                    <span style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: T1 }}>{d.active}</span>
                    <span style={{ textAlign: "right", fontSize: 13, color: d.overdue > 0 ? RED : T3 }}>{d.overdue}</span>
                    <span style={{ textAlign: "right", fontSize: 13, color: d.edits > 0 ? GREEN : T3 }}>{d.edits}</span>
                    <span style={{ textAlign: "right", fontSize: 13, color: T2 }}>
                      {d.efficiency !== null ? `${d.efficiency}×` : "—"}
                    </span>
                    <span style={{ textAlign: "right", fontSize: 13, color: cycle != null ? T2 : T4 }}>
                      {cycle != null ? `${cycle}d` : "—"}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      {d.highLoad
                        ? <Badge text="High load" color={RED} bg="rgba(242,72,34,0.12)" />
                        : d.highThru
                        ? <Badge text="High output" color={GREEN} bg="rgba(20,174,92,0.12)" />
                        : <span style={{ fontSize: 11, color: eff.color }}>{eff.text}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Trends Tab ── */}
          {activeTab === "trends" && (
            <div>
              {source.snapshots.length < 2 ? (
                <div style={{
                  background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`,
                  padding: 40, textAlign: "center",
                }}>
                  <div style={{ fontSize: 14, color: T2, fontWeight: 500, marginBottom: 8 }}>Not enough data yet</div>
                  <div style={{ fontSize: 12, color: T3 }}>
                    Trends appear after 2+ weekly Figma syncs. Each sync generates a weekly snapshot automatically.
                    {source.snapshots.length === 1 && " You have 1 snapshot — run another sync next week to see trends."}
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Tasks Completed / Week */}
                  <div style={{ background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T2, marginBottom: 12 }}>Tasks completed / week</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5), // "03-16"
                          value: s.team.tasksCompleted,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }} />
                          <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 3 }} name="Completed" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Avg Cycle Time */}
                  <div style={{ background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T2, marginBottom: 12 }}>Avg cycle time (days)</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5),
                          value: s.team.avgCycleTimeDays,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }} />
                          <Line type="monotone" dataKey="value" stroke={ORANGE} strokeWidth={2} dot={{ fill: ORANGE, r: 3 }} name="Cycle Time" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* On-Time % */}
                  <div style={{ background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T2, marginBottom: 12 }}>On-time delivery %</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5),
                          value: s.team.onTimeRate !== null ? Math.round(s.team.onTimeRate * 100) : null,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }} />
                          <Line type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2} dot={{ fill: GREEN, r: 3 }} name="On-Time %" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Total Edits */}
                  <div style={{ background: SURFACE, borderRadius: 8, border: `1px solid ${DIVIDER}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T2, marginBottom: 12 }}>Total Figma edits</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5),
                          value: s.team.totalEdits,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: ELEVATED, border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }} />
                          <Line type="monotone" dataKey="value" stroke={PURPLE} strokeWidth={2} dot={{ fill: PURPLE, r: 3 }} name="Edits" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
