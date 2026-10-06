import { isObject, type Json, readVoiceSession, type VoiceConfiguration } from 'backend/protocol';
import type { FridayFace } from '../face/friday-face.ts';
import { RelayClient } from '../relay-client.ts';
import type { TelegramWebApp } from '../telegram.ts';
import { monitorClose } from './close-monitor.ts';
import { createConversationCloser } from './conversation-close.ts';
import { monitorMicrophone, waitForIce } from './media.ts';
import { Playback } from './playback.ts';
import { handleTalkEvent } from './talk-events.ts';
import { INITIAL_VOICE_STATE, type VoiceState } from './voice-state.ts';

const PLAYBACK_BLOCKED = 'Playback was blocked. Tap or click to retry audio.';
export class VoiceController {
  private state = { ...INITIAL_VOICE_STATE };
  private peer: RTCPeerConnection | undefined;
  private stream: MediaStream | undefined;
  private sessionId: string | undefined;
  private generation = 0;
  private disposed = false;
  private cleanup: (() => void)[] = [];
  private readonly relay: RelayClient;
  private readonly playback: Playback;
  private readonly closer = createConversationCloser({
    close: () => this.end(),
    pendingChanged: () => {},
  });
  constructor(
    private readonly config: VoiceConfiguration,
    private readonly face: FridayFace,
    audio: HTMLAudioElement,
    private readonly tg: TelegramWebApp | undefined,
    private readonly changed: (state: VoiceState) => void,
    private readonly caption: (text: string) => void,
  ) {
    this.playback = new Playback(audio, (blocked) =>
      this.update({
        soundBlocked: blocked,
        ...(blocked ? { error: PLAYBACK_BLOCKED } : {}),
      }),
    );
    this.relay = new RelayClient(
      tg?.initData || '',
      (state) => {
        this.update({ ready: state.ready, ...(state.error ? { error: state.error } : {}) });
        if (!state.ready && (this.state.active || this.state.starting))
          this.end('Friday is offline');
      },
      (raw) => this.event(raw),
      () => {
        if (this.state.active || this.state.starting) this.end('Connection lost');
      },
    );
    if (!tg?.initData) this.update({ error: 'Open this Mini App from Friday in Telegram.' });
    this.relay.connect();
  }
  private update(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.changed(this.state);
  }
  private event(raw: Json): void {
    handleTalkEvent(raw, this.sessionId, {
      face: this.face,
      closer: this.closer,
      caption: this.caption,
      error: (error) => this.update({ error }),
      ended: () => this.end(),
    });
  }
  async start(): Promise<void> {
    if (!this.state.ready || this.state.starting || this.state.active || this.disposed) return;
    const generation = ++this.generation;
    const current = () => generation === this.generation && !this.disposed;
    this.update({ starting: true, error: '' });
    try {
      this.playback.prime();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!current()) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }
      this.stream = stream;
      this.cleanup.push(monitorMicrophone(stream, () => this.closer.cancel()));
      const session = readVoiceSession(
        await this.relay.rpc('talk.client.create', {
          sessionKey: this.config.sessionKey,
          provider: 'openai',
          model: this.config.model,
          mode: 'realtime',
          transport: 'webrtc',
          brain: 'agent-consult',
          capabilities: ['gateway-control-v1'],
        }),
      );
      if (!current()) {
        this.closeSession(session.voiceSessionId);
        return;
      }
      this.sessionId = session.voiceSessionId;
      const peer = new RTCPeerConnection();
      this.peer = peer;
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
      peer.addEventListener('track', (event) => {
        if (current()) void this.playback.play(event.streams[0] || new MediaStream([event.track]));
      });
      peer.addEventListener('connectionstatechange', () => {
        if (!current()) return;
        this.update({ connected: peer.connectionState === 'connected' });
        if (['failed', 'closed'].includes(peer.connectionState)) this.end('Voice connection ended');
      });
      await peer.setLocalDescription(await peer.createOffer({ offerToReceiveAudio: true }));
      await waitForIce(peer);
      if (!current()) return;
      const answer = await this.relay.offer({
        offerUrl: session.offerUrl,
        offerHeaders: session.offerHeaders,
        clientSecret: session.clientSecret,
        sdp: peer.localDescription?.sdp || '',
      });
      if (!current()) return;
      if (!isObject(answer) || typeof answer.sdp !== 'string')
        throw new Error('Invalid WebRTC answer');
      await peer.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      if (!current()) return;
      this.face.start(peer, this.playback.element);
      this.cleanup.push(monitorClose(peer, this.playback, this.closer));
      const timer = setInterval(() => {
        void this.playback
          .diagnostic(peer)
          .then((report) => {
            if (current()) this.relay.diagnostic(report);
          })
          .catch(() => {});
      }, 5000);
      this.cleanup.push(() => clearInterval(timer));
      this.update({ active: true });
      this.tg?.HapticFeedback?.impactOccurred('medium');
    } catch (error) {
      if (current()) this.end(error instanceof Error ? error.message : 'Could not start voice');
    } finally {
      if (current()) this.update({ starting: false });
    }
  }
  private closeSession(id: string): void {
    void this.relay
      .rpc('talk.client.close', { sessionKey: this.config.sessionKey, voiceSessionId: id })
      .catch(() => {});
  }
  end(error = ''): void {
    this.generation++;
    const id = this.sessionId;
    this.sessionId = undefined;
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.closer.reset();
    this.face.stop();
    this.caption('');
    const peer = this.peer;
    this.peer = undefined;
    peer?.close();
    this.stream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.stream = undefined;
    this.playback.stop();
    this.update({ active: false, starting: false, connected: false, muted: false, error });
    if (id) this.closeSession(id);
  }
  toggleMute(): void {
    const muted = !this.state.muted;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.update({ muted });
    this.tg?.HapticFeedback?.selectionChanged();
  }
  async retryAudio(): Promise<void> {
    if (!this.state.active || !this.playback.rejected) return;
    const generation = this.generation;
    await this.playback.play();
    if (
      generation === this.generation &&
      !this.playback.rejected &&
      this.state.error === PLAYBACK_BLOCKED
    )
      this.update({ error: '' });
  }
  dispose(): void {
    this.end();
    this.disposed = true;
    this.relay.dispose();
  }
}
