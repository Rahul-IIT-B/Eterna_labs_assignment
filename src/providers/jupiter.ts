import httpClient from '../utils/httpClient';
import logger from '../utils/logger';

const BASE_URL = 'https://lite-api.jup.ag/tokens/v2/search';

export interface JupiterToken {
  address: string;
  name: string;
  symbol: string;
  info: {
    priceInfo?: {
      pricePerToken?: number;
      priceChange?: {
        hour?: number;
        day?: number;
        week?: number;
      };
    };
    marketCap?: number;
    dailyVolume?: number;
  };
}

export const fetchJupiterTokens = async (query: string) => {
  try {
    const { data } = await httpClient.get<{ data?: JupiterToken[] }>(BASE_URL, {
      params: { query }
    });
    return data.data ?? [];
  } catch (err) {
    logger.error({ err }, 'Jupiter fetch failed');
    throw err;
  }
};
