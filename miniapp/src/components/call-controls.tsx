import type { VoiceState } from '../lib/voice/voice-state.ts';
export function CallControls({
  state,
  start,
  end,
  mute,
}: {
  state: VoiceState;
  start: () => void;
  end: () => void;
  mute: () => void;
}) {
  return (
    <>
      {state.error && (
        <div className="status" role="alert">
          {state.error}
        </div>
      )}
      <button
        type="button"
        className="primary"
        disabled={!state.ready || state.starting}
        onClick={start}
      >
        Talk
      </button>
      <div className="controls">
        <button type="button" className="secondary" aria-pressed={state.muted} onClick={mute}>
          {state.muted ? 'Unmute' : 'Mute'}
        </button>
        <button type="button" className="secondary end" onClick={end}>
          End
        </button>
      </div>
    </>
  );
}
