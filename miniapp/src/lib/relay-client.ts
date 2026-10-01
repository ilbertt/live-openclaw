import {
  type ClientRequest,
  isObject,
  isReply,
  isTalkMessage,
  type Json,
  type JsonObject,
  type OfferRequest,
  parseObject,
  type TalkMethod,
} from 'backend/protocol';

type Pending = {
  resolve: (value: Json) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export type RelayState = { ready: boolean; error: string };
export class RelayClient {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private reconnect: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private authenticated = false;
  private authFailed = false;
  constructor(
    private readonly initData: string,
    private readonly stateChanged: (state: RelayState) => void,
    private readonly talkEvent: (payload: Json) => void,
    private readonly disconnected: () => void,
  ) {}
  connect(): void {
    if (this.stopped || !this.initData || this.authFailed) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/rpc`);
    this.socket = socket;
    socket.addEventListener('open', () =>
      socket.send(JSON.stringify({ type: 'auth', initData: this.initData })),
    );
    socket.addEventListener('message', (event) => {
      try {
        this.receive(parseObject(String(event.data)));
      } catch {
        this.stateChanged({ ready: false, error: 'Invalid relay response' });
        socket.close();
      }
    });
    socket.addEventListener('close', () => {
      this.authenticated = false;
      this.rejectPending('Connection lost');
      this.stateChanged({
        ready: false,
        error: this.authFailed ? 'Reopen the Mini App from Telegram.' : '',
      });
      this.disconnected();
      if (!this.stopped && !this.authFailed)
        this.reconnect = setTimeout(() => this.connect(), 1800);
    });
    socket.addEventListener('error', () => socket.close());
  }
  private receive(message: Record<string, unknown>): void {
    if (message.type === 'auth.ok' || message.type === 'bridge.state') {
      if (message.type === 'auth.ok') this.authenticated = true;
      const connected = message.type === 'auth.ok' ? message.bridgeConnected : message.connected;
      this.stateChanged({
        ready: this.authenticated && connected === true && message.gatewayReady === true,
        error: '',
      });
    } else if (message.type === 'auth.error') {
      this.authFailed = true;
      this.stateChanged({
        ready: false,
        error:
          typeof message.message === 'string' ? message.message : 'Telegram authorization failed',
      });
    } else if (isReply(message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.type === 'result') pending.resolve(message.result);
      else pending.reject(new Error(message.message));
    } else if (isTalkMessage(message)) this.talkEvent(message.payload);
  }
  rpc(method: TalkMethod, params: JsonObject = {}): Promise<Json> {
    return this.request({ type: 'rpc', id: crypto.randomUUID(), method, params });
  }
  offer(params: Omit<OfferRequest, 'id' | 'type'>): Promise<Json> {
    return this.request({ type: 'offer', id: crypto.randomUUID(), ...params });
  }
  private request(message: ClientRequest): Promise<Json> {
    if (this.stopped || !this.authenticated || this.socket?.readyState !== WebSocket.OPEN)
      return Promise.reject(new Error('Friday is offline'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(message.id);
        reject(new Error('Friday took too long to respond'));
      }, 32_000);
      this.pending.set(message.id, { resolve, reject, timer });
      try {
        this.socket?.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(message.id);
        reject(error);
      }
    });
  }
  diagnostic(report: JsonObject): void {
    if (this.authenticated && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: 'audio.diagnostic', report }));
  }
  private rejectPending(message: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }
  dispose(): void {
    this.stopped = true;
    clearTimeout(this.reconnect);
    this.rejectPending('Talk ended');
    this.socket?.close();
  }
}
export async function voiceConfiguration() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  const value: unknown = await response.json();
  if (
    !response.ok ||
    !isObject(value) ||
    typeof value.sessionKey !== 'string' ||
    typeof value.model !== 'string'
  )
    throw new Error('Could not load voice configuration');
  return { sessionKey: value.sessionKey, model: value.model };
}
