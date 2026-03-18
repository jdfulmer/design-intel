// mcp/src/services/format.ts — shared response formatting

import { MAX_RESPONSE_CHARS } from "../constants.js";

/** Truncate a string to MAX_RESPONSE_CHARS with a clear message */
export function truncate(text: string): string {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return text.slice(0, MAX_RESPONSE_CHARS) +
    `\n\n[Truncated — ${text.length - MAX_RESPONSE_CHARS} chars omitted. Use filters to narrow results.]`;
}

/** Format a number as a compact string: 1234 → "1,234" */
export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format a ratio with × suffix, or "—" if null */
export function fmtRatio(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}×`;
}

/** Format an ISO date string as YYYY-MM-DD */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/** Markdown table from headers + rows */
export function mdTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep  = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map(r => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

/** Pressure level label */
export function pressureLabel(score: number): string {
  if (score >= 15) return "🔴 HIGH";
  if (score >= 8)  return "🟡 MED";
  return "🟢 LOW";
}

/** Efficiency status label */
export function efficiencyLabel(ratio: number | null): string {
  if (ratio === null) return "—";
  if (ratio >= 3)  return "✅ High";
  if (ratio >= 1)  return "🟡 On track";
  return "🔴 Behind";
}
