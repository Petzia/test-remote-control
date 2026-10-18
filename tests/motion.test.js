import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotationOf } from '../js/modules/motion.js';

test('rotationOf maps alpha/beta/gamma (deg/s) to z/x/y in rad/s', () => {
  const rate = rotationOf({ rotationRate: { alpha: 90, beta: 180, gamma: -45 } });
  assert.ok(Math.abs(rate.rz - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(rate.rx - Math.PI) < 1e-12);
  assert.ok(Math.abs(rate.ry + Math.PI / 4) < 1e-12);
});

test('rotationOf falls back to zero when the gyroscope data is missing or invalid', () => {
  const zero = { rx: 0, ry: 0, rz: 0 };
  assert.deepEqual(rotationOf({ rotationRate: null }), zero);
  assert.deepEqual(rotationOf({ rotationRate: { alpha: NaN, beta: 0, gamma: 0 } }), zero);
});
