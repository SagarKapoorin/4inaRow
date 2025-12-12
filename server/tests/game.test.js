import { ConnectFourGame } from '../src/game/game.js';
const players = {
  red: { id: 'r', username: 'r' },
  yellow: { id: 'y', username: 'y' },
};
describe('ConnectFourGame', () => {
  it('detects horizontal win', () => {
    const game = new ConnectFourGame({ id: '1', players, bot: null });
    game.dropPiece(0, 'r');
    game.dropPiece(0, 'y');
    game.dropPiece(1, 'r');
    game.dropPiece(1, 'y');
    game.dropPiece(2, 'r');
    game.dropPiece(2, 'y');
    game.dropPiece(3, 'r');
    expect(game.winner).toBe('red');
  });
  it('prevents move on full column', () => {
    const game = new ConnectFourGame({ id: '1', players, bot: null });
    for (let i = 0; i < 6; i += 1) {
      game.dropPiece(0, i % 2 === 0 ? 'r' : 'y');
    }
    expect(() => game.dropPiece(0, 'r')).toThrow('Column is full');
  });
});
