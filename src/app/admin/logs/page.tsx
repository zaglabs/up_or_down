import { db } from "@/lib/db";

export default async function LogsPage() {
  const [signals, apiErrors] = await Promise.all([
    db.signalLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.apiLog.findMany({
      where: { error: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-100">Logs</h1>

      {/* Signal logs */}
      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Recent Signal Logs</h2>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                {["Asset", "Direction", "Confidence", "Provider", "Latency", "Time"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">{s.asset}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${s.direction === "UP" ? "text-emerald-400" : s.direction === "DOWN" ? "text-red-400" : "text-zinc-400"}`}>
                      {s.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{s.confidence}%</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{s.provider}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{s.latencyMs ? `${s.latencyMs}ms` : "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 text-xs">{new Date(s.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {signals.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-600">No signals logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* API error logs */}
      <section>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">API Errors</h2>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                {["Service", "Endpoint", "Status", "Error", "Latency", "Time"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apiErrors.map((l) => (
                <tr key={l.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/50">
                  <td className="px-4 py-3 text-xs text-zinc-300">{l.service}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono truncate max-w-xs">{l.endpoint}</td>
                  <td className="px-4 py-3 text-xs text-red-400">{l.statusCode}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 truncate max-w-xs">{l.error}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{l.latencyMs}ms</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {apiErrors.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-600">No API errors logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
