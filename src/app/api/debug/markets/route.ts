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

async function fetchTopVolume() {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");
  url.searchParams.set("limit", "20");

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return { source: "top-volume", error: `HTTP ${res.status}`, markets: [] };
    const data = await res.json();
    const markets = Array.isArray(data) ? data : (data.markets ?? []);
    return {
      source: "top-volume",
      total: markets.length,
      markets: markets.slice(0, 20).map((m: any) => ({
        conditionId: m.conditionId,
        question: m.question,
        tags: m.tags,
        category: m.category,
        tokens: (m.tokens ?? []).map((t: any) => ({ outcome: t.outcome, price: t.price })),
      })),
    };
  } catch (e: any) {
    return { source: "top-volume", error: String(e?.message), markets: [] };
  }
}

async function fetchEndingSoon() {
  const url = new URL(`${GAMMA_BASE}/markets`);
  const endMax = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("end_date_max", endMax);
  url.searchParams.set("order", "endDate");
  url.searchParams.set("ascending", "true");
  url.searchParams.set("limit", "20");

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return { source: "ending-soon-6h", error: `HTTP ${res.status}`, markets: [] };
    const data = await res.json();
    const markets = Array.isArray(data) ? data : (data.markets ?? []);
    return {
      source: "ending-soon-6h",
      total: markets.length,
      markets: markets.slice(0, 20).map((m: any) => ({
        conditionId: m.conditionId,
        question: m.question,
        endDate: m.endDate ?? m.endDateIso,
        tokens: (m.tokens ?? []).map((t: any) => ({ outcome: t.outcome, price: t.price })),
      })),
    };
  } catch (e: any) {
    return { source: "ending-soon-6h", error: String(e?.message), markets: [] };
  }
}

export async function GET() {
  const slugs = [
    "crypto",
    "cryptocurrency",
    "crypto-prices",
    "bitcoin",
    "ethereum",
    "price-prediction",
    "financials",
    "economics",
    "forex",
    "stocks",
  ];

  const [tagResults, topVolume, endingSoon] = await Promise.all([
    Promise.all(slugs.map(fetchRaw)),
    fetchTopVolume(),
    fetchEndingSoon(),
  ]);

  return NextResponse.json(
    { fetched_at: new Date().toISOString(), tagResults, topVolume, endingSoon },
    { headers: { "Cache-Control": "no-store" } }
  );
}
