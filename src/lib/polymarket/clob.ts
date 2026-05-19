import type { OrderBookSummary, MarketPrice, PriceHistoryInterval } from "./types";

export const CLOB_BASE = "https://clob.polymarket.com";

export async function getOrderBook(tokenId: string): Promise<OrderBookSummary | null> {
  try {
    const res = await fetch(`${CLOB_BASE}/book?token_id=${tokenId}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getOrderBooks(tokenIds: string[]): Promise<OrderBookSummary[]> {
  const results = await Promise.allSettled(tokenIds.map(getOrderBook));
  return results
    .filter((r): r is PromiseFulfilledResult<OrderBookSummary> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);
}

export async function getPricesHistory(params: {
  tokenId: string;
  interval?: PriceHistoryInterval;
  fidelity?: number;
}): Promise<MarketPrice[]> {
  const { tokenId, interval = "1d", fidelity = 10 } = params;
  const url = new URL(`${CLOB_BASE}/prices-history`);
  url.searchParams.set("market", tokenId);
  url.searchParams.set("interval", interval);
  url.searchParams.set("fidelity", String(fidelity));

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.history) ? data.history : [];
  } catch {
    return [];
  }
}

export async function getMidpoint(tokenId: string): Promise<number> {
  try {
    const res = await fetch(`${CLOB_BASE}/midpoint?token_id=${tokenId}`);
    if (!res.ok) return 0.5;
    const data = await res.json();
    return parseFloat(data.mid ?? "0.5");
  } catch {
    return 0.5;
  }
}

export async function getLastTradePrice(tokenId: string): Promise<number> {
  try {
    const res = await fetch(`${CLOB_BASE}/last-trade-price?token_id=${tokenId}`);
    if (!res.ok) return 0.5;
    const data = await res.json();
    return parseFloat(data.price ?? "0.5");
  } catch {
    return 0.5;
  }
}

export async function getBalanceAllowance(address: string): Promise<{ balance: number; allowance: number }> {
  try {
    const res = await fetch(`${CLOB_BASE}/balance-allowance?address=${address}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { balance: 0, allowance: 0 };
    const data = await res.json();
    return {
      balance: parseFloat(data.balance ?? "0") / 1e6,
      allowance: parseFloat(data.allowance ?? "0") / 1e6,
    };
  } catch {
    return { balance: 0, allowance: 0 };
  }
}
