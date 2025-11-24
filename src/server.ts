import http from 'http';
import express from 'express';
import cors from 'cors';
import env from './config/env';
import redis from './config/redis';
import logger from './utils/logger';
import aggregator from './services/tokenAggregator';
import tokenRoutes from './routes/tokenRoutes';
import { startRefreshJob } from './jobs/refreshJob';
import { initSocketServer } from './websocket/socketServer';

const bootstrap = async () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/tokens', tokenRoutes);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error({ err }, 'Request failed');
      res.status(500).json({ message: 'Internal server error' });
    }
  );

  const server = http.createServer(app);
  initSocketServer(server);

  await redis.connect().catch((err) => {
    logger.error({ err }, 'Redis connection failed');
    process.exit(1);
  });

  await aggregator.refresh();
  startRefreshJob();

  server.listen(env.PORT, env.HOST, () => {
    logger.info({ port: env.PORT }, 'Server listening');
  });
};

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error');
  process.exit(1);
});
