// Pure functions that turn raw motion samples into punch metrics.
// A sample is { t, x, y, z, rx, ry, rz }:
//   t in milliseconds,
//   x/y/z linear acceleration in m/s² (gravity removed), phone frame,
//   rx/ry/rz rotation rate in rad/s around the phone axes (optional, 0 if unknown).

import { IDENTITY, rotate, toReferenceFrame } from './rotation.js';

export const GRAVITY = 9.81;

export const DEFAULTS = Object.freeze({
  moveThreshold: 4, // m/s² above which the hand is clearly moving
  restThreshold: 1.5, // m/s² below which the hand is considered still
  restRotation: 0.5, // rad/s: the wrist must also have stopped turning to count as still
  restDurationMs: 200, // how long the hand must stay still to count as back in guard
  maxDriftShare: 0.5, // speed is discarded when the drift exceeds this share of the peak
  minReactionMs: 100, // faster than human reaction: the beep was anticipated
  smoothingSamples: 3, // peak acceleration is averaged over a few samples to remove spikes
});

export function magnitude({ x, y, z }) {
  return Math.hypot(x, y, z);
}

/**
 * Analyses one repetition: guard → punch → back in guard.
 * @param {Array<object>} samples sorted by time (see format above)
 * @param {number} beepTime time of the "go" signal, same clock as samples
 * @returns {{status:'ok', reactionMs:number, movementMs:number, peakAccel:number, peakSpeed:number|null}
 *          | {status:'false-start'} | {status:'no-movement'} | {status:'no-return'}}
 */
export function analyzePunch(samples, beepTime, options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const isMoving = (s) => magnitude(s) > settings.moveThreshold;

  if (samples.some((s) => s.t < beepTime && isMoving(s))) {
    return { status: 'false-start' };
  }

  const triggerIndex = samples.findIndex((s) => s.t >= beepTime && isMoving(s));
  if (triggerIndex === -1) {
    return { status: 'no-movement' };
  }

  const onsetIndex = findOnsetIndex(samples, triggerIndex, settings.restThreshold);
  const reactionMs = samples[onsetIndex].t - beepTime;
  if (reactionMs < settings.minReactionMs) {
    return { status: 'false-start' }; // started before the beep, or anticipated it
  }

  const endIndex = findRestIndex(samples, triggerIndex, settings);
  if (endIndex === -1) {
    return { status: 'no-return' }; // never held still in guard: duration and speed would be wrong
  }

  const movement = samples.slice(onsetIndex, endIndex + 1);
  return {
    status: 'ok',
    reactionMs,
    movementMs: movement.at(-1).t - movement[0].t,
    peakAccel: smoothedPeak(movement.map(magnitude), settings.smoothingSamples),
    peakSpeed: reliableSpeed(movement, settings.maxDriftShare),
  };
}

// Returns the peak speed, or null when the drift is too large for the value to be trusted.
function reliableSpeed(movement, maxDriftShare) {
  const { peak, drift } = speedEstimate(movement);
  return drift > maxDriftShare * peak ? null : peak;
}

// Walks back from the threshold crossing to the moment the hand started to move.
function findOnsetIndex(samples, triggerIndex, restThreshold) {
  let index = triggerIndex;
  while (index > 0 && magnitude(samples[index - 1]) > restThreshold) {
    index -= 1;
  }
  return index;
}

// Returns the index where the hand is back at rest in guard, or -1 if it never is.
function findRestIndex(samples, fromIndex, { restThreshold, restRotation, restDurationMs }) {
  const isStill = (s) =>
    magnitude(s) < restThreshold && Math.hypot(s.rx ?? 0, s.ry ?? 0, s.rz ?? 0) < restRotation;
  let restStart = -1;
  for (let i = fromIndex; i < samples.length; i += 1) {
    if (!isStill(samples[i])) {
      restStart = -1;
      continue;
    }
    if (restStart === -1) restStart = i;
    if (samples[i].t - samples[restStart].t >= restDurationMs) return restStart;
  }
  return -1;
}

/** Highest average over `width` consecutive values. */
export function smoothedPeak(values, width) {
  const size = Math.min(width, values.length);
  let best = 0;
  for (let i = 0; i + size <= values.length; i += 1) {
    const window = values.slice(i, i + size);
    best = Math.max(best, window.reduce((sum, v) => sum + v, 0) / size);
  }
  return best;
}

/**
 * Highest speed reached during a movement that starts and ends at rest, in m/s.
 * - The gyroscope keeps acceleration in a fixed frame even when the wrist turns.
 * - Velocity is integrated with the trapezoidal rule, then the drift is removed
 *   by forcing it back to zero at the end (the hand is still in guard).
 */
export function peakSpeed(samples) {
  return speedEstimate(samples).peak;
}

// Returns the corrected peak speed and the size of the drift that was removed (m/s).
function speedEstimate(samples) {
  const t0 = samples[0]?.t;
  const span = samples.at(-1)?.t - t0;
  if (samples.length < 2 || !(span > 0)) return { peak: 0, drift: 0 };

  const velocities = integrateVelocity(samples);
  const drift = velocities.at(-1);
  let peak = 0;
  velocities.forEach((v, i) => {
    const share = (samples[i].t - t0) / span;
    peak = Math.max(peak, Math.hypot(v.x - drift.x * share, v.y - drift.y * share, v.z - drift.z * share));
  });
  return { peak, drift: magnitude(drift) };
}

function rotationRate(sample) {
  return { x: sample.rx ?? 0, y: sample.ry ?? 0, z: sample.rz ?? 0 };
}

function integrateVelocity(samples) {
  let orientation = IDENTITY;
  let previousAccel = toReferenceFrame(orientation, samples[0]);
  const velocity = { x: 0, y: 0, z: 0 };
  const velocities = [{ ...velocity }];

  for (let i = 1; i < samples.length; i += 1) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    const before = rotationRate(samples[i - 1]);
    const after = rotationRate(samples[i]);
    const averageRate = { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2, z: (before.z + after.z) / 2 };
    orientation = rotate(orientation, averageRate, dt);

    const accel = toReferenceFrame(orientation, samples[i]);
    for (const axis of ['x', 'y', 'z']) {
      velocity[axis] += ((previousAccel[axis] + accel[axis]) / 2) * dt;
    }
    previousAccel = accel;
    velocities.push({ ...velocity });
  }
  return velocities;
}

/** Best value of each metric among valid repetitions, or null. */
export function bestResults(results) {
  const valid = results.filter((r) => r.status === 'ok');
  if (valid.length === 0) return null;
  const pick = (key, compare) => {
    const values = valid.map((r) => r[key]).filter((v) => v !== null);
    return values.length === 0 ? null : values.reduce((a, b) => (compare(a, b) ? a : b));
  };
  return {
    reactionMs: pick('reactionMs', (a, b) => a < b),
    movementMs: pick('movementMs', (a, b) => a < b),
    peakAccel: pick('peakAccel', (a, b) => a > b),
    peakSpeed: pick('peakSpeed', (a, b) => a > b),
  };
}
