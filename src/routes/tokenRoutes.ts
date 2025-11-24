import { Router } from 'express';
import { z } from 'zod';
import aggregator from '../services/tokenAggregator';
import type { Timeframe } from '../types/token';

const router = Router();

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sortBy: z.enum(['volume', 'priceChange', 'marketCap']).default('volume'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  period: z.enum(['1h', '24h', '7d']).default('24h')
});

type ListParams = z.infer<typeof listSchema>;

router.get('/', async (req, res, next) => {
  try {
    const params = listSchema.parse(req.query) as ListParams;
    const { items, nextCursor } = await aggregator.listTokens({
      limit: params.limit,
      cursor: params.cursor,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      period: params.period as Timeframe
    });
    res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
});

router.get('/:address', async (req, res, next) => {
  try {
    const token = await aggregator.getToken(req.params.address);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    res.json(token);
  } catch (err) {
    next(err);
  }
});

export default router;
