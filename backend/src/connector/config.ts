import { required } from '#lib/env.ts';
export function readConnectorConfig(env = process.env) {
  const remote = new URL(required(env, 'FRIDAY_MINIAPP_URL'));
  if (!['https:', 'http:'].includes(remote.protocol))
    throw new Error('FRIDAY_MINIAPP_URL must use HTTP(S)');
  remote.protocol = remote.protocol === 'https:' ? 'wss:' : 'ws:';
  remote.pathname = '/bridge';
  remote.search = '';
  remote.hash = '';
  const gateway = new URL(env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789');
  if (!['ws:', 'wss:'].includes(gateway.protocol))
    throw new Error('OPENCLAW_GATEWAY_URL must use WS(S)');
  return {
    bridgeUrl: remote.toString(),
    bridgeSecret: required(env, 'FRIDAY_MINIAPP_BRIDGE_SECRET'),
    gatewayUrl: gateway.toString(),
    gatewayToken: env.OPENCLAW_GATEWAY_TOKEN?.trim(),
  };
}
export type ConnectorConfig = ReturnType<typeof readConnectorConfig>;
