# Alive Things — agent handoff

Hands-only mixed reality app for Meta Quest 3. Competition entry (Meta VR Start 2026, deadline reported Nov 18, 2026).
One line: *Pick up a cup. Be quiet for ten minutes. It comes alive.*

## Read these first, in order
1. `docs/PRD.md` — goals, core loop, feature list with priorities and acceptance, risks, milestones.
2. `docs/art-direction.md` — **open decision** between A (bleed + palette, owner's preference) and B (carved relief). What is agreed regardless: radial symmetry guide, motion-picked patterns, no outlines. Do not decide this for the owner.
3. `docs/storyboard-v4.html` (or the .png) — the 2-minute demo video. **This is the scope.** If a feature is not in a shot, don't build it.
4. `docs/design-notes.md` — decision log with reasons, capture pipeline, two-week build order.

## Repo map
- `docs/lookdev-symmetry.html` — Option A proof: radial symmetry guide, ink bleed, palette-mapped colour. Open in a browser; loads three.js 0.152.2 from cdnjs.
- `docs/lookdev-relief.html` — Option B proof: carve relief, clays, glaze, moving toon light.
- `docs/lookdev.html` — first colour-paint test. Kept for the lighting and jelly reference only.
- `unity/` — Unity 2022.3 LTS project. URP. Scripts under `Assets/AliveThings/Scripts/`, grouped: Creature, Interaction, Paint, Capture, World. Shader includes under `Assets/AliveThings/Shaders/`.

## Unity setup (local machine)
1. Unity Hub → install 2022.3.x LTS with Android Build Support (SDK/NDK/OpenJDK).
2. Open `unity/`. Packages in `Packages/manifest.json` install on open (URP, XR Management, Oculus XR plugin, Input System, Sentis).
3. Package Manager → My Assets → **Meta XR All-in-One SDK** (Asset Store, free). Import. Run Meta → Tools → Project Setup Tool → Fix All.
4. XR Plug-in Management → Android → Oculus. Build target Android, ARM64, IL2CPP, Vulkan or GLES3.
5. Hand tracking: subclass `Interaction/HandInput.cs` with OVRHand/OVRSkeleton. `MouseHandInput` already lets scenes run in the editor with a mouse.
6. Shader Graph: URP Unlit graph. Custom Function nodes from `Shaders/ToonRelief.hlsl` (HeightToNormal, ToonRelief) and `Shaders/JellyDeform.hlsl`. Expose `_HeightTex`, `_Displace`, `_Bump`, `_Clay`, `_Shadow`, `_Light`, `_Rim`, `_Glaze`, `_GlazeOn`, `_Ambient`, `_PokePos`, `_PokeAmt`, `_Wobble`.
7. Stamp material for `PaintSurface`: Unlit, `Blend One One`, `Cull Off`, `ZTest Always`, outputs `tex.r * _Strength` (signed). Smooth material: a disc-limited box blur over `_MainTex`.

No scene file is committed yet. First scene to make: a passthrough scene with hands, one ready cup with `JellyPoke`, `HoldAndOpenGesture` → `FocusMode`, `PaintSurface` + `ZenBrush`.

## Conventions
- Hands only. No controllers, no menus, no 2D UI except the trait tag and whisper bubbles.
- No outlines anywhere. Flat cut-out world. Creature surface look is the open decision above.
- The brush always has a radial symmetry guide on. Personality is derived from how the user drew, never random (`CreatureTraits.FromStrokes`).
- Sound is garnish: hum, ticks, chirps. No melodies.
- Scripts: namespace `AliveThings.<Area>`, one class per file, short XML summary on top saying what the thing is for.
- Keep the shelf fallback working at all times. Capture is an entry, not a dependency.

## Working rules for agents
- Branch off `main`, push the branch, don't open a PR unless asked.
- Don't commit `Library/`, builds, or APKs (see `.gitignore`).
- Storyboard changes are design changes: edit `docs/storyboard-v4.html`, re-render the PNG, and note the reason in `docs/design-notes.md`.
- When something can't be verified here (no headset, no Unity), say so plainly in the handoff instead of claiming it works.

## State as of 2026-11-05
- Done: PRD, storyboard v4.1, three look tests, Unity skeleton with 13 starter scripts (not yet compiled in Unity; expect small fixes). `PaintSurface`/`ZenBrush` currently stamp a signed height field; for Option A the same RT holds intensity and the shader does a palette lookup instead of relief. Symmetry is not yet in `ZenBrush`; add it as a wrapper around `PlaceUnit` (see `symmetric()` in `docs/lookdev-symmetry.html`).
- Open: art direction A vs B. Owner decides.
- Next: open the project locally, install Meta SDK, make the first scene, get `JellyPoke` and `ZenBrush` with symmetry working on device with a ready cup.
- Not started: capture pipeline (Sentis model, mask → `SilhouetteInflator`), My Space scene art, sounds.
