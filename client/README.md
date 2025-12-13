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

1. Enter a username and click Join / Rejoin. Use a Game ID only when reconnecting to a previous game after a refresh/crash—both the username and Game ID must match to rejoin successfully.
2. The app auto-matches you with another player; if no opponent joins within 10 seconds, a bot fills the seat. Click a column to drop your disc.
3. Board updates stream in real time; results show win/loss/draw. Leaderboard shows wins from completed games (Refresh button to reload). Analytics are not shown in the UI; events are published to Kafka by the backend only.
