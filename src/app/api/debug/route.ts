import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

async function probe(label: string, url: string) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch {}
    const markets = Array.isArray(parsed)
      ? parsed
      : (parsed as any)?.markets ?? null;

    return {
      label,
      url,
      status: res.status,
      ok: res.ok,
      count: Array.isArray(markets) ? markets.length : null,
      // Show first 3 markets with their token outcomes
      sample: Array.isArray(markets)
        ? markets.slice(0, 3).map((m: any) => ({
            conditionId: m.conditionId,
            question: m.question?.slice(0, 80),
            outcomes: m.tokens?.map((t: any) => t.outcome),
            tags: m.tags,
            active: m.active,
            closed: m.closed,
          }))
        : text.slice(0, 200),
    };
  } catch (err: any) {
    return { label, url, error: err?.message ?? String(err) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // Test basic connectivity
    probe(
      "no-filter (first 5)",
      `${GAMMA_BASE}/markets?active=true&closed=false&limit=5`
    ),
    // Test tag slugs
    probe(
      "tag=crypto",
      `${GAMMA_BASE}/markets?tag_slug=crypto&active=true&closed=false&limit=5`
    ),
    probe(
      "tag=financials",
      `${GAMMA_BASE}/markets?tag_slug=financials&active=true&closed=false&limit=5`
    ),
    // Look specifically for Up/Down style markets by searching for known tokens
    probe(
      "tag=up-or-down",
      `${GAMMA_BASE}/markets?tag_slug=up-or-down&active=true&closed=false&limit=10`
    ),
    probe(
      "tag=price-movement",
      `${GAMMA_BASE}/markets?tag_slug=price-movement&active=true&closed=false&limit=10`
    ),
  ]);

  return NextResponse.json({ ts: new Date().toISOString(), results }, { status: 200 });
}
