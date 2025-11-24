export type Timeframe = "1h" | "24h" | "7d";

export interface TokenMetrics {
  price: number;
  priceChange: {
    "1h": number | null;
    "24h": number | null;
    "7d": number | null;
  };
  volume: {
    "1h": number | null;
    "24h": number | null;
    "7d": number | null;
  };
  liquidity: number | null;
  marketCap: number | null;
  transactions: number | null;
  lastUpdated: number;
}

export interface TokenSummary extends TokenMetrics {
  address: string;
  name: string;
  symbol: string;
  protocol: string | null;
  sourceIds: string[];
}

export interface TokenQueryOptions {
  limit: number;
  cursor?: string;
  sortBy: "volume" | "priceChange" | "marketCap";
  sortDir: "asc" | "desc";
  period: Timeframe;
}
