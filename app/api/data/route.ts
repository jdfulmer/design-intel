import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/aggregate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const entry = await getData(force);
  return NextResponse.json({ source: entry.source, at: entry.at, note: entry.note ?? null, data: entry.data });
}
