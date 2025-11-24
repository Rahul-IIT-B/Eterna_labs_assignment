import { EventEmitter } from 'events';
import env from '../config/env';
import redis from '../config/redis';
import { fetchDexScreenerTokens } from '../providers/dexscreener';
import type { DexScreenerToken } from '../providers/dexscreener';
import { fetchJupiterTokens } from '../providers/jupiter';
import type { JupiterToken } from '../providers/jupiter';
import logger from '../utils/logger';
import type { TokenQueryOptions, TokenSummary, Timeframe } from '../types/token';

const TOKEN_KEY_PREFIX = 'token:';
const SORT_KEY_PREFIX = 'tokens:sort:';

const getSortKey = (sort: string, period: Timeframe) => `${SORT_KEY_PREFIX}${sort}:${period}`;

export class TokenAggregator extends EventEmitter {
  private cache = new Map<string, TokenSummary>();
  private refreshing = false;

  constructor() {
    super();
  }

  async refresh(): Promise<void> {
    if (!redis.status || redis.status === 'end') {
      await redis.connect();
    }
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      const [dex, jupiter] = await Promise.all([
        fetchDexScreenerTokens(env.DEXSCREENER_SEARCH_QUERY),
        fetchJupiterTokens(env.JUPITER_SEARCH_QUERY)
      ]);

      const merged = this.mergeTokens(dex, jupiter);
      await this.persist(merged);
      logger.info({ count: merged.length }, 'Aggregator refresh complete');
    } catch (err) {
      logger.error({ err }, 'Aggregator refresh failed');
    } finally {
      this.refreshing = false;
    }
  }

  private mergeTokens(dexTokens: DexScreenerToken[], jupTokens: JupiterToken[]): TokenSummary[] {
    const map = new Map<string, TokenSummary>();

    for (const token of dexTokens) {
      if (!token.baseToken?.symbol) continue;
      const address = token.address ?? token.baseToken.symbol;
      const summary: TokenSummary = {
        address,
        name: token.baseToken.name,
        symbol: token.baseToken.symbol,
        protocol: token.dexId ?? null,
        price: token.priceUsd ? Number(token.priceUsd) : 0,
        priceChange: {
          '1h': token.priceChange?.h1 ? Number(token.priceChange.h1) : null,
          '24h': token.priceChange?.h24 ? Number(token.priceChange.h24) : null,
          '7d': null
        },
        volume: {
          '1h': token.volume?.h1 ?? null,
          '24h': token.volume?.h24 ?? null,
          '7d': null
        },
        liquidity: token.liquidity?.usd ?? null,
        marketCap: token.fdv ?? null,
        transactions: token.txns?.h1 ? token.txns.h1.buys + token.txns.h1.sells : null,
        sourceIds: token.dexId ? [token.dexId] : [],
        lastUpdated: token.pairCreatedAt ?? Date.now()
      };
      map.set(address, summary);
    }

    for (const token of jupTokens) {
      const address = token.address;
      const existing = map.get(address);
      const price = token.info.priceInfo?.pricePerToken ?? existing?.price ?? 0;
      const merged: TokenSummary = {
        address,
        name: token.name,
        symbol: token.symbol,
        protocol: existing?.protocol ?? null,
        price,
        priceChange: {
          '1h': token.info.priceInfo?.priceChange?.hour ?? existing?.priceChange['1h'] ?? null,
          '24h': token.info.priceInfo?.priceChange?.day ?? existing?.priceChange['24h'] ?? null,
          '7d': token.info.priceInfo?.priceChange?.week ?? existing?.priceChange['7d'] ?? null
        },
        volume: {
          '1h': existing?.volume['1h'] ?? null,
          '24h': token.info.dailyVolume ?? existing?.volume['24h'] ?? null,
          '7d': existing?.volume['7d'] ?? null
        },
        liquidity: existing?.liquidity ?? null,
        marketCap: token.info.marketCap ?? existing?.marketCap ?? null,
        transactions: existing?.transactions ?? null,
        sourceIds: Array.from(new Set([...(existing?.sourceIds ?? []), 'jupiter'])),
        lastUpdated: Date.now()
      };
      map.set(address, merged);
    }

    this.cache = map;
    return Array.from(map.values());
  }

  private async persist(tokens: TokenSummary[]): Promise<void> {
    const pipeline = redis.pipeline();
    const ttl = env.CACHE_TTL_SECONDS;

    for (const token of tokens) {
      pipeline.set(`${TOKEN_KEY_PREFIX}${token.address}`, JSON.stringify(token), 'EX', ttl);
      this.updateSortSets(pipeline, token);
    }

    await pipeline.exec();
    this.emit('snapshot', tokens);
  }

  private updateSortSets(pipeline: ReturnType<typeof redis.pipeline>, token: TokenSummary) {
    const volumes = token.volume;
    const priceChange = token.priceChange;
    const marketCap = token.marketCap ?? 0;

    (['1h', '24h', '7d'] as Timeframe[]).forEach((period) => {
      const volumeScore = volumes[period] ?? 0;
      const priceScore = priceChange[period] ?? 0;
      const volumeKey = getSortKey('volume', period);
      const priceKey = getSortKey('priceChange', period);
      const marketKey = getSortKey('marketCap', period);

      pipeline.zadd(volumeKey, volumeScore, token.address);
      pipeline.expire(volumeKey, env.CACHE_TTL_SECONDS);

      pipeline.zadd(priceKey, priceScore, token.address);
      pipeline.expire(priceKey, env.CACHE_TTL_SECONDS);

      pipeline.zadd(marketKey, marketCap, token.address);
      pipeline.expire(marketKey, env.CACHE_TTL_SECONDS);
    });
  }

  async listTokens(
    options: TokenQueryOptions
  ): Promise<{ items: TokenSummary[]; nextCursor?: string }> {
    const { sortBy, sortDir, limit, cursor, period } = options;
    const key = getSortKey(sortBy, period);
    const start = cursor ? Number(Buffer.from(cursor, 'base64').toString('utf8')) : 0;
    const windowEnd = start + limit;
    const range =
      sortDir === 'asc'
        ? await redis.zrange(key, start, windowEnd)
        : await redis.zrevrange(key, start, windowEnd);
    const addresses = range.slice(0, limit);

    const tokens: Array<TokenSummary | null> = await Promise.all(
      addresses.map((address) => this.getToken(address))
    );
    const items = tokens.filter((token): token is TokenSummary => token !== null);
    const hasMore = range.length > limit;
    const nextIndex = start + limit;
    const nextCursor = hasMore ? Buffer.from(String(nextIndex)).toString('base64') : undefined;

    return { items, nextCursor };
  }

  async getToken(address: string): Promise<TokenSummary | null> {
    if (this.cache.has(address)) return this.cache.get(address) ?? null;

    const json = await redis.get(`${TOKEN_KEY_PREFIX}${address}`);
    if (json) {
      const token: TokenSummary = JSON.parse(json);
      this.cache.set(address, token);
      return token;
    }

    return null;
  }

  getSnapshot(): TokenSummary[] {
    return Array.from(this.cache.values());
  }
}

const aggregator = new TokenAggregator();
export default aggregator;
