# Alive Things — agent handoff

Hands-only mixed reality app for Meta Quest 3. Competition entry (Meta VR Start 2026, **deadline Nov 18, 2026 12:00 PM PT**, rules summarised in `docs/PRD.md` §12).
One line: *Pick up a cup. Be quiet for ten minutes. It comes alive.*

## Read these first, in order
1. `docs/PRD.md` — goals, core loop, feature list with priorities and acceptance, risks, milestones.
2. `docs/art-direction.md` — **decided:** whole-body gradient, palette from the object's own colour (no picking), guide 2 × 6 × mirror, two marks, every control a gesture. Live proof `docs/lookdev-gradient.html`. Don't reopen this without the owner.
3. `docs/storyboard-v5.html` (or the .png) — the 2-minute demo video, the studio flow. **This is the scope.** If a feature is not in a shot, don't build it. (v4 is kept for history.)
4. `docs/design-notes.md` — decision log with reasons, capture pipeline, two-week build order.
5. `docs/PRD.md` §12 — the official rules that bind the build: seated 2 ft, 60 fps, plane-anchored passthrough, ≤10 min sessions, WebXR allowed via link.

## Platform decision (Nov 5, evening)
The rules accept **IWSDK / WebXR entries by link**. WebXR (three.js + Meta Immersive Web SDK) is the primary and only active build path: it is built and deployed from a cloud session and tested on the Quest browser. The `unity/` folder is a dormant port target. Camera: IWSDK exposes `features.camera` (`CameraSource` → texture via getUserMedia); the shape comes from **tracing the object's outline with a fingertip** (hands-first, no CV), the palette from the camera frame inside the trace; without a camera the palette falls back to a soft default. Owner's instruction (Nov 5, night): build the complete product now, no staging, use the camera.

## The interaction, as built (Nov 6, after the critique pass)
1. **Room, real object first.** On a headset the first card says: trace around a real cup on your desk. Pinch the air, hold 0.35 s, draw its outline, release. The loop is projected onto the plane you actually drew in (best fit); a flat loop drawn around the object on the desk becomes an upright pebble as wide as the footprint. It is smoothed (resample + Chaikin), inflated from the curve (`inflatePolygon`), and coloured from the passthrough camera (camera starts at session start; the inner 55% of the loop is sampled; with no frame, the next reference palette, never a random hue). If nothing is traced in 45 s, or two traces fail, a ready cup appears on the detected table. In the desktop emulator the cup is there at once (`?tracefirst` forces the headset flow). Detect a real headset with `window.REAL_HEADSET` (set in `index.html` before the emulator rewrites the user agent).
2. **Table.** Plane search runs all session. Spots are on the near edge of the table, inside its outline (7 cm margin) and within 55 cm of the eyes. Anything resting on the table is pinned in the plane's own space and follows its refined pose. No table yet: in front of you, and it glides down when a table appears.
3. **Notice and pinch.** A hand near the object: glow, turn, lean. Pinch: it grows in the hand. Let go: it floats to an anchor 45 cm ahead, 14 cm below the eyes, about 26 cm tall; slow turntable paused by touch. The room dims as a **vignette** (about 10% along the line to the object, up to 55% at the edges), so your hands and the object stay clear.
4. **Draw** with a fingertip: line (slow = thick, press adds a little), tap = dot, hold still = bloom, press-and-hold 0.8 s with the smoothed tip within 12 mm = move the mandala centre, two fingertips twist = fold 4/6/8/12. Touch starts at 15 mm and holds to 30 mm; losing contact for under 0.12 s keeps the line. Ticks at most every 90 ms. Flat-palm soften is **not built**.
5. **Quiet, then set down.** Studio time counts as quiet company unless a hand scribbles fast (>0.35 m/s). Ready after 150 s for the first creature, 100 s for later ones; it breathes more as it gets close and chimes when ready. Pinch and lower it 22 cm below the anchor: it lands on the table under where you let go (clamped onto the table), **asleep**. Pick it up again to keep drawing. A ready one wakes on a tap or 4 s after landing; an unready one stirs and says "not yet". Emulator `w` makes it ready and wakes it.
6. **The island.** A disc appears beside the awake creature; set it there → a tiny floating island (36%) over the table with it on board, god view. One hand moves the island, two hands scale and turn it; pull apart past 2.4× → in (6×, eye at creature height, dusk sky that lets the room show faintly near and below the horizon); push together below 3× → out. Inside, one hand drags the world. Touching a creature gets a reaction by personality. At most six creatures live at once; older ones sleep where they are.
7. **Other objects.** Starting a new trace (or catching the newcomer) puts the current object back on the table asleep; pick it up to continue. An awake one that was never moved in hops onto the island. A blank untouched cup is removed.
8. **The newcomer.** After ~20 s with the island open, a tiny blank one hides — under the island's rim when you look from above, behind its own hill inside — and peeks out. A gaze that really lands on it (within 1.4× its angular size, min 2.5°) for 1.5 s, or a slow creeping hand within 12 cm, sends it back. A quick hand startles it still for 0.6 s; a pinch within 6 cm catches it and it becomes your next blank canvas. Emulator: `n` appear / catch.
9. **Coming back.** Saved: a small creature list (positions, traits, friendships), each creature's paint once as a PNG, and island memory (age, days visited, last seen). The island grows over ten minutes of company and adds a flower per day you return. Away more than 20 min: they move, some nap, friendships grow, the plant says a line.
Removed on Nov 6: the hold-with-one-hand-pull-with-the-other gesture (`focus-system.js`); replaced by `studio-system.js`.

## Repo map
- `docs/lookdev-gradient.html` — the reference look: whole-body gradient, guide 2 × 6 × mirror, natural stroke width, all options as gestures (table on the page). The product's palettes are copied from here. Loads three.js 0.152.2 from cdnjs.
- `docs/lookdev-symmetry.html` — Option A, first pass: strokes only, six patterns (owner found them indistinguishable at this scale).
- `docs/lookdev-relief.html` — archived Option B (carved relief). Not chosen.
- `docs/lookdev.html` — first colour-paint test. Kept for the lighting and jelly reference only.
- `web/` — the product. IWSDK/WebXR app, deployed to GitHub Pages from `main` (https://ai-jian.github.io/alive-things/). The deployed page carries Meta's IWER emulator, so a desktop browser shows an emulated Quest 3 (see `web/README.md`). Mouse-drag on the object paints in the emulator; keys `t` trace, `f` studio in/out, `w` wake, `g` island (adopt awake cup / open → go in → come out), `n` newcomer (appear / catch).
  - `src/main.js` world, active object, systems, landing lifecycle · `cup.js` lathe cup + gradient shader (`gradientShader()`) · `thing.js` captured objects · `paint.js` intensity/wet fields + symmetry guide, 32 px tiles, partial GPU uploads · `brush-system.js` gestures → marks, notice behaviour · `studio-system.js` grow/float/vignette/quiet/set-down/wake · `hints.js` cards · `space.js` floating island: door disc, mini/inside modes, two-hand gestures, sky dome, showcase landing · `brain.js` creature free will + whisper cards · `creature.js` arms/feet/traits · `face.js` googly eyes and moods (owner's reference sheet: white eyes, round black pupils that dart, no mouth except talking/surprise; moods open, wide, happy ^ ^, content ‿ ‿, cross, sleepy lid; !!! marks) used by creatures, the newcomer and the plant · `audio.js` hum/ticks/spatial whisper language · `trace.js` + `inflate.js` capture · `newcomer.js` the shy blank one · `palette.js` the four reference palettes · `store.js` localStorage (small list + PNG paint + island memory) · `place-on-table.js` table search, home spot, landing clamp, plane-pinned resting · `hands.js` pinch/tips.
- `unity/` — Unity 2022.3 LTS project (dormant; behind the web build). URP. Scripts under `Assets/AliveThings/Scripts/`, grouped: Creature, Interaction, Paint, Capture, World. Shader includes under `Assets/AliveThings/Shaders/`.

## Unity setup (local machine)
1. Unity Hub → install 2022.3.x LTS with Android Build Support (SDK/NDK/OpenJDK).
2. Open `unity/`. Packages in `Packages/manifest.json` install on open (URP, XR Management, Oculus XR plugin, Input System, Sentis).
3. Package Manager → My Assets → **Meta XR All-in-One SDK** (Asset Store, free). Import. Run Meta → Tools → Project Setup Tool → Fix All.
4. XR Plug-in Management → Android → Oculus. Build target Android, ARM64, IL2CPP, Vulkan or GLES3.
5. Hand tracking: subclass `Interaction/HandInput.cs` with OVRHand/OVRSkeleton. `MouseHandInput` already lets scenes run in the editor with a mouse.
6. Creature material: make a material from **`AliveThings/GradientSurface`** (`Shaders/GradientSurface.shader`, hand-written URP, no Shader Graph wiring). `PaletteFromObject`, `PaintSurface` and `JellyPoke` fill its properties through MaterialPropertyBlocks. Handle, feet and face use a second material from the same shader with `_UsePaint = 0`. The `.hlsl` files next to it are the shared functions (also usable from a Shader Graph Custom Function node if ever wanted).
7. Materials for `PaintSurface`: one from `Shaders/Stamp.shader`, one from `Shaders/Diffuse.shader`. Assign both in the inspector. The creature mesh needs a MeshCollider (non-convex is fine) for the brush raycasts.

No scene file is committed yet. First scene to make: a passthrough scene with hands, one ready cup (lathe mesh, MeshCollider) with `PaletteFromObject`, `PaintSurface` + `ZenBrush`, `JellyPoke`, and `HoldAndOpenGesture` → `FocusMode`. Test order in the editor with `MouseHandInput`: see the gradient, draw a line (symmetry copies appear), tap a dot, hold still to bloom, long-press to move the centre.

## Conventions
- Hands only. No controllers, no menus, no 2D UI except the trait tag and whisper bubbles.
- No outlines anywhere. Flat cut-out world. Creature surface look is the open decision above.
- The brush always has the composite symmetry guide on, default 2 around × 6 mandala × mirror. Two marks only (line, dot). No pattern menu, no option buttons, no colour picking: every control is a gesture (table in `docs/lookdev-gradient.html` and art-direction.md). Palette is derived from the object. Owner's taste: Monument Valley, less is more. Personality is derived from how the user drew, never random (`CreatureTraits.FromStrokes`).
- Sound is garnish: hum, ticks, chirps. No melodies.
- Scripts: namespace `AliveThings.<Area>`, one class per file, short XML summary on top saying what the thing is for.
- Keep the shelf fallback working at all times. Capture is an entry, not a dependency.

## Letting an agent drive the Unity Editor (MCP)
A cloud session cannot reach a local Editor. Run Claude Code **on the machine that has Unity**, inside this repo, with a Unity MCP configured:
- Community, most used: CoplayDev "MCP for Unity" (Unity package via Package Manager git URL + a local Python server; then `claude mcp add` per their README). Creates GameObjects, adds components, sets fields, makes materials, reads the Console, enters Play mode, screenshots.
- Official route (Unity 6+): Unity CLI `unity mcp` (seen in one 2026 write-up; verify against Unity docs).
With either, an agent can build the first scene and fix compile errors itself; the owner only needs to wear the headset. Shader Graph nodes can't be edited over MCP, which is why the surface shader is hand-written.

## Working rules for agents
- Branch off `main`, push the branch, don't open a PR unless asked.
- Don't commit `Library/`, builds, or APKs (see `.gitignore`).
- Deploy = push to `main`. Branch pushes only build. Pages environment only accepts `main`.
- Emulator gotcha: desktop Chrome's native `XRWebGLBinding` rejects IWER sessions; `web/index.html` deletes it before modules load unless the UA is OculusBrowser. Keep that script.
- Storyboard changes are design changes: edit `docs/storyboard-v5.html`, re-render the PNG (Playwright screenshot of the page at 1180 px wide, 2× scale), and note the reason in `docs/design-notes.md`.
- When something can't be verified here (no headset, no Unity), say so plainly in the handoff instead of claiming it works.

## State as of 2026-11-06 (late: critique pass)
- `web/` is the product, deployed at https://ai-jian.github.io/alive-things/ (push to `main`). Everything above runs in the desktop emulator. Headless smoke tests live in the session scratchpad only; locally run `npm run dev` in `web/` and use the emulator keys.
- The emulator here cannot load its synthetic room, so table placement was tested with an injected plane only.
- **Not yet verified on a real Quest.** First device pass, in order: (1) 60 fps while painting (stamps ~0.2 ms each for 24 copies; diffusion ~3 ms per step on a busy desktop, every 3rd frame), (2) touch feel: TOUCH_IN/OUT, BRIDGE, STILL in `brush-system.js`, (3) table detection, the home spot and plane pinning, (4) camera permission at session start and colour sampling, (5) the vignette over real hands, (6) island two-hand reach and the 2.4× / 3× thresholds, (7) whether 150 s to ready feels right, (8) trait words on real hand data (`TYPICAL` in `creature.js`).
- Not built: flat-palm soften (F6), following (F11), the demo video.
- Next: device pass, then the video.
