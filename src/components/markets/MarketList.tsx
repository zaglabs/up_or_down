"use client";

import useSWR from "swr";
import { useState } from "react";
import { MarketCard } from "./MarketCard";
import { fetchMarketsClient, getLastDiagnostics } from "@/lib/polymarket/client-gamma";
import type { UpDownMarket, MarketCategory, MarketPeriod } from "@/lib/polymarket/types";
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

const PERIODS: Array<MarketPeriod | "all"> = ["all", "5m", "15m", "1h", "6h", "1d", "1w"];
const CATEGORIES: Array<MarketCategory | "all"> = ["all", "crypto", "finance"];

export function MarketList() {
  const [category, setCategory] = useState<MarketCategory | "all">("all");
  const [period, setPeriod]     = useState<MarketPeriod | "all">("all");
  const [search, setSearch]     = useState("");
  const [showDiag, setShowDiag] = useState(false);

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

  const diag = getLastDiagnostics();

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
      {!isLoading && !error && markets !== undefined && markets.length > 0 && (
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
        <div className="rounded-xl border border-zinc-800 p-6 text-center space-y-3">

          {/* ── Case A: period filter is the culprit ── */}
          {markets.length > 0 && period !== "all" ? (
            <>
              <p className="text-zinc-400 font-medium">
                No {period.toUpperCase()} markets in the current set
              </p>
              {diag?.periodBreakdown && (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">
                    {markets.length} directional markets matched — available durations:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {(["5m","15m","1h","6h","1d","1w"] as const).map((p) => {
                      const n = diag.periodBreakdown[p] ?? 0;
                      return (
                        <span
                          key={p}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase ${
                            n > 0
                              ? "bg-zinc-700 text-zinc-200"
                              : "bg-zinc-900 text-zinc-600"
                          }`}
                        >
                          {p}: {n}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-zinc-600 pt-1">
                    Select a period with available markets, or choose <strong>ALL</strong> to see everything.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* ── Case B: no directional markets at all ── */
            <>
              <p className="text-zinc-400 font-medium">No directional markets found</p>
              {diag && (
                <div className="text-left space-y-2">
                  <div className="flex gap-4 justify-center text-xs">
                    <span className={diag.rawTotal === 0 ? "text-red-400" : "text-amber-400"}>
                      API returned: <strong>{diag.rawTotal}</strong> raw markets
                      {diag.usingProxy ? " (via CORS proxy)" : " (direct)"}
                    </span>
                    <span className="text-zinc-500">→</span>
                    <span className="text-zinc-400">
                      Directional filter: <strong>{diag.filteredTotal}</strong> matched
                    </span>
                  </div>

                  {diag.rawTotal === 0 ? (
                    <p className="text-xs text-red-500 text-center">
                      Polymarket API unreachable. Check DevTools → Network for gamma-api.polymarket.com.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-amber-500 text-center">
                        {diag.filteredTotal === 0
                          ? "Got markets but none have Up/Down/Higher/Lower/Above/Below outcomes or directional Yes/No questions about financial assets."
                          : `${diag.filteredTotal} matched but all filtered by current search/period.`}
                      </p>
                      <button
                        onClick={() => setShowDiag((v) => !v)}
                        className="flex items-center gap-1 mx-auto text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        {showDiag ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {showDiag ? "Hide" : "Show"} sample markets from API
                      </button>
                      {showDiag && diag.sampleOutcomes.length > 0 && (
                        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-left space-y-1">
                          {diag.sampleOutcomes.map((s, i) => (
                            <p key={i} className="text-xs text-zinc-500 font-mono break-all">{s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

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
