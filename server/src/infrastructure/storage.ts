import { PrismaClient } from '@prisma/client';
import { DiscColor } from '../game/game.js';

export interface CompletedGame {
  id: string;
  players: { red: string; yellow: string };
  winner: DiscColor | null;
  isDraw: boolean;
  moves: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  isBotGame: boolean;
}

export interface LeaderboardEntry {
  username: string;
  wins: number;
}

export interface GamePersistence {
  saveCompletedGame(game: CompletedGame): Promise<void>;
  leaderboard(): Promise<LeaderboardEntry[]>;
}

export class PrismaRepository implements GamePersistence {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async saveCompletedGame(game: CompletedGame): Promise<void> {
    const winnerName = game.winner ? game.players[game.winner] : null;
    await this.prisma.completedGame.upsert({
      where: { id: game.id },
      create: {
        id: game.id,
        playerRed: game.players.red,
        playerYellow: game.players.yellow,
        winner: winnerName,
        isDraw: game.isDraw,
        moves: game.moves,
        startedAt: BigInt(game.startedAt),
        endedAt: BigInt(game.endedAt),
        durationMs: BigInt(game.durationMs),
        isBotGame: game.isBotGame,
      },
      update: {},
    });
  }

  async leaderboard(): Promise<LeaderboardEntry[]> {
    const games = await this.prisma.completedGame.findMany({
      where: { winner: { not: null } },
      select: { winner: true, playerRed: true, playerYellow: true },
      orderBy: [{ endedAt: 'desc' }],
      take: 500,
    });

    const tally = new Map<string, number>();
    games.forEach((g) => {
      const winner = g.winner;
      const username =
        winner === 'red' ? g.playerRed : winner === 'yellow' ? g.playerYellow : (winner ?? null);
      if (username) {
        tally.set(username, (tally.get(username) ?? 0) + 1);
      }
    });

    return Array.from(tally.entries())
      .map(([username, wins]) => ({ username, wins }))
      .sort((a, b) => b.wins - a.wins || a.username.localeCompare(b.username))
      .slice(0, 20);
  }
}

export function buildRepository(): GamePersistence {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Postgres persistence');
  }
  return new PrismaRepository();
}
