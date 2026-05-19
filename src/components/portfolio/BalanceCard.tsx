"use client";

import { usePaperStore } from "@/store/paper-store";
import { computePortfolioStats } from "@/lib/paper/engine";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function BalanceCard() {
  const { portfolio, resetPortfolio } = usePaperStore();
  const stats = computePortfolioStats(portfolio);

  const pnlPct = portfolio.initialBalance > 0
    ? ((portfolio.balance + stats.unrealizedPnl - portfolio.initialBalance) / portfolio.initialBalance) * 100
    : 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500">Paper Balance</p>
          <p className="text-2xl font-bold font-mono text-zinc-100">
            {formatCurrency(portfolio.balance)}
          </p>
        </div>
        <button
          onClick={resetPortfolio}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Reset paper portfolio"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-zinc-500">Total P&L</p>
          <p className={cn("text-sm font-semibold font-mono", stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatCurrency(stats.totalPnl)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Return</p>
          <p className={cn("text-sm font-semibold font-mono", pnlPct >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatPercent(pnlPct)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Win Rate</p>
          <p className="text-sm font-semibold font-mono text-zinc-300">
            {stats.winRate.toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}
