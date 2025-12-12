# Frontend (React + Vite + Tailwind)

Simple UI for the 4 in a Row backend. Lets a user join/rejoin, play via Socket.IO (human or bot), see live board updates, and view the leaderboard. Styling is done with Tailwind (v4) utilities.

## Setup

```bash
cd client
npm install
```

## Run

- Dev server: `npm run dev` (defaults to http://localhost:5173)
- Build: `npm run build`
- Preview build: `npm run preview`

## Formatting

- `npm run format` to apply Prettier formatting.
- `npm run format:check` to verify formatting in CI.

Set the backend URL with `VITE_API_URL` (defaults to `http://localhost:4000`), e.g.:

```bash
VITE_API_URL=http://localhost:4000 npm run dev
```

## How to use

1. Enter a username (and optional game ID to rejoin) and click “Join / Rejoin”.
2. If no opponent arrives in 10s, a bot will join. Click a column to drop your disc.
3. Board updates stream in real time; results show win/loss/draw. Leaderboard shows wins from completed games (Refresh button to reload).
