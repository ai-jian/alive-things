# Alive Things

A hands-only mixed reality app for Meta Quest 3.
Pick up a cup. Be quiet for ten minutes. It comes alive.
拿起一个杯子，安静十分钟，它活了。

Entry for the Meta VR Start Developer Competition 2026.

## What it is
- **Room.** Reach for a real object on your desk. It glows. A soft copy lifts out into your hand, still looking like your cup.
- **Focus.** Hold it in one hand, pull with the other. The room fades to a warm dark fog. Draw on it slowly. The brush makes the patterns, you make the rhythm. No eraser, only water.
- **My Space.** Let go, it wakes with a personality grown from how you drew. Set it down in a dark painted garden where it wanders, naps, and whispers to the others in the patterns you gave it.

## Repo layout
```
docs/
  storyboard-v4.html / .png   the 2-minute demo video, shot by shot (this is the task list)
  lookdev.html                live 3D look test (three.js): lit cup, jelly poke, paint, My Space light
  design-notes.md             decisions, technical path, build order
unity/
  Packages/manifest.json      URP, XR Management, Oculus XR plugin, Input System, Sentis
  Assets/AliveThings/
    Scripts/Creature/         CreatureTraits, CreatureBrain (needs-based free will), CreatureBody, WhisperBubble
    Scripts/Interaction/      HandInput (one adapter for hand tracking), HoldAndOpenGesture, JellyPoke
    Scripts/Paint/            PaintSurface (decal RT), ZenBrush (patterns from motion, flow snapping)
    Scripts/Capture/          SilhouetteInflator (mask → puffy mesh)
    Scripts/World/            FocusMode, MySpace
    Shaders/JellyDeform.hlsl  vertex deformation for a Shader Graph Custom Function node
```

## Setting up the Unity project
1. Unity 2022.3 LTS (project says 2022.3.50f1; any 2022.3.x is fine). Android build support.
2. Open `unity/`. Packages in the manifest install automatically.
3. Install **Meta XR All-in-One SDK** from the Asset Store through Package Manager → My Assets. That brings Core (passthrough, hands, Passthrough Camera API, Depth API) and Interaction SDK.
4. Project Settings → XR Plug-in Management → Android → tick Oculus. Meta XR → Project Setup Tool → Fix All.
5. Subclass `Interaction/HandInput.cs` with OVRHand/OVRSkeleton data (one small adapter). Until then `MouseHandInput` lets everything run in the editor with a mouse.
6. Make a URP Lit Shader Graph, add a Custom Function node pointing at `Shaders/JellyDeform.hlsl`, expose `_PokePos`, `_PokeAmt`, `_Wobble`, and a `_PaintTex` blended over the base map.

## Order of work
See the bottom of `docs/design-notes.md`. The storyboard is the scope: if a feature is not in a shot, it is not built yet.

## Look test
Open `docs/lookdev.html` in a browser (it loads three.js from cdnjs). Drag to orbit, tap to poke, paint, switch to My Space.
