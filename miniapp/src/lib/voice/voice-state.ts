export type VoiceState = {
  ready: boolean;
  starting: boolean;
  active: boolean;
  connected: boolean;
  muted: boolean;
  soundBlocked: boolean;
  error: string;
};
export const INITIAL_VOICE_STATE: VoiceState = {
  ready: false,
  starting: false,
  active: false,
  connected: false,
  muted: false,
  soundBlocked: false,
  error: '',
};
