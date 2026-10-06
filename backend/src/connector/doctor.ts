import { OpenClawConfigRepository } from '#repositories/openclaw-config.repository.ts';
import { GatewayService } from '#services/gateway.service.ts';
import { checkGateway } from '#services/gateway-preflight.service.ts';

const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789';
const gateway = new GatewayService(
  {
    gatewayUrl,
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN?.trim(),
  },
  new OpenClawConfigRepository(),
  () => {},
  () => {},
);
const model = process.env.VOICE_MODEL || 'gpt-live-1-codex';
try {
  const probeSession = process.argv.includes('--session');
  const sessionKey = process.env.OPENCLAW_SESSION_KEY?.trim();
  if (probeSession && !sessionKey)
    throw new Error('OPENCLAW_SESSION_KEY is required for --session');
  await checkGateway(gateway, {
    gatewayUrl,
    model,
    sessionKey: probeSession ? sessionKey : undefined,
  });
  console.log('Gateway authentication and talk.catalog: OK');
  console.log(`Requested voice model: ${model}`);
  if (probeSession) {
    console.log('Gateway-owned WebRTC session negotiation and cleanup: OK');
    console.log(
      'Provider connectivity and audio playback require a real call; neither was tested.',
    );
  } else {
    console.log(
      'Run bun run doctor --session with OPENCLAW_SESSION_KEY to verify session negotiation.',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Gateway preflight failed');
  process.exitCode = 1;
} finally {
  gateway.stop();
}
