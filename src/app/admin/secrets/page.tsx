"use client";

import { useState } from "react";
import useSWR from "swr";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle, ShieldAlert, Eye, EyeOff } from "lucide-react";
import type { AIProviderName } from "@/lib/ai/providers";

const AI_KEYS: Array<{ provider: AIProviderName; label: string; envVar: string }> = [
  { provider: "anthropic", label: "Anthropic Claude", envVar: "ANTHROPIC_API_KEY" },
  { provider: "openai", label: "OpenAI GPT", envVar: "OPENAI_API_KEY" },
  { provider: "deepseek", label: "DeepSeek", envVar: "DEEPSEEK_API_KEY" },
  { provider: "kimi", label: "Kimi (Moonshot)", envVar: "KIMI_API_KEY" },
  { provider: "grok", label: "xAI Grok", envVar: "GROK_API_KEY" },
  { provider: "gemini", label: "Google Gemini", envVar: "GEMINI_API_KEY" },
];

const SYSTEM_VARS: Array<{ key: string; label: string }> = [
  { key: "POLYMARKET_PRIVATE_KEY", label: "Polymarket Wallet Key" },
  { key: "LIVE_MODE_ENABLED", label: "Live Mode Enabled" },
  { key: "POLYMARKET_CHAIN_ID", label: "Polygon Chain ID" },
  { key: "NEXT_PUBLIC_APP_URL", label: "App URL" },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminSecretsPage() {
  const { activeProvider } = useAppStore();
  const { data: status } = useSWR("/api/admin/status", fetcher, { revalidateOnFocus: false });

  const [privateKey, setPrivateKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ address: string; balance: number } | null>(null);
  const [walletError, setWalletError] = useState("");

  const handleVerify = async () => {
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
      setWalletError("Network error — try again");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Secrets</h1>
        <p className="mt-1 text-sm text-zinc-500">
          API keys and sensitive configuration. Set these as Vercel environment variables — never
          commit them to source control.
        </p>
      </div>

      {/* AI provider keys */}
      <Card>
        <CardHeader>
          <CardTitle>AI Provider Keys</CardTitle>
          <p className="text-xs text-zinc-500">
            Key values are never exposed to the client — only whether they are configured on the
            server is shown here.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {AI_KEYS.map(({ provider, label, envVar }) => {
            const configured = status?.providers?.[provider] === true;
            const isActive = activeProvider === provider;

            return (
              <div
                key={envVar}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                  isActive ? "border-zinc-600 bg-zinc-800" : "border-zinc-800 bg-zinc-900/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-200">{label}</span>
                  {isActive && (
                    <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                      active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden font-mono text-xs text-zinc-600 sm:block">{envVar}</span>
                  <span
                    className={`text-xs font-medium ${
                      !status ? "text-zinc-600" : configured ? "text-emerald-400" : "text-zinc-600"
                    }`}
                  >
                    {!status ? "●" : configured ? "● Set" : "● Not set"}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* System variables */}
      <Card>
        <CardHeader>
          <CardTitle>System Variables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {SYSTEM_VARS.map(({ key, label }) => {
            const configured = status?.system?.[key] === true;

            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-2.5"
              >
                <span className="text-sm text-zinc-200">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="hidden font-mono text-xs text-zinc-600 sm:block">{key}</span>
                  <span
                    className={`text-xs font-medium ${
                      !status ? "text-zinc-600" : configured ? "text-emerald-400" : "text-zinc-600"
                    }`}
                  >
                    {!status ? "●" : configured ? "● Set" : "● Not set"}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Wallet verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-400" />
            Live Trading Wallet
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Enter a Polygon private key to verify the wallet address and USDC balance. The key is
            never stored — only the derived address is shown.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {walletInfo ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3">
              <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              <div className="text-sm">
                <p className="font-medium text-emerald-400">Wallet verified</p>
                <p className="mt-0.5 font-mono text-xs text-zinc-400">{walletInfo.address}</p>
                <p className="text-xs text-zinc-400">USDC Balance: {walletInfo.balance.toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="0x… private key"
                  value={privateKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrivateKey(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-10 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s: boolean) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {walletError && <p className="text-xs text-red-400">{walletError}</p>}
              <Button
                onClick={handleVerify}
                disabled={!privateKey || verifying}
                variant="secondary"
                className="w-full"
              >
                {verifying ? "Verifying…" : "Verify Wallet"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
