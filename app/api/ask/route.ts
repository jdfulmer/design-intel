import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getData } from "@/lib/aggregate";

const BodySchema = z.object({ question: z.string().min(1).max(500) });

const SYSTEM = `You are Ask Design Intel, the AI query layer of a design-operations dashboard that joins Figma activity with task data. Answer questions about the team's activity, tasks, pressure, workload, trends, and flags using ONLY the dataset provided. Be concise (2-3 sentences), specific, and cite numbers. Never invent data.

Respond ONLY with valid JSON, no markdown fences, in this exact shape:
{"answer": "string", "tools": ["get_workload()"], "entities": [{"initials": "VH", "name": "Vincent Herrera", "meta": "9 open tasks", "tag": "Overloaded", "tone": "red"}]}

"tools" = 1-3 names from: get_activity(), get_tasks(), get_pressure_index(), get_workload(), get_flags().
"entities" = 0-3 people/clients/files central to the answer. tone is one of: red, amber, green, accent.`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send { question: string }" }, { status: 400 });

  const { data: DATA } = await getData();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM,
      messages: [{ role: "user", content: `DATASET:\n${JSON.stringify(DATA)}\n\nQUESTION: ${parsed.data.question}` }],
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  const raw = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");

  try {
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ answer: raw, tools: [], entities: [] });
  }
}
