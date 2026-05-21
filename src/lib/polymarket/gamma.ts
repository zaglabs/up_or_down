import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// ── Outcome matchers ──────────────────────────────────────────────────────────
const TOKEN_UP   = /^(up|higher|above)\b/i;
const TOKEN_DOWN = /^(down|lower|below)\b/i;

// Directional-question filter (for Yes/No markets about price direction)
const DIRECTION_WORDS =
  /\b(higher|lower|above|below|exceed|surpass|reach|break|rally|rise|fall|drop|crash|gain|lose|bullish|bearish|pump|dump|outperform|underperform)\b/i;

const FINANCIAL_ASSET =
  /\b(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple|bnb|ada|cardano|avax|avalanche|matic|polygon|link|chainlink|uni|uniswap|dot|polkadot|atom|cosmos|near|ltc|litecoin|bch|shib|pepe|trx|algo|xlm|vet|ftm|crypto|s&p|spx|sp500|nasdaq|dow|djia|gold|silver|oil|crude|wti|brent|eur|gbp|jpy|forex|stock|index|equity|commodity)\b/i;

type MarketKind = "directional-token" | "directional-yes-no" | null;

// Parse a field that may be a JS array already or a JSON-encoded string
function parseArrayField(val: any): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val.trim().startsWith("[")) {
    try { return JSON.parse(val); } catch {}
  }
  return [];
}

function buildTokens(market: GammaMarket): GammaMarket["tokens"] {
  if (Array.isArray(market.tokens) && market.tokens.length === 2) return market.tokens;
  // Gamma list API stores outcome names in `outcomes` — may be array or JSON string
  const outcomeNames = parseArrayField((market as any).outcomes ?? []);
  if (outcomeNames.length !== 2) return [];
  const prices  = parseArrayField(market.outcomePrices ?? []);
  const clobIds = parseArrayField((market as any).clobTokenIds ?? []);
  return outcomeNames.map((name, i) => ({
    outcome: name,
    tokenId: clobIds[i] ?? "",
    price:   parseFloat(prices[i] ?? "0.5"),
    winner:  false,
  }));
}

function classifyMarket(market: GammaMarket): MarketKind {
  const tokens = buildTokens(market);
  if (tokens.length !== 2) return null;
  const outcomes = tokens.map((t) => t.outcome.trim());

  // Tier 1 — literal Higher/Lower/Up/Down tokens
  if (outcomes.some((o) => TOKEN_UP.test(o)) && outcomes.some((o) => TOKEN_DOWN.test(o))) {
    return "directional-token";
  }

  // Tier 2 — Yes/No tokens but question is about an asset's price direction
  const norm = outcomes.map((o) => o.toLowerCase()).sort().join("|");
  if (
    norm === "no|yes" &&
    FINANCIAL_ASSET.test(market.question) &&
    DIRECTION_WORDS.test(market.question)
  ) {
    return "directional-yes-no";
  }

  return null;
}

function detectCategory(market: GammaMarket): MarketCategory {
  const tags = (market.tags ?? []).map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
  const q    = market.question.toLowerCase();
  const cryptoTags = ["crypto","bitcoin","ethereum","solana","defi","nft","web3","altcoin"];
  if (tags.some((t) => cryptoTags.some((c) => t.includes(c)))) return "crypto";
  const cryptoKw   = ["btc","bitcoin","eth","ethereum","sol","solana","doge","xrp","bnb","ada","avax","matic","link","shib","pepe","crypto"];
  if (cryptoKw.some((k) => q.includes(k))) return "crypto";
  return "finance";
}

function parseAsset(question: string): string {
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|ALGO|XLM|VET|TRX|BNB|SHIB|PEPE)\b/,
    /\b(bitcoin|ethereum|solana|dogecoin|cardano|polygon|avalanche|chainlink|polkadot|uniswap|ripple|litecoin)\b/i,
    /\b(S&P|SPX|NASDAQ|gold|silver|oil|crude|EUR|GBP|JPY)\b/i,
  ];
  for (const p of patterns) {
    const m = question.match(p);
    if (m) return m[1].toUpperCase().replace(/\s+/g, "");
  }
  const cap = question.match(/\b([A-Z]{2,6})\b/);
  return cap ? cap[1] : "ASSET";
}

function parsePeriod(question: string, endDate: string, startDate: string): MarketPeriod {
  const q = question.toLowerCase();
  if (q.match(/\b5[\s-]?min/))  return "5m";
  if (q.match(/\b15[\s-]?min/)) return "15m";
  if (q.match(/\b1[\s-]?h(our)?r?\b/) || q.includes("hourly")) return "1h";
  if (q.match(/\b6[\s-]?h(our)?r?\b/)) return "6h";
  if (q.match(/\b(daily|today|24[\s-]?h|end of (day|today))/)) return "1d";
  if (q.match(/\b(weekly|this week|7[\s-]?day)/)) return "1w";
  try {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    if (diff <= 10 * 60_000)    return "5m";
    if (diff <= 20 * 60_000)    return "15m";
    if (diff <= 2 * 3_600_000)  return "1h";
    if (diff <= 12 * 3_600_000) return "6h";
    if (diff <= 2 * 86_400_000) return "1d";
  } catch {}
  return "1d";
}

function normalizeMarket(market: GammaMarket): UpDownMarket | null {
  const kind = classifyMarket(market);
  if (!kind) return null;

  const tokens = buildTokens(market);

  let upToken   = tokens.find((t) => TOKEN_UP.test(t.outcome.trim()));
  let downToken = tokens.find((t) => TOKEN_DOWN.test(t.outcome.trim()));

  if (kind === "directional-yes-no") {
    const yesToken = tokens.find((t) => t.outcome.trim().toLowerCase() === "yes");
    const noToken  = tokens.find((t) => t.outcome.trim().toLowerCase() === "no");
    if (!yesToken || !noToken) return null;
    const bearish = /\b(fall|drop|crash|below|lower|decline|lose|dump)\b/i.test(market.question);
    upToken   = bearish ? noToken  : yesToken;
    downToken = bearish ? yesToken : noToken;
  }

  if (!upToken || !downToken) return null;

  let outcomePrices: string[] = [];
  try { outcomePrices = JSON.parse(market.outcomePrices || "[]"); } catch {}

  const upIdx   = tokens.indexOf(upToken);
  const downIdx = tokens.indexOf(downToken);
  const upPrice   = upToken.price   ?? parseFloat(outcomePrices[upIdx]   ?? "0.5");
  const downPrice = downToken.price ?? parseFloat(outcomePrices[downIdx] ?? "0.5");

  return {
    conditionId: market.conditionId,
    question:    market.question,
    asset:       parseAsset(market.question),
    period:      parsePeriod(market.question, market.endDateIso || market.endDate, market.startDate),
    endDateIso:  market.endDateIso || market.endDate,
    upTokenId:   upToken.tokenId,
    downTokenId: downToken.tokenId,
    upPrice:     isNaN(upPrice)   ? 0.5 : upPrice,
    downPrice:   isNaN(downPrice) ? 0.5 : downPrice,
    volume24h:   parseFloat(market.volume   || "0"),
    liquidity:   parseFloat(market.liquidity || "0"),
    negRisk:     market.negRisk ?? false,
    category:    detectCategory(market),
    slug:        market.slug,
  };
}

// ── Fetch — same approach as original working code ────────────────────────────

async function fetchTagMarkets(tagSlug: string): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("tag_slug", tagSlug);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "200");

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.error(`[gamma] HTTP ${res.status} for tag_slug=${tagSlug}`);
      return [];
    }

    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.markets ?? []);
    console.log(`[gamma] tag_slug=${tagSlug} → ${list.length} raw markets`);
    return list;
  } catch (err) {
    console.error(`[gamma] fetch error for tag_slug=${tagSlug}:`, err);
    return [];
  }
}

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  const tags: Array<{ slug: string; cat: MarketCategory }> = category === "crypto"
    ? [
        { slug: "crypto",     cat: "crypto" },
        { slug: "bitcoin",    cat: "crypto" },
        { slug: "ethereum",   cat: "crypto" },
        { slug: "solana",     cat: "crypto" },
        { slug: "defi",       cat: "crypto" },
      ]
    : category === "finance"
    ? [
        { slug: "financials",  cat: "finance" },
        { slug: "economics",   cat: "finance" },
        { slug: "commodities", cat: "finance" },
        { slug: "stocks",      cat: "finance" },
        { slug: "prices",      cat: "finance" },
      ]
    : [
        { slug: "crypto",          cat: "crypto"  },
        { slug: "bitcoin",         cat: "crypto"  },
        { slug: "ethereum",        cat: "crypto"  },
        { slug: "solana",          cat: "crypto"  },
        { slug: "defi",            cat: "crypto"  },
        { slug: "financials",      cat: "finance" },
        { slug: "economics",       cat: "finance" },
        { slug: "commodities",     cat: "finance" },
        { slug: "stocks",          cat: "finance" },
        { slug: "prices",          cat: "finance" },
        { slug: "up-or-down",      cat: "finance" },
        { slug: "price-prediction",cat: "finance" },
      ];

  // Parallel fetch — same as original
  const settled = await Promise.allSettled(
    tags.map(({ slug }) => fetchTagMarkets(slug))
  );

  const raw: GammaMarket[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") raw.push(...r.value);
  }

  console.log(`[gamma] total raw: ${raw.length}`);

  // Deduplicate → classify → normalize → sort
  const seen = new Set<string>();
  const results: UpDownMarket[] = [];

  for (const m of raw) {
    if (!m.conditionId || seen.has(m.conditionId)) continue;
    seen.add(m.conditionId);
    const norm = normalizeMarket(m);
    if (norm) results.push(norm);
  }

  console.log(`[gamma] after directional filter: ${results.length}`);
  return results.sort((a, b) => b.volume24h - a.volume24h);
}

export async function fetchMarketByConditionId(conditionId: string): Promise<GammaMarket | null> {
  try {
    const res = await fetch(`${GAMMA_BASE}/markets/${conditionId}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
