import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// ── Tier 1: literal directional token outcomes ────────────────────────────────
const TOKEN_UP   = /^(up|higher|above)\b/i;
const TOKEN_DOWN = /^(down|lower|below)\b/i;

// ── Tier 2: Yes/No markets whose question is about asset price direction ───────
const DIRECTION_WORDS =
  /\b(higher|lower|above|below|up|down|exceed|surpass|reach|break|rally|rise|fall|drop|crash|gain|lose|bull|bear|outperform|underperform|pump|dump|go up|go down|end (up|down|higher|lower|above|below)|close (above|below|higher|lower))\b/i;

const FINANCIAL_ASSET =
  /\b(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple|bnb|ada|cardano|avax|avalanche|matic|polygon|link|chainlink|uni|uniswap|dot|polkadot|atom|cosmos|near|ltc|litecoin|bch|shib|pepe|trx|tron|algo|xlm|vet|ftm|crypto|s&p|spx|sp500|nasdaq|dow|djia|gold|silver|oil|crude|wti|brent|eur|gbp|jpy|euro|dollar|bitcoin|equity|stock|index|commodity|forex)\b/i;

type MarketKind = "directional-token" | "directional-yes-no" | null;

function classifyMarket(market: GammaMarket): MarketKind {
  if (!market.tokens || market.tokens.length !== 2) return null;
  const outcomes = market.tokens.map((t) => t.outcome.trim());

  // Tier 1 — literal Higher/Lower/Up/Down tokens
  if (outcomes.some((o) => TOKEN_UP.test(o)) && outcomes.some((o) => TOKEN_DOWN.test(o))) {
    return "directional-token";
  }

  // Tier 2 — Yes/No tokens, question is about a price going up or down
  const isYesNo =
    outcomes
      .map((o) => o.toLowerCase())
      .sort()
      .join("|") === "no|yes";

  if (isYesNo && FINANCIAL_ASSET.test(market.question) && DIRECTION_WORDS.test(market.question)) {
    return "directional-yes-no";
  }

  return null;
}

function detectCategory(market: GammaMarket): MarketCategory {
  const tags = (market.tags ?? []).map((t) =>
    typeof t === "string" ? t.toLowerCase() : ""
  );
  const q = market.question.toLowerCase();
  const cryptoTags = ["crypto", "bitcoin", "ethereum", "solana", "defi", "nft", "web3", "altcoin"];
  if (tags.some((t) => cryptoTags.some((c) => t.includes(c)))) return "crypto";
  const cryptoKw = [
    "btc","bitcoin","eth","ethereum","sol","solana","doge","xrp","bnb",
    "ada","avax","matic","link","dot","uni","ltc","shib","pepe","crypto","defi",
  ];
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
  if (q.match(/\b5[\s-]?min/)) return "5m";
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

  let upToken   = market.tokens.find((t) => TOKEN_UP.test(t.outcome.trim()));
  let downToken = market.tokens.find((t) => TOKEN_DOWN.test(t.outcome.trim()));

  if (kind === "directional-yes-no") {
    const yesToken = market.tokens.find((t) => t.outcome.trim().toLowerCase() === "yes");
    const noToken  = market.tokens.find((t) => t.outcome.trim().toLowerCase() === "no");
    if (!yesToken || !noToken) return null;
    const q = market.question.toLowerCase();
    // "fall/drop/crash/below/lower" → bearish question → Yes means price fell → Yes=Down
    const isBearishQuestion = /\b(fall|drop|crash|below|lower|decline|lose|dump|go down|end (down|lower|below)|close (below|lower))\b/i.test(q);
    if (isBearishQuestion) { upToken = noToken; downToken = yesToken; }
    else                   { upToken = yesToken; downToken = noToken; }
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
      console.error(`[gamma] HTTP ${res.status}: ${url}`);
      return [];
    }
    const data = await res.json();
    const list: unknown = Array.isArray(data)
      ? data
      : (data as any)?.markets ?? (data as any)?.data ?? [];
    if (!Array.isArray(list)) {
      console.error("[gamma] unexpected shape:", JSON.stringify(data).slice(0, 300));
      return [];
    }
    return list as GammaMarket[];
  } catch (err) {
    console.error("[gamma] fetch error for", url, err);
    return [];
  }
}

const TAG_SLUGS = [
  "crypto", "bitcoin", "ethereum", "solana",
  "defi", "altcoins",
  "financials", "economics", "commodities", "forex", "stocks",
  "prices", "price-prediction", "crypto-prices", "up-or-down",
];

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  const slugs = category
    ? TAG_SLUGS.filter((s) =>
        category === "crypto"
          ? ["crypto","bitcoin","ethereum","solana","defi","altcoins","prices","crypto-prices","up-or-down"].includes(s)
          : ["financials","economics","commodities","forex","stocks","prices"].includes(s)
      )
    : TAG_SLUGS;

  const raw: GammaMarket[] = [];

  // Sequential tag-slug sweeps
  for (const slug of slugs) {
    const batch = await gammaFetch(
      `${GAMMA_BASE}/markets?tag_slug=${encodeURIComponent(slug)}&active=true&closed=false&limit=200`
    );
    console.log(`[gamma] slug="${slug}" → ${batch.length} raw`);
    raw.push(...batch);
    await new Promise((r) => setTimeout(r, 80));
  }

  // Paginated sweep (pages 0-4) to catch anything not in known tag slugs
  if (!category) {
    for (let page = 0; page < 5; page++) {
      const batch = await gammaFetch(
        `${GAMMA_BASE}/markets?active=true&closed=false&limit=200&offset=${page * 200}`
      );
      console.log(`[gamma] page=${page} → ${batch.length} raw`);
      raw.push(...batch);
      if (batch.length < 200) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`[gamma] total raw across all sources: ${raw.length}`);

  // Deduplicate → filter → sort
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
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
