"use client";

import { usePaperStore } from "@/store/paper-store";
import { formatCurrency, formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { PaperTrade } from "@/lib/polymarket/types";

function TradeRow({ trade, onClose }: { trade: PaperTrade; onClose?: (id: string) => void }) {
  const isOpen = trade.status === "open";
  const pnl = trade.pnl ?? 0;
  const pnlPct = trade.amount > 0 ? (pnl / trade.amount) * 100 : 0;

  return (
    <tr className="border-b border-zinc-800 text-sm hover:bg-zinc-800/40">
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5">
          {trade.direction === "UP"
            ? <TrendingUp size={12} className="text-emerald-400" />
            : <TrendingDown size={12} className="text-red-400" />}
          <span className="font-medium text-zinc-100 text-xs truncate max-w-40">{trade.question}</span>
        </div>
        <span className="ml-5 text-xs text-zinc-500">{trade.asset}</span>
      </td>
      <td className="py-2.5 px-3">
        <span className={cn("font-semibold text-xs", trade.direction === "UP" ? "text-emerald-400" : "text-red-400")}>
          {trade.direction}
        </span>
      </td>
      <td className="py-2.5 px-3 font-mono text-xs text-zinc-300">{formatPrice(trade.entryPrice)}</td>
      <td className="py-2.5 px-3 font-mono text-xs text-zinc-300">{formatCurrency(trade.amount)}</td>
      <td className="py-2.5 px-3 font-mono text-xs text-zinc-300">{trade.shares.toFixed(2)}</td>
      <td className="py-2.5 px-3">
        {isOpen ? (
          <span className="text-xs text-zinc-500">Open</span>
        ) : (
          <span className={cn("text-xs font-mono font-semibold", pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(0)}%)
          </span>
        )}
      </td>
      <td className="py-2.5 px-3">
        <span className={cn("rounded-full px-2 py-0.5 text-xs", {
          "bg-blue-900/50 text-blue-400": isOpen,
          "bg-emerald-900/50 text-emerald-400": trade.status === "resolved_win",
          "bg-red-900/50 text-red-400": trade.status === "resolved_loss",
          "bg-zinc-800 text-zinc-400": trade.status === "closed",
        })}>
          {trade.status.replace("_", " ")}
        </span>
      </td>
      {onClose && isOpen && (
        <td className="py-2.5 px-3">
          <button
            onClick={() => onClose(trade.id)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Close
          </button>
        </td>
      )}
    </tr>
  );
}

export function PositionTable() {
  const { portfolio, closePosition } = usePaperStore();
  const allTrades = [...portfolio.positions, ...portfolio.closedTrades].sort(
    (a, b) => b.entryAt - a.entryAt
  );

  if (allTrades.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 p-8 text-center text-zinc-500 text-sm">
        No trades yet. Go to Markets to place your first paper trade.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500">
            <th className="py-2.5 px-3 text-left">Market</th>
            <th className="py-2.5 px-3 text-left">Dir</th>
            <th className="py-2.5 px-3 text-left">Entry</th>
            <th className="py-2.5 px-3 text-left">Amount</th>
            <th className="py-2.5 px-3 text-left">Shares</th>
            <th className="py-2.5 px-3 text-left">P&L</th>
            <th className="py-2.5 px-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {allTrades.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              onClose={trade.status === "open" ? (id) => closePosition(id, trade.entryPrice * 0.95) : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
