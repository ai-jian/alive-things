# Alive Things, web build (IWSDK / WebXR)

Primary build path. Runs in the Meta Quest browser from a link; the competition accepts WebXR entries this way.

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
- **Room.** `immersive-ar` with hand tracking, plane detection, anchors. A cup waits on the detected table (or in front of you after 4 s). It glows when a hand comes near. Pinch to grab.
- **Capture.** Pinch in the air, hold, trace around any real object, release: the loop is inflated into a soft thing at real size and place. On a headset with camera access the colour inside the loop becomes its palette (IWSDK camera feature; OculusBrowser only). Fallback: a soft default colour.
- **Brush.** Fingertip on the surface: line (slow/deep = thick, tapered), tap = dot, hold still = bloom, press-and-hold 0.6 s = move the mandala centre, two fingertips twist = fold 4/6/8/12. Guide 2 × 6 × mirror (traced things: 1 × 6 × mirror, front and back share the pattern). Whole-body gradient from the object's own colour.
- **Studio.** Pinch the object: it grows in your hand. Let go: it floats up in front of you as a big canvas (about 30 cm) while the room fades to warm dark fog and a hum comes up. It slowly turns to show its back; painting pauses the turn. Pinch it and lower it below chest height: it shrinks back to real size, lands on the table and wakes, with a face, arms, feet and a two-word personality grown from how you drew.
- **My Space.** A doorway disc appears beside the awake creature; set it down there. Tabletop garden: painted dome, hills, fireflies, a light pool per creature, needs-based free will (wander, approach, whisper, nap, look at you), wordless whisper cards in its palette, chirps, a hanging plant that speaks one line at milestones. Touch the home disc to go back; a fresh cup waits on the table.
- **Come back.** Creatures persist in localStorage (paint at half resolution, traced shapes as masks).
- **Hints.** One soft card above the object that advances on what you actually did, then fades.
- **Landing.** Outside XR the page shows the live garden with your creatures (or a painted demo cup) under a drifting camera; the words sit on top.
- **Emulator keys (desktop):** `t` demo trace, `f` studio in/out, `w` wake, `g` garden.

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
