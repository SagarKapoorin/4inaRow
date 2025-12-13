import express from 'express';
import { GamePersistence } from '../infrastructure/storage.js';

export function createRoutes(persistence: GamePersistence) {
  const router = express.Router();
  const asyncHandler =
    (
      handler: (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => Promise<void> | void,
    ): express.RequestHandler =>
    (req, res, next) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    };

  router.get('/health', (_req, res) => res.json({ status: 'ok' }));
  router.get(
    '/leaderboard',
    asyncHandler(async (_req, res) => {
      const leaderboard = await persistence.leaderboard();
      res.json(leaderboard);
    }),
  );

  return router;
}
