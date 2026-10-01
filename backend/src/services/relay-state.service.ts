import { type AppSocket, closeSocket, send } from '#lib/socket.ts';
import type { ConnectorMessage, RelayMessage } from '#protocol.ts';

export class RelayStateService {
  bridge: AppSocket | null = null;
  gatewayReady = false;
  readonly clients = new Map<string, AppSocket>();
  get connected(): boolean {
    return this.bridge?.readyState === WebSocket.OPEN && this.bridge.data.authenticated === true;
  }
  health() {
    return {
      ok: true,
      bridgeConnected: this.connected,
      gatewayReady: this.connected && this.gatewayReady,
      clients: this.clients.size,
    };
  }
  broadcast(): void {
    for (const client of this.clients.values())
      this.sendClient(client, {
        type: 'bridge.state',
        connected: this.connected,
        gatewayReady: this.connected && this.gatewayReady,
      });
  }
  sendBridge(message: ConnectorMessage): void {
    if (this.connected && this.bridge) send(this.bridge, message);
  }
  sendClient(client: AppSocket, message: RelayMessage): void {
    send(client, message);
  }
  attachBridge(socket: AppSocket): void {
    const previous = this.bridge;
    socket.data.authenticated = true;
    this.bridge = socket;
    this.gatewayReady = false;
    if (previous && previous !== socket) closeSocket(previous, 1012, 'Bridge replaced');
    this.sendBridge({ type: 'bridge.ready' });
    for (const clientId of this.clients.keys()) this.sendBridge({ type: 'client.open', clientId });
    this.broadcast();
  }
  close(socket: AppSocket): void {
    if (socket.data.role === 'bridge') {
      if (socket !== this.bridge) return;
      this.bridge = null;
      this.gatewayReady = false;
      this.broadcast();
    } else if (this.clients.delete(socket.data.id)) {
      this.sendBridge({ type: 'client.close', clientId: socket.data.id });
    }
  }
}
