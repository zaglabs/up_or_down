import type { AISignal } from "@/lib/polymarket/types";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  signal: AISignal;
}

const INDICATOR_LABELS: Record<string, string> = {
  rsi: "RSI (14)",
  macd: "MACD Histogram",
  bollinger: "Bollinger Position",
  emaCrossover: "EMA 9/21",
  momentum: "Momentum (5-bar)",
  orderBookImbalance: "Order Book Imbalance",
  impliedProbReversion: "Implied Prob.",
};

export function SignalDetail({ signal }: Props) {
  const indicators = Object.entries(signal.indicators);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div
            className={cn(
              "flex items-center gap-1.5 text-lg font-bold",
              signal.direction === "UP" ? "text-emerald-400" : "text-red-400"
            )}
          >
            {signal.direction === "UP" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {signal.direction} — {signal.confidence}% confident
          </div>
          <p className="mt-1 text-xs text-zinc-400">{signal.reasoning}</p>
        </div>
      </div>

      <div className="text-xs text-zinc-500">
        Provider: <span className="capitalize text-zinc-400">{signal.provider}</span>
      </div>

      <div className="space-y-1.5">
        {indicators.map(([key, ind]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="w-36 shrink-0 text-xs text-zinc-500">{INDICATOR_LABELS[key] ?? key}</span>
            <div className="flex-1 rounded-full bg-zinc-800 h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  ind.signal === "UP" ? "bg-emerald-500" : ind.signal === "DOWN" ? "bg-red-500" : "bg-zinc-600"
                )}
                style={{ width: `${Math.abs(ind.value) * 100}%`, maxWidth: "100%" }}
              />
            </div>
            <span
              className={cn(
                "w-12 text-right text-xs font-mono",
                ind.signal === "UP" ? "text-emerald-400" : ind.signal === "DOWN" ? "text-red-400" : "text-zinc-500"
              )}
            >
              {ind.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
