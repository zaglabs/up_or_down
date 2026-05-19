"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppMode } from "@/lib/polymarket/types";
import type { AIProviderName } from "@/lib/ai/providers";

interface AppState {
  mode: AppMode;
  activeProvider: AIProviderName;
  autoTradeEnabled: boolean;
  autoTradeConfidence: number;
  maxTradeAmount: number;
  setMode: (mode: AppMode) => void;
  setActiveProvider: (provider: AIProviderName) => void;
  setAutoTrade: (enabled: boolean) => void;
  setAutoTradeConfidence: (confidence: number) => void;
  setMaxTradeAmount: (amount: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: "paper",
      activeProvider: "anthropic",
      autoTradeEnabled: false,
      autoTradeConfidence: 65,
      maxTradeAmount: 10,
      setMode: (mode) => set({ mode }),
      setActiveProvider: (provider) => set({ activeProvider: provider }),
      setAutoTrade: (enabled) => set({ autoTradeEnabled: enabled }),
      setAutoTradeConfidence: (confidence) => set({ autoTradeConfidence: confidence }),
      setMaxTradeAmount: (amount) => set({ maxTradeAmount: amount }),
    }),
    { name: "updown_app" }
  )
);
