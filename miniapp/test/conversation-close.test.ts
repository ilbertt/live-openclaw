import { expect, test } from 'bun:test';
import { createConversationCloser } from '../src/lib/voice/conversation-close.ts';

test('structured closing drains output before closing and ignores duplicate controls', () => {
  let time = 0,
    closed = 0;
  const closer = createConversationCloser({
    close: () => {
      closed++;
    },
    now: () => time,
  });
  expect(closer.request('a')).toBe(true);
  expect(closer.request('a')).toBe(false);
  time = 800;
  closer.sample(0.1);
  time = 1800;
  closer.sample(0);
  expect(closed).toBe(0);
  time = 2200;
  closer.output();
  closer.sample(0);
  time = 3200;
  closer.sample(0);
  expect(closed).toBe(0);
  time = 3400;
  closer.sample(0);
  expect(closed).toBe(1);
  expect(closer.pending).toBe(false);
});
test('speech cancellation, missing telemetry, timeout, and reset keep behavior safe', () => {
  let time = 0,
    closed = 0;
  const closer = createConversationCloser({
    close: () => {
      closed++;
    },
    now: () => time,
  });
  closer.request('a');
  time = 2000;
  closer.sample(Number.NaN);
  expect(closer.pending).toBe(true);
  closer.cancel();
  closer.sample(0);
  expect(closed).toBe(0);
  closer.request('b');
  time += 16_000;
  closer.sample(0);
  expect(closer.pending).toBe(false);
  expect(closed).toBe(0);
  closer.reset();
  expect(closer.request('a')).toBe(true);
});
