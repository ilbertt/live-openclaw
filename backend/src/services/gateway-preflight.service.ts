import { isObject, readVoiceSession } from '#protocol.ts';
import type { GatewayService } from '#services/gateway.service.ts';
import { resolveOfferUrl } from '#services/offer.service.ts';

export async function checkGateway(
  gateway: Pick<GatewayService, 'request'>,
  config: { gatewayUrl: string; model: string; sessionKey?: string },
): Promise<void> {
  const catalog = await gateway.request('talk.catalog', {
    provider: 'openai',
    model: config.model,
  });
  if (!isObject(catalog) || !isObject(catalog.realtime))
    throw new Error('Gateway did not return a realtime Talk catalog');
  if (config.sessionKey === undefined) return;
  if (!config.sessionKey.trim()) throw new Error('OPENCLAW_SESSION_KEY is required for --session');
  const raw = await gateway.request('talk.client.create', {
    sessionKey: config.sessionKey,
    provider: 'openai',
    model: config.model,
    mode: 'realtime',
    transport: 'webrtc',
    brain: 'agent-consult',
    capabilities: ['gateway-control-v1'],
  });
  const id = isObject(raw) && typeof raw.voiceSessionId === 'string' ? raw.voiceSessionId : null;
  try {
    const session = readVoiceSession(raw);
    resolveOfferUrl(session.offerUrl, config.gatewayUrl);
    if (!session.clientSecret.trim()) throw new Error('Missing WebRTC offer credential');
  } finally {
    if (id)
      await gateway.request('talk.client.close', {
        sessionKey: config.sessionKey,
        voiceSessionId: id,
      });
  }
}
