import type { JsonObject } from 'backend/protocol';
import { inboundAudio } from './audio-stats.ts';
export class Playback {
  rejected = false;
  private generation = 0;
  constructor(
    readonly element: HTMLAudioElement,
    private readonly changed: (blocked: boolean) => void,
  ) {}
  prime(): void {
    // Unlock this same element inside the Talk tap, before permission/signaling awaits.
    const wav = new Uint8Array(44 + 1600);
    const view = new DataView(wav.buffer);
    for (const [offset, label] of [
      [0, 'RIFF'],
      [8, 'WAVE'],
      [12, 'fmt '],
      [36, 'data'],
    ] as const)
      for (let i = 0; i < label.length; i++) wav[offset + i] = label.charCodeAt(i);
    view.setUint32(4, wav.length - 8, true);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(40, 1600, true);
    this.element.src = `data:audio/wav;base64,${btoa(String.fromCharCode(...wav))}`;
    this.element.muted = false;
    this.element.volume = 1;
    void this.element.play().catch(() => {});
  }
  async play(stream?: MediaStream): Promise<void> {
    const generation = ++this.generation;
    if (stream) {
      this.element.removeAttribute('src');
      this.element.srcObject = stream;
    }
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
    this.element.removeAttribute('src');
    this.rejected = false;
    this.changed(false);
  }
}
