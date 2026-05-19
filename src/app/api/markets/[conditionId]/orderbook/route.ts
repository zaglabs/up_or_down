import { NextResponse } from "next/server";
import { getOrderBooks } from "@/lib/polymarket/clob";
import { fetchMarketByConditionId } from "@/lib/polymarket/gamma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { conditionId: string } }
) {
  const { conditionId } = params;

  try {
    const market = await fetchMarketByConditionId(conditionId);
    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const upToken = market.tokens?.find((t) => /^(up|higher|above)/i.test(t.outcome.trim()));
    const downToken = market.tokens?.find((t) => /^(down|lower|below)/i.test(t.outcome.trim()));

    if (!upToken || !downToken) {
      return NextResponse.json({ error: "Not an up/down market" }, { status: 400 });
    }

    const [upBook, downBook] = await getOrderBooks([upToken.tokenId, downToken.tokenId]);

    return NextResponse.json({ up: upBook ?? null, down: downBook ?? null });
  } catch (err) {
    console.error("Orderbook API error:", err);
    return NextResponse.json({ error: "Failed to fetch orderbook" }, { status: 500 });
  }
}
