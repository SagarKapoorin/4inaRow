export type DiscColor = 'red' | 'yellow';

export interface PlayerInfo {
  id: string;
  username: string;
}

export interface GamePlayers {
  red: PlayerInfo;
  yellow: PlayerInfo;
}

export interface BotInfo {
  color: DiscColor;
  name: string;
}

export type GameStatus = 'active' | 'finished';

export const ROWS = 6;
export const COLS = 7;
const CONNECT = 4;

export interface Move {
  row: number;
  col: number;
  color: DiscColor;
}

export interface SerializedGame {
  id: string;
  board: (DiscColor | null)[][];
  current: DiscColor;
  winner: DiscColor | null;
  isDraw: boolean;
  you: DiscColor | null;
  opponents: { red: string; yellow: string };
  bot: BotInfo | null;
  lastMove: Move | null;
  status: GameStatus;
  validColumns: number[];
  startedAt: number;
}

export class ConnectFourGame {
  readonly id: string;
  readonly rows: number = ROWS;
  readonly cols: number = COLS;
  readonly players: GamePlayers;
  readonly bot: BotInfo | null;
  readonly startedAt: number;
  board: (DiscColor | null)[][];
  current: DiscColor = 'red';
  winner: DiscColor | null = null;
  isDraw = false;
  lastMove: Move | null = null;
  status: GameStatus = 'active';

  constructor(opts: {
    id: string;
    players: GamePlayers;
    bot: BotInfo | null;
    current?: DiscColor;
  }) {
    this.id = opts.id;
    this.players = opts.players;
    this.bot = opts.bot;
    this.current = opts.current ?? 'red';
    this.board = Array.from({ length: ROWS }, () => Array<DiscColor | null>(COLS).fill(null));
    this.startedAt = Date.now();
  }

  getPlayerColor(socketId: string): DiscColor | null {
    if (this.players.red.id === socketId) return 'red';
    if (this.players.yellow.id === socketId) return 'yellow';
    return null;
  }

  rebindPlayer(username: string, newId: string): DiscColor | null {
    if (this.players.red.username === username) {
      this.players.red.id = newId;
      return 'red';
    }
    if (this.players.yellow.username === username) {
      this.players.yellow.id = newId;
      return 'yellow';
    }
    return null;
  }

  isPlayerTurn(socketId: string): boolean {
    return this.getPlayerColor(socketId) === this.current;
  }

  isColumnFull(col: number): boolean {
    return this.board[0][col] !== null;
  }

  getValidColumns(): number[] {
    return this.board[0]
      .map((_, col) => (!this.isColumnFull(col) ? col : null))
      .filter((v) => v !== null) as number[];
  }

  dropPiece(col: number, socketId: string): Move {
    if (this.status !== 'active') {
      throw new Error('Game is finished');
    }
    if (!Number.isInteger(col) || col < 0 || col >= this.cols) {
      throw new Error('Invalid column');
    }
    const color = this.getPlayerColor(socketId);
    if (!color) {
      throw new Error('Unknown player');
    }
    if (color !== this.current) {
      throw new Error('Not your turn');
    }
    if (this.isColumnFull(col)) {
      throw new Error('Column is full');
    }

    const row = this.findAvailableRow(col);
    if (row === null) throw new Error('No available row');

    this.board[row][col] = color;
    this.lastMove = { row, col, color };

    if (this.checkWinner(row, col, color)) {
      this.winner = color;
      this.status = 'finished';
    } else if (this.isBoardFull()) {
      this.isDraw = true;
      this.status = 'finished';
    } else {
      this.current = this.current === 'red' ? 'yellow' : 'red';
    }

    return { row, col, color };
  }

  forfeit(socketId: string): void {
    const color = this.getPlayerColor(socketId);
    if (!color || this.status === 'finished') return;
    this.winner = color === 'red' ? 'yellow' : 'red';
    this.status = 'finished';
  }

  private findAvailableRow(col: number): number | null {
    for (let row = this.rows - 1; row >= 0; row -= 1) {
      if (this.board[row][col] === null) {
        return row;
      }
    }
    return null;
  }

  private isBoardFull(): boolean {
    return this.board[0].every((cell) => cell !== null);
  }

  private checkWinner(row: number, col: number, color: DiscColor): boolean {
    return (
      this.countDirection(row, col, 0, 1, color) +
        this.countDirection(row, col, 0, -1, color) -
        1 >=
        CONNECT ||
      this.countDirection(row, col, 1, 0, color) +
        this.countDirection(row, col, -1, 0, color) -
        1 >=
        CONNECT ||
      this.countDirection(row, col, 1, 1, color) +
        this.countDirection(row, col, -1, -1, color) -
        1 >=
        CONNECT ||
      this.countDirection(row, col, 1, -1, color) +
        this.countDirection(row, col, -1, 1, color) -
        1 >=
        CONNECT
    );
  }

  private countDirection(
    row: number,
    col: number,
    dRow: number,
    dCol: number,
    color: DiscColor,
  ): number {
    let count = 0;
    let r = row;
    let c = col;
    while (r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.board[r][c] === color) {
      count += 1;
      r += dRow;
      c += dCol;
    }
    return count;
  }

  serializeFor(socketId: string): SerializedGame {
    const color = this.getPlayerColor(socketId);
    return {
      id: this.id,
      board: this.board,
      current: this.current,
      winner: this.winner,
      isDraw: this.isDraw,
      you: color,
      opponents: {
        red: this.players.red.username,
        yellow: this.players.yellow.username,
      },
      bot: this.bot,
      lastMove: this.lastMove,
      status: this.status,
      validColumns: this.getValidColumns(),
      startedAt: this.startedAt,
    };
  }
}
