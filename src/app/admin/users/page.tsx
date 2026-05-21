"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Key, Wallet, Eye, EyeOff } from "lucide-react";

const AI_PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY" },
  { id: "openai", label: "OpenAI (GPT)", envVar: "OPENAI_API_KEY" },
  { id: "deepseek", label: "DeepSeek", envVar: "DEEPSEEK_API_KEY" },
  { id: "kimi", label: "Kimi (Moonshot)", envVar: "KIMI_API_KEY" },
  { id: "grok", label: "xAI Grok", envVar: "GROK_API_KEY" },
  { id: "gemini", label: "Google Gemini", envVar: "GEMINI_API_KEY" },
];

interface WalletEntry {
  id: string;
  label: string;
  address: string;
  addedAt: number;
}

function useLocalWallets() {
  const storageKey = "updown_admin_wallets";
  const load = (): WalletEntry[] => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  };
  const save = (wallets: WalletEntry[]) => {
    localStorage.setItem(storageKey, JSON.stringify(wallets));
  };
  return { load, save };
}

export default function UsersPage() {
  const { activeProvider, setActiveProvider } = useAppStore();
  const { load, save } = useLocalWallets();

  const [wallets, setWallets] = useState<WalletEntry[]>(() => load());
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [addError, setAddError] = useState("");
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});

  const addWallet = () => {
    if (!newAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
      setAddError("Must be a valid 0x… Ethereum/Polygon address (42 chars)");
      return;
    }
    const entry: WalletEntry = {
      id: crypto.randomUUID(),
      label: newLabel.trim() || "Unnamed wallet",
      address: newAddress.trim(),
      addedAt: Date.now(),
    };
    const updated = [entry, ...wallets];
    setWallets(updated);
    save(updated);
    setNewLabel("");
    setNewAddress("");
    setAddError("");
  };

  const removeWallet = (id: string) => {
    const updated = wallets.filter((w) => w.id !== id);
    setWallets(updated);
    save(updated);
  };

  return (
    <div className="space-y-6">
      {/* Wallet addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet size={15} />
            Wallet Addresses
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Track Polygon/Ethereum wallet addresses. Stored locally in the browser.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Label (e.g. Main wallet)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-36 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="0x… address"
                value={newAddress}
                onChange={(e) => { setNewAddress(e.target.value); setAddError(""); }}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
              <Button onClick={addWallet} variant="secondary" size="sm">
                <Plus size={14} />
                Add
              </Button>
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
          </div>

          {/* List */}
          {wallets.length === 0 ? (
            <p className="text-sm text-zinc-600">No wallets added yet.</p>
          ) : (
            <div className="space-y-2">
              {wallets.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100">{w.label}</p>
                    <p className="truncate font-mono text-xs text-zinc-500">{w.address}</p>
                  </div>
                  <button
                    onClick={() => removeWallet(w.id)}
                    className="shrink-0 rounded p-1 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key size={15} />
            AI Provider API Keys
          </CardTitle>
          <p className="text-xs text-zinc-500">
            Set the active AI provider and manage which keys are configured. Keys shown here are stored
            as Vercel environment variables — enter them once to see their status. Never stored in the
            browser.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {AI_PROVIDERS.map(({ id, label, envVar }) => {
            const isActive = activeProvider === id;
            const shown = showApiKey[id];
            const val = apiKeyValues[id] ?? "";
            return (
              <div
                key={id}
                className={`rounded-lg border px-3 py-2.5 transition-colors ${
                  isActive ? "border-zinc-500 bg-zinc-800" : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveProvider(id as any)}
                      className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                        isActive ? "border-zinc-100 bg-zinc-100" : "border-zinc-600"
                      }`}
                    />
                    <span className={`text-sm ${isActive ? "text-zinc-100 font-medium" : "text-zinc-400"}`}>
                      {label}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-zinc-600">{envVar}</span>
                </div>

                <div className="mt-2 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={shown ? "text" : "password"}
                      placeholder={`Enter ${envVar} to check…`}
                      value={val}
                      onChange={(e) =>
                        setApiKeyValues((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 pr-7 text-xs font-mono text-zinc-300 placeholder-zinc-700 focus:border-zinc-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowApiKey((prev) => ({ ...prev, [id]: !prev[id] }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                    >
                      {shown ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-zinc-600 pt-1">
            Active provider:{" "}
            <span className="text-zinc-400 capitalize">{activeProvider}</span>. Falls back to
            technical analysis if API key is missing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
