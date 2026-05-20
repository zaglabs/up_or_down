import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// Debug endpoint: shows raw Gamma API response to diagnose why markets aren't appearing.
// Hit /api/debug?tag=crypto or /api/debug?q=higher+or+lower in production to see raw data.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") ?? "crypto";
  const q = searchParams.get("q");

  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "10");
  if (q) {
    url.searchParams.set("q", q);
  } else {
    url.searchParams.set("tag_slug", tag);
  }

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    const status = res.status;
    const body = await res.json().catch(() => null);

    const markets = Array.isArray(body) ? body : (body?.markets ?? []);
    const sample = markets.slice(0, 3).map((m: Record<string, unknown>) => ({
      conditionId: m.conditionId,
      question: m.question,
      active: m.active,
      closed: m.closed,
      outcomes: (m.tokens as Array<{ outcome: string; price: number }>)?.map((t) => ({
        outcome: t.outcome,
        price: t.price,
      })),
    }));

    return NextResponse.json({
      url: url.toString(),
      httpStatus: status,
      totalReturned: markets.length,
      sample,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
