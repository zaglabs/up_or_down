import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const providers: Record<string, boolean> = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    kimi: !!process.env.KIMI_API_KEY,
    grok: !!process.env.GROK_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };

  const system: Record<string, boolean> = {
    POLYMARKET_PRIVATE_KEY: !!process.env.POLYMARKET_PRIVATE_KEY,
    LIVE_MODE_ENABLED: !!process.env.LIVE_MODE_ENABLED,
    POLYMARKET_CHAIN_ID: !!process.env.POLYMARKET_CHAIN_ID,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
  };

  let clobReachable = false;
  try {
    const res = await fetch("https://clob.polymarket.com", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    clobReachable = res.ok || res.status < 500;
  } catch {
    clobReachable = false;
  }

  return NextResponse.json(
    { providers, system, clobReachable },
    { headers: { "Cache-Control": "no-store" } }
  );
}
