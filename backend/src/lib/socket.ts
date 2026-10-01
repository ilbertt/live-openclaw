import type { TelegramIdentity } from '#lib/telegram-init-data.ts';
export type SocketData =
  | { role: 'bridge'; authenticated: boolean }
  | { role: 'client'; authenticated: boolean; id: string; user?: TelegramIdentity };
export type AppSocket = Bun.ServerWebSocket<SocketData>;
export function send(socket: AppSocket, value: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}
export function closeSocket(socket: AppSocket, code: number, reason: string): void {
  socket.close(code, reason.slice(0, 120));
}
