import { expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.ts';
import { validateTelegramInitData } from '../src/lib/telegram-init-data.ts';
import { AssetsRepository } from '../src/repositories/assets.repository.ts';
import { ClientService } from '../src/services/client.service.ts';
import { createServices } from '../src/services/container.ts';
import { TestSocket } from './socket-helper.ts';
import { signedData, testPublicKey } from './telegram-fixture.ts';

const config = {
  port: 0,
  botId: '123',
  allowedUserId: 42,
  bridgeSecret: 'test-secret',
  sessionKey: 'agent:test',
  model: 'gpt-live-1-codex',
};
function serviceFixture() {
  const services = createServices(config, new AssetsRepository('/nonexistent'));
  services.clients = new ClientService(services.state, config, (raw, options) =>
    validateTelegramInitData(raw, { ...options, now: 10_000, publicKey: testPublicKey }),
  );
  return services;
}
test('real relay sockets authenticate, route RPC, reconnect bridge, and reject malformed JSON', async () => {
  const server = createApp(serviceFixture());
  const origin = `ws://127.0.0.1:${server.port}`;
  const bridge = new TestSocket(`${origin}/bridge`),
    client = new TestSocket(`${origin}/rpc`);
  const sockets = [bridge, client];
  try {
    await Promise.all([bridge.open(), client.open()]);
    expect((await client.next()).type).toBe('auth.required');
    bridge.send({ type: 'bridge.auth', secret: 'test-secret' });
    expect((await bridge.next()).type).toBe('bridge.ready');
    bridge.send({ type: 'bridge.status', ready: true });
    bridge.send({ type: 'bridge.ping' });
    expect((await bridge.next()).type).toBe('bridge.pong');
    client.send({ type: 'auth', initData: signedData() });
    const authenticated = await client.next();
    expect(authenticated.type).toBe('auth.ok');
    expect(authenticated.gatewayReady).toBe(true);
    const opened = await bridge.next();
    expect(opened.type).toBe('client.open');
    client.send({ type: 'rpc', id: 'r1', method: 'talk.catalog', params: {} });
    const forwarded = await bridge.next();
    expect(forwarded.type).toBe('client.message');
    bridge.send({
      type: 'client.reply',
      clientId: opened.clientId,
      payload: { type: 'result', id: 'r1', result: { ready: true } },
    });
    expect(await client.next()).toEqual({ type: 'result', id: 'r1', result: { ready: true } });
    client.send({ type: 'rpc', id: 'bad', method: 'exec', params: {} });
    expect((await client.next()).type).toBe('error');
    const replacement = new TestSocket(`${origin}/bridge`);
    sockets.push(replacement);
    await replacement.open();
    replacement.send({ type: 'bridge.auth', secret: 'test-secret' });
    expect((await replacement.next()).type).toBe('bridge.ready');
    expect((await replacement.next()).type).toBe('client.open');
    expect(await client.next()).toEqual({
      type: 'bridge.state',
      connected: true,
      gatewayReady: false,
    });
    replacement.send({ type: 'bridge.status', ready: true });
    expect((await client.next()).gatewayReady).toBe(true);
    replacement.send({
      type: 'event',
      payload: {
        type: 'event',
        event: 'talk.event',
        payload: { type: 'session.closed', sessionId: 'v' },
      },
    });
    expect((await client.next()).type).toBe('event');
    const closed = new Promise<number>((resolve) =>
      client.socket.addEventListener('close', (event) => resolve(event.code), { once: true }),
    );
    client.socket.send('null');
    expect(await closed).toBe(1003);
  } finally {
    sockets.forEach((socket) => {
      socket.close();
    });
    await server.stop(true);
  }
});
test('unsigned clients and incorrect bridge secrets are rejected', async () => {
  const server = createApp(createServices(config, new AssetsRepository('/nonexistent')));
  const client = new TestSocket(`ws://127.0.0.1:${server.port}/rpc`),
    bridge = new TestSocket(`ws://127.0.0.1:${server.port}/bridge`);
  try {
    await Promise.all([client.open(), bridge.open()]);
    await client.next();
    client.send({ type: 'auth', initData: 'user=%7B%22id%22%3A42%7D' });
    expect((await client.next()).type).toBe('auth.error');
    const closed = new Promise<number>((resolve) =>
      bridge.socket.addEventListener('close', (event) => resolve(event.code), { once: true }),
    );
    bridge.send({ type: 'bridge.auth', secret: 'bad' });
    expect(await closed).toBe(1008);
  } finally {
    client.close();
    bridge.close();
    await server.stop(true);
  }
});
test('HTTP health, config, static assets, fallback, and optional Mini App', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'live-openclaw-assets-'));
  await writeFile(join(folder, 'index.html'), '<!doctype html><title>Friday</title>');
  const server = createApp(createServices(config, new AssetsRepository(folder)));
  try {
    const origin = `http://127.0.0.1:${server.port}`;
    expect(await (await fetch(`${origin}/healthz`)).json()).toEqual({
      ok: true,
      bridgeConnected: false,
      gatewayReady: false,
      clients: 0,
    });
    expect(await (await fetch(`${origin}/api/config`)).json()).toEqual({
      sessionKey: 'agent:test',
      model: 'gpt-live-1-codex',
    });
    const index = await fetch(origin);
    expect(index.headers.get('content-security-policy')).toContain('telegram.org');
    expect(await index.text()).toContain('Friday');
    expect((await fetch(`${origin}/app/route`)).status).toBe(200);
    for (const path of ['/missing.js', '/api/missing'])
      expect((await fetch(`${origin}${path}`)).status).toBe(404);
    expect((await fetch(`${origin}/rpc`)).status).toBe(426);
  } finally {
    await server.stop(true);
    await rm(folder, { recursive: true });
  }
  const empty = createApp(createServices(config, new AssetsRepository('/nonexistent')));
  try {
    expect((await fetch(`http://127.0.0.1:${empty.port}/`)).status).toBe(404);
  } finally {
    await empty.stop(true);
  }
});
