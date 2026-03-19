"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BLUE = "#0D99FF";
const RED = "#F24822";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.di-login {
  --di-bg: #FFFFFF;
  --di-surface: #F5F5F5;
  --di-border: #E6E6E6;
  --di-text: #000000E5;
  --di-text-secondary: #0000004D;
  --di-input-bg: #FFFFFF;
}

.di-login[data-theme="dark"] {
  --di-bg: #1E1E1E;
  --di-surface: #2C2C2C;
  --di-border: #333333;
  --di-text: #FFFFFFE5;
  --di-text-secondary: rgba(255,255,255,0.4);
  --di-input-bg: #1E1E1E;
}
`;

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
      background: "var(--di-surface)", borderRadius: 12, padding: 32,
      width: 340, border: "1px solid var(--di-border)",
      display: "flex", flexDirection: "column", gap: 20,
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <svg width="20" height="20" viewBox="0 0 38 57" fill="none">
          <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/>
          <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83"/>
          <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262"/>
          <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/>
          <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/>
        </svg>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--di-text)" }}>Design Intel</span>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--di-text-secondary)", display: "block", marginBottom: 6 }}>
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
            border: `1px solid ${error ? RED : "var(--di-border)"}`,
            background: "var(--di-input-bg)", color: "var(--di-text)", fontSize: 14, fontFamily: FONT,
            outline: "none", transition: "border-color 160ms ease-out",
            boxSizing: "border-box",
          }}
          onFocus={e => { if (!error) e.currentTarget.style.borderColor = BLUE; }}
          onBlur={e => { if (!error) e.currentTarget.style.borderColor = "var(--di-border)"; }}
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
        transition: "opacity 160ms ease-out",
      }}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const saved = localStorage.getItem("di-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  return (
    <div className="di-login" data-theme={theme} style={{
      minHeight: "100dvh", background: "var(--di-bg)", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: FONT,
    }}>
      <style>{THEME_CSS}</style>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
