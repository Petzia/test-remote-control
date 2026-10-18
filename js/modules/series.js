// Runs a series of repetitions: "ready" beep, random wait, "go" beep, record, analyse.

import { analyzePunch } from './analysis.js';

export const SERIES_SETTINGS = Object.freeze({
  reps: 5,
  minDelayMs: 2000, // shortest wait between "ready" and "go"
  maxDelayMs: 4500, // longest wait, randomised so the signal can't be anticipated
  settleMs: 500, // ignored movement right after the "ready" beep
  recordAfterBeepMs: 2000,
  pauseBetweenMs: 2500,
});

const READY_BEEP = { frequency: 440, durationMs: 120, volume: 0.4 };
const GO_BEEP = { frequency: 1320, durationMs: 180, volume: 0.8 };

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export function randomDelay(min, max, random = Math.random) {
  return min + random() * (max - min);
}

/**
 * @param {object} deps
 * @param {{beep: Function}} deps.beeper
 * @param {{start: Function, stop: Function}} deps.recorder
 * @param {(status: string, rep: number) => void} deps.onStatus
 * @param {(result: object, rep: number) => void} deps.onResult
 * @param {AbortSignal} [deps.signal]
 * @returns {Promise<object[]>} the results of every repetition
 */
export async function runSeries({
  beeper,
  recorder,
  onStatus,
  onResult,
  signal,
  random = Math.random,
  settings = SERIES_SETTINGS,
}) {
  const results = [];
  for (let rep = 1; rep <= settings.reps; rep += 1) {
    onStatus('ready', rep);
    beeper.beep(READY_BEEP);
    const delay = randomDelay(settings.minDelayMs, settings.maxDelayMs, random);
    await sleep(settings.settleMs, signal);

    let beepTime;
    let samples;
    recorder.start();
    try {
      await sleep(delay - settings.settleMs, signal);
      beepTime = beeper.beep(GO_BEEP);
      onStatus('go', rep);
      await sleep(settings.recordAfterBeepMs, signal);
    } finally {
      samples = recorder.stop();
    }
    const result = analyzePunch(samples, beepTime);
    results.push(result);
    onResult(result, rep);

    if (rep < settings.reps) {
      onStatus('pause', rep);
      await sleep(settings.pauseBetweenMs, signal);
    }
  }
  return results;
}
