"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { MarketPrice } from "@/lib/polymarket/types";

interface Props {
  data: MarketPrice[];
  color?: string;
}

export function PriceSparkline({ data, color = "#10b981" }: Props) {
  if (data.length < 2) {
    return <div className="h-8 w-20 rounded bg-zinc-800/50" />;
  }

  const chartData = data.map((d) => ({ p: parseFloat(d.p) }));
  const first = chartData[0].p;
  const last = chartData[chartData.length - 1].p;
  const strokeColor = last >= first ? "#10b981" : "#ef4444";

  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="p"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
