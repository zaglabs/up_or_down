"use client";

import useSWR from "swr";
import { useState } from "react";
import { MarketCard } from "./MarketCard";
import type { UpDownMarket, MarketCategory, MarketPeriod } from "@/lib/polymarket/types";
import { RefreshCw } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PERIODS: Array<MarketPeriod | "all"> = ["all", "5m", "15m", "1h", "6h", "1d", "1w"];
const CATEGORIES: Array<MarketCategory | "all"> = ["all", "crypto", "finance"];

export function MarketList() {
  const [category, setCategory] = useState<MarketCategory | "all">("all");
  const [period, setPeriod] = useState<MarketPeriod | "all">("all");
  const [search, setSearch] = useState("");

  const url = category !== "all" ? `/api/markets?category=${category}` : "/api/markets";
  const { data: markets, isLoading, error, mutate } = useSWR<UpDownMarket[]>(url, fetcher, {
    refreshInterval: 60_000,
  });

  const filtered = (markets ?? []).filter((m) => {
    if (period !== "all" && m.period !== period) return false;
    if (search && !m.question.toLowerCase().includes(search.toLowerCase()) && !m.asset.toLowerCase().includes(search.toLowerCase())) return false;
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
                category === c
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-200"
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
                period === p
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-200"
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

      {/* Market count */}
      {!isLoading && (
        <p className="text-xs text-zinc-500">
          {filtered.length} market{filtered.length !== 1 ? "s" : ""} found
        </p>
      )}

      {/* States */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-800" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
          Failed to load markets. Check your connection and try again.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-zinc-800 p-8 text-center text-zinc-500">
          No up/down markets found for the selected filters.
        </div>
      )}

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
