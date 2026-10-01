import { Elysia, t } from 'elysia';
import type { RelayStateService } from '#services/relay-state.service.ts';
export function createHealthController(state: RelayStateService) {
  return new Elysia().get('/healthz', () => state.health(), {
    response: t.Object({
      ok: t.Boolean(),
      bridgeConnected: t.Boolean(),
      gatewayReady: t.Boolean(),
      clients: t.Number(),
    }),
  });
}
