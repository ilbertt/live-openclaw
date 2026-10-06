import { expect, test } from 'bun:test';
import { Playback } from '../src/lib/voice/playback.ts';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const blocked: boolean[] = [];
  const element = {
    src: '',
    srcObject: null as MediaStream | null,
    muted: true,
    volume: 0,
    play: () => Promise.resolve(),
    pause: () => {},
    removeAttribute(name: string) {
      if (name === 'src') this.src = '';
    },
  };
  const playback = new Playback(element as unknown as HTMLAudioElement, (value) => {
    blocked.push(value);
  });
  return { element, playback, blocked };
}
test('Talk primes a silent WAV on the same audio element before remote playback', async () => {
  const { element, playback, blocked } = fixture();
  let primed = false;
  element.play = () => {
    primed = true;
    return Promise.reject(new Error('Autoplay blocked'));
  };
  playback.prime();
  expect(primed).toBe(true);
  const wav = Uint8Array.from(atob(element.src.split(',')[1] ?? ''), (char) => char.charCodeAt(0));
  expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
  const view = new DataView(wav.buffer);
  expect(view.getUint32(4, true)).toBe(wav.length - 8);
  expect(view.getUint32(40, true)).toBe(wav.length - 44);
  expect(wav.slice(44).every((byte) => byte === 0)).toBe(true);
  await Promise.resolve();
  expect(blocked).toEqual([]);
  element.play = () => Promise.resolve();
  const stream = {} as MediaStream;
  await playback.play(stream);
  expect(element.src).toBe('');
  expect(element.srcObject).toBe(stream);
  expect(element.muted).toBe(false);
  expect(element.volume).toBe(1);
});
test('blocked playback can recover and stop clears both audio sources', async () => {
  const { element, playback, blocked } = fixture();
  element.play = () => Promise.reject(new Error('Autoplay blocked'));
  await playback.play();
  expect(playback.rejected).toBe(true);
  element.play = () => Promise.resolve();
  await playback.play();
  expect(playback.rejected).toBe(false);
  expect(blocked).toEqual([true, false]);
  playback.prime();
  playback.stop();
  expect(element.src).toBe('');
  expect(element.srcObject).toBeNull();
});
test('stale playback results cannot replace a newer success or ended call', async () => {
  const { element, playback, blocked } = fixture();
  const attempt = deferred();
  element.play = () => attempt.promise;
  const first = playback.play();
  element.play = () => Promise.resolve();
  await playback.play();
  attempt.reject(new Error('Stale rejection'));
  await first;
  expect(playback.rejected).toBe(false);
  expect(blocked).toEqual([false]);
  const late = deferred();
  element.play = () => late.promise;
  const pending = playback.play();
  playback.stop();
  const changes = blocked.length;
  late.reject(new Error('Call ended'));
  await pending;
  expect(playback.rejected).toBe(false);
  expect(blocked.length).toBe(changes);
});
