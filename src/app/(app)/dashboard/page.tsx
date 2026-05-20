import { MarketList } from "@/components/markets/MarketList";
import { BalanceCard } from "@/components/portfolio/BalanceCard";

export const metadata = { title: "Markets — UpOrDown" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Up/Down Markets</h1>
          <p className="mt-1 text-sm text-zinc-500">
            AI-powered signals for Polymarket binary prediction markets
          </p>
        </div>
        <div className="w-64 shrink-0 hidden md:block">
          <BalanceCard />
        </div>
      </div>

      <div className="md:hidden">
        <BalanceCard />
      </div>

      <MarketList />
    </div>
  );
}
