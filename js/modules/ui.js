// DOM rendering. Only textContent and createElement are used.

import { GRAVITY } from './analysis.js';

const STATUS_TEXT = {
  idle: 'Appuie sur Démarrer',
  ready: 'Prêt…',
  go: 'FRAPPE !',
  pause: 'Reviens en garde',
  done: 'Série terminée',
};

export function formatResult(result) {
  if (result.status === 'false-start') return { label: 'Faux départ' };
  if (result.status === 'no-movement') return { label: 'Pas de coup détecté' };
  return {
    label: null,
    reaction: `${Math.round(result.reactionMs)} ms`,
    accel: `${(result.peakAccel / GRAVITY).toFixed(1)} g`,
    speed: `${result.peakSpeed.toFixed(1)} m/s`,
    duration: `${Math.round(result.durationMs)} ms`,
  };
}

export function createUi(root) {
  const elements = {
    status: root.querySelector('#status'),
    rep: root.querySelector('#rep'),
    message: root.querySelector('#message'),
    results: root.querySelector('#results tbody'),
    best: root.querySelector('#best'),
    start: root.querySelector('#start'),
    stop: root.querySelector('#stop'),
  };

  return {
    elements,

    setStatus(status, rep, totalReps) {
      elements.status.textContent = STATUS_TEXT[status];
      elements.status.dataset.state = status;
      elements.rep.textContent = rep ? `Répétition ${rep} / ${totalReps}` : '';
    },

    setRunning(running) {
      elements.start.hidden = running;
      elements.stop.hidden = !running;
    },

    showMessage(text) {
      elements.message.textContent = text;
      elements.message.hidden = !text;
    },

    clearResults() {
      elements.results.replaceChildren();
      elements.best.textContent = '';
    },

    addResult(result, rep) {
      const row = root.createElement('tr');
      const repCell = root.createElement('th');
      repCell.scope = 'row';
      repCell.textContent = String(rep);
      row.append(repCell);

      const formatted = formatResult(result);
      const texts = formatted.label
        ? [formatted.label]
        : [formatted.reaction, formatted.accel, formatted.speed, formatted.duration];
      for (const text of texts) {
        const cell = root.createElement('td');
        cell.textContent = text;
        if (formatted.label) cell.colSpan = 4;
        row.append(cell);
      }
      elements.results.append(row);
    },

    showBest(result) {
      if (!result) {
        elements.best.textContent = '';
        return;
      }
      const { reaction, accel, speed } = formatResult(result);
      elements.best.textContent = `Meilleur coup : ${accel} · ${speed} · réaction ${reaction}`;
    },
  };
}
