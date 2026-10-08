import { timingSafeEqual } from 'node:crypto';
import { type AppSocket, closeSocket } from '#lib/socket.ts';
import { isReply, isTalkMessage } from '#protocol.ts';
import type { RelayStateService } from '#services/relay-state.service.ts';

export class BridgeService {
  constructor(
    private readonly state: RelayStateService,
    private readonly secret: string,
  ) {}
  receive(socket: AppSocket, message: Record<string, unknown>): void {
    if (!socket.data.authenticated) {
      const supplied =
        typeof message.secret === 'string' ? Buffer.from(message.secret) : Buffer.alloc(0);
      const expected = Buffer.from(this.secret);
      if (
        message.type !== 'bridge.auth' ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        closeSocket(socket, 1008, 'Unauthorized');
        return;
      }
      this.state.attachBridge(socket);
      return;
    }
    if (socket !== this.state.bridge) return;
    if (message.type === 'bridge.ping') {
      this.state.sendBridge({ type: 'bridge.pong' });
    } else if (message.type === 'bridge.status' && typeof message.ready === 'boolean') {
      this.state.gatewayReady = message.ready;
      this.state.broadcast();
    } else if (message.type === 'event' && isTalkMessage(message.payload)) {
      for (const client of this.state.clients.values())
        this.state.sendClient(client, message.payload);
    } else if (
      message.type === 'client.reply' &&
      typeof message.clientId === 'string' &&
      isReply(message.payload)
    ) {
      const client = this.state.clients.get(message.clientId);
      if (client) this.state.sendClient(client, message.payload);
    }
  }
}
