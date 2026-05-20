"use client";

import { useAppStore } from "@/store/app-store";
import { formatCurrency } from "@/lib/utils";

export default function AutoTradePage() {
  const {
    autoTradeEnabled, setAutoTrade,
    autoTradeConfidence, setAutoTradeConfidence,
    maxTradeAmount, setMaxTradeAmount,
    mode,
  } = useAppStore();

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-2xl font-bold text-zinc-100">Auto-Trade</h1>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">

        {/* Toggle */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Enable auto-trade</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Trades execute automatically in {mode === "live" ? "live" : "paper"} mode when AI confidence exceeds your threshold.
            </p>
          </div>
          <button
            onClick={() => setAutoTrade(!autoTradeEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              autoTradeEnabled ? "bg-emerald-600" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                autoTradeEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Confidence threshold */}
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-200">Minimum confidence</p>
            <span className="font-mono text-sm font-bold text-zinc-100">{autoTradeConfidence}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={autoTradeConfidence}
            onChange={(e) => setAutoTradeConfidence(parseInt(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-zinc-600">
            <span>50% — more trades</span>
            <span>95% — fewer trades</span>
          </div>
        </div>

        {/* Max trade size */}
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-200">Max trade size</p>
            <span className="font-mono text-sm font-bold text-zinc-100">{formatCurrency(maxTradeAmount)}</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={maxTradeAmount}
            onChange={(e) => setMaxTradeAmount(parseInt(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-zinc-600">
            <span>$1</span>
            <span>$100</span>
          </div>
        </div>

      </section>

      <p className="text-xs text-zinc-600">
        Settings are saved locally per browser session. Database-backed persistence coming soon.
      </p>
    </div>
  );
}
