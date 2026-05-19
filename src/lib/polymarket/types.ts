// Gamma API raw types
export interface GammaToken {
  tokenId: string;
  outcome: string;
  winner: boolean;
  price: number;
}

export interface GammaMarket {
  id: string;
  conditionId: string;
  slug: string;
  question: string;
  description: string;
  endDateIso: string;
  active: boolean;
  closed: boolean;
  tokens: GammaToken[];
  tags: string[];
  category: string;
  volume: string;
  liquidity: string;
  startDate: string;
  endDate: string;
  outcomePrices: string;
  negRisk: boolean;
  icon?: string;
}

// CLOB API types
export interface OrderSummary {
  price: string;
  size: string;
}

export interface OrderBookSummary {
  market: string;
  asset_id: string;
  bids: OrderSummary[];
  asks: OrderSummary[];
  tick_size: string;
  neg_risk: boolean;
  last_trade_price?: string;
  timestamp?: string;
}

export interface MarketPrice {
  t: number;
  p: string;
}

export type PriceHistoryInterval = "max" | "1w" | "1d" | "6h" | "1h";

// App-level types
export type MarketPeriod = "5m" | "15m" | "1h" | "6h" | "1d" | "1w";
export type MarketCategory = "crypto" | "finance";
export type TradeDirection = "UP" | "DOWN";
export type AppMode = "paper" | "live";

export interface UpDownMarket {
  conditionId: string;
  question: string;
  asset: string;
  period: MarketPeriod;
  endDateIso: string;
  upTokenId: string;
  downTokenId: string;
  upPrice: number;
  downPrice: number;
  volume24h: number;
  liquidity: number;
  negRisk: boolean;
  category: MarketCategory;
  slug: string;
}

// AI Signal
export type SignalDirection = "UP" | "DOWN" | "NEUTRAL";

export interface IndicatorSignal {
  value: number;
  signal: SignalDirection;
  weight: number;
}

export interface AISignal {
  direction: TradeDirection;
  confidence: number;
  reasoning: string;
  indicators: {
    rsi: IndicatorSignal;
    macd: IndicatorSignal;
    bollinger: IndicatorSignal;
    emaCrossover: IndicatorSignal;
    momentum: IndicatorSignal;
    orderBookImbalance: IndicatorSignal;
    impliedProbReversion: IndicatorSignal;
  };
  provider: string;
  computedAt: number;
}

// Trading types
export type TradeStatus = "open" | "resolved_win" | "resolved_loss" | "closed";

export interface PaperTrade {
  id: string;
  conditionId: string;
  question: string;
  asset: string;
  direction: TradeDirection;
  tokenId: string;
  entryPrice: number;
  amount: number;
  shares: number;
  status: TradeStatus;
  entryAt: number;
  exitAt?: number;
  exitPrice?: number;
  pnl?: number;
  aiSignal?: AISignal;
}

export interface PaperPortfolio {
  balance: number;
  initialBalance: number;
  positions: PaperTrade[];
  closedTrades: PaperTrade[];
}

// Polymarket CLOB auth
export interface ApiCreds {
  key: string;
  secret: string;
  passphrase: string;
}

export interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  signature: string;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  errorMsg?: string;
  orderHash?: string;
}
