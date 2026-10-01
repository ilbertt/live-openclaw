import { Elysia } from 'elysia';
import type { SocketData } from '#lib/socket.ts';
import { createConfigController } from '#routes/api/config/controller.ts';
import { createHealthController } from '#routes/api/health/controller.ts';
import { websocketController } from '#routes/websocket.controller.ts';
import type { Services } from '#services/container.ts';
export function createApp(services: Services) {
  const http = new Elysia()
    .use(createHealthController(services.state))
    .use(createConfigController(services.config))
    .compile();
  return Bun.serve<SocketData>({
    port: services.config.port,
    hostname: '0.0.0.0',
    fetch(request, server) {
      const path = new URL(request.url).pathname;
      if (path === '/rpc' || path === '/bridge') {
        const data: SocketData =
          path === '/rpc'
            ? { role: 'client', authenticated: false, id: crypto.randomUUID() }
            : { role: 'bridge', authenticated: false };
        if (server.upgrade(request, { data })) return;
        return new Response('WebSocket upgrade required', { status: 426 });
      }
      if (path === '/healthz' || path.startsWith('/api/')) return http.handle(request);
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return new Response('Method not allowed', { status: 405 });
      const response = services.assets.respond(path);
      return request.method === 'HEAD' ? new Response(null, response) : response;
    },
    websocket: websocketController(services),
  });
}
