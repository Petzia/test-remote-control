import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePunch, bestResult, peakSpeed } from '../js/modules/analysis.js';

const STEP_MS = 1000 / 60; // typical phone sensor rate

/**
 * Builds samples at 60 Hz. `profile(t)` returns the x acceleration in m/s².
 */
function makeSamples(fromMs, toMs, profile) {
  const samples = [];
  for (let t = fromMs; t <= toMs; t += STEP_MS) {
    samples.push({ t, x: profile(t), y: 0.2, z: -0.2 });
  }
  return samples;
}

// Rest, then from 1200 ms: +20 m/s² for 100 ms, -20 for 200 ms, +20 for 100 ms (out and back).
function punchProfile(t) {
  if (t < 1200) return 0;
  if (t < 1300) return 20;
  if (t < 1500) return -20;
  if (t < 1600) return 20;
  return 0;
}

test('measures reaction, peak acceleration, speed and duration of a punch', () => {
  const samples = makeSamples(0, 2500, punchProfile);
  const result = analyzePunch(samples, 1000);

  assert.equal(result.status, 'ok');
  assert.ok(Math.abs(result.reactionMs - 200) <= STEP_MS, `reaction ${result.reactionMs}`);
  assert.ok(result.peakAccel > 19 && result.peakAccel < 21, `peak ${result.peakAccel}`);
  // At 60 Hz, one sample of 20 m/s² is worth ~0.33 m/s: that is the expected precision.
  const sampleError = (20 * STEP_MS) / 1000;
  assert.ok(Math.abs(result.peakSpeed - 2) < sampleError + 0.1, `speed ${result.peakSpeed}`);
  assert.ok(Math.abs(result.durationMs - 400) <= 2 * STEP_MS, `duration ${result.durationMs}`);
});

test('flags a movement before the signal as a false start', () => {
  const samples = makeSamples(0, 2500, (t) => (t > 800 && t < 900 ? 10 : 0));
  assert.deepEqual(analyzePunch(samples, 1000), { status: 'false-start' });
});

test('reports no movement when the hand stays still', () => {
  const samples = makeSamples(0, 2500, () => 0.5);
  assert.deepEqual(analyzePunch(samples, 1000), { status: 'no-movement' });
});

test('ignores small hand tremor below the movement threshold', () => {
  const tremor = (t) => punchProfile(t) + (Math.sin(t) > 0 ? 1 : -1);
  const result = analyzePunch(makeSamples(0, 2500, tremor), 1000);
  assert.equal(result.status, 'ok');
  assert.ok(Math.abs(result.reactionMs - 200) <= STEP_MS);
});

test('peakSpeed integrates constant acceleration', () => {
  const samples = makeSamples(0, 500, () => 10);
  assert.ok(Math.abs(peakSpeed(samples) - 5) < 0.2);
});

test('bestResult keeps the strongest valid repetition', () => {
  const results = [
    { status: 'ok', peakAccel: 15 },
    { status: 'false-start' },
    { status: 'ok', peakAccel: 22 },
  ];
  assert.equal(bestResult(results).peakAccel, 22);
  assert.equal(bestResult([{ status: 'no-movement' }]), null);
});

test('flags a slow start just before the signal as a false start', () => {
  // Hand already moving (2–3 m/s², below the movement threshold) before the beep at 1000 ms.
  const anticipated = (t) => (t >= 950 && t < 1000 ? 3 : punchProfile(t + 200));
  assert.deepEqual(analyzePunch(makeSamples(0, 2500, anticipated), 1000), { status: 'false-start' });
});

test('flags a reaction faster than humanly possible as a false start', () => {
  const tooFast = (t) => (t >= 1030 && t < 1130 ? 20 : 0);
  assert.deepEqual(analyzePunch(makeSamples(0, 2500, tooFast), 1000), { status: 'false-start' });
});

test('measures the onset of a movement that ramps up slowly', () => {
  // Starts at 1200 ms, rising by 0.1 m/s² per ms, crosses 4 m/s² at ~1240 ms.
  const ramp = (t) => (t >= 1200 && t < 1400 ? Math.min(20, (t - 1200) * 0.1) : 0);
  const result = analyzePunch(makeSamples(0, 2500, ramp), 1000);
  assert.equal(result.status, 'ok');
  assert.ok(result.reactionMs < 220, `reaction ${result.reactionMs}`);
});

test('ends the movement at the last sample when the hand never comes back to rest', () => {
  const samples = makeSamples(0, 2000, (t) => (t >= 1200 ? 8 : 0));
  const result = analyzePunch(samples, 1000);
  assert.equal(result.status, 'ok');
  assert.ok(Math.abs(result.durationMs - (samples.at(-1).t - 1200)) <= STEP_MS);
});
