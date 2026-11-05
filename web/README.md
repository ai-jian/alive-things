# Alive Things, web build (IWSDK / WebXR)

Primary build path. Runs in the Meta Quest browser from a link; the competition accepts WebXR entries this way. The shot list this build follows is `docs/storyboard-v5.html`.

## Try it without a headset
The deployed page has Meta's WebXR emulator (IWER) baked in. On a desktop browser: open the URL, press **Enter**. The emulator panel appears (top bar: toggle controllers/hands, a synthetic living room, play mode with WASD + mouse look). You can also simply **drag on the cup with the mouse** to paint; the pointer acts as a fingertip. On a real Quest browser the emulator stays out of the way.

## Run locally
```bash
cd web
npm install
npm run dev
```
Open the printed URL on a desktop browser: the IWER plugin emulates a Quest 3 with hands and a synthetic living room (plane detection works). On a Quest in the same network you need https; easiest is to push and use the GitHub Pages URL.

## Deploy
Push to the branch; `.github/workflows/pages.yml` builds `web/` and publishes to GitHub Pages at `https://<owner>.github.io/alive-things/`.
One-time: repository Settings → Pages → Source: **GitHub Actions**.

## What it does now
See the root `CLAUDE.md` ("The interaction, as built") for the exact numbers. In short:
- **Real object first.** On a headset the first card asks you to trace around a real cup; a ready cup comes after 45 s if you don't. On a desktop the cup is there at once.
- **Studio.** Pinch: it grows. Let go: it floats to you, big; the room dims only at the edges.
- **Brush.** Line, dot, bloom, long-press centre, twist fold; guide 2 × 6 × mirror; whole-body gradient from the object's own colour.
- **Quiet and set down.** It needs about three minutes of quiet company before it can wake. Lowering it lands it asleep on the table; pick it up to keep drawing; a tap (or a few seconds) wakes a ready one.
- **The island.** A small floating island over the table; pull it apart with both hands to go in at creature height, push together to come out. Creatures wander, nap, whisper, make friends; at most six live at once.
- **Come back.** Saved locally (small list, PNG paint, island memory). The island grows over ten minutes and a flower appears for each day you return.
- **The newcomer.** A shy blank one peeks over the island's rim; quick hands catch it.
- **Emulator keys (desktop):** `t` demo trace, `f` studio in/out (out = set down asleep), `w` make ready and wake, `g` island (adopt / go in / come out), `n` newcomer appear / catch. `?tracefirst` in the URL forces the headset's trace-first start.

## Files
- `src/main.js` world, cup entity, systems
- `src/cup.js` lathe cup, gradient shader, analytic surface (no raycasts), jelly
- `src/paint.js` intensity + wet fields, symmetry guide, bleed
- `src/brush-system.js` fingertip gestures → marks
- `src/place-on-table.js` plane detection → placement
- `src/palette.js` dominant colour → six stops

## Not verified yet
Everything above runs in the desktop emulator (headless smoke tests pass). Not yet tried on a real Quest: hand-tracked pinch/touch distances, plane detection on a real table, camera colour sampling, frame rate.

Deployed at https://ai-jian.github.io/alive-things/ (GitHub Pages, source: GitHub Actions).
