import { BalanceCard } from "@/components/portfolio/BalanceCard";
import { PositionTable } from "@/components/portfolio/PositionTable";

export const metadata = { title: "Portfolio — UpOrDown" };

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Portfolio</h1>
      <div className="max-w-sm">
        <BalanceCard />
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400 uppercase tracking-wide">Trade History</h2>
        <PositionTable />
      </div>
    </div>
  );
}
