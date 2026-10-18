import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatResult } from '../js/modules/ui.js';

test('formatResult converts a punch into readable units', () => {
  const formatted = formatResult({
    status: 'ok',
    reactionMs: 231.6,
    peakAccel: 19.62,
    peakSpeed: 2.34,
    durationMs: 412.2,
  });
  assert.deepEqual(formatted, {
    label: null,
    reaction: '232 ms',
    accel: '2.0 g',
    speed: '2.3 m/s',
    duration: '412 ms',
  });
});

test('formatResult labels invalid repetitions', () => {
  assert.equal(formatResult({ status: 'false-start' }).label, 'Faux départ');
  assert.equal(formatResult({ status: 'no-movement' }).label, 'Pas de coup détecté');
});
