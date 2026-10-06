import { GatewayClient } from '@openclaw/gateway-client';
import type { ConnectorConfig } from '#connector/config.ts';
import { isJson, type Json, type JsonObject, type TalkMethod } from '#protocol.ts';
import type { OpenClawConfigRepository } from '#repositories/openclaw-config.repository.ts';
export class GatewayService {
  private client: GatewayClient | null = null;
  private connecting: Promise<GatewayClient> | null = null;
  ready = false;
  constructor(
    private readonly config: Pick<ConnectorConfig, 'gatewayUrl' | 'gatewayToken'>,
    private readonly credentials: OpenClawConfigRepository,
    private readonly onReady: (ready: boolean) => void,
    private readonly onEvent: (payload: Json) => void,
  ) {}
  async request(method: TalkMethod, params: JsonObject): Promise<Json> {
    const client = await this.ensure();
    const result: unknown = await client.request(method, params, { timeoutMs: 30_000 });
    if (!isJson(result)) throw new Error('Gateway returned an invalid result');
    return result;
  }
  ensure(): Promise<GatewayClient> {
    if (this.ready && this.client) return Promise.resolve(this.client);
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }
  private async connect(): Promise<GatewayClient> {
    this.client?.stop();
    this.ready = false;
    const token = this.config.gatewayToken || (await this.credentials.gatewayToken());
    const next = new GatewayClient({
      url: this.config.gatewayUrl,
      token,
      clientName: 'cli',
      clientDisplayName: 'Friday Telegram Mini App bridge',
      clientVersion: '1.0.0',
      platform: process.platform,
      mode: 'cli',
      role: 'operator',
      scopes: ['operator.read', 'operator.talk', 'operator.write'],
      onHelloOk: () => {
        this.ready = true;
        this.onReady(true);
      },
      onEvent: (event) => {
        if (event.event === 'talk.event' && isJson(event.payload)) this.onEvent(event.payload);
      },
      onClose: () => {
        this.ready = false;
        this.onReady(false);
      },
      onConnectError: (error) => console.error(`Gateway connection failed: ${error.message}`),
    });
    this.client = next;
    next.start();
    const deadline = Date.now() + 10_000;
    while (!this.ready && Date.now() < deadline) await Bun.sleep(50);
    if (!this.ready) throw new Error('Gateway did not become ready');
    return next;
  }
  stop(): void {
    this.client?.stop();
    this.client = null;
    this.ready = false;
  }
}
