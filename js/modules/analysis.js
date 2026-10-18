// Pure functions that turn raw accelerometer samples into punch metrics.
// A sample is { t, x, y, z }: t in milliseconds, x/y/z linear acceleration in m/s² (gravity removed).

export const GRAVITY = 9.81;

export const DEFAULTS = Object.freeze({
  moveThreshold: 4, // m/s² above which the hand is clearly moving
  restThreshold: 1.5, // m/s² below which the hand is considered still
  restDurationMs: 200, // how long the hand must stay still to end the movement
  minReactionMs: 100, // faster than human reaction: the beep was anticipated
});

export function magnitude({ x, y, z }) {
  return Math.hypot(x, y, z);
}

/**
 * Analyses one repetition.
 * @param {Array<{t:number,x:number,y:number,z:number}>} samples sorted by time
 * @param {number} beepTime time of the "go" signal, same clock as samples
 * @returns {{status:'ok', reactionMs:number, peakAccel:number, peakSpeed:number, durationMs:number}
 *          | {status:'false-start'} | {status:'no-movement'}}
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
  const movement = samples.slice(onsetIndex, endIndex + 1);

  return {
    status: 'ok',
    reactionMs,
    peakAccel: Math.max(...movement.map(magnitude)),
    peakSpeed: peakSpeed(movement),
    durationMs: movement.at(-1).t - movement[0].t,
  };
}

// Walks back from the threshold crossing to the moment the hand started to move.
function findOnsetIndex(samples, triggerIndex, restThreshold) {
  let index = triggerIndex;
  while (index > 0 && magnitude(samples[index - 1]) > restThreshold) {
    index -= 1;
  }
  return index;
}

// Returns the index where the hand comes back to rest, or the last sample.
function findRestIndex(samples, fromIndex, { restThreshold, restDurationMs }) {
  let restStart = -1;
  for (let i = fromIndex; i < samples.length; i += 1) {
    if (magnitude(samples[i]) >= restThreshold) {
      restStart = -1;
      continue;
    }
    if (restStart === -1) restStart = i;
    if (samples[i].t - samples[restStart].t >= restDurationMs) return restStart;
  }
  return samples.length - 1;
}

/**
 * Integrates acceleration on each axis (trapezoidal rule) and returns the
 * highest speed reached, in m/s. Velocity is assumed to be zero at the first sample.
 */
export function peakSpeed(samples) {
  const velocity = { x: 0, y: 0, z: 0 };
  let peak = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const previous = samples[i - 1];
    const current = samples[i];
    const dt = (current.t - previous.t) / 1000;
    for (const axis of ['x', 'y', 'z']) {
      velocity[axis] += ((previous[axis] + current[axis]) / 2) * dt;
    }
    peak = Math.max(peak, magnitude(velocity));
  }
  return peak;
}

/** Picks the repetition with the highest peak acceleration, or null. */
export function bestResult(results) {
  const valid = results.filter((r) => r.status === 'ok');
  if (valid.length === 0) return null;
  return valid.reduce((best, r) => (r.peakAccel > best.peakAccel ? r : best));
}
