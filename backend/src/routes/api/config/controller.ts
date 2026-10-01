import { Elysia, t } from 'elysia';
import type { VoiceConfiguration } from '#protocol.ts';
export function createConfigController(config: VoiceConfiguration) {
  return new Elysia().get(
    '/api/config',
    () => ({ sessionKey: config.sessionKey, model: config.model }),
    { response: t.Object({ sessionKey: t.String(), model: t.String() }) },
  );
}
