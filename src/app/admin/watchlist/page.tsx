import { db } from "@/lib/db";
import { WatchlistRow } from "./WatchlistRow";

export default async function WatchlistPage() {
  const overrides = await db.marketOverride.findMany({ orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Market Watchlist & Overrides</h1>
      <p className="text-sm text-zinc-500">
        Pin markets, add notes, or override AI signals. To add a market, paste its conditionId below.
      </p>

      <AddOverrideForm />

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              {["Pinned", "Asset", "Question", "Signal Override", "Notes", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => <WatchlistRow key={o.id} override={o} />)}
            {overrides.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-600">No markets pinned yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddOverrideForm() {
  return (
    <form
      action={async (fd: FormData) => {
        "use server";
        const { db: database } = await import("@/lib/db");
        const conditionId = fd.get("conditionId") as string;
        const question = fd.get("question") as string;
        const asset = fd.get("asset") as string;
        if (!conditionId || !question || !asset) return;
        await database.marketOverride.upsert({
          where: { conditionId },
          create: { conditionId, question, asset, pinned: true },
          update: { pinned: true },
        });
      }}
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
    >
      <p className="text-xs font-medium text-zinc-400 mb-3">Add Market to Watchlist</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <input name="conditionId" placeholder="Condition ID (0x...)" required
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none font-mono" />
        <input name="question" placeholder="Question" required
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none" />
        <input name="asset" placeholder="Asset (BTC, ETH…)" required
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none" />
        <button type="submit"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition-colors">
          Add
        </button>
      </div>
    </form>
  );
}
