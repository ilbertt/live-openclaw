import { expect, test } from 'bun:test';
import { attachTiltGaze } from '../src/lib/face/tilt.ts';
import type { TelegramWebApp } from '../src/lib/telegram.ts';

test('tilt calibrates, smooths, clamps, rotates, pauses, and cleans up', () => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const motion = Object.assign(new EventTarget(), { matches: false });
  const screenRef = { orientation: { angle: 0 } };
  const events = new Map<string, () => void>(),
    looks: number[][] = [];
  let starts = 0,
    stops = 0;
  const sensor = {
    beta: 1,
    gamma: 0.1,
    start: (_options: unknown, callback: (ok: boolean) => void) => {
      starts++;
      callback(true);
    },
    stop: () => {
      stops++;
    },
  };
  const tg: TelegramWebApp = {
    initData: '',
    ready: () => {},
    expand: () => {},
    DeviceOrientation: sensor,
    isVersionAtLeast: () => true,
    isActive: true,
    onEvent: (key, value) => {
      events.set(key, value);
    },
    offEvent: (key) => {
      events.delete(key);
    },
  };
  const cleanup = attachTiltGaze(
    {
      look: (x, y) => {
        looks.push([x, y]);
      },
    },
    tg,
    { doc, motion, screenRef },
  );
  const update = () => events.get('deviceOrientationChanged')?.();
  update();
  expect(looks.at(-1)).toEqual([0, 0]);
  sensor.gamma += 0.4;
  update();
  expect(looks.at(-1)?.[0]).toBeGreaterThan(0);
  for (let i = 0; i < 50; i++) update();
  expect(looks.at(-1)?.[0]).toBeLessThanOrEqual(0.75);
  sensor.beta = Number.NaN;
  const count = looks.length;
  update();
  expect(looks).toHaveLength(count);
  sensor.beta = 1;
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  expect(stops).toBe(1);
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  expect(starts).toBe(2);
  update();
  expect(looks.at(-1)?.[0]).toBe(0);
  screenRef.orientation.angle = 90;
  update();
  sensor.beta += 0.3;
  update();
  expect(looks.at(-1)?.[0]).toBeGreaterThan(0);
  motion.matches = true;
  motion.dispatchEvent(new Event('change'));
  expect(stops).toBe(2);
  cleanup();
  expect(events.size).toBe(0);
  expect(() =>
    attachTiltGaze({ look: () => {} }, undefined, { doc, motion, screenRef })(),
  ).not.toThrow();
});
test('optional failing orientation startup remains harmless', () => {
  const tg: TelegramWebApp = {
    initData: '',
    ready: () => {},
    expand: () => {},
    onEvent: () => {},
    offEvent: () => {},
    isVersionAtLeast: () => true,
    DeviceOrientation: {
      beta: null,
      gamma: null,
      start: () => {
        throw new Error('unsupported');
      },
      stop: () => {},
    },
  };
  expect(() =>
    attachTiltGaze({ look: () => {} }, tg, {
      doc: Object.assign(new EventTarget(), { hidden: false }),
      motion: Object.assign(new EventTarget(), { matches: false }),
      screenRef: {},
    })(),
  ).not.toThrow();
});
