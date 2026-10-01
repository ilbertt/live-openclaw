import { readConnectorConfig } from '#connector/config.ts';
import { ConnectorController } from '#connector/controller.ts';
import { ConnectorRuntime } from '#connector/runtime.ts';
import { OpenClawConfigRepository } from '#repositories/openclaw-config.repository.ts';
import { GatewayService } from '#services/gateway.service.ts';
import { OfferService } from '#services/offer.service.ts';

const config = readConnectorConfig();
let runtime: ConnectorRuntime;
const gateway = new GatewayService(
  config,
  new OpenClawConfigRepository(),
  (ready) => runtime.send({ type: 'bridge.status', ready }),
  (payload) =>
    runtime.send({ type: 'event', payload: { type: 'event', event: 'talk.event', payload } }),
);
runtime = new ConnectorRuntime(
  config,
  gateway,
  new ConnectorController(gateway, new OfferService(config.gatewayUrl)),
);
await runtime.start();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => runtime.stop());
