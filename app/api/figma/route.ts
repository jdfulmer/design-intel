// app/api/figma/route.ts
// GET /api/figma — returns cached Figma data from KV (populated by /api/figma/sync)

import { NextRequest, NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache";
import { requireApiSecret } from "@/lib/auth";
import type { FigmaDesignerActivity } from "@/lib/figma";

export const runtime = "nodejs";

interface FigmaFileStats {
  name: string;
  project: string;
  edits: number;
  comments: number;
  designers: string[];
  lastModified: string;
}

interface SyncResult {
  data: FigmaDesignerActivity[];
  files?: FigmaFileStats[];
  syncedAt: string;
  startTime: number;
  endTime: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = requireApiSecret(req);
  if (guard) return guard;

  const cached = await cacheGet<SyncResult>("figma:latest-sync");

  if (cached) {
    return NextResponse.json({
      data: cached.data,
      files: cached.files ?? [],
      source: "cache",
      syncedAt: cached.syncedAt,
    });
  }

  return NextResponse.json({
    data: [],
    source: "empty",
    message: "No cached data. Run POST /api/figma/sync to populate.",
  });
}
