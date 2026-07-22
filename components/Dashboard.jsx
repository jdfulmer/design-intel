"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  RefreshCw, Sun, Moon, Flame, Sparkles, ExternalLink,
  AlertTriangle, AlertOctagon, Info, CheckCircle2, ArrowUpRight,
  Send, Lock, LayoutGrid, ListChecks, Gauge, Scale, TrendingUp, Flag,
  ChevronRight, X, Clock, User, Loader2
} from "lucide-react";
import { TOKENS } from "@/lib/tokens";
import { DATA as DEMO } from "@/lib/data";

let DATA = DEMO; // swapped to live payload from /api/data at runtime

/* ─────────────────────────────────────────────────────────────
   DESIGN INTEL — one token system, light and dark, end to end.
   Figma activity × task data. Six views + At Risk + Ask.
   ───────────────────────────────────────────────────────────── */


/* ── Mock dataset (mirrors the Figma demo file) ── */


const NAV = [
  { id: "coverage", label: "Coverage", icon: LayoutGrid, dot: "accent" },
  { id: "activity", label: "Activity", icon: Flame, dot: "accent" },
  { id: "tasks", label: "Tasks", icon: ListChecks, dot: "green" },
  { id: "pressure", label: "Pressure", icon: Gauge, dot: "red" },
  { id: "workload", label: "Workload", icon: Scale, dot: "amberBar" },
  { id: "trends", label: "Trends", icon: TrendingUp, dot: "purple" },
  { id: "flags", label: "Flags", icon: Flag, dot: "red" },
  { id: "cold", label: "At Risk", icon: AlertTriangle, dot: "red" },
];

const BAND_TONE = { Critical: "red", High: "red", Med: "amber", Low: "green", Watch: "amber", "Needs link": "purple", Healthy: "green", Danger: "red", Warn: "amber", Info: "accent", Ok: "green", Overloaded: "red", Balanced: "green", "Has room": "accent", "Going quiet": "amber", "No coverage": "red", "High output": "green", "High load": "red", "In Review": "amber", "In Progress": "accent", "Not started": "red", "Not Started": "red", Overdue: "red" };

/* ── Primitives ── */

function Pill({ label, tone = "accent", T }) {
  const c = T[tone] || T.accent;
  const bg = T[tone + "Bg"] || T.accentBg;
  return (
    <span style={{ background: tone === "amberBar" ? T.amberBg : bg, color: tone === "amberBar" ? T.amber : c, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", lineHeight: "14px" }}>
      {label}
    </span>
  );
}

function Avatar({ initials, size = 28, color, T }) {
  const palette = ["#0D99FF", "#9747FF", "#14AE5C", "#F24822", "#00A2C2", "#FFA629"];
  const bg = color || palette[(initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % palette.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function Bar({ pct, tone = "accent", T, h = 6, w = 96 }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 999, background: T.track, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 999, background: T[tone] || T.accent, transition: "width .5s ease" }} />
    </div>
  );
}

function Card({ children, T, style, onClick, hoverable }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: T.shadow, cursor: onClick ? "pointer" : "default", transform: hoverable && hov ? "translateY(-1px)" : "none", transition: "transform .15s ease, box-shadow .15s ease", ...style }}
    >
      {children}
    </div>
  );
}

function CardHead({ title, sub, T, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${T.borderSoft}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</span>
      </div>
      {sub && <span style={{ fontSize: 11, color: T.text3 }}>{sub}</span>}
    </div>
  );
}

function Sep({ T }) {
  return <div style={{ height: 1, background: T.borderSoft, margin: "0 18px" }} />;
}

function Skeleton({ w = "100%", h = 14, T, r = 6, style }) {
  return <div className="di-shimmer" style={{ width: w, height: h, borderRadius: r, background: T.track, ...style }} />;
}

function Sparkline({ pts, tone, T, w = 420, h = 120 }) {
  const min = Math.min(...pts), max = Math.max(...pts);
  const nx = (i) => (i / (pts.length - 1)) * (w - 8) + 4;
  const ny = (v) => h - 10 - ((v - min) / (max - min || 1)) * (h - 26);
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${nx(i)},${ny(v)}`).join(" ");
  const area = `${line} L${nx(pts.length - 1)},${h - 4} L${nx(0)},${h - 4} Z`;
  const c = T[tone] || T.accent;
  const gid = useRef("g" + Math.random().toString(36).slice(2, 8)).current;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.22" />
          <stop offset="100%" stopColor={c} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <circle cx={nx(pts.length - 1)} cy={ny(pts[pts.length - 1])} r="3.5" fill={c} />
    </svg>
  );
}

/* ── Views ── */

function CoverageView({ T, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: T.text2, lineHeight: 1.5, maxWidth: 640 }}>
        We stopped ranking people by edits. This asks two protective questions: is every active project covered, and is anyone underwater?
      </div>
      <Card T={T}>
        <CardHead T={T} title="Project coverage" icon={<LayoutGrid size={14} color={T.accent} />} />
        <div style={{ padding: "6px 18px 4px", display: "grid", gridTemplateColumns: "2.2fr 1fr 0.7fr 1.1fr 1fr", gap: 8, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: T.text3 }}>
          <span>PROJECT</span><span>TEAM</span><span>OPEN</span><span>LAST ACTIVITY</span><span style={{ textAlign: "right" }}>COVERAGE</span>
        </div>
        {DATA.coverage.map((r, i) => (
          <React.Fragment key={r.proj}>
            {i > 0 && <Sep T={T} />}
            <div onClick={() => { const c = DATA.clients.find((x) => x.name === r.client); if (c) onSelect({ type: "client", id: c.id }); }} className="di-row" style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "2.2fr 1fr 0.7fr 1.1fr 1fr", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.proj}</div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{r.client}</div>
              </div>
              <div style={{ display: "flex" }}>
                {r.team.length ? r.team.map((t, k) => <div key={t} style={{ marginLeft: k > 0 ? -6 : 0 }}><Avatar initials={t} size={24} T={T} /></div>) : <span style={{ fontSize: 12, color: T.text3 }}>—</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.open}</span>
              <span style={{ fontSize: 12, color: r.status === "Healthy" ? T.text2 : T[BAND_TONE[r.status]] }}>{r.last}</span>
              <div style={{ textAlign: "right" }}><Pill T={T} label={r.status} tone={BAND_TONE[r.status]} /></div>
            </div>
          </React.Fragment>
        ))}
      </Card>
      <Card T={T}>
        <CardHead T={T} title="Team balance" icon={<Scale size={14} color={T.amberBar} />} />
        {DATA.balance.map((r, i) => (
          <React.Fragment key={r.i}>
            {i > 0 && <Sep T={T} />}
            <div onClick={() => onSelect({ type: "designer", id: DATA.designers.find((d) => d.initials === r.i)?.id })} className="di-row" style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar initials={r.i} size={26} T={T} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.n}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Bar T={T} pct={(r.cap[0] / r.cap[1]) * 100} tone={BAND_TONE[r.status] === "red" ? "red" : BAND_TONE[r.status] === "green" ? "green" : "accent"} w={110} />
                <span style={{ fontSize: 12, color: T.text2, width: 30, textAlign: "right" }}>{r.cap[0]}/{r.cap[1]}</span>
                <Pill T={T} label={r.status} tone={BAND_TONE[r.status]} />
              </div>
            </div>
          </React.Fragment>
        ))}
      </Card>
    </div>
  );
}

function ActivityView({ T, onSelect }) {
  const rows = DATA.leaderboardIds.map((id) => DATA.designers.find((d) => d.id === id)).filter(Boolean);
  const maxHeat = Math.max(1, ...DATA.hotFiles.map((f) => f.heat));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card T={T}>
        {/* TODO(uxr): "Leaderboard" framing conflicts with the protect-don't-rank principle and the UXR distrust signal (false positives / ranking anxiety). Candidate rename: "Activity" or "Contribution", pending more survey responses + moderated sessions. */}
        <CardHead T={T} title="Designer Leaderboard" sub="Composite · 30d" />
        {rows.map((d, i) => (
          <React.Fragment key={d.id}>
            {i > 0 && <Sep T={T} />}
            <div onClick={() => onSelect({ type: "designer", id: d.id })} className="di-row" style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: T.text3, width: 12 }}>{i + 1}</span>
                <Avatar initials={d.initials} color={d.color} T={T} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: T.text3 }}>{d.projects} project{d.projects > 1 ? "s" : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                {[["Edits", d.edits], ["Comments", d.comments], ["Files", d.files]].map(([l, v]) => (
                  <div key={l} style={{ textAlign: "right", minWidth: 56 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{v}</div>
                    <div style={{ fontSize: 10.5, color: T.text3 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </Card>
      <Card T={T}>
        <CardHead T={T} title="Hottest Files" sub="Heat = edits×3 + comments" icon={<Flame size={14} color={T.red} />} />
        {DATA.hotFiles.map((f, i) => (
          <React.Fragment key={f.id}>
            {i > 0 && <Sep T={T} />}
            <div onClick={() => onSelect({ type: "file", id: f.id })} className="di-row" style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.accent, display: "flex", alignItems: "center", gap: 4 }}>
                  {f.name} <ArrowUpRight size={13} />
                </div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{f.client}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 12, color: T.text2 }}>{f.edits} edits</span>
                <span style={{ fontSize: 12, color: T.text2 }}>{f.comments} comments</span>
                <Bar T={T} pct={(f.heat / maxHeat) * 100} tone="amberBar" w={90} h={5} />
              </div>
            </div>
          </React.Fragment>
        ))}
      </Card>
    </div>
  );
}

function TasksView({ T, onSelect }) {
  const toneColor = { text: T.text, green: T.green, red: T.red };
  const maxProj = Math.max(1, ...DATA.byProject.map(([, v]) => v));
  const maxType = Math.max(1, ...DATA.byType.map(([, v]) => v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {DATA.taskMetrics.map((m) => (
          <Card key={m.label} T={T} style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: toneColor[m.tone] }}>{m.value}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card T={T}>
          <CardHead T={T} title="By Product Area" />
          <div style={{ padding: "10px 18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            {DATA.byProject.map(([n, v]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: T.text2, width: 130, flexShrink: 0 }}>{n}</span>
                <Bar T={T} pct={(v / maxProj) * 100} w={999} h={7} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, width: 24, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card T={T}>
          <CardHead T={T} title="By Work Type" />
          <div style={{ padding: "10px 18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            {DATA.byType.map(([n, v]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: T.text2, width: 130, flexShrink: 0 }}>{n}</span>
                <Bar T={T} pct={(v / maxType) * 100} tone="purple" w={999} h={7} />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, width: 34, textAlign: "right" }}>{v}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card T={T}>
        <CardHead T={T} title="By Assignee" sub="Active tasks · overdue" />
        {DATA.byAssignee.map((a, i) => (
          <React.Fragment key={a.i}>
            {i > 0 && <Sep T={T} />}
            <div onClick={() => { const d = DATA.designers.find((x) => x.initials === a.i); if (d) onSelect({ type: "designer", id: d.id }); }} className="di-row" style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar initials={a.i} size={26} T={T} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.n}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: T.text2 }}>{a.active} active</span>
                <Pill T={T} label={a.note} tone={a.tone} />
              </div>
            </div>
          </React.Fragment>
        ))}
      </Card>
    </div>
  );
}

function PressureView({ T, onSelect }) {
  const maxPi = Math.max(1, ...DATA.clients.map((c) => c.pi));
  return (
    <Card T={T}>
      <CardHead T={T} title="Team Pressure Index" sub="tasks + overdue×3 − min(edits×0.3, tasks)" icon={<Gauge size={14} color={T.red} />} />
      {DATA.clients.map((c, i) => (
        <React.Fragment key={c.id}>
          {i > 0 && <Sep T={T} />}
          <div onClick={() => onSelect({ type: "client", id: c.id })} className="di-row" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.name}</div>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{c.tasks} tasks · {c.overdue} overdue · {c.edits} edits</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Bar T={T} pct={(c.pi / maxPi) * 100} tone={BAND_TONE[c.band]} w={140} h={6} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text, width: 26, textAlign: "right" }}>{c.pi}</span>
              <Pill T={T} label={c.band} tone={BAND_TONE[c.band]} />
            </div>
          </div>
        </React.Fragment>
      ))}
    </Card>
  );
}

function WorkloadView({ T, onSelect }) {
  const cols = ["Active", "Overdue", "Edits", "Efficiency", "Cycle", "Flag"];
  return (
    <Card T={T}>
      <CardHead T={T} title="Workload Balance" sub="efficiency = edits ÷ active tasks" icon={<Scale size={14} color={T.amberBar} />} />
      <div style={{ padding: "8px 18px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: T.text3 }}>DESIGNER</span>
        <div style={{ display: "flex", gap: 0 }}>
          {cols.map((c) => (
            <span key={c} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: T.text3, width: c === "Flag" ? 96 : 74, textAlign: "right", textTransform: "uppercase" }}>{c}</span>
          ))}
        </div>
      </div>
      {DATA.designers.map((d, i) => (
        <React.Fragment key={d.id}>
          <Sep T={T} />
          <div onClick={() => onSelect({ type: "designer", id: d.id })} className="di-row" style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar initials={d.initials} color={d.color} size={26} T={T} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {[d.active, d.overdue, d.edits, d.efficiency, d.cycle].map((v, j) => (
                <span key={j} style={{ fontSize: 12.5, color: j === 1 && v > 0 ? T.red : T.text2, fontWeight: j === 1 && v > 0 ? 700 : 500, width: 74, textAlign: "right" }}>{v}</span>
              ))}
              <div style={{ width: 96, textAlign: "right" }}>
                {d.flag ? <Pill T={T} label={d.flag} tone={BAND_TONE[d.flag]} /> : <span style={{ fontSize: 12, color: T.text3 }}>—</span>}
              </div>
            </div>
          </div>
        </React.Fragment>
      ))}
    </Card>
  );
}

function TrendsView({ T }) {
  const toneColor = { green: T.green, red: T.red };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {DATA.trends.map((t) => (
        <Card key={t.label} T={T} style={{ padding: "16px 18px 10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text2 }}>{t.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: toneColor[t.tone] }}>{t.delta}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.text, marginBottom: 6 }}>{t.value}</div>
          <Sparkline pts={t.pts} tone={t.tone === "green" ? "green" : "red"} T={T} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.text3, marginTop: 4 }}>
            <span>8 wks ago</span><span>this week</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function FlagsView({ T, onSelect }) {
  const sevIcon = { Danger: AlertOctagon, Warn: AlertTriangle, Info: Info, Ok: CheckCircle2 };
  const resolveFlagRef = (ref) => {
    if (!ref) return null;
    if (ref.entityType === "designer" && DATA.designers.some((d) => d.id === ref.entityId)) return { type: "designer", id: ref.entityId };
    if (ref.entityType === "client" && DATA.clients.some((c) => c.id === ref.entityId)) return { type: "client", id: ref.entityId };
    return null;
  };
  return (
    <Card T={T}>
      <CardHead T={T} title="Operational Flags" sub={`${DATA.flags.length} active`} icon={<Flag size={14} color={T.red} />} />
      {DATA.flags.map((f, i) => {
        const Ic = sevIcon[f.sev];
        const tone = BAND_TONE[f.sev];
        const target = resolveFlagRef(f.entityRef);
        return (
          <React.Fragment key={f.t + i}>
            {i > 0 && <Sep T={T} />}
            <div onClick={() => target && onSelect(target)} className={target ? "di-row" : undefined} style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: target ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T[tone + "Bg"], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ic size={15} color={T[tone]} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{f.t}</div>
                  <div style={{ fontSize: 11.5, color: T.text3, marginTop: 1 }}>{f.d}</div>
                </div>
              </div>
              <Pill T={T} label={f.sev} tone={tone} />
            </div>
          </React.Fragment>
        );
      })}
    </Card>
  );
}

function ColdView({ T, onSelect }) {
  const [items, setItems] = useState(DATA.coldDeadlines);
  const [toast, setToast] = useState(null);
  const act = (id, action, title) => {
    if (action === "I've got this" || action === "Dismiss") {
      setItems((p) => p.filter((x) => x.id !== id));
      setToast(action === "Dismiss" ? `Dismissed “${title}”` : `Owner acknowledged “${title}”`);
    } else if (action === "Snooze") {
      setToast(`Snoozed “${title}” for 24h`);
    } else if (action === "Reassign") {
      setToast(`Reassign flow — routed to design lead`);
    } else if (action === "Link file") {
      setToast(`Link a Figma file to “${title}”`);
    }
    setTimeout(() => setToast(null), 2600);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
      <div style={{ fontSize: 12.5, color: T.text2 }}>
        Deadlines in danger of slipping: due soon with no recent design activity. Owners get nudged before it becomes a fire.
      </div>
      <Card T={T}>
        <CardHead T={T} title="At Risk" sub={`Sorted by risk, then PM priority · ${items.length} active · ${items.some((i) => i.band === "Needs link") ? "1 needs link" : "0 need link"}`} icon={<AlertTriangle size={14} color={T.red} />} />
        {items.length === 0 && (
          <div style={{ padding: "36px 18px", textAlign: "center" }}>
            <CheckCircle2 size={26} color={T.green} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Nothing at risk</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>Every deadline has recent activity or an acknowledged owner.</div>
          </div>
        )}
        {items.map((cd, i) => {
          const target = DATA.clients.find((x) => x.name === cd.client);
          return (
          <React.Fragment key={cd.id}>
            {i > 0 && <Sep T={T} />}
            <div style={{ padding: "14px 18px", borderLeft: cd.band === "Critical" ? `3px solid ${T.red}` : "3px solid transparent" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div onClick={() => target && onSelect({ type: "client", id: target.id })} className={target ? "di-row" : undefined} style={{ cursor: target ? "pointer" : "default", borderRadius: 8, margin: "-4px -6px", padding: "4px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{cd.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.text3, border: `1px solid ${T.border}`, borderRadius: 4, padding: "1px 5px" }}>{cd.pri}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2 }}>{cd.client}</div>
                </div>
                <Pill T={T} label={cd.band} tone={BAND_TONE[cd.band]} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {cd.chips.map((ch) => (
                  <span key={ch} style={{ fontSize: 11, color: T.text2, background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 6, padding: "3px 8px" }}>{ch}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {cd.actions.map((a, j) => (
                  <button key={a} onClick={(e) => { e.stopPropagation(); act(cd.id, a, cd.title); }} className="di-btn" style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
                    background: j === 0 ? T.accent : "transparent", color: j === 0 ? "#fff" : T.text2,
                    border: j === 0 ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                  }}>{a}</button>
                ))}
              </div>
            </div>
          </React.Fragment>
        ); })}
        <Sep T={T} />
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.65 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{DATA.coldSuppressed.title}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: T.text3, border: `1px solid ${T.border}`, borderRadius: 4, padding: "1px 5px" }}>{DATA.coldSuppressed.pri}</span>
            </div>
            <div style={{ fontSize: 11.5, color: T.green, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={12} /> {DATA.coldSuppressed.note}
            </div>
          </div>
          <Pill T={T} label="Healthy" tone="green" />
        </div>
      </Card>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.text, color: T.bg, fontSize: 12.5, fontWeight: 600, padding: "9px 16px", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.25)", zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Ask Design Intel — live Claude via MCP-style tools ── */

const SUGGESTED = [
  "Who's at risk of missing a deadline?",
  "How did velocity change vs last week?",
  "Which files are heating up?",
];

const MCP_TOOLS = ["get_workload()", "get_pressure_index()", "get_activity()", "get_tasks()", "get_flags()"];

function AskView({ T, messages, setMessages, usedTools, setUsedTools, pendingAsk, clearPending, onSelect }) {
  // Resolve an AI answer entity to a dashboard panel target, if one exists.
  const resolveEntity = (e) => {
    const d = DATA.designers.find((x) => x.initials === e.initials || x.name === e.name);
    if (d) return { type: "designer", id: d.id };
    const c = DATA.clients.find((x) => x.name === e.name);
    if (c) return { type: "client", id: c.id };
    return null;
  };
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (pendingAsk) {
      const q = pendingAsk;
      clearPending();
      ask(q);
    }
  }, [pendingAsk]);

  const ask = async (q) => {
    const question = (q || input).trim();
    if (!question || busy) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json())?.error || ""; } catch {}
        throw new Error(detail || `ask ${res.status}`);
      }
      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);
      setMessages((p) => [...p, { role: "ai", answer: parsed.answer, tools: parsed.tools || [], entities: parsed.entities || [] }]);
      setUsedTools((p) => Array.from(new Set([...p, ...(parsed.tools || [])])));
    } catch (e) {
      const notConfigured = String(e?.message || "").includes("not configured");
      const msg = notConfigured
        ? "Ask isn't connected to the AI backend yet. The rest of the dashboard works normally."
        : "Ask couldn't get an answer right now. Please try again in a moment.";
      setMessages((p) => [...p, { role: "ai", answer: msg, tools: [], entities: [], error: true }]);
    }
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingBottom: 16, minHeight: 0 }}>
        {messages.length === 0 && !busy && (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: T.purpleBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Sparkles size={20} color={T.purple} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Ask Design Intel</div>
            <div style={{ fontSize: 12.5, color: T.text3, marginTop: 4, lineHeight: 1.5 }}>
              Plain-English questions against your live Figma and task data. Try a suggestion on the right, or type your own.
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "76%", background: T.accent, color: "#fff", fontSize: 13, lineHeight: 1.5, padding: "9px 14px", borderRadius: "14px 14px 3px 14px" }}>
              {m.text}
            </div>
          ) : (
            <div key={i} style={{ alignSelf: "flex-start", maxWidth: "88%", display: "flex", gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: T.purpleBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <Sparkles size={13} color={T.purple} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: T.surface, border: `1px solid ${m.error ? T.red : T.border}`, borderRadius: "3px 14px 14px 14px", padding: "11px 14px", fontSize: 13, lineHeight: 1.55, color: T.text }}>
                  {m.answer}
                  {(m.entities || []).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                      {m.entities.map((e, j) => {
                        const target = resolveEntity(e);
                        return (
                          <div key={j} onClick={() => target && onSelect(target)} className={target ? "di-row" : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 8, padding: "8px 10px", cursor: target ? "pointer" : "default" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar initials={e.initials || "?"} size={24} T={T} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{e.name}</div>
                                <div style={{ fontSize: 10.5, color: T.text3 }}>{e.meta}</div>
                              </div>
                            </div>
                            {e.tag && <Pill T={T} label={e.tag} tone={e.tone || "accent"} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {(m.tools || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {m.tools.map((t) => (
                      <span key={t} style={{ fontSize: 10.5, fontFamily: "ui-monospace, monospace", color: T.text3, background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 5, padding: "2px 7px" }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {busy && (
          <div style={{ alignSelf: "flex-start", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: T.purpleBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={13} color={T.purple} className="di-spin" />
            </div>
            <span style={{ fontSize: 12, color: T.text3 }}>Reading Figma version history and task records…</span>
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 6px 6px 14px", alignItems: "center", boxShadow: T.shadow }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            maxLength={500}
            placeholder="Ask about activity, tasks, pressure, or flags…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: T.text }}
          />
          <button onClick={() => ask()} disabled={busy} className="di-btn" style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
            Ask <Send size={12} />
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: T.text3, marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <Lock size={10} /> Powered by Claude via the Design Intel MCP server · read-only
        </div>
      </div>
    </div>
  );
}

/* ── Detail panels (right rail) ── */

function PanelStat({ v, l, T, tone }) {
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px", flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: tone ? T[tone] : T.text }}>{v}</div>
      <div style={{ fontSize: 10.5, color: T.text3, marginTop: 1 }}>{l}</div>
    </div>
  );
}

function PanelLabel({ children, T }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: T.text3, margin: "16px 0 8px" }}>{children}</div>;
}

function DesignerPanel({ id, T, onSelect }) {
  const d = DATA.designers.find((x) => x.id === id);
  if (!d) return <EmptyPanel T={T} />;
  const tasks = DATA.designerTasks[id] || [];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Avatar initials={d.initials} color={d.color} size={38} T={T} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{d.name}</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>Product Designer</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <PanelStat v={d.edits} l="Edits" T={T} tone="accent" />
        <PanelStat v={d.active} l="Active tasks" T={T} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <PanelStat v={d.overdue} l="Overdue" T={T} tone={d.overdue > 0 ? "red" : undefined} />
      </div>
      <PanelLabel T={T}>TASKS</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.length === 0 && <span style={{ fontSize: 11.5, color: T.text3 }}>No active tasks</span>}
        {tasks.map((t) => {
          const tc = t.c ? DATA.clients.find((x) => x.id === t.c) : null;
          return (
          <div key={t.t} onClick={() => tc && onSelect && onSelect({ type: "client", id: tc.id })} className={tc ? "di-row" : undefined} style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: tc ? "pointer" : "default" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{t.t}</div>
              <div style={{ marginTop: 6 }}><Pill T={T} label={t.s} tone={BAND_TONE[t.s] || "accent"} /></div>
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}

function FilePanel({ id, T }) {
  const f = DATA.hotFiles.find((x) => x.id === id);
  if (!f) return <EmptyPanel T={T} />;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.amberBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Flame size={17} color={T.amberBar} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{f.name}</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>{f.client} · Figma file</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <PanelStat v={f.edits} l="Edits" T={T} tone="accent" />
        <PanelStat v={f.comments} l="Comments" T={T} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <PanelStat v={f.heat} l="Heat" T={T} tone="amber" />
        <PanelStat v={f.contributors.length} l="Contributors" T={T} />
      </div>
      {f.figmaUrl && (
        <a href={f.figmaUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <button className="di-btn" style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            Open in Figma <ExternalLink size={12} />
          </button>
        </a>
      )}
      <PanelLabel T={T}>CONTRIBUTORS</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {f.contributors.map((c) => (
          <div key={c.i + c.n} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar initials={c.i} size={22} T={T} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{c.n}</span>
            </div>
            <span style={{ fontSize: 11.5, color: T.text3 }}>{c.e}</span>
          </div>
        ))}
      </div>
      <PanelLabel T={T}>RECENT ACTIVITY</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {f.activity.map((a, i) => (
          <div key={a.t + i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <Clock size={12} color={T.text3} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12, color: T.text2, lineHeight: 1.4 }}>{a.t}</div>
            <span style={{ fontSize: 10.5, color: T.text3, flexShrink: 0 }}>{a.w}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientPanel({ id, T }) {
  const c = DATA.clients.find((x) => x.id === id);
  if (!c) return <EmptyPanel T={T} />;
  const dl = DATA.clientDeadlines[id] || [];
  const offset = Math.round(Math.min(c.edits * 0.3, c.tasks));
  const breakdown = [
    ["Base load (open tasks)", `+${c.tasks}`],
    ["Overdue weight (×3)", `+${c.overdue * 3}`],
    ["Activity offset", `−${offset}`],
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Avatar initials={c.initials} size={38} T={T} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{c.name}</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>Product area · {c.designers} designer{c.designers === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <PanelStat v={c.pi} l="Pressure index" T={T} tone={BAND_TONE[c.band]} />
        <PanelStat v={c.tasks} l="Open tasks" T={T} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <PanelStat v={c.overdue} l="Overdue" T={T} tone={c.overdue > 0 ? "red" : undefined} />
        <PanelStat v={c.designers} l="Designers" T={T} />
      </div>
      <PanelLabel T={T}>PRESSURE BREAKDOWN</PanelLabel>
      <div style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "4px 12px" }}>
        {breakdown.map(([l, v], i) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.borderSoft}`, fontSize: 12 }}>
            <span style={{ color: T.text2 }}>{l}</span>
            <span style={{ fontWeight: 700, color: i === 2 ? T.green : T.text }}>{v}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: T.text }}>Pressure index</span>
          <span style={{ fontWeight: 700, color: T[BAND_TONE[c.band]] }}>{c.pi}</span>
        </div>
      </div>
      <PanelLabel T={T}>DEADLINES</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dl.length === 0 && <span style={{ fontSize: 11.5, color: T.text3 }}>No dated deadlines</span>}
        {dl.map((d) => (
          <div key={d.t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.text, fontWeight: 600, lineHeight: 1.35 }}>{d.t}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T[d.tone] || T.text3, flexShrink: 0 }}>{d.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColdRulesPanel({ T }) {
  const rules = [
    ["Critical", "due ≤ 2d · quiet ≥ 5d · not started", "red"],
    ["High", "due ≤ 5d · quiet ≥ 7d", "red"],
    ["Watch", "due ≤ 7d · quiet ≥ 5d", "amber"],
    ["Suppressed", "status In Review+, recent checkpoint, or acknowledged", "green"],
    ["Needs link", "no Figma file attached — never shown as untouched", "purple"],
  ];
  const routing = [
    ["1", "Nudge the owner", "Slack DM + email with the why and inline actions"],
    ["2", "Auto-escalate", "No ack within SLA → routed to the design lead"],
    ["3", "Resolve", "I've got this, snooze, or reassign clears it"],
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.redBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AlertTriangle size={17} color={T.red} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>At risk</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>Rules + routing</div>
        </div>
      </div>
      <PanelLabel T={T}>RULES</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rules.map(([b, r, tone]) => (
          <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}><Pill T={T} label={b} tone={tone} /></div>
            <span style={{ fontSize: 11.5, color: T.text2, lineHeight: 1.45 }}>{r}</span>
          </div>
        ))}
      </div>
      <PanelLabel T={T}>ROUTING — OWNER FIRST</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {routing.map(([n, t, d]) => (
          <div key={n} style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: T.accentBg, color: T.accent, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{t}</div>
              <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.4, marginTop: 1 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: T.text2, lineHeight: 1.45 }}>
        <span style={{ fontWeight: 700, color: T.text }}>Surfacing order.</span> Risk severity first, then PM priority (P0 → P2).
      </div>
    </div>
  );
}

function TrendsPanel({ T }) {
  const metrics = [
    ["Tasks completed / week", "Count of tasks marked complete, bucketed by week"],
    ["Avg cycle time", "Created-to-completed duration, averaged per week"],
    ["On-time delivery", "Share of completed tasks that beat their due date"],
    ["Figma edits / week", "Saved versions across all scanned files"],
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.purpleBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingUp size={17} color={T.purple} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Trends</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>How these are computed</div>
        </div>
      </div>
      <PanelLabel T={T}>METRICS</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {metrics.map(([t, d]) => (
          <div key={t}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{t}</div>
            <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.45, marginTop: 1 }}>{d}</div>
          </div>
        ))}
      </div>
      <PanelLabel T={T}>WINDOW</PanelLabel>
      <div style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: T.text2, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: T.text }}>8-week rolling window.</span> The delta compares this week against last week. Sparklines run oldest to newest, left to right.
      </div>
    </div>
  );
}

function FlagsPanel({ T }) {
  const rules = [
    ["Overdue clustering", "3+ overdue tasks in one product area", "red"],
    ["High load imbalance", "8+ active tasks with under 10 Figma edits", "red"],
    ["Velocity drop", "Throughput down 20%+ week-over-week", "amber"],
    ["Stale overdue", "Any task 14+ days past its due date", "amber"],
    ["Bus factor", "One designer carrying 4+ tasks in an area", "accent"],
    ["Coverage healthy", "No active designer with zero edits this week", "green"],
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.redBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Flag size={17} color={T.red} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Flag rules</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>When each one fires</div>
        </div>
      </div>
      <PanelLabel T={T}>RULES</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rules.map(([t, d, tone]) => (
          <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T[tone], flexShrink: 0, marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{t}</div>
              <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.45, marginTop: 1 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: T.text2, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: T.text }}>Recomputed every refresh.</span> Flags clear themselves when the underlying condition resolves.
      </div>
    </div>
  );
}

function CoveragePanel({ T }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.accentBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LayoutGrid size={17} color={T.accent} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Coverage & Balance</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>How to read this view</div>
        </div>
      </div>
      <PanelLabel T={T}>WHAT YOU SEE</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11.5, color: T.text2, lineHeight: 1.5 }}>
        <div><span style={{ fontWeight: 700, color: T.text }}>Project coverage.</span> Is every active project attended to — or going dark?</div>
        <div><span style={{ fontWeight: 700, color: T.text }}>Team balance.</span> Who's over capacity, who has room — to shift load.</div>
      </div>
      <div style={{ marginTop: 16, background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: T.text2, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: T.text }}>Protect, don't rank.</span> No individual is scored. Every signal is about work and capacity.
      </div>
    </div>
  );
}

function AskPanel({ T, onSuggest, usedTools }) {
  return (
    <div>
      <PanelLabel T={T}>SUGGESTED</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SUGGESTED.map((s) => (
          <button key={s} onClick={() => onSuggest(s)} className="di-btn" style={{ textAlign: "left", background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, fontWeight: 600, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {s} <ArrowUpRight size={13} color={T.text3} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
      <PanelLabel T={T}>MCP TOOLS</PanelLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {MCP_TOOLS.map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11.5, fontFamily: "ui-monospace, monospace", color: T.text2 }}>{t}</span>
            {usedTools.includes(t) && <Pill T={T} label="used" tone="green" />}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: T.surface2, border: `1px solid ${T.borderSoft}`, borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={11} color={T.text3} /> Grounded in your live data
        </div>
        <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.5, marginTop: 4 }}>
          Answers cite the exact Figma + Asana records they're drawn from.
        </div>
      </div>
    </div>
  );
}

function EmptyPanel({ T }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: T.surface2, border: `1px solid ${T.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <User size={17} color={T.text3} />
      </div>
      <div style={{ fontSize: 12, color: T.text3, lineHeight: 1.5, maxWidth: 180 }}>Select a designer or team to see details</div>
    </div>
  );
}

/* ── Shell ── */

function LoadingView({ T }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card T={T} style={{ padding: 18 }}>
        <Skeleton T={T} w={180} h={16} style={{ marginBottom: 18 }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 3 ? 16 : 0 }}>
            <Skeleton T={T} w={28} h={28} r={14} />
            <div style={{ flex: 1 }}>
              <Skeleton T={T} w="34%" h={12} style={{ marginBottom: 6 }} />
              <Skeleton T={T} w="20%" h={9} />
            </div>
            <Skeleton T={T} w={120} h={8} />
          </div>
        ))}
      </Card>
      <Card T={T} style={{ padding: 18 }}>
        <Skeleton T={T} w={140} h={16} style={{ marginBottom: 18 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i < 2 ? 16 : 0 }}>
            <Skeleton T={T} w="28%" h={12} />
            <Skeleton T={T} w={90} h={8} />
          </div>
        ))}
      </Card>
    </div>
  );
}

const VIEW_TITLES = { coverage: "Coverage", activity: "Activity", tasks: "Tasks", pressure: "Pressure", workload: "Workload", trends: "Trends", flags: "Flags", cold: "At Risk", ask: "Ask" };

export default function DesignIntel() {
  const [mode, setMode] = useState("light");
  const [view, setView] = useState("coverage");
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState("…");
  const [askMessages, setAskMessages] = useState([]);
  const [usedTools, setUsedTools] = useState([]);
  const [pendingAsk, setPendingAsk] = useState(null);
  const T = TOKENS[mode];

  const [source, setSource] = useState("demo");
  const [tick, setTick] = useState(0);

  const load = async (force) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data${force ? "?refresh=1" : ""}`);
      const json = await res.json();
      if (json?.data) {
        DATA = json.data;
        setSource(json.source);
        setTick((t) => t + 1);
      }
    } catch {}
    setLoading(false);
    setUpdated("just now");
  };

  useEffect(() => { load(false); }, []);

  const refresh = () => load(true);

  const go = (v) => { setView(v); setSel(null); };

  const suggest = (q) => { setPendingAsk(q); };

  const panel = useMemo(() => {
    if (view === "ask" && !sel) return <AskPanel T={T} usedTools={usedTools} onSuggest={suggest} />;
    if (view === "cold" && !sel) return <ColdRulesPanel T={T} />;
    if (view === "trends") return <TrendsPanel T={T} />;
    if (view === "flags" && !sel) return <FlagsPanel T={T} />;
    if (view === "coverage" && !sel) return <CoveragePanel T={T} />;
    if (sel?.type === "designer") return <DesignerPanel id={sel.id} T={T} onSelect={setSel} />;
    if (sel?.type === "file") return <FilePanel id={sel.id} T={T} />;
    if (sel?.type === "client") return <ClientPanel id={sel.id} T={T} />;
    if (view === "activity") return <DesignerPanel id={DATA.leaderboardIds[0]} T={T} onSelect={setSel} />;
    if (view === "pressure") return <ClientPanel id={DATA.clients[0]?.id} T={T} />;
    return <EmptyPanel T={T} />;
  }, [view, sel, T, usedTools, tick]);

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: T.text, overflow: "hidden" }}>
      <style>{`
        .di-shimmer { position: relative; overflow: hidden; }
        .di-shimmer::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, ${mode === "light" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.08)"}, transparent); animation: di-sh 1.4s infinite; }
        @keyframes di-sh { 100% { transform: translateX(100%); } }
        .di-row:hover { background: ${T.hover}; }
        .di-btn:active { transform: scale(0.97); }
        .di-spin { animation: di-rot 1s linear infinite; }
        @keyframes di-rot { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        @media (prefers-reduced-motion: reduce) { .di-shimmer::after, .di-spin { animation: none; } }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 178, flexShrink: 0, borderRight: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column", padding: "16px 10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 18 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={11} color="#fff" />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>Design Intel</span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button key={n.id} onClick={() => go(n.id)} className="di-btn" style={{
                display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                background: active ? T.accentBg : "transparent", color: active ? T.accent : T.text2, fontSize: 12.5, fontWeight: active ? 700 : 500,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? T.accent : T[n.dot], opacity: active ? 1 : 0.5, flexShrink: 0 }} />
                {n.label}
                {n.id === "flags" && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, background: T.redBg, color: T.red, borderRadius: 999, padding: "1px 6px" }}>{DATA.flags.filter((f) => f.sev !== "Ok").length}</span>}
                {n.id === "cold" && DATA.coldDeadlines.length > 0 && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, background: T.redBg, color: T.red, borderRadius: 999, padding: "1px 6px" }}>{DATA.coldDeadlines.length}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{ height: 1, background: T.borderSoft, margin: "10px 8px" }} />
        <button onClick={() => go("ask")} className="di-btn" style={{
          display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
          background: view === "ask" ? T.purpleBg : "transparent", color: view === "ask" ? T.purple : T.text2, fontSize: 12.5, fontWeight: view === "ask" ? 700 : 500,
        }}>
          <Sparkles size={12} style={{ flexShrink: 0 }} />
          Ask Design Intel
        </button>
        <div style={{ marginTop: "auto", padding: "0 8px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => setMode(mode === "light" ? "dark" : "light")} className="di-btn" style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: T.text2, cursor: "pointer" }}>
            {mode === "light" ? <Sun size={12} /> : <Moon size={12} />}
            {mode === "light" ? "Light" : "Dark"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: source === "live" ? T.green : T.amberBar, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: T.text3 }}>{source === "live" ? "Live" : "Demo"} · {updated}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 50, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
            <span style={{ color: T.text3 }}>Design Intel</span>
            <ChevronRight size={12} color={T.text3} />
            <span style={{ fontWeight: 700, color: T.text }}>{VIEW_TITLES[view]}</span>
          </div>
          <button onClick={refresh} className="di-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: T.text2, cursor: "pointer" }}>
            <RefreshCw size={12} className={loading ? "di-spin" : ""} /> Refresh
          </button>
        </div>
        <div key={tick} style={{ flex: 1, overflowY: "auto", padding: 20, minHeight: 0, display: view === "ask" ? "flex" : "block", flexDirection: "column" }}>
          {loading ? <LoadingView T={T} /> : (
            <>
              {view === "coverage" && <CoverageView T={T} onSelect={setSel} />}
              {view === "activity" && <ActivityView T={T} onSelect={setSel} />}
              {view === "tasks" && <TasksView T={T} onSelect={setSel} />}
              {view === "pressure" && <PressureView T={T} onSelect={setSel} />}
              {view === "workload" && <WorkloadView T={T} onSelect={setSel} />}
              {view === "trends" && <TrendsView T={T} />}
              {view === "flags" && <FlagsView T={T} onSelect={setSel} />}
              {view === "cold" && <ColdView T={T} onSelect={setSel} />}
              {view === "ask" && <AskView T={T} messages={askMessages} setMessages={setAskMessages} usedTools={usedTools} setUsedTools={setUsedTools} pendingAsk={pendingAsk} clearPending={() => setPendingAsk(null)} onSelect={setSel} />}
            </>
          )}
        </div>
      </main>

      {/* Detail panel */}
      <aside style={{ width: 292, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.surface, padding: "18px 16px", overflowY: "auto", position: "relative" }}>
        {sel && (
          <button onClick={() => setSel(null)} className="di-btn" style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", cursor: "pointer", color: T.text3, padding: 4 }}>
            <X size={14} />
          </button>
        )}
        {loading ? (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <Skeleton T={T} w={38} h={38} r={19} />
              <div style={{ flex: 1 }}>
                <Skeleton T={T} w="60%" h={13} style={{ marginBottom: 6 }} />
                <Skeleton T={T} w="35%" h={10} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Skeleton T={T} w="50%" h={56} r={10} />
              <Skeleton T={T} w="50%" h={56} r={10} />
            </div>
          </div>
        ) : panel}
      </aside>
    </div>
  );
}


