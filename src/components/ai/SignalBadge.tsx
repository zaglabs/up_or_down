import { Badge } from "@/components/ui/badge";
import type { AISignal } from "@/lib/polymarket/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  signal: AISignal | null;
  loading?: boolean;
}

export function SignalBadge({ signal, loading }: Props) {
  if (loading) {
    return (
      <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-800" />
    );
  }

  if (!signal) {
    return <Badge variant="neutral">No signal</Badge>;
  }

  const isUp = signal.direction === "UP";
  const conf = signal.confidence;

  if (conf < 40) {
    return (
      <Badge variant="neutral" className="gap-1">
        <Minus size={10} />
        NEUTRAL {conf}%
      </Badge>
    );
  }

  return (
    <Badge variant={isUp ? "up" : "down"} className="gap-1">
      {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {signal.direction} {conf}%
    </Badge>
  );
}
