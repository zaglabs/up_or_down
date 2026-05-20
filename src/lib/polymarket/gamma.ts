import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// Directional outcomes: "Up", "Higher", "Above", etc.
const UP_DIRECTIONAL = /^(up|higher|above|over|bullish)$/i;
const DOWN_DIRECTIONAL = /^(down|lower|below|under|bearish)$/i;

// Price-direction language that makes a Yes/No market an "up or down" market
const PRICE_DIRECTION_RE =
  /\b(higher|lower|above|below|go up|go down|up or down|increase|decrease|more than|less than|over|under)\b/i;

function isUpDownMarket(market: GammaMarket): boolean {
  if (!market.tokens || market.tokens.length !== 2) return false;

  const outcomes = market.tokens.map((t) => t.outcome.trim());

  // Case 1: outcomes are explicitly directional ("Higher"/"Lower", "Up"/"Down", etc.)
  if (
    outcomes.some((o) => UP_DIRECTIONAL.test(o)) &&
    outcomes.some((o) => DOWN_DIRECTIONAL.test(o))
  ) {
    return true;
  }

  // Case 2: Yes/No market whose question is about price direction
  const isYesNo =
    outcomes.some((o) => /^yes$/i.test(o)) && outcomes.some((o) => /^no$/i.test(o));
  if (isYesNo && PRICE_DIRECTION_RE.test(market.question)) {
    return true;
  }

  return false;
}

function parseAsset(question: string): string {
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|ALGO|XLM|VET|TRX|BNB|PEPE|SHIB|ARB|OP|SUI|APT|INJ|WIF|BONK)\b/i,
    /\b(bitcoin|ethereum|solana|dogecoin|cardano|polygon|avalanche|chainlink|polkadot|uniswap|ripple|litecoin|binance)\b/i,
    /\b(S&P|SPX|SPY|nasdaq|NDX|gold|oil|EUR|GBP|JPY|crude|silver|QQQ|dow)\b/i,
  ];
  for (const p of patterns) {
    const m = question.match(p);
    if (m) return m[1].toUpperCase();
  }
  const firstCap = question.match(/\b([A-Z]{2,6})\b/);
  return firstCap ? firstCap[1] : "ASSET";
}

function parsePeriod(question: string, endDate: string, startDate: string): MarketPeriod {
  const q = question.toLowerCase();
  if (q.includes("5 min") || q.includes("5min") || q.includes("5-min")) return "5m";
  if (q.includes("15 min") || q.includes("15min") || q.includes("15-min")) return "15m";
  if (q.includes("1 hour") || q.includes("1hour") || q.includes("hourly") || q.includes("1h")) return "1h";
  if (q.includes("6 hour") || q.includes("6h")) return "6h";
  if (q.includes("daily") || q.includes("1 day") || q.includes("today") || q.includes("24h")) return "1d";
  if (q.includes("weekly") || q.includes("1 week") || q.includes("7 day")) return "1w";

  try {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diffMs = end - start;
    if (diffMs <= 10 * 60 * 1000) return "5m";
    if (diffMs <= 20 * 60 * 1000) return "15m";
    if (diffMs <= 2 * 60 * 60 * 1000) return "1h";
    if (diffMs <= 12 * 60 * 60 * 1000) return "6h";
    if (diffMs <= 2 * 24 * 60 * 60 * 1000) return "1d";
  } catch {}
  return "1d";
}

function normalizeMarket(market: GammaMarket, category: MarketCategory): UpDownMarket | null {
  if (!isUpDownMarket(market)) return null;

  const outcomes = market.tokens.map((t) => t.outcome.trim());

  // Resolve which token is "up" — prefer explicit directional, fallback to Yes
  const upToken =
    market.tokens.find((t) => UP_DIRECTIONAL.test(t.outcome.trim())) ??
    market.tokens.find((t) => /^yes$/i.test(t.outcome.trim()));
  const downToken =
    market.tokens.find((t) => DOWN_DIRECTIONAL.test(t.outcome.trim())) ??
    market.tokens.find((t) => /^no$/i.test(t.outcome.trim()));

  if (!upToken || !downToken || upToken.tokenId === downToken.tokenId) return null;

  let outcomePrices: string[] = [];
  try {
    outcomePrices = JSON.parse(market.outcomePrices || "[]");
  } catch {}

  const upIdx = outcomes.indexOf(upToken.outcome.trim());
  const upPrice = upToken.price ?? parseFloat(outcomePrices[upIdx] ?? "0.5");
  const downIdx = outcomes.indexOf(downToken.outcome.trim());
  const downPrice = downToken.price ?? parseFloat(outcomePrices[downIdx] ?? "0.5");

  return {
    conditionId: market.conditionId,
    question: market.question,
    asset: parseAsset(market.question),
    period: parsePeriod(market.question, market.endDateIso || market.endDate, market.startDate),
    endDateIso: market.endDateIso || market.endDate,
    upTokenId: upToken.tokenId,
    downTokenId: downToken.tokenId,
    upPrice: isNaN(upPrice) ? 0.5 : upPrice,
    downPrice: isNaN(downPrice) ? 0.5 : downPrice,
    volume24h: parseFloat(market.volume || "0"),
    liquidity: parseFloat(market.liquidity || "0"),
    negRisk: market.negRisk ?? false,
    category,
    slug: market.slug,
  };
}

async function fetchGammaPage(opts: {
  tagSlug?: string;
  query?: string;
  limit?: number;
}): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  if (opts.tagSlug) url.searchParams.set("tag_slug", opts.tagSlug);
  if (opts.query) url.searchParams.set("q", opts.query);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(opts.limit ?? 100));

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.warn(`[gamma] ${res.status} for ${url.search}`);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : (data.markets ?? []);
  } catch (err) {
    console.warn(`[gamma] fetch failed: ${err}`);
    return [];
  }
}

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  type Strategy = { opts: Parameters<typeof fetchGammaPage>[0]; cat: MarketCategory };

  const allStrategies: Strategy[] = [
    // Tag-based — broad crypto / finance categories
    { opts: { tagSlug: "crypto" }, cat: "crypto" },
    { opts: { tagSlug: "financials" }, cat: "finance" },
    { opts: { tagSlug: "economics" }, cat: "finance" },
    // Text search targeting common "up or down" question phrasing
    { opts: { query: "higher or lower" }, cat: "crypto" },
    { opts: { query: "up or down" }, cat: "crypto" },
    { opts: { query: "higher than" }, cat: "crypto" },
    { opts: { query: "will bitcoin go" }, cat: "crypto" },
    { opts: { query: "will eth go" }, cat: "crypto" },
    { opts: { query: "higher or lower finance" }, cat: "finance" },
  ];

  const strategies: Strategy[] = category
    ? allStrategies.filter((s) => s.cat === category)
    : allStrategies;

  const results = await Promise.allSettled(
    strategies.map(({ opts, cat }) =>
      fetchGammaPage(opts).then((markets) =>
        markets
          .map((m) => normalizeMarket(m, cat))
          .filter((m): m is UpDownMarket => m !== null)
      )
    )
  );

  const all: UpDownMarket[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Deduplicate — prefer higher liquidity when same market appears from multiple searches
  const byId = new Map<string, UpDownMarket>();
  for (const m of all) {
    const existing = byId.get(m.conditionId);
    if (!existing || m.liquidity > existing.liquidity) {
      byId.set(m.conditionId, m);
    }
  }

  // Most liquid markets first
  return Array.from(byId.values()).sort((a, b) => b.liquidity - a.liquidity);
}

export async function fetchMarketByConditionId(conditionId: string): Promise<GammaMarket | null> {
  const url = `${GAMMA_BASE}/markets/${conditionId}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
