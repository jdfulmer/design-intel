// lib/figma.ts — Figma Activity Logs API client

export interface FigmaEvent {
  id: string;
  timestamp: string; // ISO string
  event_type: string;
  actor: { id: string; name: string; email: string };
  entity?: { id: string; name: string; type: string };
  details?: Record<string, unknown>;
}

interface FigmaActivityResponse {
  error: boolean;
  meta: {
    activity_logs: FigmaEvent[];
    cursor?: string;
    next_page?: boolean;
  };
  status: number;
}

const FIGMA_API = "https://api.figma.com/v1";

function getToken(): string {
  const token = process.env.FIGMA_OAUTH_TOKEN;
  if (!token) throw new Error("FIGMA_OAUTH_TOKEN is not set. Complete the OAuth flow at /api/figma/auth");
  return token;
}

/**
 * Fetch all activity log events for a date range, handling pagination automatically.
 * start/end are Unix timestamps (seconds).
 */
export async function fetchFigmaActivity(
  startTime: number,
  endTime: number,
  eventFilter?: string[]
): Promise<FigmaEvent[]> {
  const token = getToken();
  const events: FigmaEvent[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      limit: "200",
    });
    if (eventFilter?.length) params.set("events", eventFilter.join(","));
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${FIGMA_API}/activity_logs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Figma API error ${res.status}: ${body}`);
    }

    const data: FigmaActivityResponse = await res.json();

    if (data.error) throw new Error("Figma API returned error flag");

    events.push(...data.meta.activity_logs);
    cursor = data.meta.cursor;
    hasMore = data.meta.next_page === true;
  }

  return events;
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/figma/callback`,
    scope: "org:activity_log_read",
    state,
    response_type: "code",
  });
  return `https://www.figma.com/oauth?${params}`;
}

export async function exchangeOAuthCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID!,
      client_secret: process.env.FIGMA_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/figma/callback`,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function refreshOAuthToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://api.figma.com/v1/oauth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID!,
      client_secret: process.env.FIGMA_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}
