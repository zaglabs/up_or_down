"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePaperStore } from "@/store/paper-store";
import { useAppStore } from "@/store/app-store";
import { formatCurrency, formatPrice } from "@/lib/utils";
import type { UpDownMarket, AISignal, TradeDirection } from "@/lib/polymarket/types";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface Props {
  market: UpDownMarket;
  direction: TradeDirection;
  signal: AISignal | null;
  open: boolean;
  onClose: () => void;
}

export function TradeModal({ market, direction, signal, open, onClose }: Props) {
  const { portfolio, executeTrade } = usePaperStore();
  const { mode } = useAppStore();
  const [amount, setAmount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const tokenId = direction === "UP" ? market.upTokenId : market.downTokenId;
  const currentPrice = direction === "UP" ? market.upPrice : market.downPrice;
  const numAmount = parseFloat(amount) || 0;
  const shares = currentPrice > 0 ? numAmount / currentPrice : 0;
  const payout = shares; // max payout at $1 per share
  const roi = numAmount > 0 ? ((payout - numAmount) / numAmount) * 100 : 0;

  const handleTrade = async () => {
    setError("");
    setLoading(true);

    try {
      if (mode === "paper") {
        const result = executeTrade({
          conditionId: market.conditionId,
          question: market.question,
          asset: market.asset,
          direction,
          tokenId,
          currentPrice,
          amount: numAmount,
          aiSignal: signal ?? undefined,
        });

        if ("error" in result) {
          setError(result.error);
        } else {
          setSuccess(true);
          setTimeout(() => { setSuccess(false); onClose(); }, 1500);
        }
      } else {
        // Live mode — call API
        const res = await fetch("/api/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conditionId: market.conditionId, direction, amount: numAmount, mode: "live" }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error ?? "Trade failed");
        } else {
          setSuccess(true);
          setTimeout(() => { setSuccess(false); onClose(); }, 1500);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className={direction === "UP" ? "text-emerald-400" : "text-red-400"}>
              {direction === "UP" ? <TrendingUp className="inline mr-1" size={16} /> : <TrendingDown className="inline mr-1" size={16} />}
              {direction}
            </span>{" "}
            — {market.question}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Signal context */}
          {signal && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-500">AI Signal ({signal.provider})</p>
              <p className={`text-sm font-semibold ${signal.direction === "UP" ? "text-emerald-400" : "text-red-400"}`}>
                {signal.direction} · {signal.confidence}% confidence
              </p>
              <p className="mt-1 text-xs text-zinc-400">{signal.reasoning}</p>
            </div>
          )}

          {/* Price info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-zinc-800 p-3">
              <p className="text-xs text-zinc-500">Token price</p>
              <p className="text-lg font-mono font-bold text-zinc-100">{formatPrice(currentPrice)}</p>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3">
              <p className="text-xs text-zinc-500">Available</p>
              <p className="text-lg font-mono font-bold text-zinc-100">
                {formatCurrency(mode === "paper" ? portfolio.balance : 0)}
              </p>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs text-zinc-500">Amount (USDC)</label>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="1"
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
              />
              {["5", "10", "25", "50"].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Payout info */}
          <div className="rounded-lg border border-zinc-800 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Shares</span>
              <span className="font-mono text-zinc-300">{shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Max payout</span>
              <span className="font-mono text-zinc-300">{formatCurrency(payout)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ROI if correct</span>
              <span className="font-mono text-emerald-400">{roi.toFixed(0)}%</span>
            </div>
          </div>

          {/* Live mode warning */}
          {mode === "live" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-900 bg-amber-950/30 p-3">
              <AlertTriangle size={14} className="mt-0.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-400">
                This will place a real order on Polymarket using your USDC balance. This action cannot be undone.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {success ? (
            <div className="rounded-md bg-emerald-900/40 p-3 text-center text-sm text-emerald-400">
              Trade executed successfully!
            </div>
          ) : (
            <Button
              className="w-full"
              variant={direction === "UP" ? "up" : "down"}
              onClick={handleTrade}
              disabled={loading || numAmount <= 0}
            >
              {loading ? "Processing..." : mode === "paper" ? `Simulate ${direction} (Paper)` : `Execute ${direction} on Polymarket`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
