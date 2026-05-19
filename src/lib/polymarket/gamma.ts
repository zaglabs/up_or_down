import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

const UP_PATTERNS = /^(up|higher|above|yes)$/i;
const DOWN_PATTERNS = /^(down|lower|below|no)$/i;

function isUpDownMarket(market: GammaMarket): boolean {
  if (!market.tokens || market.tokens.length !== 2) return false;
  const outcomes = market.tokens.map((t) => t.outcome.trim());
  return outcomes.some((o) => UP_PATTERNS.test(o)) && outcomes.some((o) => DOWN_PATTERNS.test(o));
}

function parseAsset(question: string): string {
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|ALGO|XLM|VET|TRX)\b/i,
    /\b(bitcoin|ethereum|solana|dogecoin|cardano|polygon|avalanche|chainlink|polkadot|uniswap|ripple|litecoin)\b/i,
    /\b(S&P|SPX|nasdaq|nasdaq 100|gold|oil|EUR|GBP|JPY|crude)\b/i,
  ];
  for (const p of patterns) {
    const m = question.match(p);
    if (m) return m[1].toUpperCase();
  }
  // Extract first capitalized word as asset
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

  // Estimate from date range
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

  const upToken = market.tokens.find((t) => UP_PATTERNS.test(t.outcome.trim()));
  const downToken = market.tokens.find((t) => DOWN_PATTERNS.test(t.outcome.trim()));
  if (!upToken || !downToken) return null;

  let outcomePrices: string[] = [];
  try {
    outcomePrices = JSON.parse(market.outcomePrices || "[]");
  } catch {}

  const upPrice = upToken.price ?? parseFloat(outcomePrices[0] ?? "0.5");
  const downPrice = downToken.price ?? parseFloat(outcomePrices[1] ?? "0.5");

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

async function fetchGammaMarkets(tagSlug: string): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("tag_slug", tagSlug);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "100");

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    console.error(`Gamma API error: ${res.status} for tag ${tagSlug}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data.markets ?? []);
}

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  const categories: Array<{ slug: string; cat: MarketCategory }> = category
    ? [{ slug: category === "crypto" ? "crypto" : "financials", cat: category }]
    : [
        { slug: "crypto", cat: "crypto" },
        { slug: "financials", cat: "finance" },
        { slug: "economics", cat: "finance" },
      ];

  const results = await Promise.allSettled(
    categories.map(({ slug, cat }) =>
      fetchGammaMarkets(slug).then((markets) =>
        markets.map((m) => normalizeMarket(m, cat)).filter((m): m is UpDownMarket => m !== null)
      )
    )
  );

  const all: UpDownMarket[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // Deduplicate by conditionId
  const seen = new Set<string>();
  return all.filter((m) => {
    if (seen.has(m.conditionId)) return false;
    seen.add(m.conditionId);
    return true;
  });
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
