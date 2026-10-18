import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePunch, bestResults, peakSpeed, smoothedPeak } from '../js/modules/analysis.js';

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

test('measures reaction, out-and-back time, peak acceleration and speed of a punch', () => {
  const samples = makeSamples(0, 2500, punchProfile);
  const result = analyzePunch(samples, 1000);

  assert.equal(result.status, 'ok');
  assert.ok(Math.abs(result.reactionMs - 200) <= STEP_MS, `reaction ${result.reactionMs}`);
  assert.ok(result.peakAccel > 19 && result.peakAccel < 21, `peak ${result.peakAccel}`);
  // At 60 Hz, one sample of 20 m/s² is worth ~0.33 m/s: that is the expected precision.
  const sampleError = (20 * STEP_MS) / 1000;
  assert.ok(Math.abs(result.peakSpeed - 2) < sampleError + 0.1, `speed ${result.peakSpeed}`);
  assert.ok(Math.abs(result.movementMs - 400) <= 2 * STEP_MS, `movement ${result.movementMs}`);
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

test('peakSpeed integrates an accelerate-then-brake movement', () => {
  const samples = makeSamples(0, 500, (t) => (t < 250 ? 10 : -10));
  assert.ok(Math.abs(peakSpeed(samples) - 2.5) < 0.2, `speed ${peakSpeed(samples)}`);
});

test('bestResults keeps the best value of each metric among valid repetitions', () => {
  const results = [
    { status: 'ok', reactionMs: 250, movementMs: 380, peakAccel: 15, peakSpeed: 3 },
    { status: 'false-start' },
    { status: 'ok', reactionMs: 210, movementMs: 420, peakAccel: 22, peakSpeed: 2.5 },
  ];
  assert.deepEqual(bestResults(results), {
    reactionMs: 210,
    movementMs: 380,
    peakAccel: 22,
    peakSpeed: 3,
  });
  assert.equal(bestResults([{ status: 'no-movement' }]), null);
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

test('rejects a repetition where the hand never holds still back in guard', () => {
  const samples = makeSamples(0, 2000, (t) => (t >= 1200 ? 8 : 0));
  assert.deepEqual(analyzePunch(samples, 1000), { status: 'no-return' });
});

test('removes sensor drift: a constant bias does not change the speed', () => {
  const clean = analyzePunch(makeSamples(0, 2500, punchProfile), 1000);
  const biased = analyzePunch(makeSamples(0, 2500, (t) => punchProfile(t) + 1.2), 1000);
  assert.equal(biased.status, 'ok');
  assert.ok(Math.abs(biased.peakSpeed - clean.peakSpeed) < 0.05, `${biased.peakSpeed} vs ${clean.peakSpeed}`);
});

test('keeps the speed right when the wrist turns during the punch', () => {
  // Phone spins half a turn around z in 0.5 s while the fist accelerates then brakes along a fixed direction.
  const turnRate = Math.PI * 2; // rad/s
  const samples = [];
  for (let t = 0; t <= 500; t += STEP_MS) {
    const world = t < 250 ? 10 : -10;
    const angle = (turnRate * t) / 1000;
    samples.push({ t, x: world * Math.cos(angle), y: -world * Math.sin(angle), z: 0, rx: 0, ry: 0, rz: turnRate });
  }
  const sampleError = (20 * STEP_MS) / 1000;
  assert.ok(Math.abs(peakSpeed(samples) - 2.5) < sampleError, `speed ${peakSpeed(samples)}`);

  const withoutGyro = samples.map((s) => ({ ...s, rz: 0 }));
  assert.ok(Math.abs(peakSpeed(withoutGyro) - 2.5) > 0.5, 'ignoring the rotation gives a wrong speed');
});

test('smoothedPeak ignores a single-sample spike', () => {
  assert.equal(smoothedPeak([1, 1, 30, 1, 1], 3), 32 / 3);
  assert.equal(smoothedPeak([5, 6], 3), 5.5);
});

test('discards the speed when the drift is too large to trust it', () => {
  // Out-and-back punch, but the "back" half is missing: the hand ends with a large leftover speed.
  const truncated = (t) => (t >= 1200 && t < 1300 ? 20 : 0);
  const result = analyzePunch(makeSamples(0, 2500, truncated), 1000);
  assert.equal(result.status, 'ok');
  assert.equal(result.peakSpeed, null);
});

test('does not count the hand as still while the wrist is still turning', () => {
  const samples = makeSamples(0, 2500, punchProfile).map((s) => ({
    ...s,
    rz: s.t >= 1200 && s.t < 1900 ? 3 : 0,
  }));
  const result = analyzePunch(samples, 1000);
  assert.ok(Math.abs(result.movementMs - 700) <= 2 * STEP_MS, `movement ${result.movementMs}`);
});
