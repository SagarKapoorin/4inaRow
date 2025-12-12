import { ConnectFourGame, DiscColor, GamePlayers } from './game.js';
export const BOT_NAME = 'BOT';
export function buildBotPlayers(human: GamePlayers['red']): {
  players: GamePlayers;
  botColor: DiscColor;
} {
  const botColor: DiscColor = 'yellow';
  return {
    botColor,
    players: {
      red: human,
      yellow: { id: 'bot', username: BOT_NAME },
    },
  };
}

export function chooseBotMove(game: ConnectFourGame, botColor: DiscColor): number {
  const opponent: DiscColor = botColor === 'red' ? 'yellow' : 'red';
  const valid = game.getValidColumns();
  for (const col of valid) {
    if (wouldWin(game, col, botColor)) return col;
  }
  // console.log('No winning move found');
  for (const col of valid) {
    if (wouldWin(game, col, opponent)) return col;
  }
  //console.log('No blocking move found');
  const preference = [3, 2, 4, 1, 5, 0, 6];
  const preferred = preference.find((c) => valid.includes(c));
  if (preferred !== undefined) return preferred;
  // console.log(valid[0]);
  return valid[0];
}

function wouldWin(game: ConnectFourGame, col: number, color: DiscColor): boolean {
  const row = findAvailableRow(game, col);
  if (row === null) return false;
  const boardCopy = game.board.map((r) => [...r]);
  boardCopy[row][col] = color;
  return checkWinner(boardCopy, row, col, color);
}

function findAvailableRow(game: ConnectFourGame, col: number): number | null {
  for (let row = game.rows - 1; row >= 0; row -= 1) {
    if (game.board[row][col] === null) return row;
  }
  return null;
}

function checkWinner(
  board: (DiscColor | null)[][],
  row: number,
  col: number,
  color: DiscColor,
): boolean {
  return (
    countDirection(board, row, col, 0, 1, color) +
      countDirection(board, row, col, 0, -1, color) -
      1 >=
      4 ||
    countDirection(board, row, col, 1, 0, color) +
      countDirection(board, row, col, -1, 0, color) -
      1 >=
      4 ||
    countDirection(board, row, col, 1, 1, color) +
      countDirection(board, row, col, -1, -1, color) -
      1 >=
      4 ||
    countDirection(board, row, col, 1, -1, color) +
      countDirection(board, row, col, -1, 1, color) -
      1 >=
      4
  );
}

function countDirection(
  board: (DiscColor | null)[][],
  row: number,
  col: number,
  dRow: number,
  dCol: number,
  color: DiscColor,
): number {
  let count = 0;
  let r = row;
  let c = col;
  while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === color) {
    count += 1;
    r += dRow;
    c += dCol;
  }
  return count;
}
