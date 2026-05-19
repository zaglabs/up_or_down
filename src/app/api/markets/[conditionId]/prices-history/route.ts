import { NextResponse } from "next/server";
import { getPricesHistory } from "@/lib/polymarket/clob";
import type { PriceHistoryInterval } from "@/lib/polymarket/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { conditionId: string } }
) {
  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get("tokenId");
  const interval = (searchParams.get("interval") ?? "1d") as PriceHistoryInterval;
  const fidelity = parseInt(searchParams.get("fidelity") ?? "10");

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 });
  }

  try {
    const history = await getPricesHistory({ tokenId, interval, fidelity });
    return NextResponse.json(history);
  } catch (err) {
    console.error("Prices history API error:", err);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
