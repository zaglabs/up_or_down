"use client";

import { usePaperStore } from "@/store/paper-store";
import { useAppStore } from "@/store/app-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Activity, TrendingUp, TrendingDown, DollarSign, Layers, Cpu, Wifi } from "lucide-react";
import useSWR from "swr";
import type { UpDownMarket } from "@/lib/polymarket/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${accent ?? "text-zinc-100"}`}>{value}</p>
            {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
          </div>
          <div className="rounded-lg bg-zinc-800 p-2">
            <Icon size={16} className="text-zinc-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { portfolio } = usePaperStore();
  const { mode, activeProvider, autoTradeEnabled, autoTradeConfidence } = useAppStore();

  const { data: markets, isLoading: marketsLoading } = useSWR<UpDownMarket[]>(
    "/api/markets",
    fetcher,
    { refreshInterval: 60_000 }
  );

  const pnl = portfolio.balance - portfolio.initialBalance;
  const pnlPct = ((pnl / portfolio.initialBalance) * 100).toFixed(1);
  const openTrades = portfolio.positions.length;
  const closedTrades = portfolio.closedTrades.length;
  const wins = portfolio.closedTrades.filter((t) => t.status === "resolved_win").length;
  const winRate = closedTrades > 0 ? ((wins / closedTrades) * 100).toFixed(0) : "—";

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Portfolio Balance"
          value={formatCurrency(portfolio.balance)}
          sub={`${pnl >= 0 ? "+" : ""}${formatCurrency(pnl)} (${pnlPct}%)`}
          icon={DollarSign}
          accent={pnl >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <StatCard
          label="Open Positions"
          value={String(openTrades)}
          sub={`${closedTrades} closed`}
          icon={Activity}
        />
        <StatCard
          label="Win Rate"
          value={winRate === "—" ? "—" : `${winRate}%`}
          sub={`${wins} wins / ${closedTrades} total`}
          icon={TrendingUp}
          accent={Number(winRate) >= 50 ? "text-emerald-400" : undefined}
        />
        <StatCard
          label="Live Markets"
          value={marketsLoading ? "..." : String(markets?.length ?? 0)}
          sub="up/down markets"
          icon={Layers}
        />
      </div>

      {/* System status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu size={15} />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
              <span className="text-zinc-400">Mode</span>
              <span className={`font-medium capitalize ${mode === "live" ? "text-amber-400" : "text-emerald-400"}`}>
                {mode}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
              <span className="text-zinc-400">AI Provider</span>
              <span className="font-medium capitalize text-zinc-100">{activeProvider}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
              <span className="text-zinc-400">Auto-Trade</span>
              <span className={`font-medium ${autoTradeEnabled ? "text-emerald-400" : "text-zinc-500"}`}>
                {autoTradeEnabled ? `On (≥${autoTradeConfidence}%)` : "Off"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
              <span className="text-zinc-400">Market Source</span>
              <span className="font-medium text-zinc-100">Polymarket Gamma</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi size={15} />
            Market Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {marketsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : !markets?.length ? (
            <p className="text-sm text-zinc-500">No market data available.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {(["crypto", "finance"] as const).map((cat) => {
                const count = markets.filter((m) => m.category === cat).length;
                const pct = ((count / markets.length) * 100).toFixed(0);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="w-16 capitalize text-zinc-400">{cat}</span>
                    <div className="flex-1 rounded-full bg-zinc-800 h-2">
                      <div
                        className={`h-2 rounded-full ${cat === "crypto" ? "bg-blue-500" : "bg-purple-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-zinc-300">
                      {count} <span className="text-zinc-600">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 border-t border-zinc-800 pt-2">
                <span className="w-16 text-zinc-400">Total</span>
                <div className="flex-1" />
                <span className="w-12 text-right font-medium text-zinc-100">{markets.length}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P&L breakdown */}
      {closedTrades > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown size={15} />
              Trade History Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-zinc-800 p-3">
                <p className="text-xs text-zinc-500">Total Trades</p>
                <p className="mt-1 text-xl font-bold text-zinc-100">{closedTrades}</p>
              </div>
              <div className="rounded-lg bg-emerald-950/40 border border-emerald-900/40 p-3">
                <p className="text-xs text-zinc-500">Wins</p>
                <p className="mt-1 text-xl font-bold text-emerald-400">{wins}</p>
              </div>
              <div className="rounded-lg bg-red-950/40 border border-red-900/40 p-3">
                <p className="text-xs text-zinc-500">Losses</p>
                <p className="mt-1 text-xl font-bold text-red-400">{closedTrades - wins}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
