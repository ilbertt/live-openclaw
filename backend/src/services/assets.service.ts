import { extname } from 'node:path';
import type { AssetsRepository } from '#repositories/assets.repository.ts';

const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:; media-src 'self' blob:; img-src 'self' data:; frame-ancestors https://web.telegram.org https://*.telegram.org",
  'permissions-policy': 'microphone=(self)',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};
export class AssetsService {
  private readonly assets: Map<string, Blob>;
  constructor(repository: AssetsRepository) {
    this.assets = repository.list();
  }
  respond(path: string): Response {
    const asset =
      this.assets.get(path === '/' ? '/index.html' : path) ??
      (!extname(path) && !path.startsWith('/api/') ? this.assets.get('/index.html') : undefined);
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(asset, {
      headers: {
        ...SECURITY_HEADERS,
        'content-type': asset.type || 'application/octet-stream',
        'cache-control': path.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-store',
      },
    });
  }
}
