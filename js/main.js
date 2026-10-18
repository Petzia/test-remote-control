import { bestResults } from './modules/analysis.js';
import { createBeeper } from './modules/audio.js';
import { createRecorder, requestMotionPermission, MotionError } from './modules/motion.js';
import { runSeries, SERIES_SETTINGS } from './modules/series.js';
import { createUi } from './modules/ui.js';
import { keepScreenOn } from './modules/wakelock.js';

function createApp(ui) {
  const recorder = createRecorder();
  let beeper = null;
  let controller = null;

  async function prepare() {
    // Both must be called inside the tap handler, before any await, for iOS to allow them.
    beeper = beeper ?? createBeeper();
    await Promise.all([beeper.unlock(), requestMotionPermission()]);
  }

  async function runOneSeries() {
    controller = new AbortController();
    const wakeLock = await keepScreenOn();
    const results = [];
    ui.clearResults();
    ui.setRunning(true);

    try {
      await runSeries({
        beeper,
        recorder,
        signal: controller.signal,
        onStatus: (status, rep) => ui.setStatus(status, rep, SERIES_SETTINGS.reps),
        onResult: (result, rep) => {
          results.push(result);
          ui.addResult(result, rep);
          ui.showBest(bestResults(results));
        },
      });
      ui.setStatus('done');
    } catch (error) {
      ui.setStatus('idle');
      if (error?.name !== 'AbortError') {
        console.error(error);
        ui.showMessage('Erreur inattendue, réessaie.');
      }
    } finally {
      ui.setRunning(false);
      wakeLock?.release();
      controller = null;
    }
  }

  async function start() {
    if (controller || ui.elements.start.disabled) return;
    ui.showMessage('');
    ui.elements.start.disabled = true;
    try {
      await prepare();
    } catch (error) {
      ui.showMessage(error instanceof MotionError ? error.message : 'Impossible de démarrer.');
      return;
    } finally {
      ui.elements.start.disabled = false;
    }
    await runOneSeries();
  }

  function stop(reason) {
    if (!controller) return;
    controller.abort();
    if (reason) ui.showMessage(reason);
  }

  return { start, stop };
}

const ui = createUi(document);
const app = createApp(ui);

ui.elements.start.addEventListener('click', app.start);
ui.elements.stop.addEventListener('click', () => app.stop());
// iOS pauses sensors and timers when the page is hidden: the series would be meaningless.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.stop('Série interrompue (écran verrouillé ou app changée).');
});
ui.setStatus('idle');
