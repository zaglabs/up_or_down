"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PaperPortfolio, PaperTrade, TradeDirection, AISignal } from "@/lib/polymarket/types";
import {
  createEmptyPortfolio,
  executePaperTrade,
  closePaperPosition,
  resolvePosition,
  PAPER_INITIAL_BALANCE,
} from "@/lib/paper/engine";

interface PaperStore {
  portfolio: PaperPortfolio;
  executeTrade: (params: {
    conditionId: string;
    question: string;
    asset: string;
    direction: TradeDirection;
    tokenId: string;
    currentPrice: number;
    amount: number;
    aiSignal?: AISignal;
  }) => { trade: PaperTrade } | { error: string };
  closePosition: (tradeId: string, exitPrice: number) => void;
  resolvePosition: (tradeId: string, outcome: TradeDirection) => void;
  resetPortfolio: () => void;
}

export const usePaperStore = create<PaperStore>()(
  persist(
    (set, get) => ({
      portfolio: createEmptyPortfolio(),

      executeTrade: (params) => {
        const result = executePaperTrade(get().portfolio, params);
        if ("error" in result) return result;
        set({ portfolio: result.portfolio });
        return { trade: result.trade };
      },

      closePosition: (tradeId, exitPrice) => {
        const updated = closePaperPosition(get().portfolio, tradeId, exitPrice);
        set({ portfolio: updated });
      },

      resolvePosition: (tradeId, outcome) => {
        const updated = resolvePosition(get().portfolio, tradeId, outcome);
        set({ portfolio: updated });
      },

      resetPortfolio: () => {
        set({ portfolio: createEmptyPortfolio() });
      },
    }),
    { name: "updown_paper" }
  )
);
