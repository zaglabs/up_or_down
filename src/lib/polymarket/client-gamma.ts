// Client-side Polymarket fetcher — runs in the browser, not on the server.
// Bypasses the Next.js API route so the browser's network stack (not Node.js)
// makes the request to gamma-api.polymarket.com.

import type { UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

const TOKEN_UP   = /^(up|higher|above)\b/i;
const TOKEN_DOWN = /^(down|lower|below)\b/i;

const DIRECTION_WORDS =
  /\b(higher|lower|above|below|exceed|surpass|reach|break|rally|rise|fall|drop|crash|gain|lose|bullish|bearish|pump|dump|outperform|underperform)\b/i;

const FINANCIAL_ASSET =
  /\b(btc|bitcoin|eth|ethereum|sol|solana|doge|dogecoin|xrp|ripple|bnb|ada|cardano|avax|avalanche|matic|polygon|link|chainlink|uni|uniswap|dot|polkadot|atom|near|ltc|bch|shib|pepe|trx|algo|crypto|s&p|spx|sp500|nasdaq|dow|gold|silver|oil|crude|eur|gbp|jpy|forex|stock|index|equity)\b/i;

function parseAsset(q: string): string {
  const p = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|BNB|SHIB|PEPE)\b/,
    /\b(bitcoin|ethereum|solana|dogecoin|cardano|polygon|avalanche|chainlink|polkadot|uniswap|ripple|litecoin)\b/i,
    /\b(S&P|SPX|NASDAQ|gold|silver|oil|crude|EUR|GBP|JPY)\b/i,
  ];
  for (const rx of p) { const m = q.match(rx); if (m) return m[1].toUpperCase(); }
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

function normalizeOne(m: any): UpDownMarket | null {
  if (!m.conditionId || !Array.isArray(m.tokens) || m.tokens.length !== 2) return null;

  const outcomes: string[] = m.tokens.map((t: any) => String(t.outcome ?? "").trim());

  let upToken   = m.tokens.find((t: any) => TOKEN_UP.test(String(t.outcome ?? "").trim()));
  let downToken = m.tokens.find((t: any) => TOKEN_DOWN.test(String(t.outcome ?? "").trim()));

  if (!upToken || !downToken) {
    // Fall back to Yes/No directional
    const norm = outcomes.map((o) => o.toLowerCase()).sort().join("|");
    if (norm !== "no|yes") return null;
    if (!FINANCIAL_ASSET.test(m.question ?? "")) return null;
    if (!DIRECTION_WORDS.test(m.question ?? "")) return null;

    const yesT = m.tokens.find((t: any) => t.outcome?.trim().toLowerCase() === "yes");
    const noT  = m.tokens.find((t: any) => t.outcome?.trim().toLowerCase() === "no");
    if (!yesT || !noT) return null;

    const bearish = /\b(fall|drop|crash|below|lower|decline|lose|dump)\b/i.test(m.question ?? "");
    upToken   = bearish ? noT  : yesT;
    downToken = bearish ? yesT : noT;
  }

  if (!upToken || !downToken) return null;

  let outcomePrices: string[] = [];
  try { outcomePrices = JSON.parse(m.outcomePrices ?? "[]"); } catch {}

  const upPrice   = upToken.price   ?? parseFloat(outcomePrices[0] ?? "0.5");
  const downPrice = downToken.price ?? parseFloat(outcomePrices[1] ?? "0.5");

  return {
    conditionId: m.conditionId,
    question:    m.question ?? "",
    asset:       parseAsset(m.question ?? ""),
    period:      parsePeriod(m.question ?? "", m.endDateIso ?? m.endDate ?? "", m.startDate ?? ""),
    endDateIso:  m.endDateIso ?? m.endDate ?? "",
    upTokenId:   upToken.tokenId,
    downTokenId: downToken.tokenId,
    upPrice:     isNaN(upPrice)   ? 0.5 : upPrice,
    downPrice:   isNaN(downPrice) ? 0.5 : downPrice,
    volume24h:   parseFloat(m.volume   ?? "0"),
    liquidity:   parseFloat(m.liquidity ?? "0"),
    negRisk:     m.negRisk ?? false,
    category:    detectCategory(m),
    slug:        m.slug ?? "",
  };
}

async function fetchSlug(slug: string): Promise<any[]> {
  const res = await fetch(
    `${GAMMA_BASE}/markets?tag_slug=${slug}&active=true&closed=false&limit=200`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.markets ?? []);
}

export async function fetchMarketsClient(category?: MarketCategory): Promise<UpDownMarket[]> {
  const slugs =
    category === "crypto"  ? ["crypto", "bitcoin", "ethereum", "solana"] :
    category === "finance" ? ["financials", "economics", "commodities"] :
    ["crypto", "bitcoin", "ethereum", "financials", "economics"];

  const batches = await Promise.all(slugs.map(fetchSlug));
  const raw: any[] = batches.flat();

  const seen = new Set<string>();
  const results: UpDownMarket[] = [];
  for (const m of raw) {
    if (!m.conditionId || seen.has(m.conditionId)) continue;
    seen.add(m.conditionId);
    const norm = normalizeOne(m);
    if (norm) results.push(norm);
  }

  return results.sort((a, b) => b.volume24h - a.volume24h);
}
