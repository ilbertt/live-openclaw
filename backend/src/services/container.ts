import type { RelayConfig } from '#lib/env.ts';
import { AssetsRepository } from '#repositories/assets.repository.ts';
import { AssetsService } from '#services/assets.service.ts';
import { BridgeService } from '#services/bridge.service.ts';
import { ClientService } from '#services/client.service.ts';
import { RelayStateService } from '#services/relay-state.service.ts';
export function createServices(config: RelayConfig, assets = new AssetsRepository()) {
  const state = new RelayStateService();
  return {
    state,
    config,
    assets: new AssetsService(assets),
    bridge: new BridgeService(state, config.bridgeSecret),
    clients: new ClientService(state, config),
  };
}
export type Services = ReturnType<typeof createServices>;
