import { parseObject } from '../src/protocol.ts';
export class TestSocket {
  readonly socket: WebSocket;
  private messages: Record<string, unknown>[] = [];
  private waiting: ((message: Record<string, unknown>) => void) | null = null;
  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener('message', (event) => {
      const message = parseObject(String(event.data));
      if (this.waiting) {
        const waiting = this.waiting;
        this.waiting = null;
        waiting(message);
      } else this.messages.push(message);
    });
  }
  async open(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve(), { once: true });
      this.socket.addEventListener('error', () => reject(new Error('Socket failed')), {
        once: true,
      });
    });
  }
  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }
  next(): Promise<Record<string, unknown>> {
    const queued = this.messages.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = null;
        reject(new Error('Socket response timed out'));
      }, 2000);
      this.waiting = (message) => {
        clearTimeout(timer);
        resolve(message);
      };
    });
  }
  close(): void {
    this.socket.close();
  }
}
