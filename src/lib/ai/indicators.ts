import type { MarketPrice } from "@/lib/polymarket/types";

export function parsePrices(history: MarketPrice[]): number[] {
  return history.map((h) => parseFloat(h.p)).filter((p) => !isNaN(p));
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

export function computeEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const emas: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    emas.push(prices[i] * k + emas[i - 1] * (1 - k));
  }
  return emas;
}

export function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function computeMACD(
  prices: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number; signal: number; histogram: number } {
  if (prices.length < slow + signal) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  const fastEma = computeEMA(prices, fast);
  const slowEma = computeEMA(prices, slow);
  const macdLine = fastEma.map((v, i) => v - slowEma[i]).slice(slow - 1);
  const signalLine = computeEMA(macdLine, signal);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
  };
}

export function computeBollingerBands(
  prices: number[],
  period = 20,
  numStdDev = 2
): { upper: number; middle: number; lower: number; position: number } {
  if (prices.length < period) {
    const last = prices[prices.length - 1] ?? 0.5;
    return { upper: last + 0.1, middle: last, lower: last - 0.1, position: 0.5 };
  }
  const slice = prices.slice(-period);
  const middle = mean(slice);
  const std = stdDev(slice);
  const upper = middle + numStdDev * std;
  const lower = middle - numStdDev * std;
  const current = prices[prices.length - 1];
  const range = upper - lower;
  const position = range === 0 ? 0.5 : Math.max(0, Math.min(1, (current - lower) / range));
  return { upper, middle, lower, position };
}

export function computeEMACrossover(prices: number[]): "bullish" | "bearish" | "neutral" {
  if (prices.length < 22) return "neutral";
  const ema9 = computeEMA(prices, 9);
  const ema21 = computeEMA(prices, 21);
  const len = Math.min(ema9.length, ema21.length);
  const curr9 = ema9[len - 1];
  const curr21 = ema21[len - 1];
  const prev9 = ema9[len - 2];
  const prev21 = ema21[len - 2];

  if (prev9 <= prev21 && curr9 > curr21) return "bullish";
  if (prev9 >= prev21 && curr9 < curr21) return "bearish";
  return curr9 > curr21 ? "bullish" : "bearish";
}

export function computeMomentum(prices: number[], period = 5): number {
  if (prices.length < period + 1) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  if (past === 0) return 0;
  return (current - past) / past;
}

export function computeOrderBookImbalance(
  bids: Array<{ price: string; size: string }>,
  asks: Array<{ price: string; size: string }>,
  depth = 5
): number {
  const bidDepth = bids
    .slice(0, depth)
    .reduce((a, b) => a + parseFloat(b.size), 0);
  const askDepth = asks
    .slice(0, depth)
    .reduce((a, b) => a + parseFloat(b.size), 0);
  const total = bidDepth + askDepth;
  if (total === 0) return 0;
  return (bidDepth - askDepth) / total;
}
