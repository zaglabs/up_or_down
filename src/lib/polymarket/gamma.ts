import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// ── Outcome-token matchers ────────────────────────────────────────────────────
// Type A: token outcomes are literally directional (Higher / Lower / Up / Down)
const TOKEN_UP   = /^(up|higher|above)\b/i;
const TOKEN_DOWN = /^(down|lower|below)\b/i;

// ── Question-content matchers (for Yes/No markets about price direction) ──────
const DIRECTION_UP_WORDS   = /\b(higher|above|exceed|surpass|reach|break|close above|end above|go above|rise|rally)\b/i;
const DIRECTION_DOWN_WORDS = /\b(lower|below|fall|drop|crash|close below|end below|go below|decline)\b/i;
const PRICE_SIGNAL = /(\$[\d,]+|[\d,]+%|\bprice\b|\bclose\b|\bsettle\b|\btrading\b)/i;
const FINANCIAL_ASSET = /\b(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple|bnb|ada|avax|matic|link|chainlink|uni|dot|atom|shib|pepe|ltc|litecoin|crypto|s&p|spx|nasdaq|dow|gold|silver|oil|crude|eur|gbp|jpy|usd|stock|index|equity|commodity|forex)\b/i;

type MarketKind = "directional-token" | "directional-yes-no" | null;

function classifyMarket(market: GammaMarket): MarketKind {
  if (!market.tokens || market.tokens.length !== 2) return null;
  const outcomes = market.tokens.map((t) => t.outcome.trim());

  // Type A — literal directional tokens
  if (
    outcomes.some((o) => TOKEN_UP.test(o)) &&
    outcomes.some((o) => TOKEN_DOWN.test(o))
  ) {
    return "directional-token";
  }

  // Type B — Yes/No tokens but the question is about a price moving up or down
  const isYesNo =
    outcomes.map((o) => o.toLowerCase()).sort().join("|") === "no|yes";
  if (isYesNo && FINANCIAL_ASSET.test(market.question) && PRICE_SIGNAL.test(market.question)) {
    if (
      DIRECTION_UP_WORDS.test(market.question) ||
      DIRECTION_DOWN_WORDS.test(market.question)
    ) {
      return "directional-yes-no";
    }
  }

  return null;
}

function detectCategory(market: GammaMarket): MarketCategory {
  const tags = (market.tags ?? []).map((t) =>
    typeof t === "string" ? t.toLowerCase() : ""
  );
  const q = market.question.toLowerCase();

  const cryptoTags = ["crypto", "bitcoin", "ethereum", "solana", "defi", "nft", "web3", "altcoin"];
  if (tags.some((t) => cryptoTags.some((ct) => t.includes(ct)))) return "crypto";

  const cryptoKw = [
    "btc","bitcoin","eth","ethereum","sol","solana","doge","xrp","bnb",
    "ada","avax","matic","link","dot","uni","ltc","bch","atom","near",
    "ftm","algo","xlm","vet","trx","shib","pepe","crypto",
  ];
  if (cryptoKw.some((k) => q.includes(k))) return "crypto";
  return "finance";
}

function parseAsset(question: string): string {
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|ALGO|XLM|VET|TRX|BNB|SHIB|PEPE)\b/i,
    /\b(bitcoin|ethereum|solana|dogecoin|cardano|polygon|avalanche|chainlink|polkadot|uniswap|ripple|litecoin)\b/i,
    /\b(S&P|SPX|nasdaq|nasdaq\s?100|gold|silver|oil|crude|EUR|GBP|JPY|EUR\/USD|GBP\/USD)\b/i,
  ];
  for (const p of patterns) {
    const m = question.match(p);
    if (m) return m[1].toUpperCase().replace(/\s+/g, "");
  }
  const firstCap = question.match(/\b([A-Z]{2,6})\b/);
  return firstCap ? firstCap[1] : "ASSET";
}

function parsePeriod(question: string, endDate: string, startDate: string): MarketPeriod {
  const q = question.toLowerCase();
  if (q.match(/\b5[\s-]?min/)) return "5m";
  if (q.match(/\b15[\s-]?min/)) return "15m";
  if (q.match(/\b1[\s-]?h(our)?r?\b/) || q.includes("hourly")) return "1h";
  if (q.match(/\b6[\s-]?h(our)?r?\b/)) return "6h";
  if (q.match(/\b(daily|1[\s-]?day|today|24[\s-]?h)/)) return "1d";
  if (q.match(/\b(weekly|1[\s-]?week|7[\s-]?day)/)) return "1w";
  try {
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    if (diff <= 10 * 60_000)   return "5m";
    if (diff <= 20 * 60_000)   return "15m";
    if (diff <= 2 * 3_600_000) return "1h";
    if (diff <= 12 * 3_600_000) return "6h";
    if (diff <= 2 * 86_400_000) return "1d";
  } catch {}
  return "1d";
}

function normalizeMarket(market: GammaMarket): UpDownMarket | null {
  const kind = classifyMarket(market);
  if (!kind) return null;

  let upToken = market.tokens.find((t) => TOKEN_UP.test(t.outcome.trim()));
  let downToken = market.tokens.find((t) => TOKEN_DOWN.test(t.outcome.trim()));

  if (kind === "directional-yes-no") {
    // For Yes/No price-direction markets determine which side is "up"
    const q = market.question.toLowerCase();
    const isAskingUp = DIRECTION_UP_WORDS.test(q);
    const yesToken = market.tokens.find((t) => t.outcome.trim().toLowerCase() === "yes");
    const noToken  = market.tokens.find((t) => t.outcome.trim().toLowerCase() === "no");
    if (!yesToken || !noToken) return null;
    // "Will X close ABOVE $Y?" → Yes = price went up (bullish), No = went down
    // "Will X FALL below $Y?"  → Yes = price went down, No = stayed up
    if (isAskingUp) { upToken = yesToken; downToken = noToken; }
    else             { upToken = noToken;  downToken = yesToken; }
  }

  if (!upToken || !downToken) return null;

  let outcomePrices: string[] = [];
  try { outcomePrices = JSON.parse(market.outcomePrices || "[]"); } catch {}

  const upPrice   = upToken.price   ?? parseFloat(outcomePrices[0] ?? "0.5");
  const downPrice = downToken.price ?? parseFloat(outcomePrices[1] ?? "0.5");

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

// ── Fetching ──────────────────────────────────────────────────────────────────

async function gammaFetch(url: string): Promise<GammaMarket[]> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[gamma] ${res.status} ${url}`);
      return [];
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.markets ?? data.data ?? []);
    if (!Array.isArray(list)) {
      console.error("[gamma] unexpected shape:", JSON.stringify(data).slice(0, 200));
      return [];
    }
    return list;
  } catch (err) {
    console.error("[gamma] fetch error:", err);
    return [];
  }
}

function makeTagUrl(slug: string, limit = 200) {
  return `${GAMMA_BASE}/markets?tag_slug=${encodeURIComponent(slug)}&active=true&closed=false&limit=${limit}`;
}

function makePageUrl(offset: number, limit = 200) {
  return `${GAMMA_BASE}/markets?active=true&closed=false&limit=${limit}&offset=${offset}`;
}

// Tag slugs most likely to contain directional price markets
const ALL_SLUGS = [
  // crypto
  "crypto", "bitcoin", "ethereum", "solana", "defi", "altcoins",
  // finance / macro
  "financials", "economics", "commodities", "forex", "stocks",
  // possible Polymarket-specific slugs for price markets
  "prices", "price-prediction", "crypto-prices", "up-or-down",
];

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  const raw: GammaMarket[] = [];

  const slugs = category
    ? ALL_SLUGS.filter((s) =>
        category === "crypto"
          ? ["crypto","bitcoin","ethereum","solana","defi","altcoins","prices","crypto-prices","up-or-down"].includes(s)
          : ["financials","economics","commodities","forex","stocks","prices"].includes(s)
      )
    : ALL_SLUGS;

  // Fetch each tag slug sequentially to avoid rate-limiting
  for (const slug of slugs) {
    const batch = await gammaFetch(makeTagUrl(slug));
    console.log(`[gamma] tag=${slug} → ${batch.length} markets`);
    raw.push(...batch);
    await new Promise((r) => setTimeout(r, 80));
  }

  if (!category) {
    // Supplement with paginated sweep (pages 0-3) to catch markets not in known tags
    for (let page = 0; page < 4; page++) {
      const batch = await gammaFetch(makePageUrl(page * 200));
      console.log(`[gamma] page=${page} → ${batch.length} markets`);
      raw.push(...batch);
      if (batch.length < 200) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`[gamma] total raw: ${raw.length}`);

  // Deduplicate → normalize → sort
  const seen = new Set<string>();
  const results: UpDownMarket[] = [];

  for (const m of raw) {
    if (!m.conditionId || seen.has(m.conditionId)) continue;
    seen.add(m.conditionId);
    const norm = normalizeMarket(m);
    if (norm) results.push(norm);
  }

  console.log(`[gamma] after filter: ${results.length} up/down markets`);
  return results.sort((a, b) => b.volume24h - a.volume24h);
}

export async function fetchMarketByConditionId(conditionId: string): Promise<GammaMarket | null> {
  try {
    const res = await fetch(`${GAMMA_BASE}/markets/${conditionId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
