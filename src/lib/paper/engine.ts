import type { PaperPortfolio, PaperTrade, TradeDirection, AISignal, TradeStatus } from "@/lib/polymarket/types";

export const PAPER_INITIAL_BALANCE = parseFloat(process.env.PAPER_INITIAL_BALANCE ?? "1000");

export function createEmptyPortfolio(): PaperPortfolio {
  return {
    balance: PAPER_INITIAL_BALANCE,
    initialBalance: PAPER_INITIAL_BALANCE,
    positions: [],
    closedTrades: [],
  };
}

export interface PaperTradeParams {
  conditionId: string;
  question: string;
  asset: string;
  direction: TradeDirection;
  tokenId: string;
  currentPrice: number;
  amount: number;
  aiSignal?: AISignal;
}

export function executePaperTrade(
  portfolio: PaperPortfolio,
  params: PaperTradeParams
): { trade: PaperTrade; portfolio: PaperPortfolio } | { error: string } {
  const { amount, currentPrice } = params;

  if (amount <= 0) return { error: "Amount must be positive" };
  if (amount < 1) return { error: "Minimum trade is $1 USDC" };
  if (amount > portfolio.balance) return { error: `Insufficient balance: $${portfolio.balance.toFixed(2)} available` };
  if (currentPrice <= 0 || currentPrice >= 1) return { error: "Invalid token price" };

  const shares = amount / currentPrice;
  const trade: PaperTrade = {
    id: `paper-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conditionId: params.conditionId,
    question: params.question,
    asset: params.asset,
    direction: params.direction,
    tokenId: params.tokenId,
    entryPrice: currentPrice,
    amount,
    shares,
    status: "open",
    entryAt: Date.now(),
    aiSignal: params.aiSignal,
  };

  return {
    trade,
    portfolio: {
      ...portfolio,
      balance: portfolio.balance - amount,
      positions: [...portfolio.positions, trade],
    },
  };
}

export function closePaperPosition(
  portfolio: PaperPortfolio,
  tradeId: string,
  exitPrice: number
): PaperPortfolio {
  const idx = portfolio.positions.findIndex((p) => p.id === tradeId);
  if (idx === -1) return portfolio;

  const trade = portfolio.positions[idx];
  const proceeds = exitPrice * trade.shares;
  const pnl = proceeds - trade.amount;

  const closed: PaperTrade = {
    ...trade,
    status: "closed",
    exitAt: Date.now(),
    exitPrice,
    pnl,
  };

  return {
    ...portfolio,
    balance: portfolio.balance + proceeds,
    positions: portfolio.positions.filter((_, i) => i !== idx),
    closedTrades: [...portfolio.closedTrades, closed],
  };
}

export function resolvePosition(
  portfolio: PaperPortfolio,
  tradeId: string,
  outcome: TradeDirection
): PaperPortfolio {
  const idx = portfolio.positions.findIndex((p) => p.id === tradeId);
  if (idx === -1) return portfolio;

  const trade = portfolio.positions[idx];
  const won = trade.direction === outcome;
  const exitPrice = won ? 1.0 : 0.0;
  const proceeds = won ? trade.shares : 0;
  const pnl = proceeds - trade.amount;
  const status: TradeStatus = won ? "resolved_win" : "resolved_loss";

  const resolved: PaperTrade = {
    ...trade,
    status,
    exitAt: Date.now(),
    exitPrice,
    pnl,
  };

  return {
    ...portfolio,
    balance: portfolio.balance + proceeds,
    positions: portfolio.positions.filter((_, i) => i !== idx),
    closedTrades: [...portfolio.closedTrades, resolved],
  };
}

export function computePortfolioStats(portfolio: PaperPortfolio, currentPrices: Record<string, number> = {}) {
  const unrealizedPnl = portfolio.positions.reduce((sum, p) => {
    const current = currentPrices[p.tokenId] ?? p.entryPrice;
    return sum + (current - p.entryPrice) * p.shares;
  }, 0);

  const realizedPnl = portfolio.closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const totalPnl = unrealizedPnl + realizedPnl;

  const closed = portfolio.closedTrades;
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

  const best = closed.reduce<PaperTrade | null>(
    (acc, t) => (!acc || (t.pnl ?? 0) > (acc.pnl ?? 0) ? t : acc),
    null
  );
  const worst = closed.reduce<PaperTrade | null>(
    (acc, t) => (!acc || (t.pnl ?? 0) < (acc.pnl ?? 0) ? t : acc),
    null
  );

  return { unrealizedPnl, realizedPnl, totalPnl, winRate, best, worst };
}
