import cron from 'node-cron';
import env from '../config/env';
import aggregator from '../services/tokenAggregator';
import logger from '../utils/logger';

export const startRefreshJob = () => {
  const intervalSeconds = env.AGGREGATOR_REFRESH_SECONDS;
  const expression = `*/${Math.max(5, intervalSeconds)} * * * * *`;

  cron.schedule(expression, () => {
    aggregator.refresh().catch((err) => logger.error({ err }, 'Scheduled refresh failed'));
  });

  logger.info({ expression }, 'Refresh job scheduled');
};
