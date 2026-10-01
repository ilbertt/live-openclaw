import { createApp } from '#app.ts';
import { readRelayConfig } from '#lib/env.ts';
import { createServices } from '#services/container.ts';

const server = createApp(createServices(readRelayConfig()));
console.log(`Friday Mini App listening on ${server.url}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void server.stop(true);
  });
