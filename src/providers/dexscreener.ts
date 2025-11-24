import httpClient from '../utils/httpClient';
import logger from '../utils/logger';

const BASE_URL = 'https://api.dexscreener.com/latest/dex';

export interface DexScreenerToken {
  address: string;
  baseToken: { name: string; symbol: string };
  priceUsd?: string;
  priceChange?: {
    h1?: string;
    h24?: string;
    h6?: string;
  };
  volume?: {
    h1?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
  txns?: {
    h1?: { buys: number; sells: number };
  };
  dexId?: string;
}

export const fetchDexScreenerTokens = async (query: string) => {
  try {
    const { data } = await httpClient.get<{ pairs: DexScreenerToken[] }>(`${BASE_URL}/search`, {
      params: { q: query }
    });
    return data.pairs ?? [];
  } catch (err) {
    logger.error({ err }, 'DexScreener fetch failed');
    throw err;
  }
};
