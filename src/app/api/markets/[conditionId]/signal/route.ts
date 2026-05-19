import { NextResponse } from "next/server";
import { getPricesHistory, getOrderBook } from "@/lib/polymarket/clob";
import { fetchMarketByConditionId } from "@/lib/polymarket/gamma";
import { computeTechnicalSignal, buildDefaultReasoning } from "@/lib/ai/signal-engine";
import { runAIProvider, getActiveProvider } from "@/lib/ai/providers";
import type { AISignal, GammaMarket } from "@/lib/polymarket/types";

export const runtime = "nodejs";

function parseUpPrice(market: GammaMarket): number {
  const upToken = market.tokens?.find((t) => /^(up|higher|above)/i.test(t.outcome.trim()));
  if (upToken?.price) return upToken.price;
  try {
    const prices = JSON.parse(market.outcomePrices || "[]");
    return parseFloat(prices[0] ?? "0.5");
  } catch {
    return 0.5;
  }
}

function parseAsset(question: string): string {
  const m = question.match(/\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|XRP|bitcoin|ethereum|solana)\b/i);
  return m ? m[1].toUpperCase() : "ASSET";
}

function parsePeriod(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("5 min")) return "5 minutes";
  if (q.includes("15 min")) return "15 minutes";
  if (q.includes("1 hour") || q.includes("hourly")) return "1 hour";
  if (q.includes("6 hour")) return "6 hours";
  if (q.includes("daily") || q.includes("1 day")) return "1 day";
  return "1 day";
}

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
    if (!upToken) {
      return NextResponse.json({ error: "Not an up/down market" }, { status: 400 });
    }

    // Fetch data in parallel
    const [priceHistory, orderBook] = await Promise.all([
      getPricesHistory({ tokenId: upToken.tokenId, interval: "1d", fidelity: 10 }),
      getOrderBook(upToken.tokenId),
    ]);

    const upPrice = parseUpPrice(market);
    const technical = computeTechnicalSignal({ priceHistory, orderBook, upPrice });

    const activeProvider = getActiveProvider();
    let direction = technical.direction;
    let confidence = technical.confidence;
    let reasoning = buildDefaultReasoning(direction, confidence, technical.indicators);

    // Try AI provider for reasoning (non-blocking failure)
    try {
      const aiResult = await runAIProvider(activeProvider, {
        asset: parseAsset(market.question),
        period: parsePeriod(market.question),
        upPrice,
        rsi: technical.indicators.rsi.value,
        macdHistogram: technical.indicators.macd.value,
        bollingerPosition: technical.indicators.bollinger.value,
        momentum: technical.indicators.momentum.value,
        obImbalance: technical.indicators.orderBookImbalance.value,
        technicalDirection: technical.direction,
        technicalConfidence: technical.confidence,
      });

      direction = aiResult.direction;
      confidence = aiResult.confidence;
      if (aiResult.reasoning) reasoning = aiResult.reasoning;
    } catch (err) {
      console.warn(`AI provider (${activeProvider}) failed, using technical signal:`, err);
    }

    const signal: AISignal = {
      direction,
      confidence,
      reasoning,
      indicators: technical.indicators,
      provider: activeProvider,
      computedAt: Date.now(),
    };

    return NextResponse.json(signal, {
      headers: { "Cache-Control": "s-maxage=25, stale-while-revalidate=10" },
    });
  } catch (err) {
    console.error("Signal API error:", err);
    return NextResponse.json({ error: "Failed to compute signal" }, { status: 500 });
  }
}
