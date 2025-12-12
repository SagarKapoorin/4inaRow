import express from 'express';
import { GamePersistence } from '../infrastructure/storage.js';
export function createRoutes(persistence: GamePersistence) {
  const router = express.Router();
  router.get('/health', (_req, res) => res.json({ status: 'ok' }));
  router.get('/leaderboard', async (_req, res) => {
    const leaderboard = await persistence.leaderboard();
    // console.log(leaderboard);
    res.json(leaderboard);
  });

  return router;
}
