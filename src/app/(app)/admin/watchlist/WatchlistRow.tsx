"use client";

import type { MarketOverride } from "@prisma/client";
import { Pin, PinOff } from "lucide-react";

export function WatchlistRow({ override: o }: { override: MarketOverride }) {
  const update = async (patch: Partial<MarketOverride>) => {
    await fetch(`/api/admin/watchlist/${o.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    window.location.reload();
  };

  return (
    <tr className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50">
      <td className="px-4 py-3">
        <button onClick={() => update({ pinned: !o.pinned })} className="text-zinc-500 hover:text-zinc-100">
          {o.pinned ? <Pin size={14} className="text-amber-400" /> : <PinOff size={14} />}
        </button>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-300">{o.asset}</td>
      <td className="px-4 py-3 text-zinc-400 text-xs max-w-sm truncate">{o.question}</td>
      <td className="px-4 py-3">
        <select
          value={o.signalOverride ?? ""}
          onChange={(e) => update({ signalOverride: e.target.value || null })}
          className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-100 focus:outline-none"
        >
          <option value="">Auto</option>
          <option value="UP">UP</option>
          <option value="DOWN">DOWN</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          defaultValue={o.notes ?? ""}
          onBlur={(e) => { if (e.target.value !== (o.notes ?? "")) update({ notes: e.target.value }); }}
          className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-100 focus:outline-none placeholder-zinc-600"
          placeholder="Add note…"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={async () => { await fetch(`/api/admin/watchlist/${o.id}`, { method: "DELETE" }); window.location.reload(); }}
          className="text-xs text-red-500 hover:text-red-400"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}
