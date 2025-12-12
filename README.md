# Emmitr — 4 in a Row

Real-time Connect Four with human/bot matchmaking, reconnection support, leaderboard, and analytics feed.

- Frontend docs: see `client/README.md` for setup, running, and UI behavior.
- Backend docs: see `server/README.md` for API, env, and database requirements.

## Manual check (basic functionality)

1) Start the backend (`server/README.md` has Postgres/env setup and `npm run dev`).  
2) Start the frontend (`client/README.md`, set `VITE_API_URL` if needed, `npm run dev`).  
3) Open the app in the browser, enter a username, and click Join / Rejoin. The app auto-matches you; if no opponent joins within 10s a bot fills the seat.  
4) Drop discs by clicking column headers; status/result updates stream live.  
5) Reconnect test: copy the Game ID shown in the header, refresh the page, then join again with the **same username and Game ID**—both must match to resume the game.  
6) Leaderboard/analytics: use Refresh buttons to verify completed games and recent events are visible.
