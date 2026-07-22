"use client";

/* Onboarding — Connect your tools (Step 2 of 3).
   MVP stub: OAuth flows land in Phase 2; buttons currently annotate env config. */

import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { TOKENS } from "@/lib/tokens";

export default function Connect() {
  const T = TOKENS.light;
  const [asana, setAsana] = useState(false);
  return (
    <div style={{ minHeight: "100dvh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", padding: 20 }}>
      <div style={{ width: 460, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, boxShadow: T.shadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, letterSpacing: 0.6 }}>STEP 2 OF 3</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "8px 0 6px" }}>Connect your tools</h1>
        <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.55, margin: 0 }}>
          Design Intel reads activity from Figma and tasks from Asana, then joins them into one operational view. Connect both to continue.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "20px 0" }}>
          <Row T={T} letter="F" name="Figma" desc="Version history, edits & comments" connected />
          <Row T={T} letter="A" name="Asana" desc="Tasks, assignees & due dates" connected={asana} onConnect={() => setAsana(true)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.text3, marginBottom: 18 }}>
          <Lock size={11} /> Read-only access. You can revoke anytime.
        </div>
        <a href="/" style={{ pointerEvents: asana ? "auto" : "none" }}>
          <button disabled={!asana} style={{ width: "100%", background: asana ? T.accent : T.track, color: asana ? "#fff" : T.text3, border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: asana ? "pointer" : "not-allowed" }}>
            {asana ? "Continue" : "Connect Asana to continue"}
          </button>
        </a>
      </div>
    </div>
  );
}

function Row({ T, letter, name, desc, connected, onConnect }: { T: typeof TOKENS.light; letter: string; name: string; desc: string; connected?: boolean; onConnect?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: T.surface2, border: `1px solid ${T.borderSoft}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: T.text }}>{letter}</div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{name}</div>
          <div style={{ fontSize: 11.5, color: T.text3 }}>{desc}</div>
        </div>
      </div>
      {connected ? (
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: T.green }}><Check size={13} /> Connected</span>
      ) : (
        <button onClick={onConnect} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Connect</button>
      )}
    </div>
  );
}
