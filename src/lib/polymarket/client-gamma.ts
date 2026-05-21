// Client-side Polymarket fetcher — runs in the browser.
// Tries direct fetch first, then a CORS proxy if the direct call is blocked.

import type { UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE  = "https://gamma-api.polymarket.com";
const CORS_PROXY  = "https://corsproxy.io/?url=";

// ── Outcome matchers (Tier 1) ─────────────────────────────────────────────────
const TOKEN_UP   = /^(up|higher|above)\b/i;
const TOKEN_DOWN = /^(down|lower|below)\b/i;

// ── Question matchers (Tier 2: Yes/No markets about price direction) ──────────
const DIRECTION_WORDS =
  /\b(higher|lower|above|below|up|down|exceed|surpass|reach|hit|cross|touch|break|rally|rise|fall|drop|crash|gain|lose|bullish|bearish|pump|dump|outperform|underperform|increase|decrease|appreciate|depreciate|surge|spike|plunge|climb|dip|recover|rebound|correct|advance|decline|overtake|close above|close below|end above|end below|finish above|finish below|go above|go below|go up|go down|be above|be below|trade above|trade below|stay above|stay below)\b/i;

const FINANCIAL_ASSET =
  /\b(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple|bnb|ada|cardano|avax|avalanche|matic|polygon|link|chainlink|uni|uniswap|dot|polkadot|atom|cosmos|near|ltc|litecoin|bch|shib|pepe|trx|tron|algo|xlm|stellar|vet|ftm|fantom|crypto|s&p|spx|sp500|nasdaq|qqq|dow|djia|gold|silver|oil|crude|wti|brent|eur|gbp|jpy|aud|cad|chf|forex|stock|index|equity|commodity|nifty|dax|ftse|cac)\b/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAsset(q: string): string {
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|BNB|SHIB|PEPE|TRX|ALGO|XLM|VET)\b/,
    /\b(bitcoin|ethereum|solana|dogecoin|cardano|polygon|avalanche|chainlink|polkadot|uniswap|ripple|litecoin)\b/i,
    /\b(S&P|SPX|NASDAQ|gold|silver|oil|crude|EUR|GBP|JPY)\b/i,
  ];
  for (const p of patterns) {
    const m = q.match(p);
    if (m) return m[1].toUpperCase();
  }
  const cap = q.match(/\b([A-Z]{2,6})\b/);
  return cap ? cap[1] : "ASSET";
}

function parsePeriod(q: string, end: string, start: string): MarketPeriod {
  const ql = q.toLowerCase();
  if (ql.match(/\b5[\s-]?min/))  return "5m";
  if (ql.match(/\b15[\s-]?min/)) return "15m";
  if (ql.match(/\b1[\s-]?h(our)?r?\b/) || ql.includes("hourly")) return "1h";
  if (ql.match(/\b6[\s-]?h(our)?r?\b/)) return "6h";
  if (ql.match(/\b(daily|today|24[\s-]?h)/)) return "1d";
  if (ql.match(/\b(weekly|this week|7[\s-]?day)/)) return "1w";
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 10 * 60_000)    return "5m";
    if (ms <= 20 * 60_000)    return "15m";
    if (ms <= 2 * 3_600_000)  return "1h";
    if (ms <= 12 * 3_600_000) return "6h";
    if (ms <= 2 * 86_400_000) return "1d";
  } catch {}
  return "1d";
}

function detectCategory(m: any): MarketCategory {
  const tags = (m.tags ?? []).map((t: any) => (typeof t === "string" ? t.toLowerCase() : ""));
  const q    = (m.question ?? "").toLowerCase();
  if (tags.some((t: string) => ["crypto","bitcoin","ethereum","solana","defi","nft"].includes(t))) return "crypto";
  if (["btc","bitcoin","eth","ethereum","sol","solana","doge","xrp","bnb","ada","avax","matic","link","shib","pepe","crypto"].some((k) => q.includes(k))) return "crypto";
  return "finance";
}

// ── Normalise a raw market object ─────────────────────────────────────────────

export function normaliseMarket(m: any): UpDownMarket | null {
  const conditionId = m.conditionId ?? m.condition_id;
  if (!conditionId) return null;

  // Parse outcome prices and token IDs regardless of token source
  let outcomePrices: string[] = [];
  try { outcomePrices = JSON.parse(m.outcomePrices ?? m.outcome_prices ?? "[]"); } catch {}

  let clobTokenIds: string[] = [];
  try { clobTokenIds = JSON.parse(m.clobTokenIds ?? m.clob_token_ids ?? "[]"); } catch {}

  // ── Build a normalised tokens array ────────────────────────────────────────
  // The Gamma list API returns outcomes as a JSON string in `outcomes`, not
  // as a populated `tokens` array. Reconstruct synthetic token objects so the
  // rest of the pipeline is unchanged.
  let tokens: any[] = Array.isArray(m.tokens) && m.tokens.length === 2 ? m.tokens : [];

  if (tokens.length !== 2) {
    // Try parsing the `outcomes` JSON string (e.g. '["Higher","Lower"]')
    let outcomeNames: string[] = [];
    try { outcomeNames = JSON.parse(m.outcomes ?? m.outcome_names ?? "[]"); } catch {}

    if (outcomeNames.length === 2) {
      tokens = outcomeNames.map((name: string, i: number) => ({
        outcome:  name,
        tokenId:  clobTokenIds[i] ?? "",
        price:    parseFloat(outcomePrices[i] ?? "0.5"),
      }));
    }
  }

  if (tokens.length !== 2) return null;

  const getOutcome = (t: any) => String(t.outcome ?? t.outcome_name ?? "").trim();

  const outcomes = tokens.map(getOutcome);

  // ── Tier 1: literal directional tokens ────────────────────────────────────
  let upToken   = tokens.find((t) => TOKEN_UP.test(getOutcome(t)));
  let downToken = tokens.find((t) => TOKEN_DOWN.test(getOutcome(t)));

  // ── Tier 2: Yes/No with directional question about a financial asset ───────
  if (!upToken || !downToken) {
    const norm = outcomes.map((o) => o.toLowerCase()).sort().join("|");
    if (norm !== "no|yes") return null;

    const question = m.question ?? "";
    if (!FINANCIAL_ASSET.test(question)) return null;
    if (!DIRECTION_WORDS.test(question)) return null;

    const yesT = tokens.find((t) => getOutcome(t).toLowerCase() === "yes");
    const noT  = tokens.find((t) => getOutcome(t).toLowerCase() === "no");
    if (!yesT || !noT) return null;

    // Bearish-framed question → Yes means price went DOWN
    const bearish = /\b(fall|drop|crash|below|lower|decline|lose|dump|go down|end below|close below|finish below|stay below|trade below)\b/i.test(question);
    upToken   = bearish ? noT  : yesT;
    downToken = bearish ? yesT : noT;
  }

  if (!upToken || !downToken) return null;

  const getPrice = (t: any) => {
    const v = t.price ?? t.token_price;
    return typeof v === "string" ? parseFloat(v) : (typeof v === "number" ? v : NaN);
  };

  const upIdx   = tokens.indexOf(upToken);
  const downIdx = tokens.indexOf(downToken);
  const upPrice   = getPrice(upToken)   || parseFloat(outcomePrices[upIdx]   ?? "0.5") || 0.5;
  const downPrice = getPrice(downToken) || parseFloat(outcomePrices[downIdx] ?? "0.5") || 0.5;

  const question = m.question ?? "";
  const endDate  = m.endDateIso ?? m.end_date_iso ?? m.endDate ?? m.end_date ?? "";
  const startDate = m.startDate ?? m.start_date ?? "";

  return {
    conditionId,
    question,
    asset:       parseAsset(question),
    period:      parsePeriod(question, endDate, startDate),
    endDateIso:  endDate,
    upTokenId:   upToken.tokenId ?? upToken.token_id ?? "",
    downTokenId: downToken.tokenId ?? downToken.token_id ?? "",
    upPrice:     isNaN(upPrice)   ? 0.5 : upPrice,
    downPrice:   isNaN(downPrice) ? 0.5 : downPrice,
    volume24h:   parseFloat(m.volume ?? m.volume_24hr ?? "0") || 0,
    liquidity:   parseFloat(m.liquidity ?? "0") || 0,
    negRisk:     m.negRisk ?? m.neg_risk ?? false,
    category:    detectCategory(m),
    slug:        m.slug ?? m.market_slug ?? "",
  };
}

// ── Network helpers ───────────────────────────────────────────────────────────

async function tryFetch(url: string): Promise<any[] | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(`[polymarket] HTTP ${res.status}: ${url}`);
      return null;
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.markets ?? data.data ?? null);
    if (!Array.isArray(list)) {
      console.warn("[polymarket] unexpected shape:", JSON.stringify(data).slice(0, 200));
      return null;
    }
    return list;
  } catch (err) {
    console.warn(`[polymarket] fetch error (${url}):`, err);
    return null;
  }
}

async function fetchSlug(slug: string, useProxy = false): Promise<any[]> {
  const target = `${GAMMA_BASE}/markets?tag_slug=${encodeURIComponent(slug)}&active=true&closed=false&limit=200`;
  const url    = useProxy ? `${CORS_PROXY}${encodeURIComponent(target)}` : target;
  return (await tryFetch(url)) ?? [];
}

async function fetchNoFilter(useProxy = false): Promise<any[]> {
  const target = `${GAMMA_BASE}/markets?active=true&closed=false&limit=100`;
  const url    = useProxy ? `${CORS_PROXY}${encodeURIComponent(target)}` : target;
  return (await tryFetch(url)) ?? [];
}

function storeDiag(key: string, value: any) {
  try { (window as any).__pmDiag = { ...((window as any).__pmDiag ?? {}), [key]: value }; } catch {}
}

// ── Diagnostic result type ────────────────────────────────────────────────────

export interface FetchDiagnostics {
  rawTotal: number;
  filteredTotal: number;
  usingProxy: boolean;
  slugBreakdown: Record<string, number>;
  sampleOutcomes: string[];   // first few market token pairs seen
  error?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

const SLUGS_CRYPTO  = ["crypto", "bitcoin", "ethereum", "solana", "defi"];
const SLUGS_FINANCE = ["financials", "economics", "commodities", "stocks", "prices"];
const SLUGS_EXTRA   = ["up-or-down", "price-prediction", "markets"];
const SLUGS_ALL     = [...SLUGS_CRYPTO, ...SLUGS_FINANCE, ...SLUGS_EXTRA];

let lastDiagnostics: FetchDiagnostics | null = null;

export function getLastDiagnostics(): FetchDiagnostics | null {
  return lastDiagnostics;
}

export async function fetchMarketsClient(category?: MarketCategory): Promise<UpDownMarket[]> {
  const slugs =
    category === "crypto"  ? SLUGS_CRYPTO :
    category === "finance" ? SLUGS_FINANCE :
    SLUGS_ALL;

  let raw: any[] = [];
  let usingProxy = false;
  const slugBreakdown: Record<string, number> = {};

  // ── Pass 1: direct fetch ───────────────────────────────────────────────────
  const directResults = await Promise.all(slugs.map((s) => fetchSlug(s, false)));
  for (let i = 0; i < slugs.length; i++) {
    const batch = directResults[i];
    slugBreakdown[slugs[i]] = (slugBreakdown[slugs[i]] ?? 0) + batch.length;
    console.log(`[polymarket] direct slug="${slugs[i]}" → ${batch.length} markets`);
    if (batch.length > 0) {
      console.log(`[polymarket]   first outcomes: ${batch.slice(0, 3).map((m: any) => m.tokens?.map((t: any) => t.outcome).join("/")).join(", ")}`);
    }
    raw.push(...batch);
  }

  // ── Pass 2: CORS proxy fallback ───────────────────────────────────────────
  if (raw.length === 0) {
    console.log("[polymarket] direct returned 0 — trying CORS proxy");
    usingProxy = true;
    const proxyResults = await Promise.all(slugs.map((s) => fetchSlug(s, true)));
    for (let i = 0; i < slugs.length; i++) {
      const batch = proxyResults[i];
      slugBreakdown[`proxy:${slugs[i]}`] = batch.length;
      console.log(`[polymarket] proxy  slug="${slugs[i]}" → ${batch.length} markets`);
      raw.push(...batch);
    }
  }

  // ── Pass 3: no-filter fallback if still empty ─────────────────────────────
  if (raw.length === 0) {
    console.log("[polymarket] slug fetch returned 0 — trying unfiltered endpoint");
    raw = await fetchNoFilter(false);
    if (raw.length === 0) {
      raw = await fetchNoFilter(true);
      usingProxy = true;
    }
    slugBreakdown["__unfiltered"] = raw.length;
    console.log(`[polymarket] unfiltered → ${raw.length} markets`);
  }

  storeDiag("rawTotal", raw.length);
  console.log(`[polymarket] total raw: ${raw.length}`);

  // Sample outcomes for diagnostics — show both tokens and the outcomes JSON string
  const sampleOutcomes = raw
    .slice(0, 10)
    .map((m: any) => {
      const tokenOuts = Array.isArray(m.tokens) && m.tokens.length
        ? m.tokens.map((t: any) => t.outcome ?? "?").join(" / ")
        : null;
      let outcomeStr = tokenOuts;
      if (!outcomeStr) {
        try {
          const parsed = JSON.parse(m.outcomes ?? m.outcome_names ?? "[]");
          outcomeStr = Array.isArray(parsed) ? parsed.join(" / ") : "?";
        } catch { outcomeStr = "?"; }
      }
      return `"${(m.question ?? "").slice(0, 60)}…" → [${outcomeStr ?? ""}]`;
    });

  // ── Filter & deduplicate ──────────────────────────────────────────────────
  const seen = new Set<string>();
  const results: UpDownMarket[] = [];

  for (const m of raw) {
    const id = m.conditionId ?? m.condition_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const norm = normaliseMarket(m);
    if (norm) results.push(norm);
  }

  storeDiag("filteredTotal", results.length);
  console.log(`[polymarket] after directional filter: ${results.length}`);

  lastDiagnostics = {
    rawTotal: raw.length,
    filteredTotal: results.length,
    usingProxy,
    slugBreakdown,
    sampleOutcomes,
  };

  return results.sort((a, b) => b.volume24h - a.volume24h);
}
