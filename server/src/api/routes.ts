import express from 'express';
import { GamePersistence } from '../infrastructure/storage.js';
import { AnalyticsBuffer } from '../infrastructure/analytics.js';

export function createRoutes(persistence: GamePersistence, analyticsBuffer?: AnalyticsBuffer) {
  const router = express.Router();
  router.get('/health', (_req, res) => res.json({ status: 'ok' }));
  router.get('/leaderboard', async (_req, res) => {
    const leaderboard = await persistence.leaderboard();
    // console.log(leaderboard);
    res.json(leaderboard);
  });
  router.get('/analytics', (_req, res) => {
    const events = analyticsBuffer?.all() ?? [];
    res.json(events);
  });

  return router;
}
