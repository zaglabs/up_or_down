import type { TradeDirection } from "@/lib/polymarket/types";

export type AIProviderName = "anthropic" | "openai" | "deepseek" | "kimi" | "grok" | "gemini";

export interface AIProviderInput {
  asset: string;
  period: string;
  upPrice: number;
  rsi: number;
  macdHistogram: number;
  bollingerPosition: number;
  momentum: number;
  obImbalance: number;
  technicalDirection: TradeDirection;
  technicalConfidence: number;
}

export interface AIProviderOutput {
  direction: TradeDirection;
  confidence: number;
  reasoning: string;
}

export type AIProviderFn = (input: AIProviderInput) => Promise<AIProviderOutput>;

const SYSTEM_PROMPT = `You are a prediction market trading analyst. You analyze technical indicators for binary "Up or Down" markets on Polymarket and provide trading signals. Be concise and precise.`;

export function buildUserPrompt(input: AIProviderInput): string {
  return `Analyze this Polymarket "Up or Down" binary market:
- Asset: ${input.asset}
- Time period: ${input.period}
- Current implied UP probability: ${(input.upPrice * 100).toFixed(1)}%
- RSI (14): ${input.rsi.toFixed(1)}
- MACD Histogram: ${input.macdHistogram.toFixed(4)}
- Bollinger Band Position: ${(input.bollingerPosition * 100).toFixed(1)}% (0%=lower band, 100%=upper band)
- 5-bar Momentum: ${(input.momentum * 100).toFixed(2)}%
- Order Book Imbalance: ${(input.obImbalance * 100).toFixed(1)}% (positive=more bids=bullish)
- Technical Signal: ${input.technicalDirection} at ${input.technicalConfidence}% confidence

Respond with JSON only: {"direction":"UP"|"DOWN","confidence":0-100,"reasoning":"1-2 sentence explanation"}`;
}

function parseAIResponse(text: string, fallback: AIProviderOutput): AIProviderOutput {
  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);  // dotAll-free version
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.direction !== "UP" && parsed.direction !== "DOWN") return fallback;
    return {
      direction: parsed.direction,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || fallback.confidence)),
      reasoning: String(parsed.reasoning || fallback.reasoning),
    };
  } catch {
    return fallback;
  }
}

// Anthropic
async function anthropicProvider(input: AIProviderInput): Promise<AIProviderOutput> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return parseAIResponse(text, { direction: input.technicalDirection, confidence: input.technicalConfidence, reasoning: "" });
}

// OpenAI
async function openaiProvider(input: AIProviderInput): Promise<AIProviderOutput> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key });

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  const text = resp.choices[0]?.message?.content ?? "";
  return parseAIResponse(text, { direction: input.technicalDirection, confidence: input.technicalConfidence, reasoning: "" });
}

// DeepSeek (OpenAI-compatible)
async function deepseekProvider(input: AIProviderInput): Promise<AIProviderOutput> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.deepseek.com" });

  const resp = await client.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  const text = resp.choices[0]?.message?.content ?? "";
  return parseAIResponse(text, { direction: input.technicalDirection, confidence: input.technicalConfidence, reasoning: "" });
}

// Kimi/Moonshot (OpenAI-compatible)
async function kimiProvider(input: AIProviderInput): Promise<AIProviderOutput> {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new Error("KIMI_API_KEY not set");

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.moonshot.cn/v1" });

  const resp = await client.chat.completions.create({
    model: "moonshot-v1-8k",
    max_tokens: 200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  const text = resp.choices[0]?.message?.content ?? "";
  return parseAIResponse(text, { direction: input.technicalDirection, confidence: input.technicalConfidence, reasoning: "" });
}

// Grok (OpenAI-compatible)
async function grokProvider(input: AIProviderInput): Promise<AIProviderOutput> {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error("GROK_API_KEY not set");

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" });

  const resp = await client.chat.completions.create({
    model: "grok-3-mini",
    max_tokens: 200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  const text = resp.choices[0]?.message?.content ?? "";
  return parseAIResponse(text, { direction: input.technicalDirection, confidence: input.technicalConfidence, reasoning: "" });
}

// Gemini
async function geminiProvider(input: AIProviderInput): Promise<AIProviderOutput> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n${buildUserPrompt(input)}`);
  const text = result.response.text();
  return parseAIResponse(text, { direction: input.technicalDirection, confidence: input.technicalConfidence, reasoning: "" });
}

export const PROVIDERS: Record<AIProviderName, AIProviderFn> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  deepseek: deepseekProvider,
  kimi: kimiProvider,
  grok: grokProvider,
  gemini: geminiProvider,
};

export function getActiveProvider(): AIProviderName {
  const env = process.env.ACTIVE_AI_PROVIDER as AIProviderName;
  if (env && env in PROVIDERS) return env;
  return "anthropic";
}

export async function runAIProvider(
  provider: AIProviderName,
  input: AIProviderInput
): Promise<AIProviderOutput> {
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`Unknown provider: ${provider}`);
  return fn(input);
}

export { SYSTEM_PROMPT };
