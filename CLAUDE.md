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

## The interaction, as built (Nov 6)
1. **Room.** A cup sits on the detected table. When a hand comes near it glows, turns toward the hand and leans in.
2. **Pinch** it: it lifts and grows in the hand. **Let go:** it floats up to an anchor 45 cm ahead and 14 cm below the eyes, about 26 cm tall, the room fades to warm fog, a hum rises. It slowly turns to show its back; touching pauses the turn.
3. **Draw** with a fingertip: line (slow/deep = thick, tapered), tap = dot, hold still = bloom, press-and-hold 0.9 s (fingertip still in space, not in texture pixels) = move the mandala centre, two fingertips twist = fold 4/6/8/12, flat palm = soften. Guide 2 × 6 × mirror. Strokes are a tint of the object's own gradient.
4. **Pinch it and lower it** below chest height: it shrinks to real size, lands on the table, wakes (face, arms, feet, two-word trait tag from the stroke stats).
5. **Doorway** disc appears beside it; set it on the disc → the garden. Home disc to return; a fresh cup waits.
6. **Trace:** pinch in the air, hold 0.35 s, trace around any real object, release → the loop is smoothed (resample + Chaikin) and inflated from the curve itself (`inflatePolygon`: rim snapped to the outline, exact-distance heights, Laplacian smoothing, shared rim vertices), a soft thing at real size and place; it then behaves like the cup. Saved as the polygon (tiny); old mask saves still rebuild.
7. **The newcomer:** after about 20 s in the garden with at least one creature, a tiny blank one hides behind its own hill at the far left edge and peeks out now and then (quiet question whisper; the plant says "someone is shy over there" the first time). A long stare (>1.1 s within 10°) or a slow hand within 12 cm sends it back. A quick pinch while it is out catches it: you return to the room and it is the next blank canvas on your table, with a real palette. Another appears after 2 more minutes in the garden. Emulator: `n` makes it appear, `n` again catches it.
Removed on Nov 6: the hold-with-one-hand-pull-with-the-other gesture (`focus-system.js`); replaced by `studio-system.js`.

## Repo map
- `docs/lookdev-gradient.html` — the reference look: whole-body gradient, guide 2 × 6 × mirror, natural stroke width, all options as gestures (table on the page). The product's palettes are copied from here. Loads three.js 0.152.2 from cdnjs.
- `docs/lookdev-symmetry.html` — Option A, first pass: strokes only, six patterns (owner found them indistinguishable at this scale).
- `docs/lookdev-relief.html` — archived Option B (carved relief). Not chosen.
- `docs/lookdev.html` — first colour-paint test. Kept for the lighting and jelly reference only.
- `web/` — the product. IWSDK/WebXR app, deployed to GitHub Pages from `main` (https://ai-jian.github.io/alive-things/). The deployed page carries Meta's IWER emulator, so a desktop browser shows an emulated Quest 3 (see `web/README.md`). Mouse-drag on the object paints in the emulator; keys `t` trace, `f` studio in/out, `w` wake, `g` garden, `n` newcomer (appear / catch).
  - `src/main.js` world, active object, systems, landing lifecycle · `cup.js` lathe cup + gradient shader (`gradientShader()`) · `thing.js` captured objects · `paint.js` intensity/wet fields + symmetry guide · `brush-system.js` gestures → marks, notice behaviour · `studio-system.js` grow/float/fog/set-down/wake · `hints.js` cards · `space.js` garden, doorway, showcase landing · `brain.js` creature free will + whisper cards · `creature.js` face/arms/feet/traits · `audio.js` hum/ticks/spatial whisper language · `trace.js` + `inflate.js` capture · `newcomer.js` the shy blank one · `palette.js` the four reference palettes · `store.js` localStorage · `place-on-table.js` plane detection · `hands.js` pinch/tips.
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

## State as of 2026-11-06
- `web/` is the product, deployed at https://ai-jian.github.io/alive-things/ (push to `main`). The whole studio flow above runs end to end in the desktop emulator: room, notice, pinch → grow → float big → fog, brush with the symmetry guide, set down → wake with traits, doorway → garden, free-will creatures, spatial wordless whispers in turns, plant guide, home disc, trace capture with smoothing, persistence, and a landing page that is the live garden. Palettes are the four from `docs/lookdev-gradient.html`.
- Headless smoke tests live in the session scratchpad only; locally run `npm run dev` in `web/` and use the emulator keys.
- **Not yet verified on a real Quest.** First device pass: fingertip touch distance (TOUCH in `brush-system.js`), studio anchor height and the 0.22 m set-down threshold, table detection, camera permission and colour, 60 fps while painting (JS diffusion runs at 30 Hz over the wet box).
- Owner feedback applied Nov 6: no illustration on the landing (it looked machine-made), colours must match the gradient look test, the object must come to you and get big to paint (size contrast, parallax), objects should react to you, traced shapes must read cleanly.
- Not built: the demo video itself. Everything in storyboard v5 is in the build (newcomer added Nov 6).
- Next: device pass, then the video.
