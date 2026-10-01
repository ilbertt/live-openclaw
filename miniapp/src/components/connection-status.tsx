import type { VoiceState } from '../lib/voice/voice-state.ts';
export function ConnectionStatus({ state }: { state: VoiceState }) {
  const live = state.ready && state.connected && state.active;
  const label = live
    ? 'Live'
    : !state.ready
      ? 'Offline'
      : state.starting || state.active
        ? 'Connecting'
        : 'Ready';
  return (
    <div className="connection" role="status" aria-live="polite" data-live={live}>
      {label}
    </div>
  );
}
