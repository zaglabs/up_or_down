import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// Strictly literal directional outcomes — excludes Yes/No binary markets
const UP_PATTERNS = /^(up|higher|above)$/i;
const DOWN_PATTERNS = /^(down|lower|below)$/i;

function isStrictUpDownMarket(market: GammaMarket): boolean {
  if (!market.tokens || market.tokens.length !== 2) return false;
  const outcomes = market.tokens.map((t) => t.outcome.trim());
  return (
    outcomes.some((o) => UP_PATTERNS.test(o)) &&
    outcomes.some((o) => DOWN_PATTERNS.test(o))
  );
}

function detectCategory(market: GammaMarket): MarketCategory {
  const tags = (market.tags ?? []).map((t) =>
    typeof t === "string" ? t.toLowerCase() : ""
  );
  const q = market.question.toLowerCase();

  const cryptoTags = ["crypto", "bitcoin", "ethereum", "solana", "defi", "nft", "web3"];
  if (tags.some((t) => cryptoTags.includes(t))) return "crypto";

  const cryptoKeywords = [
    "btc", "bitcoin", "eth", "ethereum", "sol", "solana", "doge", "xrp",
    "ada", "matic", "avax", "link", "dot", "uni", "ltc", "bch", "atom",
    "near", "ftm", "algo", "xlm", "vet", "trx", "bnb", "shib", "pepe",
  ];
  if (cryptoKeywords.some((k) => q.includes(k))) return "crypto";

  return "finance";
}

function parseAsset(question: string): string {
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|ALGO|XLM|VET|TRX|BNB|SHIB|PEPE)\b/i,
    /\b(bitcoin|ethereum|solana|dogecoin|cardano|polygon|avalanche|chainlink|polkadot|uniswap|ripple|litecoin)\b/i,
    /\b(S&P|SPX|nasdaq|nasdaq\s?100|gold|oil|crude|EUR|GBP|JPY|EUR\/USD|GBP\/USD)\b/i,
  ];
  for (const p of patterns) {
    const m = question.match(p);
    if (m) return m[1].toUpperCase().replace(/\s+/g, "");
  }
  const firstCap = question.match(/\b([A-Z]{2,6})\b/);
  return firstCap ? firstCap[1] : "ASSET";
}

function parsePeriod(
  question: string,
  endDate: string,
  startDate: string
): MarketPeriod {
  const q = question.toLowerCase();
  if (q.match(/\b5[\s-]?min/)) return "5m";
  if (q.match(/\b15[\s-]?min/)) return "15m";
  if (q.match(/\b1[\s-]?h(our)?r?\b/) || q.includes("hourly")) return "1h";
  if (q.match(/\b6[\s-]?h(our)?r?\b/)) return "6h";
  if (q.match(/\b(daily|1[\s-]?day|today|24[\s-]?h)/)) return "1d";
  if (q.match(/\b(weekly|1[\s-]?week|7[\s-]?day)/)) return "1w";

  try {
    const diffMs =
      new Date(endDate).getTime() - new Date(startDate).getTime();
    if (diffMs <= 10 * 60_000) return "5m";
    if (diffMs <= 20 * 60_000) return "15m";
    if (diffMs <= 2 * 3_600_000) return "1h";
    if (diffMs <= 12 * 3_600_000) return "6h";
    if (diffMs <= 2 * 86_400_000) return "1d";
  } catch {}
  return "1d";
}

function normalizeMarket(market: GammaMarket): UpDownMarket | null {
  if (!isStrictUpDownMarket(market)) return null;

  const upToken = market.tokens.find((t) => UP_PATTERNS.test(t.outcome.trim()));
  const downToken = market.tokens.find((t) =>
    DOWN_PATTERNS.test(t.outcome.trim())
  );
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
    period: parsePeriod(
      market.question,
      market.endDateIso || market.endDate,
      market.startDate
    ),
    endDateIso: market.endDateIso || market.endDate,
    upTokenId: upToken.tokenId,
    downTokenId: downToken.tokenId,
    upPrice: isNaN(upPrice) ? 0.5 : upPrice,
    downPrice: isNaN(downPrice) ? 0.5 : downPrice,
    volume24h: parseFloat(market.volume || "0"),
    liquidity: parseFloat(market.liquidity || "0"),
    negRisk: market.negRisk ?? false,
    category: detectCategory(market),
    slug: market.slug,
  };
}

async function fetchGammaPage(offset: number, limit = 200): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  // Sort by volume descending so high-activity Up/Down markets surface first
  url.searchParams.set("order", "volume");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    console.error(`Gamma API ${res.status} at offset ${offset}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data.markets ?? []);
}

async function fetchTagSlug(
  slug: string,
  limit = 200
): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  url.searchParams.set("tag_slug", slug);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("order", "volume");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.markets ?? []);
}

export async function fetchUpDownMarkets(
  category?: MarketCategory
): Promise<UpDownMarket[]> {
  const raw: GammaMarket[] = [];

  if (category) {
    // Targeted fetch for a specific category
    const slugs =
      category === "crypto"
        ? ["crypto", "bitcoin", "ethereum", "solana"]
        : ["financials", "economics", "commodities", "forex"];

    for (const slug of slugs) {
      const batch = await fetchTagSlug(slug);
      raw.push(...batch);
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }
  } else {
    // Broad paginated sweep — fetch up to 1000 markets sorted by volume
    // so the most active Up/Down markets appear early
    const PAGE_SIZE = 200;
    const MAX_PAGES = 5;

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchGammaPage(page * PAGE_SIZE, PAGE_SIZE);
      raw.push(...batch);
      if (batch.length < PAGE_SIZE) break; // Last page
      if (page < MAX_PAGES - 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    // Also sweep known tag slugs in case volume-sorted pagination missed any
    const extraSlugs = [
      "crypto",
      "bitcoin",
      "ethereum",
      "financials",
      "economics",
    ];
    for (const slug of extraSlugs) {
      const batch = await fetchTagSlug(slug);
      raw.push(...batch);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Filter, normalize, deduplicate
  const seen = new Set<string>();
  const results: UpDownMarket[] = [];

  for (const m of raw) {
    if (seen.has(m.conditionId)) continue;
    seen.add(m.conditionId);
    const normalized = normalizeMarket(m);
    if (normalized) results.push(normalized);
  }

  // Sort by volume descending
  return results.sort((a, b) => b.volume24h - a.volume24h);
}

export async function fetchMarketByConditionId(
  conditionId: string
): Promise<GammaMarket | null> {
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
