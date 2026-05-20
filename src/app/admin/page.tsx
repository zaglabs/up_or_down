import { db } from "@/lib/db";

export default async function AdminOverview() {
  const [users, signals, trades, apiLogs] = await Promise.all([
    db.user.count(),
    db.signalLog.count(),
    db.tradeLog.count(),
    db.apiLog.count(),
  ]);

  const recentErrors = await db.apiLog.count({
    where: { error: { not: null }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });

  const stats = [
    { label: "Total Users", value: users },
    { label: "Signals Generated", value: signals.toLocaleString() },
    { label: "Trades Logged", value: trades.toLocaleString() },
    { label: "API Calls Today", value: apiLogs.toLocaleString() },
    { label: "Errors (24h)", value: recentErrors, warn: recentErrors > 0 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-100">Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map(({ label, value, warn }) => (
          <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${warn ? "text-red-400" : "text-zinc-100"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
