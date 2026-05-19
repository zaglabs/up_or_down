"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { AIProviderName } from "@/lib/ai/providers";
import { ShieldAlert, CheckCircle } from "lucide-react";

const AI_PROVIDERS: Array<{ id: AIProviderName; label: string; envVar: string }> = [
  { id: "anthropic", label: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY" },
  { id: "openai", label: "OpenAI (GPT)", envVar: "OPENAI_API_KEY" },
  { id: "deepseek", label: "DeepSeek", envVar: "DEEPSEEK_API_KEY" },
  { id: "kimi", label: "Kimi (Moonshot)", envVar: "KIMI_API_KEY" },
  { id: "grok", label: "xAI Grok", envVar: "GROK_API_KEY" },
  { id: "gemini", label: "Google Gemini", envVar: "GEMINI_API_KEY" },
];

export default function SettingsPage() {
  const {
    activeProvider, setActiveProvider,
    autoTradeEnabled, setAutoTrade,
    autoTradeConfidence, setAutoTradeConfidence,
    maxTradeAmount, setMaxTradeAmount,
    mode,
  } = useAppStore();

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
        setPrivateKey(""); // Clear from UI after verification
      }
    } catch {
      setWalletError("Network error, try again");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>

      {/* AI Provider */}
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <p className="text-xs text-zinc-500">
            Select which AI model analyzes market signals. Set the corresponding API key as a Vercel environment variable.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {AI_PROVIDERS.map(({ id, label, envVar }) => (
            <button
              key={id}
              onClick={() => setActiveProvider(id)}
              className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors text-left ${
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
        </CardContent>
      </Card>

      {/* Auto-trade settings */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Trade</CardTitle>
          <p className="text-xs text-zinc-500">
            When enabled in {mode === "live" ? "live" : "paper"} mode, trades execute automatically when AI confidence exceeds the threshold.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-300">Auto-trade enabled</label>
            <button
              onClick={() => setAutoTrade(!autoTradeEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoTradeEnabled ? "bg-emerald-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  autoTradeEnabled ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="text-sm text-zinc-300">
              Min confidence to auto-trade: <span className="font-mono text-zinc-100">{autoTradeConfidence}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={autoTradeConfidence}
              onChange={(e) => setAutoTradeConfidence(parseInt(e.target.value))}
              className="mt-1 w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>50% (more trades)</span>
              <span>95% (fewer trades)</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-300">
              Max trade size: <span className="font-mono text-zinc-100">{formatCurrency(maxTradeAmount)}</span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={maxTradeAmount}
              onChange={(e) => setMaxTradeAmount(parseInt(e.target.value))}
              className="mt-1 w-full accent-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Wallet / Live mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-400" />
            Live Trading Wallet
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Enter your Polygon private key to verify your wallet. The key is never stored — only the derived API credentials are used for live trading. Set <code className="text-zinc-400">LIVE_MODE_ENABLED=true</code> in Vercel env vars to enable real trades.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {walletInfo ? (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-950/40 border border-emerald-900 p-3">
              <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-emerald-400 font-medium">Wallet verified</p>
                <p className="text-zinc-400 font-mono text-xs mt-0.5">{walletInfo.address}</p>
                <p className="text-zinc-400 text-xs">USDC Balance: {formatCurrency(walletInfo.balance)}</p>
              </div>
            </div>
          ) : (
            <>
              <input
                type="password"
                placeholder="0x... (your Polygon private key)"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none font-mono"
              />
              {walletError && <p className="text-xs text-red-400">{walletError}</p>}
              <Button
                onClick={handleVerifyKey}
                disabled={!privateKey || verifying}
                variant="secondary"
                className="w-full"
              >
                {verifying ? "Verifying..." : "Verify Wallet"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
