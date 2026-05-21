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

// Parse a field that may be either a JS array already or a JSON-encoded string
function parseArrayField(val: any): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val.trim().startsWith("[")) {
    try { return JSON.parse(val); } catch {}
  }
  return [];
}

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
  if (ql.match(/\b30[\s-]?min/)) return "1h";  // treat 30m as 1h bucket
  if (ql.match(/\b1[\s-]?h(our)?r?\b/) || ql.includes("hourly")) return "1h";
  if (ql.match(/\b[2-5][\s-]?h(our)?r?\b/)) return "6h";
  if (ql.match(/\b6[\s-]?h(our)?r?\b/)) return "6h";
  if (ql.match(/\b(daily|today|24[\s-]?h)/)) return "1d";
  if (ql.match(/\b(weekly|this week|7[\s-]?day)/)) return "1w";
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms > 0) {
      if (ms <=  8 * 60_000)    return "5m";
      if (ms <= 20 * 60_000)    return "15m";
      if (ms <=  2 * 3_600_000) return "1h";
      if (ms <= 12 * 3_600_000) return "6h";
      if (ms <=  2 * 86_400_000) return "1d";
      return "1w";
    }
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

  // outcomePrices and clobTokenIds can be either arrays or JSON strings
  const outcomePrices  = parseArrayField(m.outcomePrices  ?? m.outcome_prices  ?? []);
  const clobTokenIds   = parseArrayField(m.clobTokenIds   ?? m.clob_token_ids  ?? []);

  // ── Build a normalised tokens array ────────────────────────────────────────
  // The Gamma list API returns outcome names in `outcomes` (array or JSON string),
  // while the tokens array is usually empty for list responses.
  let tokens: any[] = Array.isArray(m.tokens) && m.tokens.length === 2 ? m.tokens : [];

  if (tokens.length !== 2) {
    // outcomes may be an array ["Higher","Lower"] or JSON string '["Higher","Lower"]'
    const outcomeNames = parseArrayField(m.outcomes ?? m.outcome_names ?? []);

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
  const endDate   = m.endDateIso ?? m.end_date_iso ?? m.endDate ?? m.end_date ?? "";
  const startDate = m.startDate  ?? m.start_date   ?? "";

  return {
    conditionId,
    question,
    asset:       parseAsset(question),
    period:      parsePeriod(question, endDate, startDate),
    endDateIso:  endDate,
    upTokenId:   upToken.tokenId   ?? upToken.token_id   ?? "",
    downTokenId: downToken.tokenId ?? downToken.token_id ?? "",
    upPrice:     isNaN(upPrice)    ? 0.5 : upPrice,
    downPrice:   isNaN(downPrice)  ? 0.5 : downPrice,
    volume24h:   parseFloat(m.volume ?? m.volumeNum ?? m.volume_24hr ?? "0") || 0,
    liquidity:   parseFloat(m.liquidity ?? m.liquidityNum ?? "0") || 0,
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

// Paginate a single tag slug: fetches `pages` pages of 100 each
async function fetchSlugPaginated(slug: string, pages: number, useProxy = false): Promise<any[]> {
  const results: any[] = [];
  for (let page = 0; page < pages; page++) {
    const target = [
      `${GAMMA_BASE}/markets`,
      `?tag_slug=${encodeURIComponent(slug)}`,
      `&active=true&closed=false`,
      `&limit=100&offset=${page * 100}`,
    ].join("");
    const url = useProxy ? `${CORS_PROXY}${encodeURIComponent(target)}` : target;
    const batch = (await tryFetch(url)) ?? [];
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
}

// Fetch markets sorted by soonest end date — surfaces 5m/15m/1h markets
async function fetchBySoonestExpiry(pages: number, useProxy = false): Promise<any[]> {
  const results: any[] = [];
  for (let page = 0; page < pages; page++) {
    const target = [
      `${GAMMA_BASE}/markets`,
      `?active=true&closed=false`,
      `&limit=100&offset=${page * 100}`,
      `&order=endDateIso&ascending=true`,
    ].join("");
    const url = useProxy ? `${CORS_PROXY}${encodeURIComponent(target)}` : target;
    const batch = (await tryFetch(url)) ?? [];
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
}

// Fetch top markets by volume without tag filter
async function fetchByVolume(pages: number, useProxy = false): Promise<any[]> {
  const results: any[] = [];
  for (let page = 0; page < pages; page++) {
    const target = [
      `${GAMMA_BASE}/markets`,
      `?active=true&closed=false`,
      `&limit=100&offset=${page * 100}`,
      `&order=volumeNum&ascending=false`,
    ].join("");
    const url = useProxy ? `${CORS_PROXY}${encodeURIComponent(target)}` : target;
    const batch = (await tryFetch(url)) ?? [];
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
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
  sampleOutcomes: string[];
  error?: string;
}

let lastDiagnostics: FetchDiagnostics | null = null;

export function getLastDiagnostics(): FetchDiagnostics | null {
  return lastDiagnostics;
}

// ── Main export ───────────────────────────────────────────────────────────────

// Key slugs — 3 pages each (up to 300 per slug)
const SLUGS_CRYPTO  = ["crypto", "bitcoin", "ethereum", "solana"];
const SLUGS_FINANCE = ["financials", "economics", "commodities"];
const SLUGS_ALL     = [...SLUGS_CRYPTO, ...SLUGS_FINANCE];
const PAGES_PER_SLUG = 3;

// Sort priority: shorter durations appear first in the default view
const PERIOD_PRIORITY: Record<string, number> = {
  "5m": 0, "15m": 1, "1h": 2, "6h": 3, "1d": 4, "1w": 5,
};

export async function fetchMarketsClient(category?: MarketCategory): Promise<UpDownMarket[]> {
  const slugs =
    category === "crypto"  ? SLUGS_CRYPTO :
    category === "finance" ? SLUGS_FINANCE :
    SLUGS_ALL;

  let raw: any[] = [];
  let usingProxy = false;
  const slugBreakdown: Record<string, number> = {};

  async function runDirectPasses() {
    // Tag-slug pages + soonest-expiry pages + volume pages — all in parallel
    const [slugResults, expiryResults, volResults] = await Promise.all([
      Promise.all(slugs.map((s) => fetchSlugPaginated(s, PAGES_PER_SLUG, false))),
      fetchBySoonestExpiry(5, false),   // 500 markets sorted by nearest end date
      fetchByVolume(3, false),           // 300 top-volume markets
    ]);

    for (let i = 0; i < slugs.length; i++) {
      slugBreakdown[slugs[i]] = slugResults[i].length;
      console.log(`[polymarket] slug="${slugs[i]}" → ${slugResults[i].length}`);
      raw.push(...slugResults[i]);
    }
    slugBreakdown["__expiry"] = expiryResults.length;
    slugBreakdown["__volume"] = volResults.length;
    console.log(`[polymarket] expiry-sorted → ${expiryResults.length}, volume-sorted → ${volResults.length}`);
    raw.push(...expiryResults, ...volResults);
  }

  await runDirectPasses();

  // CORS proxy fallback
  if (raw.length === 0) {
    console.log("[polymarket] direct returned 0 — trying CORS proxy");
    usingProxy = true;

    const [slugResults, expiryResults, volResults] = await Promise.all([
      Promise.all(slugs.map((s) => fetchSlugPaginated(s, PAGES_PER_SLUG, true))),
      fetchBySoonestExpiry(5, true),
      fetchByVolume(3, true),
    ]);

    for (let i = 0; i < slugs.length; i++) {
      slugBreakdown[`proxy:${slugs[i]}`] = slugResults[i].length;
      raw.push(...slugResults[i]);
    }
    raw.push(...expiryResults, ...volResults);
  }

  storeDiag("rawTotal", raw.length);
  console.log(`[polymarket] total raw (before dedup): ${raw.length}`);

  if (raw.length > 0) {
    const s = raw[0];
    console.log("[polymarket] sample field check:", {
      q: (s.question ?? "").slice(0, 80),
      outcomes: s.outcomes,
      outcomePrices: s.outcomePrices,
      clobTokenIds: s.clobTokenIds,
      endDateIso: s.endDateIso ?? s.endDate,
    });
  }

  // ── Deduplicate → normalise ───────────────────────────────────────────────
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

  const sampleOutcomes = raw.slice(0, 10).map((m: any) => {
    const outArr = parseArrayField(m.outcomes ?? m.tokens ?? []);
    const outStr = outArr.length
      ? outArr.join(" / ")
      : `RAW:${JSON.stringify(m.outcomes ?? null).slice(0, 40)}`;
    return `"${(m.question ?? "").slice(0, 55)}…" → [${outStr}]`;
  });

  lastDiagnostics = {
    rawTotal: raw.length,
    filteredTotal: results.length,
    usingProxy,
    slugBreakdown,
    sampleOutcomes,
  };

  // Sort: shortest duration first, then by volume within same period
  return results.sort((a, b) => {
    const pa = PERIOD_PRIORITY[a.period] ?? 99;
    const pb = PERIOD_PRIORITY[b.period] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.volume24h - a.volume24h;
  });
}
