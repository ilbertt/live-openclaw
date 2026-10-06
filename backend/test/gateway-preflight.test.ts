import { expect, test } from 'bun:test';
import type { Json, JsonObject, TalkMethod } from '../src/protocol.ts';
import { checkGateway } from '../src/services/gateway-preflight.service.ts';

const config = { gatewayUrl: 'ws://127.0.0.1:18789', model: 'gpt-live-1-codex' };
const validSession = {
  voiceSessionId: 'probe',
  clientControl: { owner: 'gateway' },
  offerUrl: '/plugins/openai/realtime/calls',
  clientSecret: 'offer-secret',
};
function fixture(session: Json = validSession, catalog: Json = { realtime: {} }) {
  const calls: { method: TalkMethod; params: JsonObject }[] = [];
  return {
    calls,
    request: async (method: TalkMethod, params: JsonObject): Promise<Json> => {
      calls.push({ method, params });
      if (method === 'talk.catalog') return catalog;
      if (method === 'talk.client.create') return session;
      return {};
    },
  };
}
test('catalog preflight does not create a voice session', async () => {
  const gateway = fixture();
  await checkGateway(gateway, config);
  expect(gateway.calls).toEqual([
    { method: 'talk.catalog', params: { provider: 'openai', model: config.model } },
  ]);
});
test('session preflight negotiates Gateway control and closes the probe', async () => {
  const gateway = fixture();
  await checkGateway(gateway, { ...config, sessionKey: 'agent:test' });
  expect(gateway.calls[1]).toEqual({
    method: 'talk.client.create',
    params: {
      sessionKey: 'agent:test',
      provider: 'openai',
      model: config.model,
      mode: 'realtime',
      transport: 'webrtc',
      brain: 'agent-consult',
      capabilities: ['gateway-control-v1'],
    },
  });
  expect(gateway.calls[2]).toEqual({
    method: 'talk.client.close',
    params: { sessionKey: 'agent:test', voiceSessionId: 'probe' },
  });
});
test('rejected session ownership, credentials, and offer routes still close the probe', async () => {
  for (const session of [
    { ...validSession, clientControl: { owner: 'client' } },
    { ...validSession, clientSecret: '' },
    { ...validSession, offerUrl: '/plugins/openai/../../admin' },
    { ...validSession, offerUrl: 'https://evil.test/plugins/openai/calls' },
  ]) {
    const gateway = fixture(session);
    await expect(checkGateway(gateway, { ...config, sessionKey: 'agent:test' })).rejects.toThrow();
    expect(gateway.calls.at(-1)?.method).toBe('talk.client.close');
  }
});
test('missing realtime catalog or session key does not create a probe', async () => {
  for (const gateway of [fixture(validSession, {}), fixture()]) {
    await expect(checkGateway(gateway, { ...config, sessionKey: '' })).rejects.toThrow();
    expect(gateway.calls.some((call) => call.method === 'talk.client.create')).toBe(false);
  }
});
test('failed probe cleanup fails the preflight', async () => {
  const gateway = fixture();
  const request = gateway.request;
  gateway.request = async (method, params) => {
    if (method === 'talk.client.close') throw new Error('Gateway could not close the probe');
    return request(method, params);
  };
  await expect(checkGateway(gateway, { ...config, sessionKey: 'agent:test' })).rejects.toThrow(
    'could not close',
  );
});
