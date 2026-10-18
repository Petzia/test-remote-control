// Short beeps generated with the Web Audio API (no sound files).

const SCHEDULE_AHEAD_S = 0.05; // small lead so the start time is known precisely

/** Must be created from a user gesture, otherwise iOS keeps the audio muted. */
export function createBeeper() {
  // Lets the sound play even when the iPhone silent switch is on (iOS 17+).
  if (navigator.audioSession) {
    navigator.audioSession.type = 'playback';
  }
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const context = new AudioContextClass();

  // Converts an audio-clock time into the performance.now() clock used by the sensor.
  function toPerformanceTime(audioTime) {
    if (typeof context.getOutputTimestamp === 'function') {
      const stamp = context.getOutputTimestamp();
      if (stamp.performanceTime > 0) {
        return stamp.performanceTime + (audioTime - stamp.contextTime) * 1000;
      }
    }
    const latencyS = (context.outputLatency || 0) + (context.baseLatency || 0);
    return performance.now() + (audioTime - context.currentTime + latencyS) * 1000;
  }

  return {
    unlock() {
      return context.resume();
    },

    /**
     * Plays a beep and returns the estimated time (performance.now() clock)
     * at which the sound comes out of the speaker.
     */
    beep({ frequency = 880, durationMs = 150, volume = 0.6 } = {}) {
      // iOS suspends audio after a call or Siri; try to bring it back.
      if (context.state !== 'running') context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + SCHEDULE_AHEAD_S;
      const end = start + durationMs / 1000;

      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);

      return toPerformanceTime(start);
    },
  };
}
