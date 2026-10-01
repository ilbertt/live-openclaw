export type RelayConfig = {
  port: number;
  bridgeSecret: string;
  botId: string;
  allowedUserId: number;
  sessionKey: string;
  model: string;
};
export function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}
export function readRelayConfig(env = process.env): RelayConfig {
  const port = Number(env.PORT || env.NIBRUN_HTTP_PORT || 3000);
  const allowedUserId = Number(required(env, 'TELEGRAM_ALLOWED_USER_ID'));
  const botId = required(env, 'TELEGRAM_BOT_ID');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  if (!Number.isSafeInteger(allowedUserId) || allowedUserId <= 0)
    throw new Error('Invalid TELEGRAM_ALLOWED_USER_ID');
  if (!/^\d+$/.test(botId)) throw new Error('Invalid TELEGRAM_BOT_ID');
  return {
    port,
    allowedUserId,
    botId,
    bridgeSecret: required(env, 'BRIDGE_SECRET'),
    sessionKey: required(env, 'OPENCLAW_SESSION_KEY'),
    model: env.VOICE_MODEL || 'gpt-live-1-codex',
  };
}
