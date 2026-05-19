import { NextResponse } from "next/server";
import { buildAndSignOrder, postOrder } from "@/lib/polymarket/order-builder";
import { createOrDeriveApiCreds } from "@/lib/polymarket/clob-auth";
import { getLastTradePrice } from "@/lib/polymarket/clob";
import { fetchMarketByConditionId } from "@/lib/polymarket/gamma";

export const runtime = "nodejs";

// Simple in-memory rate limiter: conditionId → last trade timestamp
const lastTrade = new Map<string, number>();
const LIVE_RATE_LIMIT_MS = 30_000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conditionId, direction, amount, mode } = body as {
      conditionId: string;
      direction: "UP" | "DOWN";
      amount: number;
      mode: "paper" | "live";
    };

    if (!conditionId || !direction || !amount || !mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Paper mode: return success immediately — client state handles it
    if (mode === "paper") {
      const market = await fetchMarketByConditionId(conditionId);
      if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

      const upToken = market.tokens?.find((t) => /^(up|higher|above)/i.test(t.outcome.trim()));
      const downToken = market.tokens?.find((t) => /^(down|lower|below)/i.test(t.outcome.trim()));
      const token = direction === "UP" ? upToken : downToken;

      if (!token) return NextResponse.json({ error: "Token not found" }, { status: 400 });

      const price = await getLastTradePrice(token.tokenId);
      return NextResponse.json({ success: true, tokenId: token.tokenId, price, mode: "paper" });
    }

    // Live mode safety checks
    if (process.env.LIVE_MODE_ENABLED !== "true") {
      return NextResponse.json({ error: "Live mode is not enabled" }, { status: 403 });
    }

    const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Wallet not configured" }, { status: 403 });
    }

    const maxAmount = parseFloat(process.env.LIVE_MAX_TRADE_USDC ?? "10");
    if (amount > maxAmount) {
      return NextResponse.json({ error: `Max trade size is $${maxAmount} USDC` }, { status: 400 });
    }

    // Rate limit
    const lastTradeTime = lastTrade.get(conditionId) ?? 0;
    if (Date.now() - lastTradeTime < LIVE_RATE_LIMIT_MS) {
      return NextResponse.json({ error: "Rate limit: wait 30s between trades on same market" }, { status: 429 });
    }

    const market = await fetchMarketByConditionId(conditionId);
    if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

    const upToken = market.tokens?.find((t) => /^(up|higher|above)/i.test(t.outcome.trim()));
    const downToken = market.tokens?.find((t) => /^(down|lower|below)/i.test(t.outcome.trim()));
    const token = direction === "UP" ? upToken : downToken;

    if (!token) return NextResponse.json({ error: "Token not found" }, { status: 400 });

    const currentPrice = await getLastTradePrice(token.tokenId);

    const creds = await createOrDeriveApiCreds(privateKey);
    const signedOrder = await buildAndSignOrder({
      privateKey,
      tokenId: token.tokenId,
      side: "BUY",
      price: currentPrice,
      size: amount,
      negRisk: market.negRisk,
    });

    const result = await postOrder(signedOrder, creds, "GTC");

    if (result.success) {
      lastTrade.set(conditionId, Date.now());
      console.error(`[LIVE TRADE] ${direction} ${amount} USDC on ${conditionId} @ ${currentPrice} | orderId: ${result.orderId}`);
    }

    return NextResponse.json({ ...result, mode: "live", price: currentPrice });
  } catch (err) {
    console.error("Trade API error:", err);
    return NextResponse.json({ error: "Trade execution failed" }, { status: 500 });
  }
}
