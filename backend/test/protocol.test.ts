import { expect, test } from 'bun:test';
import { readConnectorConfig } from '../src/connector/config.ts';
import { ConnectorController } from '../src/connector/controller.ts';
import { readRelayConfig } from '../src/lib/env.ts';
import { isClientRequest, parseObject, readTalkEvent, readVoiceSession } from '../src/protocol.ts';

test('validates RPC allowlist, object params, offers, and JSON roots', () => {
  expect(isClientRequest({ type: 'rpc', id: '1', method: 'talk.catalog', params: {} })).toBe(true);
  for (const input of [
    null,
    [],
    { type: 'rpc', id: '1', method: 'exec', params: {} },
    { type: 'rpc', id: 1, method: 'talk.catalog', params: {} },
    { type: 'rpc', id: '1', method: 'talk.catalog', params: [] },
    { type: 'offer', id: '1', offerHeaders: { a: 123 } },
  ])
    expect(isClientRequest(input)).toBe(false);
  for (const input of ['null', '[]', '1', 'broken']) expect(() => parseObject(input)).toThrow();
});
test('requires negotiated Gateway ownership and validates sessions', () => {
  expect(() => readVoiceSession({ voiceSessionId: 'v' })).toThrow('control');
  expect(() => readVoiceSession({ clientControl: { owner: 'gateway' } })).toThrow('session');
  expect(
    readTalkEvent({
      talkEvent: { type: 'transcript.done', sessionId: 'v', payload: { text: 'hello' } },
    })?.payload.text,
  ).toBe('hello');
  expect(readTalkEvent({ type: 123 })).toBeNull();
});
test('connector rejects invalid RPC without invoking Gateway', async () => {
  let called = false;
  const controller = new ConnectorController(
    {
      request: async () => {
        called = true;
        return {};
      },
    },
    { exchange: async () => ({ sdp: 'answer' }) },
  );
  expect((await controller.handle({ type: 'rpc', id: '1', method: 'exec', params: {} })).type).toBe(
    'error',
  );
  expect(called).toBe(false);
  expect(
    await controller.handle({ type: 'rpc', id: '2', method: 'talk.catalog', params: {} }),
  ).toEqual({ type: 'result', id: '2', result: {} });
});
test('environment rejects missing identity and invalid numbers and URL schemes', () => {
  const env = {
    BRIDGE_SECRET: 'secret',
    TELEGRAM_BOT_ID: '123',
    TELEGRAM_ALLOWED_USER_ID: '42',
    OPENCLAW_SESSION_KEY: 'agent:test',
  };
  expect(readRelayConfig(env).model).toBe('gpt-live-1-codex');
  for (const patch of [
    { TELEGRAM_ALLOWED_USER_ID: 'NaN' },
    { PORT: '-1' },
    { TELEGRAM_BOT_ID: 'x' },
    { BRIDGE_SECRET: '' },
  ])
    expect(() => readRelayConfig({ ...env, ...patch })).toThrow();
  expect(
    readConnectorConfig({
      FRIDAY_MINIAPP_URL: 'https://example.com/path?a=b#x',
      FRIDAY_MINIAPP_BRIDGE_SECRET: 'secret',
    }).bridgeUrl,
  ).toBe('wss://example.com/bridge');
  expect(() =>
    readConnectorConfig({
      FRIDAY_MINIAPP_URL: 'file:///tmp/a',
      FRIDAY_MINIAPP_BRIDGE_SECRET: 'secret',
    }),
  ).toThrow();
});
