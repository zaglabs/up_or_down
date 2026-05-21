import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CLOB_BASE  = "https://clob.polymarket.com";

// Mimic a real browser so WAFs don't block the request
const BROWSER_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://polymarket.com/",
  Origin: "https://polymarket.com",
};

// ── Tier 1: literal directional token outcomes ────────────────────────────────
const TOKEN_UP   = /^(up|higher|above)\b/i;
const TOKEN_DOWN = /^(down|lower|below)\b/i;

// ── Tier 2: Yes/No markets where the question is about price direction ─────────
const DIRECTION_WORDS =
  /\b(higher|lower|above|below|exceed|surpass|reach|break|rally|rise|fall|drop|crash|gain|lose|bullish|bearish|pump|dump|outperform|underperform|go up|go down|end (up|down|higher|lower|above|below)|close (above|below|higher|lower))\b/i;

const FINANCIAL_ASSET =
  /\b(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple|bnb|ada|cardano|avax|avalanche|matic|polygon|link|chainlink|uni|uniswap|dot|polkadot|atom|cosmos|near|ltc|litecoin|bch|shib|pepe|trx|algo|xlm|vet|ftm|crypto|s&p|spx|sp500|nasdaq|dow|djia|gold|silver|oil|crude|wti|brent|eur|gbp|jpy|forex|stock|index|equity|commodity)\b/i;

type MarketKind = "directional-token" | "directional-yes-no" | null;

function classifyMarket(market: GammaMarket): MarketKind {
  if (!market.tokens || market.tokens.length !== 2) return null;
  const outcomes = market.tokens.map((t) => t.outcome.trim());

  // Tier 1 — literal Higher/Lower/Up/Down tokens
  if (outcomes.some((o) => TOKEN_UP.test(o)) && outcomes.some((o) => TOKEN_DOWN.test(o))) {
    return "directional-token";
  }

  // Tier 2 — Yes/No but question is about asset price direction
  const norm = outcomes.map((o) => o.toLowerCase()).sort().join("|");
  if (norm === "no|yes" && FINANCIAL_ASSET.test(market.question) && DIRECTION_WORDS.test(market.question)) {
    return "directional-yes-no";
  }

  return null;
}

function detectCategory(market: GammaMarket): MarketCategory {
  const tags = (market.tags ?? []).map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
  const q    = market.question.toLowerCase();
  const cryptoTags = ["crypto","bitcoin","ethereum","solana","defi","nft","web3","altcoin"];
  if (tags.some((t) => cryptoTags.some((c) => t.includes(c)))) return "crypto";
  const cryptoKw = ["btc","bitcoin","eth","ethereum","sol","solana","doge","xrp","bnb","ada","avax","matic","link","dot","shib","pepe","crypto","defi"];
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
    if (diff <= 10 * 60_000)     return "5m";
    if (diff <= 20 * 60_000)     return "15m";
    if (diff <= 2 * 3_600_000)   return "1h";
    if (diff <= 12 * 3_600_000)  return "6h";
    if (diff <= 2 * 86_400_000)  return "1d";
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
    const isBearish = /\b(fall|drop|crash|below|lower|decline|lose|dump|go down|end (down|lower|below)|close (below|lower))\b/i.test(market.question);
    upToken   = isBearish ? noToken  : yesToken;
    downToken = isBearish ? yesToken : noToken;
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

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function timedFetch(url: string, timeoutMs = 8_000): Promise<Response> {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function gammaFetch(url: string): Promise<GammaMarket[]> {
  try {
    const res = await timedFetch(url);
    if (!res.ok) {
      const body = await res.text();
      console.error(`[gamma] HTTP ${res.status} | ${url} | ${body.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    const list: unknown = Array.isArray(data) ? data : (data?.markets ?? data?.data ?? []);
    if (!Array.isArray(list)) {
      console.error("[gamma] unexpected shape:", JSON.stringify(data).slice(0, 200));
      return [];
    }
    return list as GammaMarket[];
  } catch (err: any) {
    console.error(`[gamma] fetch error | ${url} | ${err?.message ?? err}`);
    return [];
  }
}

// ── CLOB API (fallback source) ────────────────────────────────────────────────
// Returns markets in CLOB format; we adapt them to GammaMarket.

function adaptClobMarket(m: any): GammaMarket | null {
  try {
    return {
      id:           m.question_id ?? m.condition_id ?? "",
      conditionId:  m.condition_id ?? "",
      slug:         m.market_slug ?? m.slug ?? "",
      question:     m.question ?? "",
      description:  m.description ?? "",
      endDateIso:   m.end_date_iso ?? m.end_date ?? "",
      active:       m.active ?? true,
      closed:       m.closed ?? false,
      tokens: (m.tokens ?? []).map((t: any) => ({
        tokenId: t.token_id ?? t.tokenId ?? "",
        outcome: t.outcome ?? "",
        winner:  t.winner  ?? false,
        price:   typeof t.price === "string" ? parseFloat(t.price) : (t.price ?? 0.5),
      })),
      tags:         m.tags ?? [],
      category:     m.category ?? "",
      volume:       String(m.volume ?? m.volume_24hr ?? "0"),
      liquidity:    String(m.liquidity ?? "0"),
      startDate:    m.start_date ?? m.startDate ?? "",
      endDate:      m.end_date   ?? m.endDate   ?? "",
      outcomePrices: m.outcome_prices ?? m.outcomePrices ?? "[]",
      negRisk:      m.neg_risk ?? m.negRisk ?? false,
    };
  } catch {
    return null;
  }
}

async function fetchClobPage(nextCursor = ""): Promise<{ markets: GammaMarket[]; next: string }> {
  const url = nextCursor
    ? `${CLOB_BASE}/markets?next_cursor=${encodeURIComponent(nextCursor)}`
    : `${CLOB_BASE}/markets`;
  try {
    const res = await timedFetch(url);
    if (!res.ok) { console.error(`[clob] HTTP ${res.status}`); return { markets: [], next: "" }; }
    const data = await res.json();
    const raw: any[] = data?.data ?? [];
    return {
      markets: raw.map(adaptClobMarket).filter((m): m is GammaMarket => m !== null),
      next: data?.next_cursor ?? "",
    };
  } catch (err: any) {
    console.error(`[clob] fetch error: ${err?.message ?? err}`);
    return { markets: [], next: "" };
  }
}

// ── Tag slugs ─────────────────────────────────────────────────────────────────

const TAG_SLUGS = [
  "crypto","bitcoin","ethereum","solana","defi","altcoins",
  "financials","economics","commodities","forex","stocks",
  "prices","price-prediction","crypto-prices","up-or-down",
];

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  const slugs = category
    ? TAG_SLUGS.filter((s) =>
        category === "crypto"
          ? ["crypto","bitcoin","ethereum","solana","defi","altcoins","prices","crypto-prices","up-or-down"].includes(s)
          : ["financials","economics","commodities","forex","stocks","prices"].includes(s)
      )
    : TAG_SLUGS;

  const raw: GammaMarket[] = [];

  // ── Source 1: Gamma API tag sweeps ──────────────────────────────────────────
  for (const slug of slugs) {
    const batch = await gammaFetch(
      `${GAMMA_BASE}/markets?tag_slug=${encodeURIComponent(slug)}&active=true&closed=false&limit=200`
    );
    console.log(`[gamma] slug="${slug}" → ${batch.length}`);
    raw.push(...batch);
    await new Promise((r) => setTimeout(r, 80));
  }

  // ── Source 2: Gamma API paginated (no tag filter, pages 0-4) ────────────────
  if (!category) {
    for (let page = 0; page < 5; page++) {
      const batch = await gammaFetch(
        `${GAMMA_BASE}/markets?active=true&closed=false&limit=200&offset=${page * 200}`
      );
      console.log(`[gamma] page=${page} → ${batch.length}`);
      raw.push(...batch);
      if (batch.length < 200) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // ── Source 3: CLOB API (if Gamma returned nothing) ──────────────────────────
  const gammaRaw = raw.length;
  if (gammaRaw === 0) {
    console.log("[clob] gamma returned 0 — trying CLOB API");
    for (let i = 0; i < 5; i++) {
      const { markets, next } = await fetchClobPage(i === 0 ? "" : String(i * 100));
      console.log(`[clob] page=${i} → ${markets.length}`);
      raw.push(...markets);
      if (!next || markets.length === 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`[gamma] total raw: ${raw.length} (gamma=${gammaRaw}, clob=${raw.length - gammaRaw})`);

  // Deduplicate → filter → sort
  const seen = new Set<string>();
  const results: UpDownMarket[] = [];
  for (const m of raw) {
    if (!m.conditionId || seen.has(m.conditionId)) continue;
    seen.add(m.conditionId);
    const norm = normalizeMarket(m);
    if (norm) results.push(norm);
  }

  console.log(`[gamma] after filter: ${results.length}`);
  return results.sort((a, b) => b.volume24h - a.volume24h);
}

export async function fetchMarketByConditionId(conditionId: string): Promise<GammaMarket | null> {
  try {
    const res = await timedFetch(`${GAMMA_BASE}/markets/${conditionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
