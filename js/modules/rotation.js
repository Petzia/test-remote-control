// Minimal quaternion helpers to follow the phone orientation with the gyroscope.
// A quaternion is [w, x, y, z].

export const IDENTITY = Object.freeze([1, 0, 0, 0]);

function multiply([aw, ax, ay, az], [bw, bx, by, bz]) {
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

function normalize(q) {
  const length = Math.hypot(...q);
  return q.map((value) => value / length);
}

/**
 * Applies a rotation measured in the phone's own frame.
 * @param {number[]} q current orientation (phone frame → reference frame)
 * @param {{x:number,y:number,z:number}} rate angular velocity in rad/s, phone frame
 * @param {number} dt seconds
 */
export function rotate(q, rate, dt) {
  const speed = Math.hypot(rate.x, rate.y, rate.z);
  const angle = speed * dt;
  if (angle < 1e-9) return q;
  const s = Math.sin(angle / 2) / speed;
  const step = [Math.cos(angle / 2), rate.x * s, rate.y * s, rate.z * s];
  return normalize(multiply(q, step));
}

/** Expresses a phone-frame vector in the reference frame. */
export function toReferenceFrame(q, { x, y, z }) {
  const [w, qx, qy, qz] = q;
  const [, rx, ry, rz] = multiply(multiply(q, [0, x, y, z]), [w, -qx, -qy, -qz]);
  return { x: rx, y: ry, z: rz };
}
