import { expect, test } from 'bun:test';
import { AudioLevel } from '../src/lib/voice/audio-stats.ts';

test('RTP energy deltas provide audio level with safe silence and missing-data behavior', () => {
  const level = new AudioLevel();
  expect(Number.isNaN(level.sample(undefined))).toBe(true);
  expect(level.sample({ audioLevel: 0.5, totalAudioEnergy: 1, totalSamplesDuration: 1 })).toBe(0.5);
  expect(level.sample({ totalAudioEnergy: 2, totalSamplesDuration: 2 })).toBe(1);
  expect(Number.isNaN(level.sample({ totalAudioEnergy: 2, totalSamplesDuration: 2 }))).toBe(true);
  expect(level.sample({ totalAudioEnergy: 1, totalSamplesDuration: 3 })).toBe(0);
});
