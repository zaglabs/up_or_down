"use client";

import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export function ModeToggle() {
  const { mode, setMode } = useAppStore();

  return (
    <div className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 p-1">
      <button
        onClick={() => setMode("paper")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
          mode === "paper"
            ? "bg-blue-600 text-white"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        Paper
      </button>
      <button
        onClick={() => setMode("live")}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
          mode === "live"
            ? "bg-emerald-600 text-white"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        Live
      </button>
    </div>
  );
}
