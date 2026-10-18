# Decisions

## Mode

The user answered "no" to the challenge question: built directly, decisions logged here.

## Stack

- **Vanilla HTML/CSS/JS (ES modules), no build step.** A single screen with a sensor,
  a beep and a table does not need a framework.
- **No dependencies.** Sensors (`DeviceMotionEvent`), sound (Web Audio), screen wake
  (Wake Lock API) and the maths are all built into the browser or a few lines of code.
- **Tests with `node --test`.** `package.json` only exists to set `"type": "module"`
  and the `test` script; it has no dependencies.
- **Hosting on GitHub Pages**, requested by the user: free and served over HTTPS, which
  iOS requires to access motion sensors. Deployed from the `main` branch root.

## Product

- **Target: iPhone (Safari or Chrome).** On iOS, Chrome uses the same WebKit engine as
  Safari, so the same permission flow applies: `DeviceMotionEvent.requestPermission()`
  must be called from a tap.
- **Two beeps**: a low "ready" beep, then a high "go" beep after a random 2–4.5 s
  delay, so the signal can't be anticipated. No voice, to stay light.
- **Series of 5 repetitions**, run automatically so the user doesn't need to touch the
  screen between punches.
- **One repetition = one complete movement**: guard → punch → back still in guard. Only
  the phone is held in the fist (no dumbbell).
- **Metrics**: reaction time, out-and-back time, peak acceleration (in g, averaged over 3
  samples to remove single-sample spikes) and estimated peak speed (m/s). The "Records"
  line shows the best value of each metric, since each one measures something different.
- **No return to guard → rejected**: if the hand never holds still after the punch, the
  out-and-back time and speed can't be trusted, so the rep shows "Pas revenu en garde"
  instead of misleading numbers.
- **Detection thresholds**: movement starts above 4 m/s², the hand is "at rest" below
  1.5 m/s² **and** below 0.5 rad/s of rotation for 200 ms (low acceleration alone could
  just mean a slow glide).
- **Records**: the shortest out-and-back time wins, even if the punch was weaker. Each
  record is independent; compare "Pic" and "Vitesse" for power. The reaction time is measured from the moment the acceleration
  first rises above the rest level (walking back from the 4 m/s² crossing).
- **False start**: any movement above 4 m/s² between the "ready" beep (+0.5 s settle
  time) and the "go" beep, or a movement whose onset is less than 100 ms after the beep
  (faster than human reaction, so the beep was anticipated).
- **Speed** is integrated from acceleration (trapezoidal rule) with two corrections:
  - the wrist turns during a punch, so the phone axes turn too. The gyroscope
    (`rotationRate`) is integrated into a quaternion to express every acceleration in the
    fixed frame of the starting guard position (`js/modules/rotation.js`, ~40 lines, no
    library needed);
  - the hand is still at the start and at the end, so the final velocity must be zero:
    the leftover is sensor drift and is removed linearly over the movement.
  If the removed drift is larger than half the peak speed, the speed is shown as "—":
  something went wrong (end of rep missed, sensor glitch) and the number would mislead.
  It remains an estimate, best used to compare sessions.
- **Known limits**: without a gyroscope (`rotationRate` missing) rotation compensation is
  off. Phones that only report `accelerationIncludingGravity` use a phone-frame gravity
  filter that leaks gravity when the wrist turns. Neither case happens on recent iPhones.
- **Beep timing**: the beep is scheduled 50 ms ahead and its time is converted from the
  audio clock to the sensor clock with `getOutputTimestamp()`. Sensor events arrive at
  ~60 Hz, so timings have a resolution of about 17 ms.
- **Interruptions**: the series stops if the page is hidden (screen locked, app switch),
  because iOS pauses sensors and timers. The audio is resumed if iOS suspended it.
- **Silent mode**: `navigator.audioSession.type = 'playback'` lets the beep play when
  the iPhone silent switch is on (iOS 17+). Trade-off: it pauses music playing on the phone.
- **Nothing is stored** (no localStorage): results are only shown for the current series.

## Security

- Strict Content-Security-Policy in a `<meta>` tag (GitHub Pages can't set headers):
  only same-origin scripts and styles.
- All DOM updates use `textContent` / `createElement`.
