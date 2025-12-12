import { Server, Socket } from 'socket.io';
import { GameManager } from '../game/manager.js';

type MovePayload = number | string | null | undefined;

export function setupSocket(io: Server, manager: GameManager) {
  io.on('connection', (socket: Socket) => {
    socket.on('join', ({ username, gameId }: { username?: string; gameId?: string }) => {
      if (!username || typeof username !== 'string') {
        socket.emit('error_message', 'Username required');
        return;
      }
      manager.join(socket, username, gameId);
    });

    socket.on('move', (payload: MovePayload) => {
      if (typeof payload !== 'number' || !Number.isInteger(payload)) {
        socket.emit('error_message', 'Column required');
        return;
      }
      manager.handleMove(socket, payload);
    });

    socket.on('disconnect', () => {
      manager.handleDisconnect(socket.id);
    });
  });
}
