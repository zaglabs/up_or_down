import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const SignalSchema = z.object({
  type: z.literal("signal"),
  conditionId: z.string(),
  question: z.string(),
  asset: z.string(),
  direction: z.string(),
  confidence: z.number().int(),
  provider: z.string(),
  reasoning: z.string().optional(),
  indicators: z.unknown().optional(),
  latencyMs: z.number().int().optional(),
  userId: z.string().optional(),
});

const ApiSchema = z.object({
  type: z.literal("api"),
  service: z.string(),
  endpoint: z.string(),
  statusCode: z.number().int(),
  latencyMs: z.number().int(),
  error: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();

  if (body.type === "signal") {
    const parsed = SignalSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid signal payload" }, { status: 400 });
    const { type: _, ...data } = parsed.data;
    await db.signalLog.create({ data: { ...data, indicators: data.indicators as object ?? undefined } });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (body.type === "api") {
    const parsed = ApiSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid api log payload" }, { status: 400 });
    const { type: _, ...data } = parsed.data;
    await db.apiLog.create({ data });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown log type" }, { status: 400 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "signal";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);

  if (type === "signal") {
    const rows = await db.signalLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return NextResponse.json(rows);
  }
  if (type === "api") {
    const rows = await db.apiLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return NextResponse.json(rows);
  }
  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
