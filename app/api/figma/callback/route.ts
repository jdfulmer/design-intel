// app/api/figma/callback/route.ts
// GET /api/figma/callback?code=<code>&state=<state>
// Exchanges the OAuth code for tokens and displays them for manual env var storage.
// This is a one-time admin flow — tokens are shown once and must be saved to .env / Vercel env vars.

import { NextRequest, NextResponse } from "next/server";
import { exchangeOAuthCode } from "@/lib/figma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `<html><body><h2>OAuth Error</h2><pre>${error}: ${searchParams.get("error_description")}</pre></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return NextResponse.json({ error: "No code in callback" }, { status: 400 });
  }

  try {
    const tokens = await exchangeOAuthCode(code);

    // Display tokens for manual copy to env vars — never log to console in prod
    const html = `
<!DOCTYPE html>
<html>
<head><title>Figma OAuth — Design Intel</title>
<style>
  body { font-family: monospace; background: #0a0f0d; color: #e2e8e4; padding: 40px; }
  h2 { color: #10b981; }
  .token { background: #111815; border: 1px solid #1e2d26; padding: 16px; border-radius: 8px; margin: 12px 0; word-break: break-all; }
  .label { color: #6b8c7a; font-size: 12px; margin-bottom: 4px; }
  .warn { color: #f59e0b; margin-top: 24px; }
  .value { color: #34d399; }
</style>
</head>
<body>
  <h2>✓ Figma OAuth successful</h2>
  <p>Copy these values into your <code>.env.local</code> and Vercel environment variables, then dismiss this page.</p>

  <div class="token">
    <div class="label">FIGMA_OAUTH_TOKEN</div>
    <div class="value">${tokens.access_token}</div>
  </div>

  <div class="token">
    <div class="label">FIGMA_OAUTH_REFRESH_TOKEN</div>
    <div class="value">${tokens.refresh_token}</div>
  </div>

  <div class="token">
    <div class="label">Expires in</div>
    <div class="value">${tokens.expires_in} seconds (~${Math.round(tokens.expires_in / 3600)} hours)</div>
  </div>

  <p class="warn">⚠ This page will not show these tokens again. Save them now.</p>
</body>
</html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
