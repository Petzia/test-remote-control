import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSeries, randomDelay } from '../js/modules/series.js';

const FAST_SETTINGS = {
  reps: 2,
  minDelayMs: 20,
  maxDelayMs: 40,
  settleMs: 5,
  recordAfterBeepMs: 10,
  pauseBetweenMs: 5,
};

function fakeDeps() {
  const statuses = [];
  const beeps = [];
  return {
    statuses,
    beeps,
    beeper: {
      beep: (options) => {
        beeps.push(options.frequency);
        return 0;
      },
    },
    recorder: { start() {}, stop: () => [] },
    onStatus: (status, rep) => statuses.push(`${rep}:${status}`),
    onResult: () => {},
  };
}

test('runs every repetition with a ready beep then a go beep', async () => {
  const deps = fakeDeps();
  const results = await runSeries({ ...deps, settings: FAST_SETTINGS });

  assert.equal(results.length, 2);
  assert.deepEqual(deps.statuses, ['1:ready', '1:go', '1:pause', '2:ready', '2:go']);
  assert.equal(deps.beeps.length, 4);
  assert.ok(deps.beeps[1] > deps.beeps[0], 'go beep is higher than ready beep');
});

test('stops when the signal is aborted', async () => {
  const deps = fakeDeps();
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 15);
  await assert.rejects(
    runSeries({ ...deps, settings: FAST_SETTINGS, signal: controller.signal }),
    { name: 'AbortError' },
  );
});

test('randomDelay stays within bounds', () => {
  assert.equal(randomDelay(2000, 4000, () => 0), 2000);
  assert.equal(randomDelay(2000, 4000, () => 1), 4000);
});
