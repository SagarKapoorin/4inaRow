/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

type DiscColor = 'red' | 'yellow' | null;

interface GameState {
  id: string;
  board: DiscColor[][];
  current: DiscColor;
  winner: DiscColor;
  isDraw: boolean;
  you: Exclude<DiscColor, null> | null;
  opponents: { red: string; yellow: string };
  bot: { color: Exclude<DiscColor, null>; name: string } | null;
  lastMove: { row: number; col: number; color: Exclude<DiscColor, null> } | null;
  status: 'active' | 'finished';
  validColumns: number[];
  startedAt: number;
}

interface LeaderboardEntry {
  username: string;
  wins: number;
}

type AnalyticsEvent =
  | {
      type: 'game_started';
      gameId: string;
      players: { red: string; yellow: string };
      isBot: boolean;
      at: number;
    }
  | {
      type: 'move_made';
      gameId: string;
      by: string;
      column: number;
      moveNumber: number;
      at: number;
    }
  | {
      type: 'game_finished';
      gameId: string;
      winner: string | null;
      isDraw: boolean;
      durationMs: number;
      at: number;
    };

type AnalyticsRecord = AnalyticsEvent & { id: string };

const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 100) / 10;
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

function App() {
  const socketRef = useRef<Socket | null>(null);
  const lastGameIdRef = useRef<string | null>(null);
  const [username, setUsername] = useState('');
  const [gameId, setGameId] = useState('');
  const [game, setGame] = useState<GameState | null>(null);
  const [waitingMsg, setWaitingMsg] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [statusText, setStatusText] = useState('Disconnected');
  const [matchFound, setMatchFound] = useState<{ opponent: string; gameId: string } | null>(
    null,
  );

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/leaderboard`);
      if (!res.ok) return;
      const data = await res.json();
      setLeaderboard(data);
    } catch {
      // ignore fetch errors in UI
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/analytics`);
      if (!res.ok) return;
      const data = (await res.json()) as AnalyticsRecord[];
      setAnalytics(data);
    } catch {
      // ignore fetch errors in UI
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    fetchAnalytics();
  }, [fetchLeaderboard, fetchAnalytics]);

  useEffect(() => {
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const connectAndJoin = () => {
    if (!username.trim()) {
      setError('Username required');
      return;
    }
    setError('');
    setWaitingMsg('');
    setGame(null);
    setMatchFound(null);
    lastGameIdRef.current = null;
    setConnecting(true);
    fetchLeaderboard();

    socketRef.current?.disconnect();
    const socket = io(backendUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatusText('Connected');
      socket.emit('join', { username: username.trim(), gameId: gameId.trim() || undefined });
      setConnecting(false);
    });

    socket.on('waiting', (payload: { message?: string }) => {
      setWaitingMsg(payload?.message || 'Waiting for opponent...');
      setStatusText('Waiting');
    });

    socket.on('state', (payload: GameState) => {
      const isNewGame = lastGameIdRef.current !== payload.id;
      lastGameIdRef.current = payload.id;

      if (isNewGame && !payload.bot) {
        const opponentName =
          payload.you === 'red'
            ? payload.opponents.yellow
            : payload.you === 'yellow'
              ? payload.opponents.red
              : payload.opponents.red;
        setMatchFound({ opponent: opponentName, gameId: payload.id });
      }

      setGame(payload);
      setWaitingMsg('');
      setStatusText(payload.status === 'active' ? 'Playing' : 'Finished');
      if (payload.status === 'finished') {
        fetchLeaderboard();
      }
    });

    socket.on('error_message', (msg: string) => {
      setError(msg || 'Error from server');
    });

    socket.on('connect_error', (err) => {
      setError(err.message || 'Failed to connect');
      setConnecting(false);
      setStatusText('Disconnected');
    });

    socket.on('disconnect', () => {
      setStatusText('Disconnected');
    });
  };

  const sendMove = (col: number) => {
    if (!game || game.status !== 'active') return;
    if (game.you !== game.current) {
      setError('Not your turn');
      return;
    }
    setError('');
    socketRef.current?.emit('move', col);
  };

  const resetSession = () => {
    socketRef.current?.disconnect();
    setGame(null);
    setWaitingMsg('');
    setMatchFound(null);
    setStatusText('Disconnected');
    lastGameIdRef.current = null;
  };

  const yourColor = game?.you;
  const currentPlayer =
    game && game.current
      ? game.current === yourColor
        ? 'Your move'
        : `Waiting for ${game.current === 'red' ? game.opponents.red : game.opponents.yellow}`
      : '';

  const resultText = useMemo(() => {
    if (!game || game.status !== 'finished') return '';
    if (game.isDraw) return 'Draw';
    if (game.winner && game.you === game.winner) return 'You win!';
    if (game.winner)
      return `${game.winner === 'red' ? game.opponents.red : game.opponents.yellow} wins`;
    return '';
  }, [game]);

  const board = game?.board || Array.from({ length: 6 }, () => Array<DiscColor>(7).fill(null));
  const yourLabel =
    yourColor === 'red'
      ? 'You are RED'
      : yourColor === 'yellow'
        ? 'You are YELLOW'
        : 'Spectating (no assigned color)';
  const opponentLabel =
    yourColor && game
      ? `Opponent: ${yourColor === 'red' ? game.opponents.yellow : game.opponents.red} (${yourColor === 'red' ? 'yellow' : 'red'})`
      : '';

  const analyticsSummary = (evt: AnalyticsRecord) => {
    switch (evt.type) {
      case 'game_started':
        return `Game ${evt.gameId} started: ${evt.players.red} vs ${evt.players.yellow}${evt.isBot ? ' (bot)' : ''}`;
      case 'move_made':
        return `Move #${evt.moveNumber} by ${evt.by} in game ${evt.gameId}`;
      case 'game_finished': {
        if (evt.isDraw) return `Game ${evt.gameId} finished: Draw`;
        return `Game ${evt.gameId} finished: ${evt.winner ?? 'Unknown'} won`;
      }
      default:
        return 'Unknown event';
    }
  };

  const analyticsMeta = (evt: AnalyticsRecord) => {
    switch (evt.type) {
      case 'game_started':
        return `Started ${new Date(evt.at).toLocaleTimeString()}`;
      case 'move_made':
        return `Column ${evt.column} -> ${new Date(evt.at).toLocaleTimeString()}`;
      case 'game_finished':
        return `Duration ${formatDuration(evt.durationMs)} -> ${new Date(evt.at).toLocaleTimeString()}`;
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-6xl p-6 space-y-4">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">4 in a Row</h1>
            <p className="text-slate-600">Real-time multiplayer with bot fallback.</p>
          </div>
          <div className="flex flex-col items-start gap-1 text-sm text-slate-600 md:items-end">
            <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-800">
              {statusText}
            </span>
            {game?.id ? <span className="text-xs text-slate-500">Game ID: {game.id}</span> : null}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.1fr,1.1fr,0.9fr]">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              aria-label="Username"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-sky-400 focus:outline-none"
            />
            <input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Rejoin by Game ID (optional)"
              aria-label="Game ID"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-sky-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={connectAndJoin}
                disabled={connecting}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connecting ? 'Connecting...' : 'Join / Rejoin'}
              </button>
              <button
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300"
                onClick={resetSession}
              >
                Reset
              </button>
            </div>
            {waitingMsg ? (
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
                {waitingMsg}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}
            {game ? (
              <div className="space-y-1 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1">
                    <span
                      className={cx(
                        'h-3 w-3 rounded-full',
                        yourColor === 'red'
                          ? 'bg-rose-500'
                          : yourColor === 'yellow'
                            ? 'bg-amber-400'
                            : 'bg-slate-400',
                      )}
                    />
                    <span className="font-semibold">{yourLabel}</span>
                  </span>
                  {opponentLabel ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1">
                      <span
                        className={cx(
                          'h-3 w-3 rounded-full',
                          yourColor === 'red' ? 'bg-amber-400' : 'bg-rose-500',
                        )}
                      />
                      <span className="font-semibold">{opponentLabel}</span>
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Turn:</span> <span>{currentPlayer}</span>
                </div>
                {resultText ? (
                  <div className="rounded-xl bg-sky-100 px-3 py-2 font-semibold text-sky-800">
                    {resultText}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="w-full max-w-xl space-y-2">
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, cIdx) => {
                  const canClick = game?.status === 'active' && game.validColumns?.includes(cIdx);
                  return (
                    <button
                      key={`col-${cIdx}`}
                      className={cx(
                        'rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold',
                        canClick
                          ? 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                          : 'bg-slate-100 text-slate-500 cursor-not-allowed',
                      )}
                      onClick={() => canClick && sendMove(cIdx)}
                    >
                      Drop
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-rows-6 gap-2">
                {board.map((row, rIdx) => (
                  <div className="grid grid-cols-7 gap-2" key={`row-${rIdx}`}>
                    {row.map((cell, cIdx) => {
                      const cellColor =
                        cell === 'red'
                          ? 'bg-rose-500 shadow-inner shadow-rose-900/30'
                          : cell === 'yellow'
                            ? 'bg-amber-400 shadow-inner shadow-amber-900/30'
                            : 'bg-slate-200';
                      return (
                        <div
                          key={`cell-${rIdx}-${cIdx}`}
                          className="relative aspect-square rounded-xl border-2 border-slate-200 bg-slate-50"
                          aria-label={`Cell r${rIdx} c${cIdx}`}
                        >
                          <span className={cx('absolute inset-1 rounded-full', cellColor)} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                Red
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                Yellow
              </span>
            </div>
            <div className="text-xs text-slate-500">Click a column header to drop a disc.</div>
          </div>

          <div className="space-y-3">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Leaderboard</h2>
                <button
                  className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300"
                  onClick={fetchLeaderboard}
                >
                  Refresh
                </button>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-slate-500">No games yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {leaderboard.map((entry) => (
                    <li
                      key={entry.username}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span>{entry.username}</span>
                      <span className="font-semibold text-slate-800">
                        {entry.wins} win{entry.wins === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Analytics (Kafka)</h2>
                  <p className="text-xs text-slate-500">
                    Latest analytics events (Kafka if configured) — showing newest 4.
                  </p>
                </div>
                <button
                  className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300"
                  onClick={fetchAnalytics}
                >
                  Refresh
                </button>
              </div>
              {analytics.length === 0 ? (
                <p className="text-sm text-slate-500">No analytics events yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {analytics.slice(0, 4).map((evt) => (
                    <li
                      key={evt.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs uppercase tracking-wide text-slate-700">
                            {evt.type.replace(/_/g, ' ')}
                          </span>
                          {analyticsSummary(evt)}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(evt.at).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs text-slate-600">{analyticsMeta(evt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
      {matchFound ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/30 px-4 py-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Match found
                </p>
                <h3 className="text-xl font-bold text-slate-900">Opponent ready</h3>
              </div>
              <button
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                onClick={() => setMatchFound(null)}
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              {matchFound.opponent
                ? `You are playing against ${matchFound.opponent}.`
                : 'An opponent is ready. Good luck!'}
            </p>
            <button
              className="mt-4 w-full rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-600"
              onClick={() => setMatchFound(null)}
            >
              Play now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
