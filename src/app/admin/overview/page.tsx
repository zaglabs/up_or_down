"use client";

import useSWR from "swr";
import { useAppStore } from "@/store/app-store";
import { usePaperStore } from "@/store/paper-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { UpDownMarket, MarketPeriod } from "@/lib/polymarket/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const PERIODS: MarketPeriod[] = ["5m", "15m", "1h", "6h", "1d", "1w"];

export default function AdminOverviewPage() {
  const { data: markets, isLoading: marketsLoading } = useSWR<UpDownMarket[]>("/api/markets", fetcher);
  const { data: status } = useSWR("/api/admin/status", fetcher, { revalidateOnFocus: false });
  const { mode, activeProvider, autoTradeEnabled, autoTradeConfidence, maxTradeAmount } = useAppStore();
  const { portfolio } = usePaperStore();

  const periodCounts = (markets ?? []).reduce<Record<string, number>>(
    (acc: Record<string, number>, m: UpDownMarket) => {
      acc[m.period] = (acc[m.period] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const closed = portfolio.closedTrades ?? [];
  const wins = closed.filter((t: { status: string }) => t.status === "resolved_win").length;
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
  const totalPnl = closed.reduce((s: number, t: { pnl?: number }) => s + (t.pnl ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">System status and application statistics</p>
      </div>

      {/* Top-level stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Mode" value={mode} accent={mode === "live"} />
        <StatTile label="AI Provider" value={activeProvider} />
        <StatTile label="Auto-Trade" value={autoTradeEnabled ? "Enabled" : "Disabled"} accent={autoTradeEnabled} />
        <StatTile label="Markets Loaded" value={marketsLoading ? "…" : String(markets?.length ?? 0)} />
      </div>

      {/* Markets by period */}
      <Card>
        <CardHeader>
          <CardTitle>Markets by Period</CardTitle>
        </CardHeader>
        <CardContent>
          {marketsLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {PERIODS.map((p) => (
                <div key={p} className="rounded-lg bg-zinc-800 p-3 text-center">
                  <div className="text-xl font-bold text-zinc-100">{periodCounts[p] ?? 0}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-zinc-500">{p}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API connectivity */}
      <Card>
        <CardHeader>
          <CardTitle>API Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatusRow
            label="Polymarket Gamma API"
            ok={!marketsLoading && (markets?.length ?? 0) > 0}
            loading={marketsLoading}
          />
          <StatusRow
            label={`AI Provider — ${activeProvider}`}
            ok={status?.providers?.[activeProvider] === true}
            loading={!status}
          />
          <StatusRow
            label="Polymarket CLOB API"
            ok={status?.clobReachable === true}
            loading={!status}
          />
        </CardContent>
      </Card>

      {/* Auto-trade config */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Trade Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ConfigRow label="Enabled" value={autoTradeEnabled ? "Yes" : "No"} />
          <ConfigRow label="Min confidence" value={`${autoTradeConfidence}%`} />
          <ConfigRow label="Max trade size" value={formatCurrency(maxTradeAmount)} />
        </CardContent>
      </Card>

      {/* Paper trading stats */}
      <Card>
        <CardHeader>
          <CardTitle>Paper Trading</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Balance" value={formatCurrency(portfolio.balance)} />
            <StatTile label="Open Positions" value={String(portfolio.positions?.length ?? 0)} />
            <StatTile label="Closed Trades" value={String(closed.length)} />
            <StatTile label="Win Rate" value={`${winRate}%`} />
          </div>
          <div className="text-sm">
            <span className="text-zinc-500">Total P&amp;L: </span>
            <span className={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
              {totalPnl >= 0 ? "+" : ""}
              {formatCurrency(totalPnl)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/60 p-4">
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <p className={`text-base font-semibold capitalize ${accent ? "text-emerald-400" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusRow({ label, ok, loading }: { label: string; ok: boolean; loading: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2.5">
      <span className="text-sm text-zinc-300">{label}</span>
      {loading ? (
        <span className="text-xs text-zinc-500">Checking…</span>
      ) : (
        <span className={`text-xs font-medium ${ok ? "text-emerald-400" : "text-red-400"}`}>
          {ok ? "● Connected" : "● Disconnected"}
        </span>
      )}
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-zinc-200">{value}</span>
    </div>
  );
}
