import { AudioLevel, inboundAudio } from './audio-stats.ts';
import type { createConversationCloser } from './conversation-close.ts';
import type { Playback } from './playback.ts';
export function monitorClose(
  peer: RTCPeerConnection,
  playback: Playback,
  closer: ReturnType<typeof createConversationCloser>,
): () => void {
  let busy = false,
    stopped = false;
  const level = new AudioLevel();
  const sample = async () => {
    if (busy || !closer.pending) return;
    busy = true;
    try {
      const stats = await peer.getStats();
      if (!stopped && closer.pending)
        closer.sample(
          playback.element.paused || playback.rejected ? 0 : level.sample(inboundAudio(stats)),
        );
    } catch {
      if (!stopped) closer.sample(Number.NaN);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    void sample();
  }, 120);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
