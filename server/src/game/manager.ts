import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { AnalyticsProducer } from '../infrastructure/analytics.js';
import { BOT_NAME, chooseBotMove } from './bot.js';
import { ConnectFourGame, DiscColor, GamePlayers } from './game.js';
import { GamePersistence } from '../infrastructure/storage.js';

interface WaitingPlayer {
  username: string;
  socketId: string;
  timer: NodeJS.Timeout;
}

interface ManagedGame {
  game: ConnectFourGame;
  moveCount: number;
  isBotGame: boolean;
  disconnectTimers: Partial<Record<DiscColor, NodeJS.Timeout>>;
}

export class GameManager {
  private io: Server;
  private persistence: GamePersistence;
  private analytics: AnalyticsProducer;
  private waiting: WaitingPlayer | null = null;
  private activeGames = new Map<string, ManagedGame>();
  private socketToGame = new Map<string, string>();
  private usernameToGame = new Map<string, string>();

  constructor(io: Server, persistence: GamePersistence, analytics: AnalyticsProducer) {
    this.io = io;
    this.persistence = persistence;
    this.analytics = analytics;
  }

  async join(socket: Socket, username: string, gameId?: string) {
    if (gameId) {
      const managed = this.activeGames.get(gameId);
      if (managed && managed.game.rebindPlayer(username, socket.id)) {
        this.trackSocket(socket.id, gameId, username);
        socket.join(gameId);
        //console.log(gameId);
        this.clearDisconnectTimer(managed, socket.id);
        socket.emit('state', managed.game.serializeFor(socket.id));
        return;
      }
    }

    const existingGameId = this.usernameToGame.get(username);
    if (existingGameId) {
      //console.log(existingGameId);
      const managed = this.activeGames.get(existingGameId);
      if (managed && managed.game.rebindPlayer(username, socket.id)) {
        this.trackSocket(socket.id, existingGameId, username);
        socket.join(existingGameId);
        this.clearDisconnectTimer(managed, socket.id);
        socket.emit('state', managed.game.serializeFor(socket.id));
        return;
      }
    }

    if (this.waiting) {
      const opponent = this.waiting;
      clearTimeout(opponent.timer);
      this.waiting = null;
      const players: GamePlayers = {
        red: { id: opponent.socketId, username: opponent.username },
        yellow: { id: socket.id, username },
      };
      const game = new ConnectFourGame({ id: randomUUID(), players, bot: null, current: 'red' });
      const managed: ManagedGame = {
        game,
        moveCount: 0,
        isBotGame: false,
        disconnectTimers: {},
      };
      this.activeGames.set(game.id, managed);
      this.trackSocket(opponent.socketId, game.id, opponent.username);
      this.trackSocket(socket.id, game.id, username);
      this.io.sockets.sockets.get(opponent.socketId)?.join(game.id);
      socket.join(game.id);
      this.emitState(managed);
      await this.analytics.publish({
        type: 'game_started',
        gameId: game.id,
        players: { red: players.red.username, yellow: players.yellow.username },
        isBot: false,
        at: Date.now(),
      });
      return;
    }
    //console.log(this.waiting);
    const timer = setTimeout(() => this.startBotGame(socket, username), 10_000);
    this.waiting = { username, socketId: socket.id, timer };
    socket.emit('waiting', {
      message: 'Waiting for opponent, bot will join after 10s if none found.',
    });
  }

  async handleMove(socket: Socket, column: number) {
    const gameId = this.socketToGame.get(socket.id);
    if (!gameId) return;
    const managed = this.activeGames.get(gameId);
    if (!managed) return;
    const { game } = managed;
    try {
      game.dropPiece(column, socket.id);
      managed.moveCount += 1;
      const color = game.getPlayerColor(socket.id);
      const username = color ? game.players[color].username : socket.id;
      this.emitState(managed);
      await this.analytics.publish({
        type: 'move_made',
        gameId,
        by: username,
        column,
        moveNumber: managed.moveCount,
        at: Date.now(),
      });
      if (game.status === 'finished') {
        await this.finishGame(managed);
      } else if (managed.isBotGame && game.getPlayerColor(socket.id) !== game.current) {
        this.makeBotMove(managed);
      }
    } catch (err: any | { message?: string } | string | null | undefined) {
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        socket.emit('error_message', err.message);
        return;
      }
      if (typeof err === 'string') {
        socket.emit('error_message', err);
        return;
      }
      socket.emit('error_message', 'Move failed');
    }
  }

  handleDisconnect(socketId: string) {
    if (this.waiting?.socketId === socketId) {
      clearTimeout(this.waiting.timer);
      this.waiting = null;
      return;
    }
    const gameId = this.socketToGame.get(socketId);
    if (!gameId) return;
    const managed = this.activeGames.get(gameId);
    if (!managed) return;
    const color = managed.game.getPlayerColor(socketId);
    if (!color) return;
    this.socketToGame.delete(socketId);
    const timer = setTimeout(() => {
      managed.game.forfeit(socketId);
      this.emitState(managed);
      this.finishGame(managed);
    }, 30_000);
    managed.disconnectTimers[color] = timer;
  }

  private async finishGame(managed: ManagedGame) {
    const { game, moveCount, isBotGame } = managed;
    this.clearDisconnectTimer(managed);
    this.usernameToGame.delete(game.players.red.username);
    this.usernameToGame.delete(game.players.yellow.username);
    this.socketToGame.delete(game.players.red.id);
    this.socketToGame.delete(game.players.yellow.id);
    const summary = {
      id: game.id,
      players: { red: game.players.red.username, yellow: game.players.yellow.username },
      winner: game.winner,
      isDraw: game.isDraw,
      moves: moveCount,
      startedAt: game.startedAt,
      endedAt: Date.now(),
      durationMs: Date.now() - game.startedAt,
      isBotGame,
    };
    await this.persistence.saveCompletedGame(summary);
    await this.analytics.publish({
      type: 'game_finished',
      gameId: game.id,
      winner: game.winner ? summary.players[game.winner] : null,
      isDraw: game.isDraw,
      durationMs: summary.durationMs,
      at: summary.endedAt,
    });
    setTimeout(() => {
      this.activeGames.delete(game.id);
    }, 60_000);
  }

  private clearDisconnectTimer(managed: ManagedGame, socketId?: string) {
    if (socketId) {
      const color = managed.game.getPlayerColor(socketId);
      if (color && managed.disconnectTimers[color]) {
        clearTimeout(managed.disconnectTimers[color]!);
        delete managed.disconnectTimers[color];
      }
      return;
    }
    (['red', 'yellow'] as DiscColor[]).forEach((c) => {
      const timer = managed.disconnectTimers[c];
      if (timer) clearTimeout(timer);
    });
    managed.disconnectTimers = {};
  }

  private async startBotGame(socket: Socket, username: string) {
    if (!this.waiting || this.waiting.socketId !== socket.id) return;
    this.waiting = null;
    const players: GamePlayers = {
      red: { id: socket.id, username },
      yellow: { id: BOT_NAME, username: BOT_NAME },
    };
    const game = new ConnectFourGame({
      id: randomUUID(),
      players,
      bot: { color: 'yellow', name: BOT_NAME },
    });
    const managed: ManagedGame = { game, moveCount: 0, isBotGame: true, disconnectTimers: {} };
    this.activeGames.set(game.id, managed);
    this.trackSocket(socket.id, game.id, username);
    socket.join(game.id);
    this.emitState(managed);
    await this.analytics.publish({
      type: 'game_started',
      gameId: game.id,
      players: { red: players.red.username, yellow: players.yellow.username },
      isBot: true,
      at: Date.now(),
    });
    if (game.current === 'yellow') {
      this.makeBotMove(managed);
    }
  }

  private makeBotMove(managed: ManagedGame) {
    const botColor: DiscColor = managed.game.bot?.color ?? 'yellow';
    const col = chooseBotMove(managed.game, botColor);
    try {
      managed.game.dropPiece(col, BOT_NAME);
      managed.moveCount += 1;
      this.emitState(managed);
      if (managed.game.status === 'finished') {
        this.finishGame(managed);
      }
    } catch {
      console.error('Bot move failed');
    }
  }

  private trackSocket(socketId: string, gameId: string, username: string) {
    this.socketToGame.set(socketId, gameId);
    this.usernameToGame.set(username, gameId);
  }

  private emitState(managed: ManagedGame) {
    const { game } = managed;
    const recipients = [game.players.red.id, game.players.yellow.id];
    recipients.forEach((id) => {
      const sock = this.io.sockets.sockets.get(id);
      if (sock) {
        sock.emit('state', game.serializeFor(id));
      }
    });
  }
}
