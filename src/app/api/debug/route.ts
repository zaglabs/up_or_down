import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://gamma-api.polymarket.com";

async function probe(label: string, url: string) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}

    const list: any[] = Array.isArray(parsed)
      ? parsed
      : (parsed?.markets ?? parsed?.data ?? []);

    return {
      label,
      status: res.status,
      ok: res.ok,
      total: Array.isArray(list) ? list.length : "?",
      // For each of first 5 markets show: question snippet + token outcomes
      markets: Array.isArray(list)
        ? list.slice(0, 5).map((m: any) => ({
            conditionId: m.conditionId ?? m.condition_id,
            q: (m.question ?? "").slice(0, 100),
            outcomes: (m.tokens ?? []).map((t: any) => t.outcome),
            tags: m.tags ?? [],
            active: m.active,
          }))
        : text.slice(0, 300),
    };
  } catch (e: any) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const slugs = ["crypto", "bitcoin", "financials", "economics", "up-or-down", "prices"];
  const probes = await Promise.all([
    // No filter — what does the raw API return?
    probe("raw (no filter)", `${BASE}/markets?active=true&closed=false&limit=5`),
    // Known tag slugs
    ...slugs.map((s) =>
      probe(`tag=${s}`, `${BASE}/markets?tag_slug=${s}&active=true&closed=false&limit=5`)
    ),
  ]);

  return NextResponse.json({ ts: new Date().toISOString(), probes }, { status: 200 });
}
