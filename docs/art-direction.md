# Art direction: carved clay, 3渲2

Decided 2026-11-05. Supersedes the "paint colour on the photo" direction in design-notes.

## The idea in one line
You don't colour the object. You carve it. The light does the colouring.

## Why
- Flat colour strokes looked like a kid's app and put taste in the user's hands. Carving removes colour from the user entirely. Nothing the user does can look ugly, because the only things that change are height and light.
- Turning the object in your hands becomes the way you look at your own work: the relief only reads as the light slides over it. That makes the "hold and turn" gesture meaningful.
- It matches the quiet, wabi-sabi, zen-doodle intent: celadon incised patterns, Wedgwood jasperware, Japanese kogo boxes.

## The look
- **Creature:** one clay colour per creature (cream, celadon, indigo, terracotta, a few more). Three-band toon ramp (shadow, mid, light) with soft edges, one hard specular dot, a cool rim light on the shadow side. Grooves darken, ridges lighten (cheap height occlusion). Optional "glaze": a second colour pools only in the grooves.
- **Captured objects:** the photo becomes the clay colour (dominant colour, lightly desaturated) and a very light posterised tint, not a full texture. The object still reads as "your cup" by its shape, handle, proportions, and tone.
- **World:** flat gouache cut-outs, no outlines, slight hand-cut wobble. Room is passthrough. Focus is warm dark fog with a single pool of light. My Space is painted navy with warm light pools, fireflies, soft hills.
- **Patterns (relief, picked by motion):** tap = dimple, straight = ridge, wavy = fish scale, circle = swirl groove, flick = leaf with a vein, scrub = weave. Slow strokes carve deeper.
- **Water gesture:** a flat palm smooths the relief like wet clay. Never erases.

## Rendering recipe (Unity, URP)
1. Height map: half-float RenderTexture, 0 = flat, signed. `Paint/PaintSurface.cs` stamps kernels with additive blending; `Smooth()` blurs a disc.
2. Vertex displacement from the height map along the normal (0.003 m to start). Capture meshes are dense; ready-made objects are subdivided.
3. Normal from height gradient, blended into the mesh normal: `HeightToNormal` in `Shaders/ToonRelief.hlsl`.
4. Lighting: `ToonRelief` in the same file. One directional light direction (the focus spotlight in Focus Mode, the pool light in My Space).
5. Jelly deformation still runs in the vertex stage: `Shaders/JellyDeform.hlsl`.
6. Face, feet, handle: URP toon ramp material with the same clay colour.

## Proof
`docs/lookdev-relief.html` is a live three.js version of this recipe: carve by dragging, four clays, glaze toggle, moving light, room vs My Space. Open it in any browser.

## Kill list
- Pink/blue/yellow colour brushes (gone)
- "Everything white" (gone earlier)
- Outlines on anything
- Neon as a brush (glow stays in the world: fireflies, pools)
