"use client";

import useSWR from "swr";
import { useState } from "react";
import { MarketCard } from "./MarketCard";
import { fetchMarketsClient } from "@/lib/polymarket/client-gamma";
import type { UpDownMarket, MarketCategory, MarketPeriod } from "@/lib/polymarket/types";
import { RefreshCw, AlertCircle } from "lucide-react";

const PERIODS: Array<MarketPeriod | "all"> = ["all", "5m", "15m", "1h", "6h", "1d", "1w"];
const CATEGORIES: Array<MarketCategory | "all"> = ["all", "crypto", "finance"];

export function MarketList() {
  const [category, setCategory] = useState<MarketCategory | "all">("all");
  const [period, setPeriod]     = useState<MarketPeriod | "all">("all");
  const [search, setSearch]     = useState("");

  // Fetch directly from Polymarket in the browser — bypasses the Next.js server
  // so network restrictions on the server don't affect market loading.
  const swrKey = `polymarket-markets-${category}`;
  const { data: markets, isLoading, error, mutate } = useSWR<UpDownMarket[]>(
    swrKey,
    () => fetchMarketsClient(category === "all" ? undefined : category),
    { refreshInterval: 120_000, shouldRetryOnError: false }
  );

  const filtered = (markets ?? []).filter((m) => {
    if (period !== "all" && m.period !== period) return false;
    if (
      search &&
      !m.question.toLowerCase().includes(search.toLowerCase()) &&
      !m.asset.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search markets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                category === c ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase transition-colors ${
                period === p ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={() => mutate()}
          className="ml-auto rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:text-zinc-200"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Count */}
      {!isLoading && !error && markets !== undefined && (
        <p className="text-xs text-zinc-500">
          {filtered.length} market{filtered.length !== 1 ? "s" : ""} shown
          {(period !== "all" || search) && markets.length !== filtered.length
            ? ` of ${markets.length} total`
            : ""}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-400 flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Failed to load markets from Polymarket</p>
            <p className="text-red-500 text-xs mt-1">{String(error?.message ?? error)}</p>
            <p className="text-red-600 text-xs mt-1">
              Check your browser console for the exact error (CORS, network, etc.)
            </p>
            <button onClick={() => mutate()} className="mt-2 text-xs underline text-red-400 hover:text-red-300">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && markets !== undefined && filtered.length === 0 && (
        <div className="rounded-xl border border-zinc-800 p-8 text-center space-y-2">
          <p className="text-zinc-400 font-medium">No directional markets found</p>
          <p className="text-zinc-600 text-xs max-w-sm mx-auto">
            {markets.length === 0
              ? "Polymarket returned 0 markets — check your browser's DevTools console (Network tab) for the request to gamma-api.polymarket.com."
              : `${markets.length} markets from Polymarket but none matched the price-direction filter${period !== "all" ? ` for "${period}"` : ""}.`}
          </p>
          <button onClick={() => mutate()} className="text-xs text-zinc-500 underline hover:text-zinc-300">
            Try again
          </button>
        </div>
      )}

      {/* List */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {filtered.map((market) => (
            <MarketCard key={market.conditionId} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
