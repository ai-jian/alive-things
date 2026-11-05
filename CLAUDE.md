# Alive Things — agent handoff

Hands-only mixed reality app for Meta Quest 3. Competition entry (Meta VR Start 2026, deadline reported Nov 18, 2026).
One line: *Pick up a cup. Be quiet for ten minutes. It comes alive.*

## Read these first, in order
1. `docs/PRD.md` — goals, core loop, feature list with priorities and acceptance, risks, milestones.
2. `docs/art-direction.md` — **decided:** whole-body gradient, palette from the object's own colour (no picking), guide 2 × 6 × mirror, two marks, every control a gesture. Live proof `docs/lookdev-gradient.html`. Don't reopen this without the owner.
3. `docs/storyboard-v4.html` (or the .png) — the 2-minute demo video. **This is the scope.** If a feature is not in a shot, don't build it.
4. `docs/design-notes.md` — decision log with reasons, capture pipeline, two-week build order.

## Repo map
- `docs/lookdev-gradient.html` — Option A, current pass: whole-body gradient, guide 2 × 6 × mirror, natural stroke width, all options as gestures (table on the page). Open in a browser; loads three.js 0.152.2 from cdnjs.
- `docs/lookdev-symmetry.html` — Option A, first pass: strokes only, six patterns (owner found them indistinguishable at this scale).
- `docs/lookdev-relief.html` — archived Option B (carved relief). Not chosen.
- `docs/lookdev.html` — first colour-paint test. Kept for the lighting and jelly reference only.
- `unity/` — Unity 2022.3 LTS project. URP. Scripts under `Assets/AliveThings/Scripts/`, grouped: Creature, Interaction, Paint, Capture, World. Shader includes under `Assets/AliveThings/Shaders/`.

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
- Storyboard changes are design changes: edit `docs/storyboard-v4.html`, re-render the PNG, and note the reason in `docs/design-notes.md`.
- When something can't be verified here (no headset, no Unity), say so plainly in the handoff instead of claiming it works.

## State as of 2026-11-05 (evening)
- Done: PRD, storyboard v4.2, look tests (gradient one is the reference), Unity skeleton with 15 scripts and 3 shader files matching the decided design. Nothing has been compiled in Unity yet; expect small fixes.
- `Paint/ZenBrush.cs` implements the full gesture map and the 2 × N × mirror guide. `Paint/PaintSurface.cs` is intensity + wet with a diffusion blit. `Paint/PaletteFromObject.cs` builds the six stops. `Shaders/GradientSurface.hlsl` is the surface.
- Not started: scene, Meta SDK hand adapter, capture pipeline (Sentis model, mask → `SilhouetteInflator`, dominant colour → `PaletteFromObject.SetDominant`), My Space art, sounds, ripple/spoke visuals (`ZenBrush.OnCentreSet` / `OnFoldChanged` are virtual hooks).
- Next: open locally, install Meta SDK, build the first scene, get the cup painting in the editor with the mouse, then on device.
