import type { ConnectorConfig } from '#connector/config.ts';
import type { ConnectorController } from '#connector/controller.ts';
import { type BridgeMessage, parseObject } from '#protocol.ts';
import type { GatewayService } from '#services/gateway.service.ts';
export class ConnectorRuntime {
  private socket: WebSocket | null = null;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  constructor(
    private readonly config: ConnectorConfig,
    private readonly gateway: GatewayService,
    private readonly controller: ConnectorController,
  ) {}
  send(message: BridgeMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  async start(): Promise<void> {
    try {
      await this.gateway.ensure();
      if (this.stopped) return;
      const socket = new WebSocket(this.config.bridgeUrl);
      this.socket = socket;
      socket.addEventListener('open', () =>
        socket.send(JSON.stringify({ type: 'bridge.auth', secret: this.config.bridgeSecret })),
      );
      socket.addEventListener('message', (event) => {
        void this.receive(String(event.data)).catch((error) =>
          console.error('Invalid relay message', error),
        );
      });
      socket.addEventListener('close', () => this.scheduleReconnect());
      socket.addEventListener('error', () => socket.close());
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      this.scheduleReconnect();
    }
  }
  private async receive(raw: string): Promise<void> {
    const message = parseObject(raw);
    if (message.type === 'bridge.ready') {
      this.send({ type: 'bridge.status', ready: this.gateway.ready });
      console.log('Friday Mini App bridge connected');
    } else if (message.type === 'client.message' && typeof message.clientId === 'string') {
      const payload = await this.controller.handle(message.payload);
      this.send({ type: 'client.reply', clientId: message.clientId, payload });
    }
  }
  private scheduleReconnect(): void {
    if (this.stopped || this.reconnect) return;
    this.reconnect = setTimeout(() => {
      this.reconnect = null;
      void this.start();
    }, 2_000);
  }
  stop(): void {
    this.stopped = true;
    if (this.reconnect) clearTimeout(this.reconnect);
    this.socket?.close();
    this.gateway.stop();
  }
}
