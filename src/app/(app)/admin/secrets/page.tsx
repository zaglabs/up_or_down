"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { ShieldAlert, CheckCircle } from "lucide-react";
import type { AIProviderName } from "@/lib/ai/providers";

const AI_PROVIDERS: Array<{ id: AIProviderName; label: string; envVar: string }> = [
  { id: "anthropic", label: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY" },
  { id: "openai", label: "OpenAI (GPT)", envVar: "OPENAI_API_KEY" },
  { id: "deepseek", label: "DeepSeek", envVar: "DEEPSEEK_API_KEY" },
  { id: "kimi", label: "Kimi (Moonshot)", envVar: "KIMI_API_KEY" },
  { id: "grok", label: "xAI Grok", envVar: "GROK_API_KEY" },
  { id: "gemini", label: "Google Gemini", envVar: "GEMINI_API_KEY" },
];

export default function SecretsPage() {
  const { activeProvider, setActiveProvider } = useAppStore();

  const [privateKey, setPrivateKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ address: string; balance: number } | null>(null);
  const [walletError, setWalletError] = useState("");

  const handleVerifyKey = async () => {
    setVerifying(true);
    setWalletError("");
    setWalletInfo(null);
    try {
      const res = await fetch("/api/settings/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setWalletError(data.error ?? "Invalid key");
      } else {
        setWalletInfo({ address: data.address, balance: data.balance });
        setPrivateKey("");
      }
    } catch {
      setWalletError("Network error, try again");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-bold text-zinc-100">Secrets</h1>

      {/* AI Provider */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">AI Provider</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Select which AI model analyzes market signals. Set the corresponding API key as a Vercel environment variable.
          </p>
        </div>
        <div className="space-y-2">
          {AI_PROVIDERS.map(({ id, label, envVar }) => (
            <button
              key={id}
              onClick={() => setActiveProvider(id)}
              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors text-left ${
                activeProvider === id
                  ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <span>{label}</span>
              <span className="font-mono text-xs text-zinc-600">{envVar}</span>
            </button>
          ))}
          <p className="text-xs text-zinc-600 pt-1">
            Active: <span className="text-zinc-400 capitalize">{activeProvider}</span>. Falls back to technical analysis if API key is missing.
          </p>
        </div>
      </section>

      <div className="border-t border-zinc-800" />

      {/* Live Trading Wallet */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <ShieldAlert size={14} className="text-amber-400" />
            Live Trading Wallet
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Enter your Polygon private key to verify your wallet. The key is never stored — only the derived API credentials are used for live trading.
            Set <code className="text-zinc-400">LIVE_MODE_ENABLED=true</code> in Vercel to enable real trades.
          </p>
        </div>

        {walletInfo ? (
          <div className="flex items-start gap-2 rounded-xl bg-emerald-950/40 border border-emerald-900 p-4">
            <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-emerald-400 font-medium">Wallet verified</p>
              <p className="text-zinc-400 font-mono text-xs mt-1">{walletInfo.address}</p>
              <p className="text-zinc-400 text-xs mt-0.5">USDC Balance: ${walletInfo.balance.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              placeholder="0x... (your Polygon private key)"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none font-mono"
            />
            {walletError && <p className="text-xs text-red-400">{walletError}</p>}
            <button
              onClick={handleVerifyKey}
              disabled={!privateKey || verifying}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {verifying ? "Verifying…" : "Verify Wallet"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
