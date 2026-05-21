import { NextResponse } from "next/server";
import { fetchUpDownMarkets } from "@/lib/polymarket/gamma";
import type { MarketCategory } from "@/lib/polymarket/types";

export const runtime = "nodejs";
export const revalidate = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as MarketCategory | null;

  try {
    const markets = await fetchUpDownMarkets(category ?? undefined);
    console.log(`[markets] ${markets.length} up/down markets returned (category=${category ?? "all"})`);
    return NextResponse.json(markets, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("Markets API error:", err);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
