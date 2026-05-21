/**
 * Debug endpoint — visit /api/debug/markets in the browser.
 * Returns raw Gamma API data so the exact token names and question
 * formats can be inspected and used to fix the parser.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

async function fetchRaw(tagSlug: string) {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("tag_slug", tagSlug);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "30");

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return { slug: tagSlug, error: `HTTP ${res.status}`, markets: [] };
    const data = await res.json();
    const markets = Array.isArray(data) ? data : (data.markets ?? []);
    return {
      slug: tagSlug,
      total: markets.length,
      // Return trimmed snapshots — just the fields we care about for diagnosis
      markets: markets.slice(0, 10).map((m: any) => ({
        conditionId: m.conditionId,
        question: m.question,
        tags: m.tags,
        category: m.category,
        active: m.active,
        closed: m.closed,
        startDate: m.startDate,
        endDate: m.endDate ?? m.endDateIso,
        tokens: (m.tokens ?? []).map((t: any) => ({
          outcome: t.outcome,
          price: t.price,
        })),
        outcomePrices: m.outcomePrices,
      })),
    };
  } catch (e: any) {
    return { slug: tagSlug, error: String(e?.message), markets: [] };
  }
}

export async function GET() {
  const slugs = [
    "crypto",
    "cryptocurrency",
    "crypto-prices",
    "financials",
    "economics",
    "forex",
  ];

  const results = await Promise.all(slugs.map(fetchRaw));

  return NextResponse.json(
    { fetched_at: new Date().toISOString(), results },
    { headers: { "Cache-Control": "no-store" } }
  );
}
