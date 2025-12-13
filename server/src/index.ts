import http from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import compression from 'compression';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import { AnalyticsProducer } from './infrastructure/analytics.js';
import { createRateLimiter } from './infrastructure/rateLimiter.js';
import { GameManager } from './game/manager.js';
import { buildRepository } from './infrastructure/storage.js';
import { env, assertEnv } from './config/index.js';
import { createRoutes } from './api/routes.js';
import { setupSocket } from './socket/index.js';

assertEnv();

const persistence = buildRepository();
const analytics = new AnalyticsProducer();
const rateLimiterPromise = createRateLimiter(env.redisUrl);

const app = express();
app.use(helmet());
app.use(
  helmet.crossOriginResourcePolicy({
    policy: 'cross-origin',
  }),
);
app.use(
  cors({
    origin: '*',
  }),
);
app.use(hpp());
app.use(morgan('common'));
app.use(express.json());
app.use(compression());
app.use(async (req, res, next) => {
  const limiter: RateLimitRequestHandler = await rateLimiterPromise;
  return limiter(req, res, next);
});

app.use(createRoutes(persistence));
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const errorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
  const status =
    (typeof (err as { status?: number }).status === 'number' && (err as { status?: number }).status) ||
    (typeof (err as { statusCode?: number }).statusCode === 'number' &&
      (err as { statusCode?: number }).statusCode) ||
    500;
  const message =
    status >= 500 ? 'Internal server error' : (err instanceof Error ? err.message : 'Request failed');
  console.error('Request failed', err);
  res.status(status).json({ error: message });
};

app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const manager = new GameManager(io, persistence, analytics);

setupSocket(io, manager);

server.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});
