"use client";
// app/dashboard.tsx
// Wraps the V2 dashboard. On load, fetches from /api/figma + /api/asana.
// Falls back to manual CSV import if API fetch fails or returns no data.

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataSource {
  figmaEvents: unknown[] | null;   // raw Figma activity log events
  asanaTasks: unknown[] | null;    // raw Asana tasks
  figmaFiles: string[];
  asanaFiles: string[];
  lastFetched: { figma: string | null; asana: string | null };
  mode: "api" | "csv" | "mixed" | "empty";
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BG     = "#0a0f0d";
const ACCENT = "#10b981";
const MUTED  = "#6b8c7a";
const TEXT   = "#e2e8e4";
const BORDER = "#1e2d26";
const WARN   = "#f59e0b";
const DANGER = "#ef4444";

// ── Dashboard shell ───────────────────────────────────────────────────────────

export default function DesignIntelDashboard() {
  const [source, setSource] = useState<DataSource>({
    figmaEvents: null,
    asanaTasks: null,
    figmaFiles: [],
    asanaFiles: [],
    lastFetched: { figma: null, asana: null },
    mode: "empty",
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch from API routes ──────────────────────────────────────────────────
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
        ? (await figmaRes.value.json()).data
        : null;

      const asanaData = asanaRes.status === "fulfilled" && asanaRes.value.ok
        ? (await asanaRes.value.json()).data
        : null;

      const cacheData = cacheRes.status === "fulfilled" && cacheRes.value.ok
        ? await cacheRes.value.json()
        : null;

      if (!figmaData && !asanaData) {
        setApiError("API routes returned no data. Check that env vars are set in Vercel.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setSource(prev => ({
        ...prev,
        figmaEvents: figmaData ?? prev.figmaEvents,
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
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setApiError(msg);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFromApi(); }, [fetchFromApi]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", background: BG, display: "flex",
        alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}>
        <div style={{
          width: 32, height: 32, border: `2px solid ${BORDER}`,
          borderTopColor: ACCENT, borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ color: MUTED, fontSize: 13 }}>Fetching live data…</div>
      </div>
    );
  }

  // Pass everything into the actual dashboard JSX (imported below)
  return (
    <DashboardCore
      initialFigmaEvents={source.figmaEvents}
      initialAsanaTasks={source.asanaTasks}
      figmaFileNames={source.figmaFiles}
      asanaFileNames={source.asanaFiles}
      lastFetched={source.lastFetched}
      apiError={apiError}
      refreshing={refreshing}
      onRefresh={() => fetchFromApi(true)}
    />
  );
}

// ── Minimal status bar injected into the dashboard ───────────────────────────
// The full DashboardCore component lives in dashboard-core.tsx and is the
// converted V2 JSX. This file handles the data plumbing layer only.

function DashboardCore({
  initialFigmaEvents,
  initialAsanaTasks,
  figmaFileNames,
  asanaFileNames,
  lastFetched,
  apiError,
  refreshing,
  onRefresh,
}: {
  initialFigmaEvents: unknown[] | null;
  initialAsanaTasks: unknown[] | null;
  figmaFileNames: string[];
  asanaFileNames: string[];
  lastFetched: { figma: string | null; asana: string | null };
  apiError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const hasLiveData = figmaFileNames.some(f => f.startsWith("Live"));

  return (
    <div style={{ minHeight: "100dvh", background: BG, fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ── API status banner ── */}
      {(apiError || hasLiveData) && (
        <div style={{
          background: apiError ? "#2d0a0a" : "#0d1f14",
          borderBottom: `1px solid ${apiError ? "#7c1d1d" : "#1e3d26"}`,
          padding: "8px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: apiError ? DANGER : ACCENT,
              boxShadow: apiError ? "none" : `0 0 6px ${ACCENT}`,
            }} />
            <span style={{ color: apiError ? DANGER : ACCENT, fontWeight: 600 }}>
              {apiError ? "API Error" : "Live data"}
            </span>
            {!apiError && lastFetched.figma && (
              <span style={{ color: MUTED }}>
                Figma: {new Date(lastFetched.figma).toLocaleTimeString()}
              </span>
            )}
            {!apiError && lastFetched.asana && (
              <span style={{ color: MUTED }}>
                Asana: {new Date(lastFetched.asana).toLocaleTimeString()}
              </span>
            )}
            {apiError && (
              <span style={{ color: "#fca5a5", fontSize: 11 }}>{apiError}</span>
            )}
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              background: "transparent", border: `1px solid ${BORDER}`,
              color: refreshing ? MUTED : TEXT, borderRadius: 7,
              padding: "4px 12px", fontSize: 11, cursor: refreshing ? "not-allowed" : "pointer",
              fontWeight: 500,
            }}
          >
            {refreshing ? "Refreshing…" : "↺ Refresh now"}
          </button>
        </div>
      )}

      {/* ── Dashboard body ── */}
      {/* NOTE: The full V2 dashboard JSX (from design-intel-dashboard.jsx)   */}
      {/*   is imported here once it's converted to dashboard-core.tsx.       */}
      {/*   For now, render a clear status so the scaffold is visually useful */}
      <div style={{ padding: "48px 28px", textAlign: "center" }}>
        <div style={{ color: ACCENT, fontSize: 32, marginBottom: 16 }}>⬡</div>
        <div style={{ color: TEXT, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Design Intel — API Backend Ready
        </div>
        <div style={{ color: MUTED, fontSize: 14, lineHeight: 1.8, maxWidth: 520, margin: "0 auto" }}>
          {initialFigmaEvents
            ? `✓ Figma: ${(initialFigmaEvents as unknown[]).length.toLocaleString()} events loaded`
            : "⚠ Figma data not yet available — set FIGMA_OAUTH_TOKEN and complete /api/figma/auth"}
          <br />
          {initialAsanaTasks
            ? `✓ Asana: ${(initialAsanaTasks as unknown[]).length.toLocaleString()} tasks loaded`
            : "⚠ Asana data not yet available — set ASANA_PAT and ASANA_WORKSPACE_GID"}
          <br /><br />
          <span style={{ color: MUTED, fontSize: 12 }}>
            Next step: copy the V2 dashboard JSX into <code>app/dashboard-core.tsx</code>
            and wire <code>initialFigmaEvents</code> / <code>initialAsanaTasks</code> as props.
          </span>
        </div>
      </div>

    </div>
  );
}
