import { expect, jest, test } from 'bun:test';
import type { FridayFace } from '../src/lib/face/friday-face.ts';
import type { TelegramWebApp } from '../src/lib/telegram.ts';
import { VoiceController } from '../src/lib/voice/voice-controller.ts';
import type { VoiceState } from '../src/lib/voice/voice-state.ts';

class FakeSocket extends EventTarget {
  static OPEN = 1;
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  send(raw: string): void {
    this.sent.push(JSON.parse(raw));
  }
  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
  receive(message: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const sockets: FakeSocket[] = [],
    changes: VoiceState[] = [];
  const capture = deferred<MediaStream>();
  const peers: EventTarget[] = [];
  let play = () => Promise.resolve();
  let stopped = 0,
    meterClosed = 0,
    audioPlayed = 0;
  const track = {
    enabled: true,
    stop: () => {
      stopped++;
    },
  };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const globals: Record<string, unknown> = {
    location: { protocol: 'https:', host: 'example.test' },
    WebSocket: class extends FakeSocket {
      constructor() {
        super();
        sockets.push(this);
      }
    },
    navigator: { mediaDevices: { getUserMedia: () => capture.promise } },
    RTCPeerConnection: class extends EventTarget {
      connectionState = 'new';
      iceGatheringState = 'complete';
      localDescription = { sdp: 'offer' };
      constructor() {
        super();
        peers.push(this);
      }
      addTrack() {}
      async createOffer() {
        return { type: 'offer', sdp: 'offer' };
      }
      async setLocalDescription() {}
      async setRemoteDescription() {
        this.connectionState = 'connected';
        this.dispatchEvent(new Event('connectionstatechange'));
      }
      async getStats() {
        return new Map();
      }
      close() {
        this.connectionState = 'closed';
      }
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    AudioContext: class {
      createAnalyser() {
        return { fftSize: 256, frequencyBinCount: 128, getByteFrequencyData: () => {} };
      }
      createMediaStreamSource() {
        return { connect: () => {}, disconnect: () => {} };
      }
      async close() {
        meterClosed++;
      }
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const face: FridayFace = {
    event: () => {},
    look: () => {},
    start: () => {},
    stop: () => {},
    destroy: () => {},
  };
  const tg: TelegramWebApp = {
    initData: 'signed',
    ready: () => {},
    expand: () => {},
    onEvent: () => {},
    offEvent: () => {},
  };
  const audio = {
    play: () => {
      audioPlayed++;
      return play();
    },
    pause: () => {},
    removeAttribute: () => {},
    srcObject: null,
    muted: false,
    volume: 1,
  } as unknown as HTMLAudioElement;
  const controller = new VoiceController(
    { sessionKey: 'agent:test', model: 'gpt-live-1-codex' },
    face,
    audio,
    tg,
    (state) => {
      changes.push(state);
    },
    () => {},
  );
  const socket = sockets[0];
  if (!socket) throw new Error('Missing test socket');
  socket.receive({ type: 'auth.ok', bridgeConnected: true, gatewayReady: true });
  return {
    controller,
    socket,
    changes,
    capture,
    stream,
    stops: () => stopped,
    meterClosed: () => meterClosed,
    audioPlayed: () => audioPlayed,
    setPlay: (next: () => Promise<void>) => {
      play = next;
    },
    activate: async () => {
      const starting = controller.start();
      capture.resolve(stream);
      await Promise.resolve();
      const request = socket.sent.find((message) => message.method === 'talk.client.create');
      expect(request).toBeDefined();
      socket.receive({
        type: 'result',
        id: request?.id,
        result: {
          voiceSessionId: 'active',
          clientControl: { owner: 'gateway' },
          offerUrl: '/plugins/openai/offer',
          clientSecret: 'secret',
        },
      });
      for (let i = 0; i < 10; i++) await Promise.resolve();
      const offer = socket.sent.find((message) => message.type === 'offer');
      expect(offer).toBeDefined();
      socket.receive({ type: 'result', id: offer?.id, result: { sdp: 'answer' } });
      await starting;
    },
    remoteTrack: () => {
      peers[0]?.dispatchEvent(Object.assign(new Event('track'), { streams: [stream], track }));
    },
    cleanup: () => {
      controller.dispose();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
test('ending while microphone permission is pending stops the late stream', async () => {
  const f = fixture();
  try {
    const starting = f.controller.start();
    expect(f.audioPlayed()).toBe(1);
    f.controller.end();
    f.capture.resolve(f.stream);
    await starting;
    expect(f.stops()).toBe(1);
    expect(f.changes.at(-1)?.active).toBe(false);
    expect(f.changes.at(-1)?.starting).toBe(false);
    expect(f.socket.sent.some((message) => message.type === 'rpc')).toBe(false);
  } finally {
    f.cleanup();
  }
});
test('a brief bridge reconnect preserves the active WebRTC call and pending answer', async () => {
  jest.useFakeTimers();
  const f = fixture();
  try {
    await f.activate();
    f.socket.receive({ type: 'bridge.state', connected: false, gatewayReady: false });
    jest.advanceTimersByTime(2000);
    expect(f.changes.at(-1)?.active).toBe(true);
    expect(f.stops()).toBe(0);
    f.socket.receive({ type: 'bridge.state', connected: true, gatewayReady: true });
    jest.advanceTimersByTime(11000);
    expect(f.changes.at(-1)?.active).toBe(true);
    expect(f.socket.sent.some((message) => message.method === 'talk.client.close')).toBe(false);
  } finally {
    f.cleanup();
    jest.useRealTimers();
  }
});
test('an unrecovered bridge outage ends the call after grace and stops capture', async () => {
  jest.useFakeTimers();
  const f = fixture();
  try {
    await f.activate();
    f.socket.receive({ type: 'bridge.state', connected: false, gatewayReady: false });
    jest.advanceTimersByTime(10001);
    expect(f.changes.at(-1)?.active).toBe(false);
    expect(f.stops()).toBe(1);
    expect(f.changes.at(-1)?.error).toBe('Friday is offline');
    const closing = f.socket.sent.find((message) => message.method === 'talk.client.close');
    expect(closing).toBeDefined();
    f.socket.receive({ type: 'result', id: closing?.id, result: {} });
  } finally {
    f.cleanup();
    jest.useRealTimers();
  }
});
test('ending while Gateway creates a session closes a late session and microphone meter', async () => {
  const f = fixture();
  try {
    const starting = f.controller.start();
    f.capture.resolve(f.stream);
    await Promise.resolve();
    const request = f.socket.sent.find((message) => message.method === 'talk.client.create');
    expect(request).toBeDefined();
    f.controller.end();
    f.socket.receive({
      type: 'result',
      id: request?.id,
      result: {
        voiceSessionId: 'late',
        clientControl: { owner: 'gateway' },
        offerUrl: '/plugins/openai/offer',
        clientSecret: 'secret',
      },
    });
    await starting;
    expect(f.stops()).toBe(1);
    expect(f.meterClosed()).toBe(1);
    const closing = f.socket.sent.find((message) => message.method === 'talk.client.close');
    expect(closing?.params).toEqual({ sessionKey: 'agent:test', voiceSessionId: 'late' });
    f.socket.receive({ type: 'result', id: closing?.id, result: {} });
  } finally {
    f.cleanup();
  }
});
test('bridge loss cancels capture and reports offline without restarting the call', async () => {
  const f = fixture();
  try {
    const starting = f.controller.start();
    f.socket.receive({ type: 'bridge.state', connected: false, gatewayReady: false });
    f.capture.resolve(f.stream);
    await starting;
    expect(f.stops()).toBe(1);
    expect(f.changes.at(-1)?.ready).toBe(false);
    expect(f.changes.at(-1)?.error).toBe('Friday is offline');
  } finally {
    f.cleanup();
  }
});
test('a late audio retry preserves the error from an ended call', async () => {
  const f = fixture();
  try {
    await f.activate();
    expect(f.changes.at(-1)?.active).toBe(true);
    f.setPlay(() => Promise.reject(new Error('Autoplay blocked')));
    f.remoteTrack();
    await Promise.resolve();
    expect(f.changes.at(-1)?.soundBlocked).toBe(true);
    const pending = deferred<void>();
    f.setPlay(() => pending.promise);
    const retrying = f.controller.retryAudio();
    f.controller.end('Connection lost');
    pending.resolve();
    await retrying;
    expect(f.changes.at(-1)?.active).toBe(false);
    expect(f.changes.at(-1)?.error).toBe('Connection lost');
  } finally {
    f.cleanup();
  }
});
