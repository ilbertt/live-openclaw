import { expect, test } from 'bun:test';
import { OfferService, resolveOfferUrl } from '../src/services/offer.service.ts';

test('offer URL stays inside Gateway origin and plugin subtree', () => {
  expect(resolveOfferUrl('/plugins/openai/offer', 'wss://localhost:18789').href).toBe(
    'https://localhost:18789/plugins/openai/offer',
  );
  for (const path of [
    'https://evil.test/plugins/openai/offer',
    '//evil.test/plugins/openai/offer',
    '/plugins/openai/../../admin',
    '/plugins/openai/%2e%2e/%2e%2e/admin',
    '/plugins/openai/%2fadmin',
    '/plugins/openai/\\evil',
  ])
    expect(() => resolveOfferUrl(path, 'ws://localhost:18789')).toThrow();
});
test('offer exchange uses scoped credentials and preserves provider headers', async () => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      expect(request.headers.get('authorization')).toBe('Bearer secret');
      expect(request.headers.get('x-provider-session')).toBe('v');
      expect(request.headers.get('content-type')).toBe('application/sdp');
      expect(request.headers.get('cookie')).toBeNull();
      expect(await request.text()).toBe('offer');
      return new Response('answer');
    },
  });
  try {
    const service = new OfferService(`ws://127.0.0.1:${server.port}`);
    expect(
      await service.exchange({
        type: 'offer',
        id: '1',
        offerUrl: '/plugins/openai/offer',
        clientSecret: 'secret',
        sdp: 'offer',
        offerHeaders: { authorization: 'override', cookie: 'bad', 'x-provider-session': 'v' },
      }),
    ).toEqual({ sdp: 'answer' });
  } finally {
    await server.stop(true);
  }
});
test('offer exchange rejects redirects and non-success responses', async () => {
  const server = Bun.serve({
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname.endsWith('/redirect')
        ? Response.redirect('https://example.com', 302)
        : new Response('failed', { status: 500 }),
  });
  try {
    const service = new OfferService(`ws://127.0.0.1:${server.port}`);
    for (const route of ['redirect', 'failure'])
      await expect(
        service.exchange({
          type: 'offer',
          id: '1',
          offerUrl: `/plugins/openai/${route}`,
          sdp: 'offer',
          clientSecret: 'secret',
          offerHeaders: {},
        }),
      ).rejects.toThrow();
  } finally {
    await server.stop(true);
  }
});
