import { type AppSocket, closeSocket, type SocketData } from '#lib/socket.ts';
import { parseObject } from '#protocol.ts';
import type { Services } from '#services/container.ts';
export function websocketController(services: Services): Bun.WebSocketHandler<SocketData> {
  return {
    maxPayloadLength: 1_048_576,
    open(socket: AppSocket) {
      if (socket.data.role === 'client')
        services.state.sendClient(socket, { type: 'auth.required' });
    },
    message(socket, raw) {
      try {
        const message = parseObject(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
        if (socket.data.role === 'bridge') services.bridge.receive(socket, message);
        else services.clients.receive(socket, message);
      } catch {
        closeSocket(socket, 1003, 'Invalid message');
      }
    },
    close(socket) {
      services.state.close(socket);
    },
  };
}
