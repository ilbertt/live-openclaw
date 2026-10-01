import type { OfferRequest } from '#protocol.ts';
export function resolveOfferUrl(path: string, gatewayUrl: string): URL {
  const gateway = new URL(gatewayUrl);
  gateway.protocol = gateway.protocol === 'wss:' ? 'https:' : 'http:';
  const url = new URL(path, gateway);
  if (
    !path.startsWith('/plugins/openai/') ||
    url.origin !== gateway.origin ||
    !url.pathname.startsWith('/plugins/openai/') ||
    /%2f|%5c|\\/i.test(path)
  )
    throw new Error('Invalid WebRTC offer URL');
  return url;
}
export class OfferService {
  constructor(
    private readonly gatewayUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async exchange(request: OfferRequest): Promise<{ sdp: string }> {
    const url = resolveOfferUrl(request.offerUrl, this.gatewayUrl);
    if (!request.clientSecret || !request.sdp) throw new Error('Invalid WebRTC offer request');
    const headers = new Headers();
    // Preserve adapter headers without allowing the browser to override host or credentials.
    for (const [key, value] of Object.entries(request.offerHeaders))
      if (
        ![
          'host',
          'cookie',
          'connection',
          'content-length',
          'authorization',
          'content-type',
        ].includes(key.toLowerCase())
      )
        headers.set(key, value);
    headers.set('authorization', `Bearer ${request.clientSecret}`);
    headers.set('content-type', 'application/sdp');
    const response = await this.fetcher(url, {
      method: 'POST',
      body: request.sdp,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`WebRTC setup failed (${response.status})`);
    return { sdp: await response.text() };
  }
}
