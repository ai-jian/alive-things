# Alive Things, web build (IWSDK / WebXR)

Primary build path. Runs in the Meta Quest browser from a link; the competition accepts WebXR entries this way.

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

## What v0 does
- `immersive-ar` session with hand tracking, plane detection, anchors.
- One cup, placed on the detected table (or 50 cm in front after 4 s). Pinch to grab (IWSDK `OneHandGrabbable`).
- Gesture brush on the cup wall: drag = line (slow/deep = thick), tap = dot, hold still = ink blooms, press-and-hold 0.6 s = set the mandala centre, two fingertips twist = fold 4/6/8/12. Guide 2 × 6 × mirror.
- Whole-body gradient from the cup's own colour. Jelly dent on touch. Tick per stamp.

## Files
- `src/main.js` world, cup entity, systems
- `src/cup.js` lathe cup, gradient shader, analytic surface (no raycasts), jelly
- `src/paint.js` intensity + wet fields, symmetry guide, bleed
- `src/brush-system.js` fingertip gestures → marks
- `src/place-on-table.js` plane detection → placement
- `src/palette.js` dominant colour → six stops

## Not yet
Focus mode (room fade), wake animation and traits, My Space, creature brain, whispers, trace-to-capture, camera colour (IWSDK has a `camera` feature; verify on device), sounds beyond the tick.

Deployed at https://ai-jian.github.io/alive-things/ (GitHub Pages, source: GitHub Actions).
