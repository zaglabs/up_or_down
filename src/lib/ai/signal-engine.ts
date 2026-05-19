import type { AISignal, MarketPrice, OrderBookSummary, IndicatorSignal, TradeDirection } from "@/lib/polymarket/types";
import {
  parsePrices,
  computeRSI,
  computeMACD,
  computeBollingerBands,
  computeEMACrossover,
  computeMomentum,
  computeOrderBookImbalance,
} from "./indicators";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scoreToSignal(score: number): "UP" | "DOWN" | "NEUTRAL" {
  if (score > 0.1) return "UP";
  if (score < -0.1) return "DOWN";
  return "NEUTRAL";
}

function makeIndicator(value: number, rawScore: number, weight: number): IndicatorSignal {
  return { value, signal: scoreToSignal(rawScore), weight };
}

interface SignalInputs {
  priceHistory: MarketPrice[];
  orderBook: OrderBookSummary | null;
  upPrice: number;
}

export interface TechnicalResult {
  direction: TradeDirection;
  confidence: number;
  indicators: AISignal["indicators"];
  rawScore: number;
}

export function computeTechnicalSignal(inputs: SignalInputs): TechnicalResult {
  const prices = parsePrices(inputs.priceHistory);
  const ob = inputs.orderBook;
  const upPrice = inputs.upPrice;

  // --- RSI ---
  const rsiVal = computeRSI(prices);
  const rsiScore = clamp((50 - rsiVal) / 50, -1, 1);

  // --- MACD ---
  const { histogram } = computeMACD(prices);
  const macdScore = clamp(Math.tanh(histogram * 50), -1, 1);

  // --- Bollinger ---
  const { position } = computeBollingerBands(prices);
  const bbScore = clamp((0.5 - position) * 2, -1, 1);

  // --- EMA Crossover ---
  const crossover = computeEMACrossover(prices);
  const emaScore = crossover === "bullish" ? 1 : crossover === "bearish" ? -1 : 0;

  // --- Momentum ---
  const momVal = computeMomentum(prices);
  const momScore = clamp(Math.tanh(momVal * 20), -1, 1);

  // --- Order Book Imbalance ---
  let obScore = 0;
  let obImbalance = 0;
  if (ob && ob.bids && ob.asks) {
    obImbalance = computeOrderBookImbalance(ob.bids, ob.asks);
    obScore = clamp(obImbalance, -1, 1);
  }

  // --- Implied Probability Mean Reversion ---
  let probScore = 0;
  if (upPrice < 0.35) probScore = 0.8;
  else if (upPrice > 0.65) probScore = -0.8;
  else if (upPrice < 0.45) probScore = 0.3;
  else if (upPrice > 0.55) probScore = -0.3;

  // Weighted sum
  const weights = {
    rsi: 0.15,
    macd: 0.20,
    bollinger: 0.15,
    ema: 0.15,
    momentum: 0.10,
    obImbalance: 0.15,
    probReversion: 0.10,
  };

  const rawScore =
    weights.rsi * rsiScore +
    weights.macd * macdScore +
    weights.bollinger * bbScore +
    weights.ema * emaScore +
    weights.momentum * momScore +
    weights.obImbalance * obScore +
    weights.probReversion * probScore;

  const direction: TradeDirection = rawScore >= 0 ? "UP" : "DOWN";
  const confidence = Math.round(Math.abs(rawScore) * 100);

  return {
    direction,
    confidence: Math.min(99, confidence),
    rawScore,
    indicators: {
      rsi: makeIndicator(rsiVal, rsiScore, weights.rsi),
      macd: makeIndicator(histogram, macdScore, weights.macd),
      bollinger: makeIndicator(position, bbScore, weights.bollinger),
      emaCrossover: makeIndicator(emaScore, emaScore, weights.ema),
      momentum: makeIndicator(momVal, momScore, weights.momentum),
      orderBookImbalance: makeIndicator(obImbalance, obScore, weights.obImbalance),
      impliedProbReversion: makeIndicator(upPrice, probScore, weights.probReversion),
    },
  };
}

export function buildDefaultReasoning(
  direction: TradeDirection,
  confidence: number,
  indicators: AISignal["indicators"]
): string {
  const topSignal = Object.entries(indicators)
    .sort((a, b) => Math.abs(b[1].value) - Math.abs(a[1].value))[0];

  const dirText = direction === "UP" ? "bullish" : "bearish";
  const confText = confidence > 70 ? "strong" : confidence > 50 ? "moderate" : "weak";

  return `Technical analysis shows a ${confText} ${dirText} signal at ${confidence}% confidence. The primary driver is the ${topSignal[0].replace(/([A-Z])/g, " $1").toLowerCase()} indicator, with supporting signals from MACD and order book depth.`;
}
