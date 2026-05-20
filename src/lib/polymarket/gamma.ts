import type { GammaMarket, UpDownMarket, MarketCategory, MarketPeriod } from "./types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// Strict directional outcomes — exclude yes/no to avoid false positives on
// entertainment markets. Yes/No only accepted when question mentions a price asset.
const UP_PATTERNS = /^(up|higher|above)$/i;
const DOWN_PATTERNS = /^(down|lower|below)$/i;

const BROWSER_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

// Known tradeable assets — required for Yes/No markets to qualify as price markets.
// Intentionally excludes common words shared with non-crypto entities (e.g. "avalanche"
// matches the Colorado Avalanche NHL team). Use ticker symbols where ambiguous.
const PRICE_ASSET_RE =
  /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|ALGO|XLM|VET|TRX|BNB|bitcoin|ethereum|solana|dogecoin|cardano|polygon|chainlink|polkadot|uniswap|ripple|litecoin|binance|S&P|SPX|nasdaq|gold|oil|EUR|GBP|JPY|crude)\b/i;

// For Yes/No markets the question must also contain directional/price language.
const DIRECTIONAL_QUESTION_RE =
  /\b(up or down|higher or lower|be (up|down|higher|lower)|go (up|down)|close (above|below|higher|lower)|price.{0,20}(above|below|higher|lower)|above \$|below \$|will .{0,30}(rise|fall|increase|decrease|up\?|down\?))\b/i;

// The Gamma API list endpoint returns outcomes/prices/tokenIds as JSON strings,
// NOT a tokens array. Parse them defensively to handle both string and array forms.
function parseJsonStringField(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).replace(/^"|"$/g, "").trim());
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).replace(/^"|"$/g, "").trim());
  } catch {}
  return [];
}

function isUpDownMarket(market: GammaMarket): boolean {
  // Prefer outcomes field (present in list responses) over tokens array (individual fetch only).
  const outcomeSource = market.outcomes ?? (market.tokens ? JSON.stringify(market.tokens.map((t) => t.outcome)) : undefined);
  const outcomes = parseJsonStringField(outcomeSource);
  if (outcomes.length !== 2) return false;

  const hasUp = outcomes.some((o) => UP_PATTERNS.test(o));
  const hasDown = outcomes.some((o) => DOWN_PATTERNS.test(o));
  if (hasUp && hasDown) return true;

  // Accept Yes/No only when the question mentions a known asset AND uses
  // directional/price language — prevents corporate-action or sports markets
  // that happen to mention a crypto-related word from slipping through.
  const hasYes = outcomes.some((o) => /^yes$/i.test(o));
  const hasNo = outcomes.some((o) => /^no$/i.test(o));
  if (hasYes && hasNo) {
    return PRICE_ASSET_RE.test(market.question) && DIRECTIONAL_QUESTION_RE.test(market.question);
  }

  return false;
}

function parseAsset(question: string): string {
  const patterns = [
    /\b(BTC|ETH|SOL|DOGE|ADA|MATIC|AVAX|LINK|DOT|UNI|XRP|LTC|BCH|ATOM|NEAR|FTM|ALGO|XLM|VET|TRX|BNB)\b/i,
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

function parsePeriod(question: string, endDate: string, startDate: string): MarketPeriod {
  const q = question.toLowerCase();
  if (q.includes("5 min") || q.includes("5min") || q.includes("5-min")) return "5m";
  if (q.includes("15 min") || q.includes("15min") || q.includes("15-min")) return "15m";
  if (q.includes("1 hour") || q.includes("1hour") || q.includes("hourly") || q.includes("1h")) return "1h";
  if (q.includes("6 hour") || q.includes("6h")) return "6h";
  if (q.includes("daily") || q.includes("1 day") || q.includes("today") || q.includes("24h")) return "1d";
  if (q.includes("weekly") || q.includes("1 week") || q.includes("7 day")) return "1w";

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

  const outcomeSource = market.outcomes ?? (market.tokens ? JSON.stringify(market.tokens.map((t) => t.outcome)) : undefined);
  const outcomes = parseJsonStringField(outcomeSource);
  const prices = parseJsonStringField(market.outcomePrices);
  const tokenIds = parseJsonStringField(market.clobTokenIds);

  // Fall back to tokens array for tokenIds when fetching individual markets.
  const resolvedTokenIds =
    tokenIds.length === 2
      ? tokenIds
      : market.tokens?.map((t) => t.tokenId) ?? [];

  const upIdx = outcomes.findIndex((o) => UP_PATTERNS.test(o) || /^yes$/i.test(o));
  const downIdx = outcomes.findIndex((o) => DOWN_PATTERNS.test(o) || /^no$/i.test(o));
  if (upIdx === -1 || downIdx === -1) return null;

  const upTokenId = resolvedTokenIds[upIdx];
  const downTokenId = resolvedTokenIds[downIdx];
  if (!upTokenId || !downTokenId) return null;

  // Try token price first (individual fetch), then outcomePrices array.
  const upTokenPrice = market.tokens?.[upIdx]?.price;
  const downTokenPrice = market.tokens?.[downIdx]?.price;
  const upPrice = upTokenPrice ?? parseFloat(prices[upIdx] ?? "0.5");
  const downPrice = downTokenPrice ?? parseFloat(prices[downIdx] ?? "0.5");

  return {
    conditionId: market.conditionId,
    question: market.question,
    asset: parseAsset(market.question),
    period: parsePeriod(market.question, market.endDateIso || market.endDate, market.startDate),
    endDateIso: market.endDateIso || market.endDate,
    upTokenId,
    downTokenId,
    upPrice: isNaN(upPrice) ? 0.5 : upPrice,
    downPrice: isNaN(downPrice) ? 0.5 : downPrice,
    volume24h: parseFloat(market.volume || "0"),
    liquidity: parseFloat(market.liquidity || "0"),
    negRisk: market.negRisk ?? false,
    category,
    slug: market.slug,
  };
}

async function fetchGammaPage(params: Record<string, string>): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/markets`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await fetch(url.toString(), { headers: BROWSER_HEADERS, next: { revalidate: 60 } } as any);
    if (!res.ok) {
      console.error(`Gamma API error: ${res.status} — ${url}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data.markets ?? []);
  } catch (err) {
    console.error(`Gamma fetch failed: ${err}`);
    return [];
  }
}

async function fetchGammaEvents(tagSlug: string): Promise<GammaMarket[]> {
  const url = new URL(`${GAMMA_BASE}/events`);
  url.searchParams.set("tag_slug", tagSlug);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "50");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await fetch(url.toString(), { headers: BROWSER_HEADERS, next: { revalidate: 60 } } as any);
    if (!res.ok) return [];
    const data = await res.json();
    const events: Array<{ markets?: GammaMarket[] }> = Array.isArray(data)
      ? data
      : (data.events ?? []);
    return events.flatMap((e) => e.markets ?? []);
  } catch {
    return [];
  }
}

// Polymarket "up or down" price markets use the pattern <asset>-updown.
// The generic "crypto" tag returns broad crypto-culture content, not price markets.
const CATEGORY_TAGS: Record<"crypto" | "finance", string[]> = {
  crypto: ["btc-updown", "eth-updown", "sol-updown", "doge-updown", "bnb-updown", "xrp-updown", "crypto"],
  finance: ["gold-updown", "spx-updown", "oil-updown", "financials", "economics"],
};

export async function fetchUpDownMarkets(category?: MarketCategory): Promise<UpDownMarket[]> {
  const tagSets: Array<{ tags: string[]; cat: MarketCategory }> = category
    ? [{ tags: CATEGORY_TAGS[category], cat: category }]
    : [
        { tags: CATEGORY_TAGS.crypto, cat: "crypto" },
        { tags: CATEGORY_TAGS.finance, cat: "finance" },
      ];

  const fetchTasks = tagSets.flatMap(({ tags, cat }) =>
    tags.flatMap((slug) => [
      fetchGammaPage({ tag_slug: slug, active: "true", closed: "false", limit: "100" }).then(
        (markets) =>
          markets.map((m) => normalizeMarket(m, cat)).filter((m): m is UpDownMarket => m !== null)
      ),
      fetchGammaEvents(slug).then((markets) =>
        markets.map((m) => normalizeMarket(m, cat)).filter((m): m is UpDownMarket => m !== null)
      ),
    ])
  );

  const results = await Promise.allSettled(fetchTasks);

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
