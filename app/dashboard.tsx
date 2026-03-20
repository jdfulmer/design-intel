"use client";
// app/dashboard.tsx — Design Intel dashboard (Figma-native light/dark theme)

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from "recharts";
import {
  avgCycleTime, onTimeRate, throughput, topAlert,
  type WeeklySnapshot,
} from "@/lib/metrics";
import {
  DESIGN_TEAM, TEAM_FIGMA_NAMES, TEAM_ASANA_NAMES,
  toFigmaName, NON_CLIENT_PROJECTS,
} from "@/lib/team-config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DesignerActivity {
  name: string;
  edits: number;
  comments: number;
  files: string[];
  projects: string[];
}

interface FigmaFileStats {
  name: string;
  key?: string;
  project: string;
  edits: number;
  comments: number;
  designers: string[];
  lastModified: string;
}

interface Flag {
  type: "danger" | "warn" | "ok" | "info";
  category: string;
  title: string;
  detail: string;
  tasks?: Array<{ gid: string; name: string; due_on?: string; assignee?: string }>;
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
  figmaFileStats: FigmaFileStats[];
  asanaTasks: AsanaTask[] | null;
  completedTasks: AsanaTask[] | null;
  snapshots: WeeklySnapshot[];
  figmaFiles: string[];
  asanaFiles: string[];
  lastFetched: { figma: string | null; asana: string | null };
  mode: "api" | "csv" | "mixed" | "empty";
}

// Name mappings & NON_CLIENT_PROJECTS imported from @/lib/team-config

function isTeamTask(task: AsanaTask): boolean {
  return task.assignee !== null && TEAM_ASANA_NAMES.has(task.assignee.name);
}

// ── Theme Constants ──────────────────────────────────────────────────────────

const BLUE     = "#0D99FF";
const GREEN    = "#14AE5C";
const RED      = "#F24822";
const ORANGE   = "#FFA629";
const PURPLE   = "#7B61FF";

const FONT     = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const V = {
  bg: 'var(--di-bg)',
  surface: 'var(--di-surface)',
  elevated: 'var(--di-elevated)',
  hover: 'var(--di-hover)',
  border: 'var(--di-border)',
  divider: 'var(--di-divider)',
  text: 'var(--di-text)',
  textSecondary: 'var(--di-text-secondary)',
  textTertiary: 'var(--di-text-tertiary)',
  textQuaternary: 'var(--di-text-quaternary)',
  selectedBg: 'var(--di-selected-bg)',
  selectedText: 'var(--di-selected-text)',
  textDanger: 'var(--di-text-danger)',
  textSuccess: 'var(--di-text-success)',
  textWarning: 'var(--di-text-warning)',
  textComponent: 'var(--di-text-component)',
  shadow: 'var(--di-shadow)',
  tooltipBg: 'var(--di-tooltip-bg)',
  tooltipBorder: 'var(--di-tooltip-border)',
  backdrop: 'var(--di-backdrop)',
  chartTick: 'var(--di-chart-tick)',
  chartCursor: 'var(--di-chart-cursor)',
} as const;

const THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.di-root {
  --di-bg: #FFFFFF;
  --di-surface: #F5F5F5;
  --di-elevated: #EAEAEA;
  --di-hover: #F0F0F0;
  --di-border: #E6E6E6;
  --di-divider: #E6E6E6;
  --di-text: #000000E5;
  --di-text-secondary: #00000080;
  --di-text-tertiary: #0000004D;
  --di-text-quaternary: #00000026;
  --di-selected-bg: #E5F4FF;
  --di-selected-text: #007BE5;
  --di-text-danger: #DC3412;
  --di-text-success: #009951;
  --di-text-warning: #B86200;
  --di-text-component: #8638E5;
  --di-scrollbar: #D9D9D9;
  --di-scrollbar-hover: #BFBFBF;
  --di-shadow: 0 1px 3px rgba(0,0,0,0.08);
  --di-tooltip-bg: #2C2C2C;
  --di-tooltip-border: #444444;
  --di-backdrop: rgba(0,0,0,0.2);
  --di-chart-tick: #0000004D;
  --di-chart-cursor: rgba(0,0,0,0.04);
}

.di-root[data-theme="dark"] {
  --di-bg: #1E1E1E;
  --di-surface: #2C2C2C;
  --di-elevated: #383838;
  --di-hover: #444444;
  --di-border: #444444;
  --di-divider: #333333;
  --di-text: #FFFFFFE5;
  --di-text-secondary: #FFFFFF80;
  --di-text-tertiary: #FFFFFF4D;
  --di-text-quaternary: #FFFFFF26;
  --di-selected-bg: rgba(13,153,255,0.12);
  --di-selected-text: #0D99FF;
  --di-text-danger: #F24822;
  --di-text-success: #14AE5C;
  --di-text-warning: #FFA629;
  --di-text-component: #7B61FF;
  --di-scrollbar: #383838;
  --di-scrollbar-hover: #444444;
  --di-shadow: 0 1px 3px rgba(0,0,0,0.2);
  --di-tooltip-bg: #383838;
  --di-tooltip-border: #444444;
  --di-backdrop: rgba(0,0,0,0.5);
  --di-chart-tick: #FFFFFF4D;
  --di-chart-cursor: rgba(255,255,255,0.03);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }

* { box-sizing: border-box; }

.di-root ::-webkit-scrollbar { width: 6px; }
.di-root ::-webkit-scrollbar-track { background: transparent; }
.di-root ::-webkit-scrollbar-thumb { background: var(--di-scrollbar); border-radius: 3px; }
.di-root ::-webkit-scrollbar-thumb:hover { background: var(--di-scrollbar-hover); }

.di-root .di-hover:hover { background: var(--di-hover) !important; }

.di-root .di-tab-scroll::-webkit-scrollbar { display: none; }
.di-root .di-tab-scroll { scrollbar-width: none; }
.di-root .di-scroll-x { -webkit-overflow-scrolling: touch; }
.di-root .di-scroll-x::-webkit-scrollbar { height: 3px; }
.di-root .di-scroll-x::-webkit-scrollbar-thumb { background: var(--di-scrollbar); border-radius: 2px; }
`;

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
  if (eff === null) return { text: "\u2014", color: V.textQuaternary };
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

function asanaTaskUrl(gid: string): string {
  return `https://app.asana.com/0/0/${gid}`;
}

function figmaFileUrl(key: string, name: string): string {
  const slug = name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://www.figma.com/design/${key}/${slug}`;
}

// ── useIsMobile Hook ──────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

// ── useTheme Hook ─────────────────────────────────────────────────────────────

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const saved = localStorage.getItem('di-theme');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);
  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('di-theme', next);
      return next;
    });
  }, []);
  return [theme, toggle];
}

// ── Dashboard Entry ───────────────────────────────────────────────────────────

export default function DesignIntelDashboard() {
  const [theme, toggleTheme] = useTheme();
  const [source, setSource] = useState<DataSource>({
    figmaActivity: null, figmaFileStats: [],
    asanaTasks: null, completedTasks: null, snapshots: [],
    figmaFiles: [], asanaFiles: [],
    lastFetched: { figma: null, asana: null },
    mode: "empty",
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"activity" | "tasks" | "pressure" | "workload" | "trends" | "flags">("activity");
  const [figmaSyncing, setFigmaSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(0); // counter to trigger re-fetch after sync
  const syncingRef = useRef(false);

  const fetchFromApi = useCallback(async (force = false) => {
    setRefreshing(true);
    setApiError(null);

    // Helper: classify a failed response or network error for a given source
    function describeError(source: string, res?: Response): string {
      if (!res) return `${source}: Network error \u2014 check your connection`;
      if (res.status === 401) return `${source}: Authentication failed \u2014 check API credentials`;
      if (res.status === 429) return `${source}: Rate limited \u2014 try again in a few minutes`;
      if (res.status >= 500) return `${source}: Server error \u2014 Figma or Asana API may be down`;
      return `${source}: Request failed (${res.status})`;
    }

    try {
      const forceParam = force ? "&force=true" : "";
      const [figmaRes, asanaRes, completedRes, snapshotsRes, cacheRes] = await Promise.allSettled([
        fetch(`/api/data?source=figma${forceParam}`),
        fetch(`/api/data?source=asana${forceParam}`),
        fetch(`/api/data?source=completed&include_completed=30d${forceParam}`),
        fetch("/api/data?source=snapshots"),
        fetch("/api/data?source=cache"),
      ]);

      // Collect per-source errors
      const errors: string[] = [];

      // Parse Figma
      let figmaData: DesignerActivity[] | null = null;
      let figmaFileData: FigmaFileStats[] = [];
      if (figmaRes.status === "fulfilled") {
        if (figmaRes.value.ok) {
          const figmaJson = await figmaRes.value.json();
          figmaData = figmaJson?.data as DesignerActivity[] | null ?? null;
          figmaFileData = (figmaJson?.files ?? []) as FigmaFileStats[];
        } else {
          errors.push(describeError("Figma", figmaRes.value));
        }
      } else {
        errors.push(describeError("Figma"));
      }

      // Parse Asana
      let asanaData: AsanaTask[] | null = null;
      if (asanaRes.status === "fulfilled") {
        if (asanaRes.value.ok) {
          asanaData = (await asanaRes.value.json()).data as AsanaTask[];
        } else {
          errors.push(describeError("Asana", asanaRes.value));
        }
      } else {
        errors.push(describeError("Asana"));
      }

      // Parse completed tasks (non-critical, no error surfaced)
      const completedData = completedRes.status === "fulfilled" && completedRes.value.ok
        ? (await completedRes.value.json()).data as AsanaTask[] : null;

      // Parse snapshots (non-critical)
      const snapshotsData = snapshotsRes.status === "fulfilled" && snapshotsRes.value.ok
        ? (await snapshotsRes.value.json()).data as WeeklySnapshot[] : [];

      // Parse cache timestamps (non-critical)
      const cacheData = cacheRes.status === "fulfilled" && cacheRes.value.ok
        ? await cacheRes.value.json() : null;

      if (!figmaData && !asanaData) {
        const msg = errors.length > 0 ? errors.join(". ") : "No data returned. Check env vars.";
        setApiError(msg);
        setLoading(false); setRefreshing(false); return;
      }

      // Surface partial errors even when some data loaded
      if (errors.length > 0) setApiError(errors.join(". "));

      // Auto-trigger Figma sync when data is empty (cache expired)
      const figmaEmpty = !figmaData || (Array.isArray(figmaData) && figmaData.length === 0);
      if (figmaEmpty && asanaData && !syncingRef.current) {
        syncingRef.current = true;
        setFigmaSyncing(true);
        // Fire-and-forget: chain sync calls in background
        (async () => {
          try {
            for (let i = 0; i < 12; i++) {
              const res = await fetch("/api/data?source=figma-sync", { method: "POST" });
              if (!res.ok) break;
              const data = await res.json();
              if (data.status === "complete" || data.error) break;
            }
          } catch { /* sync failed silently */ }
          syncingRef.current = false;
          setFigmaSyncing(false);
          setSyncComplete(c => c + 1);
        })();
      }

      setSource(prev => ({
        ...prev,
        figmaActivity: figmaData ?? prev.figmaActivity,
        figmaFileStats: figmaFileData.length > 0 ? figmaFileData : prev.figmaFileStats,
        asanaTasks: asanaData ?? prev.asanaTasks,
        completedTasks: completedData ?? prev.completedTasks,
        snapshots: snapshotsData.length > 0 ? snapshotsData : prev.snapshots,
        figmaFiles: figmaData ? ["Live"] : prev.figmaFiles,
        asanaFiles: asanaData ? ["Live"] : prev.asanaFiles,
        lastFetched: { figma: cacheData?.figma ?? null, asana: cacheData?.asana ?? null },
        mode: figmaData && asanaData ? "api" : figmaData || asanaData ? "mixed" : prev.mode,
      }));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error \u2014 check your connection");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFromApi(); }, [fetchFromApi]);

  // Re-fetch dashboard data after Figma sync completes
  useEffect(() => {
    if (syncComplete > 0) fetchFromApi();
  }, [syncComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="di-root" data-theme={theme} style={{
        height: "100dvh", background: V.bg, display: "flex",
        alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12,
        fontFamily: FONT,
      }}>
        <style>{THEME_CSS}</style>
        <div style={{
          width: 24, height: 24, border: `2px solid ${V.divider}`,
          borderTopColor: BLUE, borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <div style={{ color: V.textTertiary, fontSize: 12, fontWeight: 500 }}>Loading dashboard...</div>
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
      theme={theme}
      toggleTheme={toggleTheme}
      figmaSyncing={figmaSyncing}
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
      background: V.surface, borderRadius: 8, padding: "12px 16px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: V.textTertiary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: color ?? V.text, letterSpacing: -0.5 }}>
        {typeof value === "number" ? fmt(value) : value}
      </div>
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function Tab({ label, active, onClick, compact }: { label: string; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      padding: "8px 0", marginRight: compact ? 16 : 24,
      fontSize: 13, fontWeight: 500, fontFamily: FONT,
      color: active ? V.text : V.textTertiary,
      borderBottom: active ? `2px solid ${BLUE}` : "2px solid transparent",
      transition: "all 160ms ease-out",
      whiteSpace: "nowrap",
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
      background: V.tooltipBg, border: `1px solid ${V.tooltipBorder}`, borderRadius: 6,
      padding: "8px 12px", fontSize: 12, fontFamily: FONT,
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      <div style={{ color: "#FFFFFFE5", fontWeight: 500 }}>{label}</div>
      <div style={{ color: BLUE, marginTop: 2 }}>{fmt(payload[0].value)} tasks</div>
    </div>
  );
}

// ── Pressure Bar ──────────────────────────────────────────────────────────────

function PressureBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min((score / Math.max(max, 1)) * 100, 100);
  const { color } = pressureLabel(score);
  return (
    <div style={{ width: "100%", height: 3, background: V.divider, borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 300ms ease-out" }} />
    </div>
  );
}

// ── Collapsible Section ──────────────────────────────────────────────────────

function Section({ title, count, defaultOpen = true, children }: {
  title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 6, width: "100%",
        background: "none", border: "none", cursor: "pointer",
        padding: "8px 0", fontFamily: FONT,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 160ms ease-out",
          flexShrink: 0,
        }}>
          <path d="M3 1L7 5L3 9" fill="none" stroke={V.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary }}>{title}</span>
        {count !== undefined && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: V.textTertiary,
            background: V.elevated, borderRadius: 4, padding: "1px 5px",
          }}>{count}</span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: V.surface, borderRadius: 8, padding: "48px 24px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: V.textSecondary, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: V.textTertiary }}>{description}</div>
    </div>
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ tab, selectedDesigner, selectedClient, onClearFilter }: {
  tab: string;
  selectedDesigner: string | null;
  selectedClient: string | null;
  onClearFilter: () => void;
}) {
  const tabLabels: Record<string, string> = {
    activity: "Activity", tasks: "Tasks", pressure: "Client Pressure",
    workload: "Workload", trends: "Trends", flags: "Flags",
  };
  const filterName = selectedDesigner || selectedClient;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, marginBottom: 2 }}>
      <span style={{ color: V.textTertiary }}>Design Intel</span>
      <span style={{ color: V.textQuaternary }}>/</span>
      <span style={{ color: filterName ? V.textTertiary : V.text, cursor: filterName ? "pointer" : "default" }}
        onClick={filterName ? onClearFilter : undefined}
      >{tabLabels[tab] ?? tab}</span>
      {filterName && (
        <>
          <span style={{ color: V.textQuaternary }}>/</span>
          <span style={{ color: V.text }}>{filterName}</span>
        </>
      )}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ selectedDesigner, selectedClient, designers, filteredTeamTasks, filteredClientPressure, clientDesignerNames, designerClients, hotFiles, clientPressure }: {
  selectedDesigner: string | null;
  selectedClient: string | null;
  designers: Array<DesignerActivity & { score: number }>;
  filteredTeamTasks: AsanaTask[];
  filteredClientPressure: Array<{ name: string; tasks: number; overdue: number; matchedEdits: number; pressureScore: number }>;
  clientDesignerNames: Record<string, string[]>;
  designerClients: Record<string, string[]>;
  hotFiles: Array<FigmaFileStats & { heat: number }>;
  clientPressure: Array<{ name: string; tasks: number; overdue: number; matchedEdits: number; pressureScore: number }>;
}) {
  if (selectedDesigner) {
    const designer = designers.find(d => d.name === selectedDesigner);
    if (!designer) return null;
    const clients = designerClients[selectedDesigner] ?? [];
    const designerFiles = hotFiles.filter(f => f.designers.some(dn => dn === selectedDesigner));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={designer.name} size={48} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: V.text }}>{designer.name}</div>
            <div style={{ fontSize: 11, color: V.textTertiary }}>{designer.projects.length} project{designer.projects.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Edits</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: V.text }}>{designer.edits}</div>
          </div>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Comments</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: V.text }}>{designer.comments}</div>
          </div>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Files</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: V.text }}>{designer.files.length}</div>
          </div>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Score</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: BLUE }}>{designer.score}</div>
          </div>
        </div>
        {/* Clients */}
        {clients.length > 0 && (
          <Section title="Clients" count={clients.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {clients.map(c => {
                const cp = clientPressure.find(cp2 => cp2.name === c);
                const p = cp ? pressureLabel(cp.pressureScore) : null;
                return (
                  <div key={c} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "4px 0", fontSize: 12, color: V.text,
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                    {p && <div style={{ width: 6, height: 6, borderRadius: 3, background: p.color, flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </Section>
        )}
        {/* Active Tasks */}
        {filteredTeamTasks.length > 0 && (
          <Section title="Active Tasks" count={filteredTeamTasks.length} defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {filteredTeamTasks.slice(0, 15).map(t => (
                <a key={t.gid} href={asanaTaskUrl(t.gid)} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 11, color: BLUE, textDecoration: "none",
                  padding: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                >
                  {t.name}
                  {isOverdue(t) && <span style={{ color: V.textDanger, marginLeft: 4, fontSize: 10 }}>overdue</span>}
                </a>
              ))}
              {filteredTeamTasks.length > 15 && (
                <div style={{ fontSize: 10, color: V.textTertiary, padding: "2px 0" }}>+{filteredTeamTasks.length - 15} more</div>
              )}
            </div>
          </Section>
        )}
        {/* Recent Files */}
        {designerFiles.length > 0 && (
          <Section title="Recent Files" count={designerFiles.length} defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {designerFiles.slice(0, 10).map(f => (
                <div key={f.name} style={{ fontSize: 11, color: V.text, padding: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.key ? (
                    <a href={figmaFileUrl(f.key, f.name)} target="_blank" rel="noopener noreferrer" style={{
                      color: BLUE, textDecoration: "none",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                    >{f.name}</a>
                  ) : f.name}
                  <span style={{ color: V.textTertiary, marginLeft: 4, fontSize: 10 }}>{f.edits} edits</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  if (selectedClient) {
    const client = clientPressure.find(c => c.name === selectedClient);
    if (!client) return null;
    const p = pressureLabel(client.pressureScore);
    const maxP = clientPressure.length ? Math.max(...clientPressure.map(c => c.pressureScore)) : 1;
    const clientDesigners = clientDesignerNames[selectedClient] ?? [];
    const clientTasks = filteredTeamTasks;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
        {/* Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: V.text }}>{client.name}</div>
            <Badge text={p.text} color={p.color} bg={p.bg} />
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Tasks</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: V.text }}>{client.tasks}</div>
          </div>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Overdue</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: client.overdue > 0 ? V.textDanger : V.text }}>{client.overdue}</div>
          </div>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Figma Edits</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: client.matchedEdits > 0 ? V.textSuccess : V.text }}>{client.matchedEdits}</div>
          </div>
          <div style={{ background: V.surface, borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: V.textTertiary }}>Pressure</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: p.color }}>{client.pressureScore}</div>
          </div>
        </div>
        <PressureBar score={client.pressureScore} max={maxP} />
        {/* Designers */}
        {clientDesigners.length > 0 && (
          <Section title="Designers" count={clientDesigners.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {clientDesigners.map(dn => (
                <div key={dn} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                  <Avatar name={dn} size={20} />
                  <span style={{ fontSize: 12, color: V.text }}>{dn}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
        {/* Active Tasks */}
        {clientTasks.length > 0 && (
          <Section title="Active Tasks" count={clientTasks.length} defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {clientTasks.slice(0, 15).map(t => (
                <a key={t.gid} href={asanaTaskUrl(t.gid)} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 11, color: BLUE, textDecoration: "none",
                  padding: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                >
                  {t.name}
                  {isOverdue(t) && <span style={{ color: V.textDanger, marginLeft: 4, fontSize: 10 }}>overdue</span>}
                </a>
              ))}
              {clientTasks.length > 15 && (
                <div style={{ fontSize: 10, color: V.textTertiary, padding: "2px 0" }}>+{clientTasks.length - 15} more</div>
              )}
            </div>
          </Section>
        )}
      </div>
    );
  }

  return null;
}

// ── Dashboard Shell ───────────────────────────────────────────────────────────

function DashboardShell({
  source, apiError, refreshing, onRefresh, activeTab, setActiveTab, theme, toggleTheme, figmaSyncing,
}: {
  source: DataSource;
  apiError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  activeTab: string;
  setActiveTab: (t: "activity" | "tasks" | "pressure" | "workload" | "trends" | "flags") => void;
  theme: string;
  toggleTheme: () => void;
  figmaSyncing?: boolean;
}) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDesigner, setSelectedDesigner] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
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

  const completedTasks = useMemo(() => source.completedTasks ?? [], [source.completedTasks]);

  const clientPressure = useMemo(() => {
    const clientMap: Record<string, { tasks: number; overdue: number }> = {};
    // Active tasks
    for (const t of teamTasks) {
      for (const p of t.projects) {
        if (NON_CLIENT_PROJECTS.has(p.name)) continue;
        clientMap[p.name] ??= { tasks: 0, overdue: 0 };
        clientMap[p.name].tasks++;
        if (isOverdue(t)) clientMap[p.name].overdue++;
      }
    }
    // Completed tasks — surface clients even if they have no active work
    for (const t of completedTasks) {
      if (!isTeamTask(t)) continue;
      for (const p of t.projects) {
        if (NON_CLIENT_PROJECTS.has(p.name)) continue;
        clientMap[p.name] ??= { tasks: 0, overdue: 0 };
      }
    }
    // Figma projects — surface clients with design activity but no tasking
    for (const d of teamFigma) {
      for (const p of d.projects) {
        if (NON_CLIENT_PROJECTS.has(p)) continue;
        clientMap[p] ??= { tasks: 0, overdue: 0 };
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
    }).sort((a, b) => b.pressureScore - a.pressureScore);
  }, [teamTasks, completedTasks, teamFigma]);

  // ── Designer <-> Client lookup maps ──────────────────────────────────────────
  const designerClients = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of teamTasks) {
      const fn = toFigmaName(t.assignee?.name ?? "");
      if (!fn) continue;
      for (const p of t.projects) {
        if (NON_CLIENT_PROJECTS.has(p.name)) continue;
        map[fn] ??= [];
        if (!map[fn].includes(p.name)) map[fn].push(p.name);
      }
    }
    return map;
  }, [teamTasks]);

  const clientDesignerNames = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [designer, clients] of Object.entries(designerClients)) {
      for (const client of clients) {
        map[client] ??= [];
        if (!map[client].includes(designer)) map[client].push(designer);
      }
    }
    return map;
  }, [designerClients]);

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

    // Top alert
    const highLoad = workload.filter(d => d.highLoad).map(d => d.name);
    const highPressure = clientPressure.filter(c => c.pressureScore >= 15).map(c => c.name);
    const alert = topAlert(taskStats.overdue, highLoad, highPressure);

    return { onTime, avgCycle, total, thisWeek, lastWeek, weekDelta, alert };
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

  // ── Operational Flags ─────────────────────────────────────────────────────
  const flags = useMemo((): Flag[] => {
    const f: Flag[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // Overdue clustering by client
    const overdueByClient: Record<string, number> = {};
    for (const t of teamTasks) {
      if (isOverdue(t)) {
        for (const p of t.projects) {
          if (!NON_CLIENT_PROJECTS.has(p.name)) {
            overdueByClient[p.name] = (overdueByClient[p.name] ?? 0) + 1;
          }
        }
      }
    }
    for (const [client, count] of Object.entries(overdueByClient)) {
      if (count >= 3) {
        const clientOverdueTasks = teamTasks.filter(t => isOverdue(t) && t.projects.some(p => p.name === client));
        f.push({ type: "danger", category: "Delivery",
          title: `${client}: ${count} overdue tasks`,
          detail: `This client has ${count} tasks past their due date. Risk of missed deadlines escalating.`,
          tasks: clientOverdueTasks.slice(0, 8).map(t => ({ gid: t.gid, name: t.name, due_on: t.due_on ?? undefined, assignee: t.assignee?.name ?? "Unassigned" })),
        });
      }
    }

    // Bus factor — clients served by only 1 designer with 3+ tasks
    const clientDesignersMap: Record<string, Set<string>> = {};
    const clientTaskCount: Record<string, number> = {};
    for (const t of teamTasks) {
      if (!t.assignee) continue;
      for (const p of t.projects) {
        if (NON_CLIENT_PROJECTS.has(p.name)) continue;
        clientDesignersMap[p.name] ??= new Set();
        clientDesignersMap[p.name].add(t.assignee.name);
        clientTaskCount[p.name] = (clientTaskCount[p.name] ?? 0) + 1;
      }
    }
    const busRisk = Object.entries(clientDesignersMap)
      .filter(([name, s]) => s.size === 1 && (clientTaskCount[name] ?? 0) >= 3)
      .map(([name, s]) => ({ name, designer: Array.from(s)[0], tasks: clientTaskCount[name] }));
    if (busRisk.length > 0) {
      f.push({ type: "warn", category: "Risk",
        title: `${busRisk.length} client${busRisk.length > 1 ? "s" : ""} covered by only one designer`,
        detail: busRisk.map(r => `${r.name} \u2192 ${r.designer} (${r.tasks} tasks)`).join(" \u00b7 ") + " \u2014 consider cross-coverage." });
    }

    // Zero-edit designers — active tasks but no Figma edits
    const zeroEdit = workload.filter(d => d.active >= 5 && d.edits === 0);
    if (zeroEdit.length > 0) {
      f.push({ type: "warn", category: "Output",
        title: `${zeroEdit.length} designer${zeroEdit.length > 1 ? "s" : ""} with tasks but no Figma edits`,
        detail: zeroEdit.map(d => `${d.name} (${d.active} tasks, 0 edits)`).join(" \u00b7 ") });
    }

    // High load imbalance
    const overloaded = workload.filter(d => d.highLoad);
    if (overloaded.length > 0) {
      f.push({ type: "warn", category: "Workload",
        title: `${overloaded.length} designer${overloaded.length > 1 ? "s" : ""} overloaded`,
        detail: overloaded.map(d => `${d.name} (${d.active} tasks, ${d.edits} edits)`).join(" \u00b7 ") });
    }

    // Velocity drop
    if (deliveryMetrics.lastWeek > 0 && deliveryMetrics.thisWeek < deliveryMetrics.lastWeek * 0.5) {
      f.push({ type: "warn", category: "Velocity",
        title: `Output dropped ${Math.round((1 - deliveryMetrics.thisWeek / deliveryMetrics.lastWeek) * 100)}% vs last week`,
        detail: `${deliveryMetrics.thisWeek} tasks completed this week vs ${deliveryMetrics.lastWeek} last week.` });
    } else if (deliveryMetrics.thisWeek > deliveryMetrics.lastWeek * 1.5 && deliveryMetrics.thisWeek > 3) {
      f.push({ type: "ok", category: "Velocity",
        title: `Output up ${Math.round((deliveryMetrics.thisWeek / Math.max(deliveryMetrics.lastWeek, 1) - 1) * 100)}% vs last week`,
        detail: `${deliveryMetrics.thisWeek} tasks completed this week vs ${deliveryMetrics.lastWeek} last week.` });
    }

    // Stale overdue — 14+ days past due
    const stale = teamTasks.filter(t => {
      if (!t.due_on || t.completed) return false;
      const days = (new Date(today).getTime() - new Date(t.due_on).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 14;
    });
    if (stale.length > 0) {
      f.push({ type: "danger", category: "Stale",
        title: `${stale.length} task${stale.length > 1 ? "s" : ""} overdue by 14+ days`,
        detail: stale.slice(0, 5).map(t => `"${t.name}" (due ${t.due_on}) \u2014 ${t.assignee?.name ?? "Unassigned"}`).join(" \u00b7 ") + (stale.length > 5 ? ` +${stale.length - 5} more` : ""),
        tasks: stale.slice(0, 8).map(t => ({ gid: t.gid, name: t.name, due_on: t.due_on ?? undefined, assignee: t.assignee?.name ?? "Unassigned" })),
      });
    }

    // Client with no Figma activity
    const clientsNoFigma = clientPressure.filter(c => c.matchedEdits === 0 && c.tasks >= 3);
    if (clientsNoFigma.length > 0) {
      f.push({ type: "info", category: "Coverage",
        title: `${clientsNoFigma.length} client${clientsNoFigma.length > 1 ? "s" : ""} with tasks but no Figma edits`,
        detail: clientsNoFigma.map(c => `${c.name} (${c.tasks} tasks)`).join(" \u00b7 ") });
    }

    if (f.length === 0) {
      f.push({ type: "ok", category: "Status",
        title: "All clear \u2014 no flags this period",
        detail: "No overdue clustering, workload imbalances, or coverage gaps detected." });
    }

    return f;
  }, [teamTasks, workload, clientPressure, deliveryMetrics]);

  // ── Overdue x Figma Activity Overlay ───────────────────────────────────────
  const overdueOverlay = useMemo(() => {
    const overdueTasks = teamTasks.filter(isOverdue);
    return overdueTasks.map(t => {
      const figmaName = toFigmaName(t.assignee?.name ?? "");
      const figmaDesigner = teamFigma.find(d => d.name === figmaName);
      // Check if this designer has Figma activity on the same client project
      const taskClients = t.projects.filter(p => !NON_CLIENT_PROJECTS.has(p.name)).map(p => p.name);
      const matchedProjects = figmaDesigner?.projects.filter(fp =>
        taskClients.some(tc => fp.toLowerCase().includes(tc.toLowerCase()) || tc.toLowerCase().includes(fp.toLowerCase()))
      ) ?? [];
      return {
        gid: t.gid,
        task: t.name,
        assignee: t.assignee?.name ?? "Unassigned",
        figmaName,
        dueDate: t.due_on ?? "\u2014",
        clients: taskClients,
        figmaEdits: figmaDesigner?.edits ?? 0,
        hasMatchedActivity: matchedProjects.length > 0,
        matchedProjects,
        type: t.custom_fields.find(f => f.name.toLowerCase() === "type of creative")?.display_value ?? null,
      };
    }).sort((a, b) => (b.hasMatchedActivity ? 1 : 0) - (a.hasMatchedActivity ? 1 : 0) || b.figmaEdits - a.figmaEdits);
  }, [teamTasks, teamFigma]);

  // ── Creative Type Breakdown ────────────────────────────────────────────────
  const creativeTypes = useMemo(() => {
    const typeMap: Record<string, { total: number; overdue: number; completed: number; designers: Set<string> }> = {};
    const allTasks = [...teamTasks, ...completedTasks.filter(t => isTeamTask(t))];
    const seen = new Set<string>();
    for (const t of allTasks) {
      if (seen.has(t.gid)) continue;
      seen.add(t.gid);
      const tp = t.custom_fields.find(f => f.name.toLowerCase() === "type of creative")?.display_value ?? "Other";
      typeMap[tp] ??= { total: 0, overdue: 0, completed: 0, designers: new Set() };
      typeMap[tp].total++;
      if (isOverdue(t)) typeMap[tp].overdue++;
      if (t.completed) typeMap[tp].completed++;
      if (t.assignee) typeMap[tp].designers.add(t.assignee.name);
    }
    return Object.entries(typeMap)
      .map(([type, s]) => ({ type, ...s, designerCount: s.designers.size }))
      .sort((a, b) => b.total - a.total);
  }, [teamTasks, completedTasks]);

  // ── File Intelligence (from sync data) ─────────────────────────────────────
  const hotFiles = useMemo(() => {
    return source.figmaFileStats
      .filter(f => f.edits > 0 || f.comments > 0)
      .map(f => ({ ...f, heat: f.edits * 3 + f.comments }))
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 20);
  }, [source.figmaFileStats]);

  // ── Filtered views for drill-down ────────────────────────────────────────
  const filteredDesigners = useMemo(() => {
    if (!selectedClient) return designers;
    const names = clientDesignerNames[selectedClient];
    return names ? designers.filter(d => names.includes(d.name)) : designers;
  }, [designers, selectedClient, clientDesignerNames]);

  const filteredTeamTasks = useMemo(() => {
    if (!selectedDesigner && !selectedClient) return teamTasks;
    let result = teamTasks;
    if (selectedDesigner) {
      const asanaNames = Object.entries(DESIGN_TEAM)
        .filter(([, fig]) => fig === selectedDesigner)
        .map(([asana]) => asana);
      result = result.filter(t => t.assignee && asanaNames.includes(t.assignee.name));
    }
    if (selectedClient) {
      result = result.filter(t => t.projects.some(p => p.name === selectedClient));
    }
    return result;
  }, [teamTasks, selectedDesigner, selectedClient]);

  const filteredTaskStats = useMemo(() => {
    const tasks = filteredTeamTasks;
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
        if (!NON_CLIENT_PROJECTS.has(p.name)) byProject[p.name] = (byProject[p.name] ?? 0) + 1;
      }
    }
    return {
      total, overdue,
      topAssignees: Object.entries(byAssignee).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.total - a.total),
      topProjects: Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [filteredTeamTasks]);

  const filteredClientPressure = useMemo(() => {
    if (!selectedDesigner) return clientPressure;
    const clients = designerClients[selectedDesigner];
    return clients ? clientPressure.filter(c => clients.includes(c.name)) : clientPressure;
  }, [clientPressure, selectedDesigner, designerClients]);

  const filteredWorkload = useMemo(() => {
    if (!selectedClient) return workload;
    const names = clientDesignerNames[selectedClient];
    return names ? workload.filter(d => names.includes(d.name)) : workload;
  }, [workload, selectedClient, clientDesignerNames]);

  const filteredOverdueOverlay = useMemo(() => {
    if (!selectedDesigner && !selectedClient) return overdueOverlay;
    if (selectedDesigner) return overdueOverlay.filter(t => t.figmaName === selectedDesigner);
    if (selectedClient) return overdueOverlay.filter(t => t.clients.includes(selectedClient));
    return overdueOverlay;
  }, [overdueOverlay, selectedDesigner, selectedClient]);

  const maxPressure = filteredClientPressure.length ? Math.max(...filteredClientPressure.map(c => c.pressureScore)) : 1;

  // Chart colors derived from theme state (for SVG attributes that can't use CSS vars)
  const chartColors = {
    tick: theme === 'dark' ? '#FFFFFF4D' : '#0000004D',
    cursor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
  };

  const showDetailPanel = !isMobile && (selectedDesigner !== null || selectedClient !== null);

  return (
    <div className="di-root" data-theme={theme} style={{ height: "100dvh", background: V.bg, fontFamily: FONT, color: V.text, display: "flex" }}>
      <style>{THEME_CSS}</style>

      {/* ── Hamburger (mobile) ── */}
      {isMobile && !sidebarOpen && (
        <button className="di-hover" onClick={() => setSidebarOpen(true)} style={{
          position: "fixed", top: 10, left: 10, zIndex: 1100,
          width: 36, height: 36, borderRadius: 8,
          background: V.surface, border: `1px solid ${V.divider}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 160ms ease-out",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={V.textSecondary} strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* ── Backdrop (mobile) ── */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: V.backdrop,
        }} />
      )}

      {/* ── Sidebar ── */}
      <div style={{
        width: isMobile ? 250 : 240, background: V.surface, borderRight: `1px solid ${V.divider}`,
        display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto",
        ...(isMobile ? {
          position: "fixed" as const, top: 0, bottom: 0,
          left: sidebarOpen ? 0 : -250,
          zIndex: 1300,
          transition: "left 300ms ease-out",
        } : {}),
      }}>
        {/* Logo */}
        <div style={{
          padding: "16px 16px", display: "flex", alignItems: "center", gap: 10,
          borderBottom: `1px solid ${V.divider}`,
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
          <div style={{ fontSize: 11, fontWeight: 500, color: V.textTertiary, padding: "8px 8px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Dashboard
          </div>
          {([
            { id: "activity", label: "Activity", icon: "\u25C6" },
            { id: "tasks", label: "Tasks", icon: "\u2610" },
            { id: "pressure", label: "Client Pressure", icon: "\u25B2" },
            { id: "workload", label: "Workload", icon: "\u229E" },
            { id: "trends", label: "Trends", icon: "\u25C8" },
            { id: "flags", label: `Flags${flags.length > 0 && flags[0].type !== "ok" ? ` (${flags.length})` : ""}`, icon: "\u2691" },
          ] as const).map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); if (isMobile) setSidebarOpen(false); }} className="di-hover" style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "7px 8px", marginBottom: 1,
              background: activeTab === item.id ? V.elevated : "transparent",
              border: "none", borderRadius: 6, cursor: "pointer",
              fontSize: 13, fontWeight: 500, fontFamily: FONT,
              color: activeTab === item.id ? V.text : V.textSecondary,
              transition: "all 160ms ease-out",
            }}>
              <span style={{ fontSize: 11, opacity: 0.6, width: 16, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div style={{ fontSize: 11, fontWeight: 500, color: V.textTertiary, padding: "16px 8px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Team {designers.length > 0 ? `(${designers.length})` : figmaSyncing ? "" : "(0)"}
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {designers.length === 0 && figmaSyncing && (
              <div style={{ padding: "8px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 12, height: 12, border: `2px solid ${V.divider}`,
                  borderTopColor: BLUE, borderRadius: "50%",
                  animation: "spin 0.8s linear infinite", flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: V.textTertiary }}>Syncing Figma data...</span>
              </div>
            )}
            {designers.map(d => (
              <button key={d.name} onClick={() => {
                setSelectedClient(null);
                setSelectedDesigner(prev => prev === d.name ? null : d.name);
                if (isMobile) setSidebarOpen(false);
              }} className="di-hover" style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 8px", borderRadius: 6, width: "100%",
                background: selectedDesigner === d.name ? V.selectedBg : "transparent",
                border: selectedDesigner === d.name ? `1px solid ${BLUE}44` : "1px solid transparent",
                cursor: "pointer", fontFamily: FONT, transition: "all 160ms ease-out",
              }}>
                <Avatar name={d.name} size={22} />
                <span style={{
                  fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: selectedDesigner === d.name ? V.selectedText : V.textSecondary,
                  fontWeight: selectedDesigner === d.name ? 600 : 400,
                }}>{d.name}</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 500, color: V.textTertiary, padding: "16px 8px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Clients ({clientPressure.length})
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {clientPressure.map(c => {
              const p = pressureLabel(c.pressureScore);
              return (
                <button key={c.name} onClick={() => {
                  setSelectedDesigner(null);
                  setSelectedClient(prev => prev === c.name ? null : c.name);
                  if (isMobile) setSidebarOpen(false);
                }} className="di-hover" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 8, padding: "5px 8px", borderRadius: 6, width: "100%",
                  background: selectedClient === c.name ? V.selectedBg : "transparent",
                  border: selectedClient === c.name ? `1px solid ${PURPLE}44` : "1px solid transparent",
                  cursor: "pointer", fontFamily: FONT, transition: "all 160ms ease-out",
                }}>
                  <span style={{
                    fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: selectedClient === c.name ? V.textComponent : V.textSecondary,
                    fontWeight: selectedClient === c.name ? 600 : 400,
                  }}>{c.name}</span>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer: Theme toggle + Status */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${V.divider}`,
          fontSize: 11, color: V.textTertiary, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {hasLiveData && !apiError && (
              <>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN }} />
                <span>Connected</span>
              </>
            )}
            {apiError && <span style={{ color: V.textDanger }}>Error: {apiError}</span>}
          </div>
          <button onClick={toggleTheme} className="di-hover" style={{
            width: 28, height: 28, borderRadius: 6, background: "transparent",
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 160ms ease-out",
          }}>
            {theme === "light" ? (
              /* Moon icon for light mode (click to go dark) */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={V.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              /* Sun icon for dark mode (click to go light) */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={V.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Header bar */}
        <div style={{
          padding: isMobile ? "12px 12px" : "12px 24px",
          paddingLeft: isMobile ? 56 : 24,
          borderBottom: `1px solid ${V.divider}`,
          display: "flex", flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: isMobile ? 8 : 0,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Breadcrumb
              tab={activeTab}
              selectedDesigner={selectedDesigner}
              selectedClient={selectedClient}
              onClearFilter={() => { setSelectedDesigner(null); setSelectedClient(null); }}
            />
            <div className="di-tab-scroll" style={{
              display: "flex", alignItems: "center",
              ...(isMobile ? { overflowX: "auto" as const } : {}),
            }}>
              <Tab label="Activity" active={activeTab === "activity"} onClick={() => setActiveTab("activity")} compact={isMobile} />
              <Tab label="Tasks" active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} compact={isMobile} />
              <Tab label="Client Pressure" active={activeTab === "pressure"} onClick={() => setActiveTab("pressure")} compact={isMobile} />
              <Tab label="Workload" active={activeTab === "workload"} onClick={() => setActiveTab("workload")} compact={isMobile} />
              <Tab label="Trends" active={activeTab === "trends"} onClick={() => setActiveTab("trends")} compact={isMobile} />
              <Tab label={`Flags${flags.length > 0 && flags[0].type !== "ok" ? ` (${flags.length})` : ""}`} active={activeTab === "flags"} onClick={() => setActiveTab("flags")} compact={isMobile} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {(selectedDesigner || selectedClient) && (
              <>
                {selectedDesigner && (
                  <button onClick={() => setSelectedDesigner(null)} className="di-hover" style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: `${BLUE}22`, border: `1px solid ${BLUE}44`,
                    borderRadius: 12, padding: "3px 10px 3px 8px",
                    fontSize: 11, fontWeight: 500, color: BLUE,
                    cursor: "pointer", fontFamily: FONT,
                    transition: "all 160ms ease-out",
                  }}>
                    <Avatar name={selectedDesigner} size={14} />
                    {selectedDesigner}
                    <span style={{ marginLeft: 4, opacity: 0.6 }}>\u00d7</span>
                  </button>
                )}
                {selectedClient && (
                  <button onClick={() => setSelectedClient(null)} className="di-hover" style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: `${PURPLE}22`, border: `1px solid ${PURPLE}44`,
                    borderRadius: 12, padding: "3px 10px",
                    fontSize: 11, fontWeight: 500, color: PURPLE,
                    cursor: "pointer", fontFamily: FONT,
                    transition: "all 160ms ease-out",
                  }}>
                    {selectedClient}
                    <span style={{ marginLeft: 4, opacity: 0.6 }}>\u00d7</span>
                  </button>
                )}
                <button onClick={() => { setSelectedDesigner(null); setSelectedClient(null); }} style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, color: V.textTertiary, fontFamily: FONT,
                  transition: "all 160ms ease-out",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = V.text)}
                onMouseLeave={e => (e.currentTarget.style.color = V.textTertiary)}
                >Clear</button>
              </>
            )}
            <button onClick={onRefresh} disabled={refreshing} style={{
              background: BLUE, color: "#fff", border: "none", borderRadius: 6,
              padding: "6px 12px", fontSize: 12, fontWeight: 500, fontFamily: FONT,
              cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.5 : 1,
              transition: "all 160ms ease-out",
            }}>
              {refreshing ? "Syncing\u2026" : "Refresh data"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          padding: isMobile ? "16px 12px" : "20px 24px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, 1fr)",
          gap: 12,
          animation: "fadeIn 0.3s ease",
          flexShrink: 0,
        }}>
          <StatPill label="Team members" value={designers.length} color={BLUE} />
          <StatPill label="Figma edits" value={designers.reduce((s, d) => s + d.edits, 0)} />
          <StatPill label="Comments" value={designers.reduce((s, d) => s + d.comments, 0)} />
          <StatPill label="Assigned tasks" value={taskStats.total} />
          <StatPill label="Overdue" value={taskStats.overdue} color={taskStats.overdue > 0 ? RED : undefined} />
          <StatPill label="Active files" value={teamFigma.length > 0 ? new Set(teamFigma.flatMap(d => d.files)).size : 0} />
        </div>

        {/* Tab Content */}
        <div style={{ padding: isMobile ? "0 12px 24px" : "0 24px 24px", animation: "fadeIn 0.2s ease", flex: 1 }}>

          {/* ── Activity Tab ── */}
          {activeTab === "activity" && (
            <div>
            {filteredDesigners.length === 0 ? (
              <EmptyState title="No designers match" description="Try clearing your filter to see all team members." />
            ) : (
              <>
            <div className={isMobile ? "di-scroll-x" : undefined} style={isMobile ? { overflowX: "auto" } : undefined}>
            <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, overflow: "hidden", minWidth: isMobile ? 520 : undefined }}>
              <div style={{
                display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 64px",
                padding: "10px 16px", fontSize: 11, fontWeight: 500, color: V.textTertiary,
                borderBottom: `1px solid ${V.divider}`, background: V.surface,
              }}>
                <span>#</span><span>Designer</span>
                <span style={{ textAlign: "right" }}>Edits</span>
                <span style={{ textAlign: "right" }}>Comments</span>
                <span style={{ textAlign: "right" }}>Files</span>
                <span style={{ textAlign: "right" }}>Score</span>
              </div>
              {filteredDesigners.map((d, i) => (
                <div key={d.name} style={{
                  display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 64px",
                  padding: "10px 16px", alignItems: "center",
                  borderBottom: i < filteredDesigners.length - 1 ? `1px solid ${V.divider}` : "none",
                  background: selectedDesigner === d.name ? V.selectedBg : "transparent",
                  borderLeft: selectedDesigner === d.name ? `2px solid ${BLUE}` : "2px solid transparent",
                  transition: "background 160ms ease-out",
                }}
                onMouseEnter={e => { if (selectedDesigner !== d.name) e.currentTarget.style.background = V.hover; }}
                onMouseLeave={e => { if (selectedDesigner !== d.name) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 12, color: V.textTertiary, fontWeight: 500 }}>{i + 1}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={d.name} size={28} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: V.text }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: V.textTertiary }}>
                        {d.projects.join(", ").slice(0, 50)}{d.projects.join(", ").length > 50 ? "\u2026" : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: V.text }}>{d.edits}</div>
                  <div style={{ textAlign: "right", fontSize: 13, color: V.textSecondary }}>{d.comments}</div>
                  <div style={{ textAlign: "right", fontSize: 13, color: V.textTertiary }}>{d.files.length}</div>
                  <div style={{
                    textAlign: "right", fontSize: 13, fontWeight: 600,
                    color: i === 0 ? BLUE : V.text,
                  }}>{d.score}</div>
                </div>
              ))}
            </div>
            </div>

            {/* File Intelligence */}
            {hotFiles.length > 0 && (
              <div className={isMobile ? "di-scroll-x" : undefined} style={{ marginTop: 16, ...(isMobile ? { overflowX: "auto" } : {}) }}>
              <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, overflow: "hidden", minWidth: isMobile ? 580 : undefined }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${V.divider}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary }}>Hottest files</div>
                  <div style={{ fontSize: 11, color: V.textTertiary, marginTop: 2 }}>Ranked by heat score (edits x3 + comments)</div>
                </div>
                <div style={{
                  display: "grid", gridTemplateColumns: "2fr 1.2fr 64px 64px 64px 60px",
                  padding: "8px 16px", fontSize: 11, fontWeight: 500, color: V.textTertiary,
                  borderBottom: `1px solid ${V.divider}`,
                }}>
                  <span>File</span><span>Client</span>
                  <span style={{ textAlign: "right" }}>Edits</span>
                  <span style={{ textAlign: "right" }}>Comments</span>
                  <span style={{ textAlign: "right" }}>Heat</span>
                  <span style={{ textAlign: "right" }}>Team</span>
                </div>
                {hotFiles.slice(0, 12).map((f, i) => (
                  <div key={f.name} style={{
                    display: "grid", gridTemplateColumns: "2fr 1.2fr 64px 64px 64px 60px",
                    padding: "8px 16px", alignItems: "center",
                    borderBottom: i < Math.min(hotFiles.length, 12) - 1 ? `1px solid ${V.divider}` : "none",
                    transition: "background 160ms ease-out",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = V.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {f.key ? (
                      <a href={figmaFileUrl(f.key, f.name)} target="_blank" rel="noopener noreferrer" style={{
                        fontSize: 12, fontWeight: 500, color: BLUE, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                        textDecoration: "none", paddingRight: 8,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                      >{f.name} <span style={{ fontSize: 10, opacity: 0.5 }}>\u2197</span></a>
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 500, color: V.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{f.name}</div>
                    )}
                    <div style={{ fontSize: 11, color: V.textTertiary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.project}</div>
                    <div style={{ textAlign: "right", fontSize: 12, color: V.text }}>{f.edits}</div>
                    <div style={{ textAlign: "right", fontSize: 12, color: V.textSecondary }}>{f.comments}</div>
                    <div style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: i === 0 ? BLUE : ORANGE }}>{f.heat}</div>
                    <div style={{ textAlign: "right", fontSize: 11, color: V.textTertiary }}>{f.designers.length}</div>
                  </div>
                ))}
              </div>
              </div>
            )}
              </>
            )}
            </div>
          )}

          {/* ── Tasks Tab ── */}
          {activeTab === "tasks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Delivery metrics row */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
                <StatPill label="Completed (30d)" value={deliveryMetrics.total} color={GREEN} />
                <StatPill
                  label="On-time rate"
                  value={deliveryMetrics.onTime !== null ? `${Math.round(deliveryMetrics.onTime * 100)}%` : "\u2014"}
                  color={deliveryMetrics.onTime !== null && deliveryMetrics.onTime >= 0.8 ? GREEN : deliveryMetrics.onTime !== null && deliveryMetrics.onTime >= 0.5 ? ORANGE : undefined}
                />
                <StatPill
                  label="Avg cycle time"
                  value={deliveryMetrics.avgCycle !== null ? `${deliveryMetrics.avgCycle}d` : "\u2014"}
                />
                <StatPill
                  label="This week"
                  value={`${deliveryMetrics.thisWeek} tasks`}
                  color={deliveryMetrics.weekDelta > 0 ? GREEN : deliveryMetrics.weekDelta < 0 ? RED : undefined}
                />
              </div>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16 }}>
              <div style={{ flex: 1, background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, marginBottom: 12 }}>Tasks by project</div>
                {filteredTaskStats.topProjects.length > 0 ? (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredTaskStats.topProjects.map(([name, count]) => ({
                        name: name.length > 14 ? name.slice(0, 12) + "\u2026" : name, count,
                      }))} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: chartColors.cursor }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                          {filteredTaskStats.topProjects.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? BLUE : `${BLUE}66`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState title="No projects" description="No project data available for the current filter." />
                )}
              </div>
              <div style={{ width: isMobile ? "auto" : 340, background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, marginBottom: 12 }}>By assignee</div>
                {filteredTaskStats.topAssignees.length > 0 ? filteredTaskStats.topAssignees.map(a => (
                  <div key={a.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 0", borderBottom: `1px solid ${V.divider}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={a.name} size={22} />
                      <span style={{ fontSize: 12, color: V.text }}>{a.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: V.text }}>{a.total}</span>
                      {a.overdue > 0 && <Badge text={`${a.overdue} overdue`} color={RED} bg="rgba(242,72,34,0.12)" />}
                    </div>
                  </div>
                )) : (
                  <EmptyState title="No assignees" description="No assignee data for the current filter." />
                )}
              </div>
            </div>

            {/* Creative Type Breakdown */}
            {creativeTypes.length > 0 && creativeTypes[0].type !== "Other" && (
              <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, marginBottom: 12 }}>Creative type breakdown</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {creativeTypes.filter(t => t.type !== "Other").map(t => {
                    const pct = creativeTypes[0].total > 0 ? Math.round((t.total / creativeTypes[0].total) * 100) : 0;
                    return (
                      <div key={t.type} style={{ flex: isMobile ? "1 1 100%" : "1 1 180px", minWidth: isMobile ? undefined : 160, background: V.elevated, borderRadius: 6, padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: V.text }}>{t.type}</span>
                          <span style={{ fontSize: 11, color: V.textTertiary }}>{t.total}</span>
                        </div>
                        <div style={{ height: 3, background: V.divider, borderRadius: 2, marginBottom: 6 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: BLUE, borderRadius: 2 }} />
                        </div>
                        <div style={{ display: "flex", gap: 8, fontSize: 10 }}>
                          {t.overdue > 0 && <span style={{ color: RED, fontWeight: 600 }}>{t.overdue} overdue</span>}
                          {t.completed > 0 && <span style={{ color: GREEN }}>{t.completed} done</span>}
                          <span style={{ color: V.textTertiary }}>{t.designerCount} designer{t.designerCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          )}

          {/* ── Pressure Tab ── */}
          {activeTab === "pressure" && (
            <div>
            {filteredClientPressure.length === 0 ? (
              <EmptyState title="No clients match" description="Try clearing your filter to see all clients." />
            ) : (
            <div className={isMobile ? "di-scroll-x" : undefined} style={isMobile ? { overflowX: "auto" } : undefined}>
            <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, overflow: "hidden", minWidth: isMobile ? 480 : undefined }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 80px",
                padding: "10px 16px", fontSize: 11, fontWeight: 500, color: V.textTertiary,
                borderBottom: `1px solid ${V.divider}`,
              }}>
                <span>Client</span>
                <span style={{ textAlign: "right" }}>Tasks</span>
                <span style={{ textAlign: "right" }}>Overdue</span>
                <span style={{ textAlign: "right" }}>Edits</span>
                <span style={{ textAlign: "right" }}>Pressure</span>
              </div>
              {filteredClientPressure.map((c, i) => {
                const p = pressureLabel(c.pressureScore);
                return (
                  <div key={c.name}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 80px",
                      padding: "12px 16px", alignItems: "center",
                      borderBottom: i < filteredClientPressure.length - 1 ? `1px solid ${V.divider}` : "none",
                      background: selectedClient === c.name ? V.selectedBg : "transparent",
                      borderLeft: selectedClient === c.name ? `2px solid ${PURPLE}` : "2px solid transparent",
                      transition: "background 160ms ease-out",
                    }}
                    onMouseEnter={e => { if (selectedClient !== c.name) e.currentTarget.style.background = V.hover; }}
                    onMouseLeave={e => { if (selectedClient !== c.name) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: V.text }}>{c.name}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: V.textSecondary }}>{c.tasks}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: c.overdue > 0 ? V.textDanger : V.textTertiary }}>{c.overdue}</span>
                      <span style={{ textAlign: "right", fontSize: 13, color: c.matchedEdits > 0 ? V.textSuccess : V.textTertiary }}>{c.matchedEdits}</span>
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
            </div>
            )}
            </div>
          )}

          {/* ── Workload Tab ── */}
          {activeTab === "workload" && (
            <div>
            {filteredWorkload.length === 0 ? (
              <EmptyState title="No workload data" description="Try clearing your filter to see all team members." />
            ) : (
            <div className={isMobile ? "di-scroll-x" : undefined} style={isMobile ? { overflowX: "auto" } : undefined}>
            <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, overflow: "hidden", minWidth: isMobile ? 620 : undefined }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 64px 64px 64px 64px 72px 100px",
                padding: "10px 16px", fontSize: 11, fontWeight: 500, color: V.textTertiary,
                borderBottom: `1px solid ${V.divider}`,
              }}>
                <span>Designer</span>
                <span style={{ textAlign: "right" }}>Tasks</span>
                <span style={{ textAlign: "right" }}>Overdue</span>
                <span style={{ textAlign: "right" }}>Edits</span>
                <span style={{ textAlign: "right" }}>Eff.</span>
                <span style={{ textAlign: "right" }}>Cycle</span>
                <span style={{ textAlign: "right" }}>Status</span>
              </div>
              {filteredWorkload.map((d, i) => {
                const eff = effLabel(d.efficiency);
                // Look up cycle time by original Asana name
                const asanaName = Object.entries(DESIGN_TEAM).find(([, fig]) => fig === d.name)?.[0] ?? d.name;
                const cycle = designerCycleTime[asanaName] ?? designerCycleTime[d.name];
                return (
                  <div key={d.name} style={{
                    display: "grid", gridTemplateColumns: "1fr 64px 64px 64px 64px 72px 100px",
                    padding: "10px 16px", alignItems: "center",
                    borderBottom: i < filteredWorkload.length - 1 ? `1px solid ${V.divider}` : "none",
                    background: selectedDesigner === d.name ? V.selectedBg : "transparent",
                    borderLeft: selectedDesigner === d.name ? `2px solid ${BLUE}` : "2px solid transparent",
                    transition: "background 160ms ease-out",
                  }}
                  onMouseEnter={e => { if (selectedDesigner !== d.name) e.currentTarget.style.background = V.hover; }}
                  onMouseLeave={e => { if (selectedDesigner !== d.name) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={d.name} size={24} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: V.text }}>{d.name}</span>
                    </div>
                    <span style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: V.text }}>{d.active}</span>
                    <span style={{ textAlign: "right", fontSize: 13, color: d.overdue > 0 ? V.textDanger : V.textTertiary }}>{d.overdue}</span>
                    <span style={{ textAlign: "right", fontSize: 13, color: d.edits > 0 ? V.textSuccess : V.textTertiary }}>{d.edits}</span>
                    <span style={{ textAlign: "right", fontSize: 13, color: V.textSecondary }}>
                      {d.efficiency !== null ? `${d.efficiency}\u00d7` : "\u2014"}
                    </span>
                    <span style={{ textAlign: "right", fontSize: 13, color: cycle != null ? V.textSecondary : V.textQuaternary }}>
                      {cycle != null ? `${cycle}d` : "\u2014"}
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
            </div>
            )}
            </div>
          )}

          {/* ── Trends Tab ── */}
          {activeTab === "trends" && (
            <div>
              {source.snapshots.length < 2 ? (
                <EmptyState
                  title="Not enough data yet"
                  description={`Trends appear after 2+ weekly Figma syncs. Each sync generates a weekly snapshot automatically.${source.snapshots.length === 1 ? " You have 1 snapshot \u2014 run another sync next week to see trends." : ""}`}
                />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  {/* Tasks Completed / Week */}
                  <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, marginBottom: 12 }}>Tasks completed / week</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5), // "03-16"
                          value: s.team.tasksCompleted,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: V.tooltipBg, border: `1px solid ${V.tooltipBorder}`, borderRadius: 6, fontSize: 12, color: "#FFFFFFE5" }} />
                          <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 3 }} name="Completed" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Avg Cycle Time */}
                  <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, marginBottom: 12 }}>Avg cycle time (days)</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5),
                          value: s.team.avgCycleTimeDays,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: V.tooltipBg, border: `1px solid ${V.tooltipBorder}`, borderRadius: 6, fontSize: 12, color: "#FFFFFFE5" }} />
                          <Line type="monotone" dataKey="value" stroke={ORANGE} strokeWidth={2} dot={{ fill: ORANGE, r: 3 }} name="Cycle Time" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* On-Time % */}
                  <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, marginBottom: 12 }}>On-time delivery %</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5),
                          value: s.team.onTimeRate !== null ? Math.round(s.team.onTimeRate * 100) : null,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: V.tooltipBg, border: `1px solid ${V.tooltipBorder}`, borderRadius: 6, fontSize: 12, color: "#FFFFFFE5" }} />
                          <Line type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2} dot={{ fill: GREEN, r: 3 }} name="On-Time %" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Total Edits */}
                  <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary, marginBottom: 12 }}>Total Figma edits</div>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={source.snapshots.map(s => ({
                          week: s.weekOf.slice(5),
                          value: s.team.totalEdits,
                        }))}>
                          <XAxis dataKey="week" tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: chartColors.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: V.tooltipBg, border: `1px solid ${V.tooltipBorder}`, borderRadius: 6, fontSize: 12, color: "#FFFFFFE5" }} />
                          <Line type="monotone" dataKey="value" stroke={PURPLE} strokeWidth={2} dot={{ fill: PURPLE, r: 3 }} name="Edits" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Flags Tab ── */}
          {activeTab === "flags" && (
            <div>
              {/* Flags grid */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 24 }}>
                {flags.map((flag, i) => {
                  const colors = {
                    danger: { bg: "rgba(242,72,34,0.08)", border: "rgba(242,72,34,0.3)", label: RED, badge: "rgba(242,72,34,0.15)" },
                    warn: { bg: "rgba(255,166,41,0.08)", border: "rgba(255,166,41,0.3)", label: ORANGE, badge: "rgba(255,166,41,0.15)" },
                    ok: { bg: "rgba(20,174,92,0.08)", border: "rgba(20,174,92,0.3)", label: GREEN, badge: "rgba(20,174,92,0.15)" },
                    info: { bg: "rgba(13,153,255,0.08)", border: "rgba(13,153,255,0.3)", label: BLUE, badge: "rgba(13,153,255,0.15)" },
                  }[flag.type];
                  const typeLabel = { danger: "Alert", warn: "Watch", ok: "Signal", info: "Info" }[flag.type];
                  return (
                    <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.label, background: colors.badge, padding: "2px 8px", borderRadius: 4 }}>{typeLabel}</span>
                        <span style={{ fontSize: 11, color: V.textTertiary }}>{flag.category}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: V.text, marginBottom: 6 }}>{flag.title}</div>
                      <div style={{ fontSize: 12, color: V.textSecondary, lineHeight: 1.6 }}>{flag.detail}</div>
                      {flag.tasks && flag.tasks.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                          {flag.tasks.map(t => (
                            <a key={t.gid} href={asanaTaskUrl(t.gid)} target="_blank" rel="noopener noreferrer" style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              fontSize: 11, color: BLUE, textDecoration: "none",
                              padding: "4px 8px", borderRadius: 4,
                              background: "rgba(13,153,255,0.06)",
                              transition: "background 160ms ease-out",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(13,153,255,0.14)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "rgba(13,153,255,0.06)")}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.name}</span>
                              <span style={{ color: V.textTertiary, marginLeft: 8, flexShrink: 0 }}>
                                {t.due_on && <span style={{ color: RED, marginRight: 6 }}>{t.due_on}</span>}
                                {t.assignee}
                                <span style={{ marginLeft: 6, opacity: 0.5 }}>\u2197</span>
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overdue x Figma Activity overlay */}
              {filteredOverdueOverlay.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: V.text, marginBottom: 4 }}>Overdue x Figma Activity</div>
                  <div style={{ fontSize: 11, color: V.textTertiary, marginBottom: 12 }}>Overdue tasks cross-referenced with designer Figma activity on that client \u2014 "In Figma" means work exists but may not have shipped.</div>
                  <div className={isMobile ? "di-scroll-x" : undefined} style={isMobile ? { overflowX: "auto" } : undefined}>
                  <div style={{ background: V.surface, borderRadius: 8, border: `1px solid ${V.divider}`, overflow: "hidden", minWidth: isMobile ? 520 : undefined }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "2fr 1fr 80px 80px 90px",
                      padding: "10px 16px", fontSize: 11, fontWeight: 500, color: V.textTertiary,
                      borderBottom: `1px solid ${V.divider}`,
                    }}>
                      <span>Task</span><span>Assignee</span>
                      <span style={{ textAlign: "right" }}>Due</span>
                      <span style={{ textAlign: "right" }}>Edits</span>
                      <span style={{ textAlign: "right" }}>Status</span>
                    </div>
                    {filteredOverdueOverlay.map((t, i) => (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "2fr 1fr 80px 80px 90px",
                        padding: "10px 16px", alignItems: "center",
                        borderBottom: i < filteredOverdueOverlay.length - 1 ? `1px solid ${V.divider}` : "none",
                        transition: "background 160ms ease-out",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = V.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <div>
                          <a href={asanaTaskUrl(t.gid)} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 12, fontWeight: 500, color: BLUE, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
                            textDecoration: "none",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                          >{t.task} <span style={{ fontSize: 10, opacity: 0.5 }}>\u2197</span></a>
                          {t.type && <div style={{ fontSize: 10, color: V.textTertiary, marginTop: 1 }}>{t.type}</div>}
                        </div>
                        <div style={{ fontSize: 12, color: V.textSecondary }}>{t.assignee}</div>
                        <div style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: RED }}>{t.dueDate}</div>
                        <div style={{ textAlign: "right", fontSize: 12, color: t.figmaEdits > 0 ? GREEN : V.textQuaternary }}>{t.figmaEdits > 0 ? t.figmaEdits : "\u2014"}</div>
                        <div style={{ textAlign: "right" }}>
                          {t.hasMatchedActivity
                            ? <Badge text="In Figma" color={ORANGE} bg="rgba(255,166,41,0.12)" />
                            : <Badge text="No activity" color={RED} bg="rgba(242,72,34,0.12)" />
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Panel (desktop only) ── */}
      {showDetailPanel && (
        <div style={{
          width: 300, flexShrink: 0, borderLeft: `1px solid ${V.divider}`,
          background: V.bg, overflowY: "auto",
          transition: "all 300ms ease-out",
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: `1px solid ${V.divider}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: V.textSecondary }}>
              {selectedDesigner ? "Designer" : "Client"} Details
            </span>
            <button onClick={() => { setSelectedDesigner(null); setSelectedClient(null); }} className="di-hover" style={{
              width: 24, height: 24, borderRadius: 4, background: "transparent",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 160ms ease-out",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={V.textTertiary} strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
          <DetailPanel
            selectedDesigner={selectedDesigner}
            selectedClient={selectedClient}
            designers={designers}
            filteredTeamTasks={filteredTeamTasks}
            filteredClientPressure={filteredClientPressure}
            clientDesignerNames={clientDesignerNames}
            designerClients={designerClients}
            hotFiles={hotFiles}
            clientPressure={clientPressure}
          />
        </div>
      )}
    </div>
  );
}
