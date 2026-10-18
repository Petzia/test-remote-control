// Access to the phone accelerometer through the DeviceMotion API.

const SENSOR_CHECK_TIMEOUT_MS = 1500;
const GRAVITY_FILTER = 0.98; // slow low-pass, used only when the device reports gravity-included data
const MAX_CLOCK_GAP_MS = 1000;

export class MotionError extends Error {}

/** Must be called from a user gesture (tap) for iOS to show the permission prompt. */
export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent === 'undefined') {
    throw new MotionError('Ce navigateur ne donne pas accès aux capteurs de mouvement.');
  }
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    const answer = await DeviceMotionEvent.requestPermission();
    if (answer !== 'granted') {
      throw new MotionError("Accès aux capteurs refusé. Ferme l'onglet, rouvre la page et autorise l'accès.");
    }
  }
  await waitForFirstReading();
}

function waitForFirstReading() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('devicemotion', onMotion);
      reject(new MotionError('Aucun accéléromètre détecté sur cet appareil.'));
    }, SENSOR_CHECK_TIMEOUT_MS);

    function onMotion(event) {
      if (!toSample(event)) return;
      clearTimeout(timer);
      window.removeEventListener('devicemotion', onMotion);
      resolve();
    }
    window.addEventListener('devicemotion', onMotion);
  });
}

function isFiniteVector(v) {
  return v != null && [v.x, v.y, v.z].every(Number.isFinite);
}

// Uses the event time when it shares the performance.now() clock (all modern engines).
function eventTime(event) {
  const now = performance.now();
  return Math.abs(now - event.timeStamp) < MAX_CLOCK_GAP_MS ? event.timeStamp : now;
}

// Returns the raw reading of an event, or null when the data is unusable.
function toSample(event) {
  if (isFiniteVector(event.acceleration)) {
    const { x, y, z } = event.acceleration;
    return { t: eventTime(event), x, y, z, linear: true };
  }
  if (isFiniteVector(event.accelerationIncludingGravity)) {
    const { x, y, z } = event.accelerationIncludingGravity;
    return { t: eventTime(event), x, y, z, linear: false };
  }
  return null;
}

/** Records linear acceleration samples between start() and stop(). */
export function createRecorder() {
  let samples = [];
  let gravity = null;

  function removeGravity(sample) {
    if (sample.linear) return sample;
    gravity = gravity ?? { x: sample.x, y: sample.y, z: sample.z };
    for (const axis of ['x', 'y', 'z']) {
      gravity[axis] = GRAVITY_FILTER * gravity[axis] + (1 - GRAVITY_FILTER) * sample[axis];
    }
    return { t: sample.t, x: sample.x - gravity.x, y: sample.y - gravity.y, z: sample.z - gravity.z };
  }

  function onMotion(event) {
    const sample = toSample(event);
    if (!sample) return;
    const { t, x, y, z } = removeGravity(sample);
    samples.push({ t, x, y, z });
  }

  return {
    start() {
      samples = [];
      gravity = null;
      window.addEventListener('devicemotion', onMotion);
    },
    stop() {
      window.removeEventListener('devicemotion', onMotion);
      return samples;
    },
  };
}
