import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDENTITY, rotate, toReferenceFrame } from '../js/modules/rotation.js';

function assertVectorClose(actual, expected) {
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(actual[axis] - expected[axis]) < 1e-9, `${axis}: ${actual[axis]} vs ${expected[axis]}`);
  }
}

test('identity leaves vectors unchanged', () => {
  assertVectorClose(toReferenceFrame(IDENTITY, { x: 1, y: 2, z: 3 }), { x: 1, y: 2, z: 3 });
});

test('a quarter turn around z maps the phone x axis to the reference y axis', () => {
  const q = rotate(IDENTITY, { x: 0, y: 0, z: Math.PI / 2 }, 1);
  assertVectorClose(toReferenceFrame(q, { x: 1, y: 0, z: 0 }), { x: 0, y: 1, z: 0 });
});

test('small steps add up to the same rotation as one big step', () => {
  let q = IDENTITY;
  for (let i = 0; i < 100; i += 1) q = rotate(q, { x: Math.PI / 2, y: 0, z: 0 }, 0.01);
  assertVectorClose(toReferenceFrame(q, { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 });
});
