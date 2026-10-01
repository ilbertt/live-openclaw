import type { JsonObject } from 'backend/protocol';
import { inboundAudio } from './audio-stats.ts';
export class Playback {
  rejected = false;
  private generation = 0;
  constructor(
    readonly element: HTMLAudioElement,
    private readonly changed: (blocked: boolean) => void,
  ) {}
  async play(stream?: MediaStream): Promise<void> {
    const generation = this.generation;
    if (stream) this.element.srcObject = stream;
    this.element.muted = false;
    this.element.volume = 1;
    try {
      await this.element.play();
      if (generation !== this.generation) return;
      this.rejected = false;
      this.changed(false);
    } catch {
      if (generation !== this.generation) return;
      this.rejected = true;
      this.changed(true);
    }
  }
  async diagnostic(peer: RTCPeerConnection): Promise<JsonObject> {
    const inbound = inboundAudio(await peer.getStats());
    const source = this.element.srcObject;
    return {
      packetsReceived: inbound?.packetsReceived ?? 0,
      bytesReceived: inbound?.bytesReceived ?? 0,
      totalAudioEnergy: inbound?.totalAudioEnergy ?? 0,
      currentTime: this.element.currentTime,
      readyState: this.element.readyState,
      paused: this.element.paused,
      trackMuted:
        source instanceof MediaStream ? (source.getAudioTracks()[0]?.muted ?? true) : true,
      playRejected: this.rejected,
    };
  }
  stop(): void {
    this.generation++;
    this.element.pause();
    this.element.srcObject = null;
    this.rejected = false;
    this.changed(false);
  }
}
