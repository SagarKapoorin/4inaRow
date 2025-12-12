# 4 in a Row Backend (Node.js + TypeScript)

Real-time Connect Four server with human/bot matchmaking, reconnection, Kafka analytics hooks, and Postgres persistence for completed games.

## Quick start (Postgres required)

```bash
cd server
npm install
# set DATABASE_URL to your Postgres connection string
# e.g. postgresql://user:password@localhost:5432/emmitr
npx prisma generate        # once, after installing dependencies
npx prisma migrate deploy  # or: npx prisma db push (for quick dev)
npm run dev           # runs ts-node on port 4000
# or build & run
npm run build
npm start
```

## Formatting

- `npm run format` to apply Prettier formatting.
- `npm run format:check` to verify formatting in CI.

## API

- `GET /health` – basic health check.
- `GET /leaderboard` – current win totals.
- `GET /analytics` – latest Kafka analytics events (when `KAFKA_BROKERS` is configured).
- WebSocket (Socket.IO) events:
  - `join`: `{ username: string, gameId?: string }` (rejoin with username or gameId).
  - `move`: `column: number`.
  - Server emits `state` updates, `waiting` message when queued, and `error_message` on invalid actions.

## Environment

- `PORT` (default: 4000)
- `DATABASE_URL` (required): Postgres connection string.
- `KAFKA_BROKERS` (optional): Comma-separated Kafka brokers for analytics publishing/consuming.

## Notes

- Matchmaking waits up to 10s before pairing you with a competitive bot.
- Disconnects allow 30s to reconnect (by username or gameId) before the opponent is declared winner.
- Completed games are persisted and fed into the leaderboard; analytics events are published to Kafka when configured.

## Project structure

- `src/config` – env loading (`index.ts`)
- `src/api` – HTTP routes (`routes.ts`)
- `src/socket` – Socket.IO wiring (`index.ts`)
- `src/game` – core game logic, bot, manager (`game.ts`, `bot.ts`, `manager.ts`)
- `src/infrastructure` – Prisma/Postgres persistence, Kafka producer/consumer (`storage.ts`, `analytics.ts`)
- `tests/` – Jest tests
