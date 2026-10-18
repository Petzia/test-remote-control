// Keeps the screen on during a series so the sensors keep running.

export async function keepScreenOn() {
  if (!('wakeLock' in navigator)) return null;
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    return null; // Not critical: the app still works if the screen may turn off.
  }
}
