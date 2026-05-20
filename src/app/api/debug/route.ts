import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

const BROWSER_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

async function probe(url: string) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text.slice(0, 500);
    }
    const items = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>)?.markets ?? (parsed as Record<string, unknown>)?.events ?? [];
    return {
      url,
      httpStatus: res.status,
      totalReturned: Array.isArray(items) ? (items as unknown[]).length : "n/a",
      sampleFull: Array.isArray(items) ? (items as unknown[]).slice(0, 3) : parsed,
    };
  } catch (err) {
    return { url, error: String(err) };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") ?? "crypto";

  const [marketsResult, eventsResult, noTagResult] = await Promise.all([
    probe(`${GAMMA_BASE}/markets?active=true&closed=false&limit=20&tag_slug=${tag}`),
    probe(`${GAMMA_BASE}/events?active=true&closed=false&limit=10&tag_slug=${tag}`),
    probe(`${GAMMA_BASE}/markets?active=true&closed=false&limit=5`),
  ]);

  return NextResponse.json({ tag, marketsResult, eventsResult, noTagResult });
}
