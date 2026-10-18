# Punch Meter

A tiny web app that measures how fast and explosive your punch is, using your phone's
accelerometer. Hold the phone firmly (e.g. against a dumbbell), wait for the beep, punch
forward and bring your fist back.

## How it works

1. Tap **Démarrer** and allow motion sensors when asked.
2. A low beep means "get ready". Keep still.
3. After a random delay (2–4.5 s), a high beep means "punch!".
4. After 5 repetitions you get, for each punch:
   - **Réaction**: time between the beep and the start of the movement (ms);
   - **Pic**: peak acceleration, in g — the best indicator of explosiveness;
   - **Vitesse**: estimated peak speed (m/s), integrated from acceleration;
   - **Durée**: time of the full out-and-back movement (ms).

Moving before the beep counts as a **false start**.

> The speed is an estimate: a phone is not a lab sensor. Use it to compare yourself
> from one session to the next, not as an absolute value. Phone sensors report about 60
> times per second, so timings are precise to roughly ±17 ms.

## Use on iPhone

- Open the GitHub Pages URL in Safari or Chrome (HTTPS is required for sensors).
- iOS asks for motion access on the first tap. If you refused, close the tab and reopen it.
- Keep the screen on and the page open: locking the phone stops the series.
- Turn the volume up. On recent iOS versions the beep plays even in silent mode; on older
  ones, turn the silent switch off.

## Run locally

No build step and no dependencies.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # runs the tests with node --test
```

Sensors only work over HTTPS on a phone, so test the real thing on the GitHub Pages URL.

## Project layout

```
index.html
css/style.css
js/main.js               # wires the UI to the series
js/modules/analysis.js   # pure maths: reaction, peak, speed, duration
js/modules/series.js     # beep → wait → beep → record loop
js/modules/motion.js     # accelerometer access and recording
js/modules/audio.js      # beeps with Web Audio
js/modules/wakelock.js   # keeps the screen on during a series
js/modules/ui.js         # DOM rendering
tests/                   # node --test
```
