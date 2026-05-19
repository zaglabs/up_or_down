"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { SignalBadge } from "@/components/ai/SignalBadge";
import { TradeModal } from "@/components/trading/TradeModal";
import { PriceSparkline } from "./PriceSparkline";
import { formatPrice, formatCurrency, timeUntil } from "@/lib/utils";
import type { UpDownMarket, AISignal, TradeDirection, MarketPrice } from "@/lib/polymarket/types";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  market: UpDownMarket;
}

export function MarketCard({ market }: Props) {
  const [tradeDir, setTradeDir] = useState<TradeDirection | null>(null);

  const { data: signal, isLoading: signalLoading } = useSWR<AISignal>(
    `/api/markets/${market.conditionId}/signal`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  const { data: priceHistory } = useSWR<MarketPrice[]>(
    `/api/markets/${market.conditionId}/prices-history?tokenId=${market.upTokenId}&interval=1d&fidelity=10`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  return (
    <>
      <div className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700">
        <div className="flex items-start justify-between gap-3">
          {/* Left: market info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-bold text-zinc-300">
                {market.asset}
              </span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
                {market.period}
              </span>
              <span className={`text-xs ${market.category === "crypto" ? "text-blue-400" : "text-purple-400"}`}>
                {market.category}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-zinc-100 line-clamp-2">
              {market.question}
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {timeUntil(market.endDateIso)}
              </span>
              <span>Vol {formatCurrency(market.volume24h, 0)}</span>
              <span>Liq {formatCurrency(market.liquidity, 0)}</span>
            </div>
          </div>

          {/* Center: sparkline */}
          <div className="shrink-0">
            <PriceSparkline data={priceHistory ?? []} />
          </div>
        </div>

        {/* Bottom row: prices + signal + buttons */}
        <div className="mt-3 flex items-center justify-between gap-3">
          {/* Prices */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <TrendingUp size={12} className="text-emerald-400" />
              <span className="font-mono text-emerald-400">{formatPrice(market.upPrice)}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown size={12} className="text-red-400" />
              <span className="font-mono text-red-400">{formatPrice(market.downPrice)}</span>
            </div>
          </div>

          {/* Signal */}
          <SignalBadge signal={signal ?? null} loading={signalLoading} />

          {/* Trade buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="up"
              size="sm"
              onClick={() => setTradeDir("UP")}
            >
              <TrendingUp size={12} />
              UP
            </Button>
            <Button
              variant="down"
              size="sm"
              onClick={() => setTradeDir("DOWN")}
            >
              <TrendingDown size={12} />
              DOWN
            </Button>
          </div>
        </div>
      </div>

      {tradeDir && (
        <TradeModal
          market={market}
          direction={tradeDir}
          signal={signal ?? null}
          open={!!tradeDir}
          onClose={() => setTradeDir(null)}
        />
      )}
    </>
  );
}
