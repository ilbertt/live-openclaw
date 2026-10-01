import type { RelayConfig } from '#lib/env.ts';
import { type AppSocket, closeSocket } from '#lib/socket.ts';
import { validateTelegramInitData } from '#lib/telegram-init-data.ts';
import { isClientRequest, isObject } from '#protocol.ts';
import type { RelayStateService } from '#services/relay-state.service.ts';

const DIAGNOSTIC_KEYS = [
  'packetsReceived',
  'bytesReceived',
  'totalAudioEnergy',
  'currentTime',
  'readyState',
  'paused',
  'trackMuted',
  'playRejected',
];
export class ClientService {
  constructor(
    private readonly state: RelayStateService,
    private readonly config: RelayConfig,
    private readonly authenticateUser = validateTelegramInitData,
  ) {}
  receive(socket: AppSocket, message: Record<string, unknown>): void {
    if (socket.data.role !== 'client') return;
    if (!socket.data.authenticated) {
      this.authenticate(socket, message);
      return;
    }
    if (message.type === 'audio.diagnostic') {
      const report = isObject(message.report) ? message.report : {};
      const safe = Object.fromEntries(
        DIAGNOSTIC_KEYS.flatMap((key) => {
          const value = report[key];
          return typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
            ? [[key, value]]
            : [];
        }),
      );
      console.log('audio.diagnostic', JSON.stringify(safe));
      return;
    }
    if (!isClientRequest(message)) {
      this.reject(socket, message, 'Unsupported request');
      return;
    }
    if (!this.state.connected) {
      this.reject(socket, message, 'Friday is offline');
      return;
    }
    this.state.sendBridge({ type: 'client.message', clientId: socket.data.id, payload: message });
  }
  private reject(socket: AppSocket, message: Record<string, unknown>, reason: string): void {
    this.state.sendClient(socket, {
      type: 'error',
      id: typeof message.id === 'string' ? message.id : '',
      message: reason,
    });
  }
  private authenticate(socket: AppSocket, message: Record<string, unknown>): void {
    if (socket.data.role !== 'client') return;
    try {
      if (message.type !== 'auth' || typeof message.initData !== 'string')
        throw new Error('Telegram authorization required');
      const user = this.authenticateUser(message.initData, this.config);
      socket.data.authenticated = true;
      socket.data.user = user;
      this.state.clients.set(socket.data.id, socket);
      this.state.sendClient(socket, {
        type: 'auth.ok',
        user: { id: user.id, firstName: user.first_name || 'User' },
        bridgeConnected: this.state.connected,
        gatewayReady: this.state.connected && this.state.gatewayReady,
      });
      this.state.sendBridge({ type: 'client.open', clientId: socket.data.id });
    } catch (error) {
      this.state.sendClient(socket, {
        type: 'auth.error',
        message: error instanceof Error ? error.message : 'Unauthorized',
      });
      closeSocket(socket, 1008, 'Unauthorized');
    }
  }
}
