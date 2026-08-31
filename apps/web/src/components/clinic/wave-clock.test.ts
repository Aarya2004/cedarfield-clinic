import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE_PERIOD_MS,
  describeWaveAge,
  msIntoWave,
  msUntilNextWave,
  secondsUntilNextWave,
  waveIndexAt,
  waveSeed,
  waveStartAt,
} from './wave-clock.ts';

test('the wave index is a function of the epoch, not of when the page opened', () => {
  assert.equal(waveIndexAt(0), 0);
  assert.equal(waveIndexAt(WAVE_PERIOD_MS - 1), 0);
  assert.equal(waveIndexAt(WAVE_PERIOD_MS), 1);
  assert.equal(waveIndexAt(WAVE_PERIOD_MS * 7 + 12), 7);
});

test('two routes reading the same instant agree on the wave', () => {
  const now = 1_756_500_123_456;
  assert.equal(waveIndexAt(now), waveIndexAt(now));
  assert.equal(waveStartAt(waveIndexAt(now)) + msIntoWave(now), now);
});

test('msIntoWave and msUntilNextWave always sum to one period', () => {
  for (const now of [0, 1, 44_999, 90_000, 123_456_789, 1_756_500_000_001]) {
    assert.equal(msIntoWave(now) + msUntilNextWave(now), WAVE_PERIOD_MS, `at ${now}`);
  }
});

test('on a boundary the countdown reads a full period, never a stalled 0:00', () => {
  assert.equal(msIntoWave(WAVE_PERIOD_MS * 4), 0);
  assert.equal(msUntilNextWave(WAVE_PERIOD_MS * 4), WAVE_PERIOD_MS);
  assert.equal(secondsUntilNextWave(WAVE_PERIOD_MS * 4), WAVE_PERIOD_MS / 1000);
});

test('msIntoWave never exceeds the period and never goes negative', () => {
  for (let i = 0; i < 400; i++) {
    const now = i * 977 + 13;
    const into = msIntoWave(now);
    assert.ok(into >= 0 && into < WAVE_PERIOD_MS, `into=${into} at ${now}`);
  }
});

test('a custom period is honoured; a nonsense period falls back to the default', () => {
  assert.equal(waveIndexAt(2500, 1000), 2);
  assert.equal(msIntoWave(2500, 1000), 500);
  assert.equal(msIntoWave(2500, 0), 2500);
  assert.equal(msIntoWave(2500, Number.NaN), 2500);
});

test('non-finite clocks read as wave zero rather than throwing', () => {
  assert.equal(waveIndexAt(Number.NaN), 0);
  assert.equal(waveIndexAt(Number.POSITIVE_INFINITY), 0);
});

test('consecutive waves get seeds that are not near-neighbours', () => {
  assert.equal(waveSeed(12), 'cedarfield-wave-12');
  assert.notEqual(waveSeed(12), waveSeed(13));
});

test('the wave age line reads as English at every scale', () => {
  assert.equal(describeWaveAge(0), 'Released just now');
  assert.equal(describeWaveAge(4_999), 'Released just now');
  assert.equal(describeWaveAge(34_000), 'Released 34 seconds ago');
  assert.equal(describeWaveAge(61_000), 'Released a minute ago');
  assert.equal(describeWaveAge(150_000), 'Released 2 minutes ago');
  assert.equal(describeWaveAge(-5), 'Released just now');
});
