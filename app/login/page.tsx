"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BG = "#1E1E1E";
const SURFACE = "#2C2C2C";
const DIVIDER = "#333333";
const BLUE = "#0D99FF";
const RED = "#F24822";
const T1 = "#FFFFFF";
const T3 = "rgba(255,255,255,0.4)";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const from = searchParams.get("from") ?? "/";
        router.push(from);
        router.refresh();
      } else {
        setError("Wrong password");
        setPassword("");
      }
    } catch {
      setError("Connection failed");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: SURFACE, borderRadius: 12, padding: 32,
      width: 340, border: `1px solid ${DIVIDER}`,
      display: "flex", flexDirection: "column", gap: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <svg width="20" height="20" viewBox="0 0 38 57" fill="none">
          <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/>
          <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83"/>
          <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262"/>
          <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/>
          <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/>
        </svg>
        <span style={{ fontSize: 16, fontWeight: 600, color: T1 }}>Design Intel</span>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: T3, display: "block", marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          placeholder="Enter dashboard password"
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 6,
            border: `1px solid ${error ? RED : DIVIDER}`,
            background: BG, color: T1, fontSize: 14, fontFamily: FONT,
            outline: "none", transition: "border-color 0.15s",
            boxSizing: "border-box",
          }}
          onFocus={e => { if (!error) e.currentTarget.style.borderColor = BLUE; }}
          onBlur={e => { if (!error) e.currentTarget.style.borderColor = DIVIDER; }}
        />
        {error && (
          <div style={{ fontSize: 12, color: RED, marginTop: 6, fontWeight: 500 }}>{error}</div>
        )}
      </div>

      <button type="submit" disabled={loading || !password} style={{
        background: BLUE, color: "#fff", border: "none", borderRadius: 6,
        padding: "10px 16px", fontSize: 14, fontWeight: 600, fontFamily: FONT,
        cursor: loading || !password ? "not-allowed" : "pointer",
        opacity: loading || !password ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100dvh", background: BG, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: FONT,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
