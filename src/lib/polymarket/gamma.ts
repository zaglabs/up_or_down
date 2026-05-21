import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// ── Outcome-token patterns ────────────────────────────────────────────────────
// Strict directional tokens (never include Yes/No – those are handled separately).
const STRICT_UP = /^(up|higher|above)$/i;
const STRICT_DOWN = /^(down|lower|below)$/i;

// ── Question-text patterns for Yes/No markets ─────────────────────────────────
// A Yes/No market qualifies when its question contains BOTH:
//   1. a direction word  ("up", "down", "higher", "lower", "pump", "bull", …)
//   2. a price asset     ("BTC", "ETH", "gold", "crypto", "nasdaq", …)
//
// Timeframe is intentionally NOT required here: Polymarket often uses absolute
// timestamps ("at 3:00 PM ET") rather than durations ("in 1 hour"), and those
// would fail a duration-regex check even though the market is valid.
const DIRECTION_RE =
  /\b(up|down|higher|lower|rise|rises|risen|fall|falls|fallen|pump|dump|bull(ish)?|bear(ish)?|increase|decrease|gain|rally|surge|drop|decline)\b/i;
const ASSET_RE =
  /\b(btc|eth|sol|xrp|ada|doge|link|avax|matic|dot|uni|atom|near|ftm|algo|xlm|vet|trx|bitcoin|ethereum|solana|crypto|gold|silver|oil|crude|spx|s&p|nasdaq|nasdaq100|forex|eur|gbp|jpy|cad)\b/i;

// Kept for parsePeriod tag-based classification — not used in isUpDownMarket.
const TIMEFRAME_RE =
  /\b(\d+[\s-]?min(ute)?s?|\d+[\s-]?h(our)?s?|\d+[\s-]?day|today|daily|tonight|weekly|candle|5m|15m|1h|6h|1d|1w)\b/i;

function isUpDownMarket(market: GammaMarket): boolean {
  if (!market.tokens || market.tokens.length !== 2) return false;
  const outcomes = market.tokens.map((t) => t.outcome.trim());

  // Case 1 – explicit directional tokens: "Up"/"Down", "Higher"/"Lower", "Above"/"Below"
  if (outcomes.some((o) => STRICT_UP.test(o)) && outcomes.some((o) => STRICT_DOWN.test(o))) {
    return true;
  }

  // Case 2 – Yes/No tokens: admit only when question is about a price asset moving up/down.
  // No timeframe check — Polymarket uses absolute timestamps ("at 3:00 PM") not durations.
  const hasYes = outcomes.some((o) => /^yes$/i.test(o));
  const hasNo = outcomes.some((o) => /^no$/i.test(o));
  if (hasYes && hasNo) {
    const text = (market.question ?? "") + " " + (market.description ?? "");
    return DIRECTION_RE.test(text) && ASSET_RE.test(text);
  }

  return false;
}

function getDirectionalTokens(
  market: GammaMarket,
): { upToken: typeof market.tokens[0]; downToken: typeof market.tokens[0] } | null {
  const tokens = market.tokens.map((t) => ({ ...t, outcome: t.outcome.trim() }));

  // Prefer explicit directional tokens
  const upToken = tokens.find((t) => STRICT_UP.test(t.outcome));
  const downToken = tokens.find((t) => STRICT_DOWN.test(t.outcome));
  if (upToken && downToken) return { upToken, downToken };

  // Fall back: Yes → Up, No → Down (Polymarket always frames as "will it go UP?")
  const yesToken = tokens.find((t) => /^yes$/i.test(t.outcome));
  const noToken = tokens.find((t) => /^no$/i.test(t.outcome));
  if (yesToken && noToken) return { upToken: yesToken, downToken: noToken };

  return null;
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
  const firstCap = question.match(/\b([A-Z]{2,6})\b/);
  return firstCap ? firstCap[1] : "ASSET";
}

function parsePeriod(
  question: string,
  endDate: string,
  startDate: string,
  description?: string,
  tags?: string[],
): MarketPeriod {
  // Combine question + description for richer text matching
  const q = (question + " " + (description ?? "")).toLowerCase();

  // 5-minute: "5 min", "5min", "5-min", "5 minute", standalone "5m"
  if (/\b5[\s-]?min(ute)?s?\b/.test(q) || /\b5m\b/.test(q)) return "5m";

  // 15-minute: "15 min", "15min", "15-min", "15 minute", standalone "15m"
  if (/\b15[\s-]?min(ute)?s?\b/.test(q) || /\b15m\b/.test(q)) return "15m";

  // 1-hour: "1 hour", "1h", "hourly", "60 min"
  if (/\b(1[\s-]?h(our)?|hourly|60[\s-]?min(ute)?s?)\b/.test(q)) return "1h";

  // 6-hour
  if (/\b6[\s-]?h(our)?s?\b/.test(q)) return "6h";

  // Daily
  if (/\b(daily|today|24[\s-]?h(our)?s?)\b/.test(q) || /\b1[\s-]?day\b/.test(q)) return "1d";

  // Weekly
  if (/\b(weekly)\b/.test(q) || /\b1[\s-]?week\b/.test(q) || /\b7[\s-]?days?\b/.test(q)) return "1w";

  // Check market tags for duration hints (e.g. tag slug contains "5m", "1h", etc.)
  if (tags?.length) {
    const tagStr = tags.join(" ").toLowerCase();
    if (/\b5m\b/.test(tagStr) || tagStr.includes("5-min") || tagStr.includes("5min")) return "5m";
    if (/\b15m\b/.test(tagStr) || tagStr.includes("15-min") || tagStr.includes("15min")) return "15m";
    if (/\b1h\b/.test(tagStr) || tagStr.includes("1-hour") || tagStr.includes("hourly")) return "1h";
    if (/\b6h\b/.test(tagStr)) return "6h";
  }

  // Date-based fallback — try total market duration first (good for one-off short markets)
  try {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const totalMs = end - start;

    if (!isNaN(totalMs) && totalMs > 0) {
      if (totalMs <= 10 * 60 * 1000) return "5m";
      if (totalMs <= 20 * 60 * 1000) return "15m";
      if (totalMs <= 2 * 60 * 60 * 1000) return "1h";
      if (totalMs <= 12 * 60 * 60 * 1000) return "6h";
      if (totalMs <= 2 * 24 * 60 * 60 * 1000) return "1d";
    }

    // For recurring/rolling markets startDate is the series start (weeks ago),
    // so fall back to time-remaining-until-expiry as a proxy for the resolution window.
    const remaining = end - now;
    if (!isNaN(remaining) && remaining > 0) {
      if (remaining <= 10 * 60 * 1000) return "5m";
      if (remaining <= 20 * 60 * 1000) return "15m";
      if (remaining <= 2 * 60 * 60 * 1000) return "1h";
      if (remaining <= 12 * 60 * 60 * 1000) return "6h";
      if (remaining <= 2 * 24 * 60 * 60 * 1000) return "1d";
    }
  } catch {}
  return "1d";
}

function normalizeMarket(market: GammaMarket, category: MarketCategory): UpDownMarket | null {
  if (!isUpDownMarket(market)) return null;

  const pair = getDirectionalTokens(market);
  if (!pair) return null;
  const { upToken, downToken } = pair;

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
    period: parsePeriod(
      market.question,
      market.endDateIso || market.endDate,
      market.startDate,
      market.description,
      market.tags,
    ),
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

function safeNormalize(market: GammaMarket, category: MarketCategory): UpDownMarket | null {
  try {
    return normalizeMarket(market, category);
  } catch {
    return null;
  }
}

async function fetchGammaMarkets(tagSlug: string): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("tag_slug", tagSlug);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "200");

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

// Fetch markets expiring within the next `windowHours` hours — this reliably
// surfaces short-duration markets regardless of their tag classification.
async function fetchGammaMarketsEndingSoon(windowHours: number): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  const endMax = new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString();
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("end_date_max", endMax);
  url.searchParams.set("order", "endDate");
  url.searchParams.set("ascending", "true");
  url.searchParams.set("limit", "200");

  try {
    const res = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.markets ?? []);
  } catch {
    return [];
  }
}

// Tag slugs known (or likely) to contain Up/Down price-direction markets on Polymarket.
// "crypto" and "cryptocurrency" cover BTC/ETH/SOL candle markets.
// "crypto-prices" is Polymarket's dedicated price-prediction tag.
// "financials" / "economics" / "forex" cover non-crypto directional markets.
const TAG_SLUGS_CRYPTO: Array<{ slug: string; cat: MarketCategory }> = [
  { slug: "crypto", cat: "crypto" },
  { slug: "cryptocurrency", cat: "crypto" },
  { slug: "crypto-prices", cat: "crypto" },
];
const TAG_SLUGS_FINANCE: Array<{ slug: string; cat: MarketCategory }> = [
  { slug: "financials", cat: "finance" },
  { slug: "economics", cat: "finance" },
  { slug: "forex", cat: "finance" },
];

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  const tagSlugs: Array<{ slug: string; cat: MarketCategory }> =
    category === "crypto"
      ? TAG_SLUGS_CRYPTO
      : category === "finance"
      ? TAG_SLUGS_FINANCE
      : [...TAG_SLUGS_CRYPTO, ...TAG_SLUGS_FINANCE];

  // Tag-based fetches (covers 6H/1D/1W markets well)
  const tagResults = await Promise.allSettled(
    tagSlugs.map(({ slug, cat }) =>
      fetchGammaMarkets(slug).then((markets) =>
        markets.map((m) => safeNormalize(m, cat)).filter((m): m is UpDownMarket => m !== null)
      )
    )
  );

  // "Ending soon" fetch — catches 5M/15M/1H markets regardless of tag.
  // 2-hour window captures all short-duration resolutions active right now.
  // Category is inferred from the API's own category string (safe String() coercion).
  const shortTermResult = await fetchGammaMarketsEndingSoon(2).then((markets) =>
    markets
      .map((m) => {
        const rawCat = String(m.category ?? "").toLowerCase();
        const cat: MarketCategory = /crypto|bitcoin|ethereum|defi|nft/.test(rawCat)
          ? "crypto"
          : "finance";
        return safeNormalize(m, cat);
      })
      .filter((m): m is UpDownMarket => m !== null)
  );

  const all: UpDownMarket[] = [];
  for (const r of tagResults) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  all.push(...shortTermResult);

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
