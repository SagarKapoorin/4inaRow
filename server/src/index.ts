import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { AnalyticsBuffer, AnalyticsProducer, startAnalyticsConsumer } from './infrastructure/analytics.js';
import { GameManager } from './game/manager.js';
import { buildRepository } from './infrastructure/storage.js';
import { env, assertEnv } from './config/index.js';
import { createRoutes } from './api/routes.js';
import { setupSocket } from './socket/index.js';

assertEnv();

const app = express();
app.use(
  cors({
    origin: '*',
  }),
);
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const persistence = buildRepository();
const analyticsBuffer = new AnalyticsBuffer();
const analytics = new AnalyticsProducer(analyticsBuffer);
const manager = new GameManager(io, persistence, analytics);

setupSocket(io, manager);
app.use(createRoutes(persistence, analyticsBuffer));

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${env.port}`);
});

startAnalyticsConsumer({
  handlers: {
    onEvent: (event) => analyticsBuffer.record(event),
  },
}).catch(() => {
  // ignore consumer start failures (e.g., no Kafka available)
});
