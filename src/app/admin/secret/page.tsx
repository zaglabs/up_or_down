"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, CheckCircle, Eye, EyeOff, Copy, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface EnvRow {
  key: string;
  description: string;
  sensitive: boolean;
}

const ENV_VARS: EnvRow[] = [
  { key: "ANTHROPIC_API_KEY", description: "Claude AI signal provider", sensitive: true },
  { key: "OPENAI_API_KEY", description: "GPT signal provider fallback", sensitive: true },
  { key: "DEEPSEEK_API_KEY", description: "DeepSeek signal provider", sensitive: true },
  { key: "KIMI_API_KEY", description: "Kimi / Moonshot signal provider", sensitive: true },
  { key: "GROK_API_KEY", description: "xAI Grok signal provider", sensitive: true },
  { key: "GEMINI_API_KEY", description: "Google Gemini signal provider", sensitive: true },
  { key: "LIVE_MODE_ENABLED", description: "Set to 'true' to enable real trades", sensitive: false },
  { key: "POLYMARKET_PRIVATE_KEY", description: "Polygon wallet private key for live trading", sensitive: true },
];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return { copied, copy };
}

export default function SecretPage() {
  const [privateKey, setPrivateKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{ address: string; balance: number } | null>(null);
  const [walletError, setWalletError] = useState("");
  const [showEnvValues, setShowEnvValues] = useState<Record<string, boolean>>({});
  const [envInputs, setEnvInputs] = useState<Record<string, string>>({});
  const { copied, copy } = useCopy();

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
      setWalletError("Network error — try again");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
        <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-300">Sensitive area</p>
          <p className="text-amber-500/80 mt-0.5">
            This page contains private credentials and wallet keys. Do not share screenshots or
            access in untrusted environments. Keys are never logged or persisted by the app.
          </p>
        </div>
      </div>

      {/* Wallet private key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-amber-400" />
            Live Trading Wallet
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Enter your Polygon private key to derive trading credentials. The key is verified
            client-side and never stored.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {walletInfo ? (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-950/40 border border-emerald-900 p-3">
              <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-emerald-400 font-medium">Wallet verified</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-zinc-400 font-mono text-xs">{walletInfo.address}</p>
                  <button
                    onClick={() => copy(walletInfo.address, "addr")}
                    className="text-zinc-600 hover:text-zinc-400"
                  >
                    {copied === "addr" ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>
                <p className="text-zinc-400 text-xs">
                  USDC Balance: {formatCurrency(walletInfo.balance)}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="0x… (Polygon private key)"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-10 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {walletError && <p className="text-xs text-red-400">{walletError}</p>}
              <Button
                onClick={handleVerifyKey}
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

      {/* Environment variables reference */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <p className="text-xs text-zinc-500">
            Reference for all credentials this app uses. Set these in your Vercel project settings
            under Environment Variables. Values entered here are NOT saved.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {ENV_VARS.map(({ key, description, sensitive }) => {
            const val = envInputs[key] ?? "";
            const shown = showEnvValues[key];
            return (
              <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-zinc-200">{key}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
                  </div>
                  {sensitive && (
                    <span className="rounded bg-amber-950/50 border border-amber-900/40 px-1.5 py-0.5 text-xs text-amber-500 shrink-0">
                      sensitive
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={shown ? "text" : "password"}
                      placeholder="Not saved — reference only"
                      value={val}
                      onChange={(e) =>
                        setEnvInputs((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 pr-7 text-xs font-mono text-zinc-300 placeholder-zinc-700 focus:border-zinc-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowEnvValues((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                    >
                      {shown ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                  {val && (
                    <button
                      onClick={() => copy(val, key)}
                      className="rounded border border-zinc-700 px-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {copied === key ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
