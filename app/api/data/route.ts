// app/api/data/route.ts
// Server-side proxy that adds the API_SECRET header so the bearer token
// is never exposed to browser clients.  The dashboard is already behind
// password middleware, so this route itself does not require auth.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SOURCE_TO_PATH: Record<string, string> = {
  figma: "/api/figma",
  "figma-sync": "/api/figma/sync",
  asana: "/api/asana",
  completed: "/api/asana",
  snapshots: "/api/snapshots",
  cache: "/api/cache",
  "cache-bust": "/api/cache",
};

function buildInternalUrl(req: NextRequest, source: string): string {
  const basePath = SOURCE_TO_PATH[source];
  if (!basePath) throw new Error(`Unknown source: ${source}`);

  const origin = req.nextUrl.origin;
  const url = new URL(basePath, origin);

  // Forward relevant query params
  const { searchParams } = req.nextUrl;

  if (searchParams.has("force")) {
    url.searchParams.set("force", searchParams.get("force")!);
  }
  if (searchParams.has("modified_since")) {
    url.searchParams.set("modified_since", searchParams.get("modified_since")!);
  }
  if (searchParams.has("include_completed")) {
    url.searchParams.set("include_completed", searchParams.get("include_completed")!);
  }

  return url.toString();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const source = req.nextUrl.searchParams.get("source");
  if (!source || !SOURCE_TO_PATH[source]) {
    return NextResponse.json(
      { error: `Invalid or missing "source" param. Expected: ${Object.keys(SOURCE_TO_PATH).join(", ")}` },
      { status: 400 },
    );
  }

  const secret = process.env.API_SECRET;
  const headers: HeadersInit = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const url = buildInternalUrl(req, source);

  // For the "completed" source, ensure include_completed is set
  if (source === "completed") {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("include_completed")) {
      parsed.searchParams.set("include_completed", "30d");
    }
    const res = await fetch(parsed.toString(), { headers });
    return new NextResponse(res.body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  }

  const res = await fetch(url, { headers });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const source = req.nextUrl.searchParams.get("source");
  if (source !== "figma-sync") {
    return NextResponse.json(
      { error: `POST only supports source=figma-sync` },
      { status: 400 },
    );
  }

  const secret = process.env.API_SECRET;
  const headers: HeadersInit = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const url = buildInternalUrl(req, source);
  const res = await fetch(url, { method: "POST", headers });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const source = req.nextUrl.searchParams.get("source");
  if (source !== "cache-bust") {
    return NextResponse.json(
      { error: `DELETE only supports source=cache-bust` },
      { status: 400 },
    );
  }

  const secret = process.env.API_SECRET;
  const headers: HeadersInit = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  const origin = req.nextUrl.origin;
  const url = new URL("/api/cache", origin).toString();

  const res = await fetch(url, { method: "DELETE", headers });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
