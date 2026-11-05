# Art direction: OPEN, two options on the table

Status 2026-11-05: **not decided.** The owner (ai-jian) decides after seeing both look tests on a real screen. Agents: do not pick one, do not change the storyboard's look, do not remove either option.

## What is already agreed (independent of the option)
- Drawing is for people who can't draw. The system guarantees the result looks good; the user supplies path and rhythm.
- **Radial symmetry guide**, like Procreate's drawing guide: one stroke becomes N mirrored strokes (N = 4, 6, 8, 12), optionally mirrored across the axis too. This is the thing that makes zen doodling feel good and it closes any stroke into a pleasing whole. On a 3D object it can sit on the front as a mandala (centre placed by touch) or wrap around the object's axis.
- Six pattern units picked by the motion itself (tap, straight, wavy, circle, flick, scrub).
- Strokes snap gently toward the object's flow lines. Slow strokes count more.
- No eraser. A flat palm is water (softens / smooths).
- No outlines anywhere. World is flat gouache cut-outs (Pola, Utanomori references). Glow lives in the world (fireflies, light pools), not in a brush.
- Hands only. No menus.

## Option A: bleed + palette (owner's current preference)
References: the ZZAi figure video (blue → green → pink → peach gradients, soft bleeding, mirrored patterns, black ground), the pastel pointillist trees, the 烛吉 glowing objects.
- The user paints **intensity**, not colour. Fresh strokes bleed outward like wet ink for a second or two.
- A palette gradient maps intensity to colour: thin = deep, layered = hot and light. Palettes are curated (four to six). Nothing the user does can clash.
- Painted areas glow softly in My Space. Clay underneath stays soft-lit.
- Live proof: `docs/lookdev-symmetry.html` (symmetry guide, bleed, palettes, patterns).
- Unity path: half-float intensity RT + wetness RT, a small diffusion blit each frame while wet, palette lookup in the shader.

## Option B: carved relief, 3渲2 (agent proposal, kept as an option)
- The user carves height instead of colour; a three-band toon ramp and relief normals let the light draw the pattern; one clay colour per creature, optional glaze in grooves.
- Live proof: `docs/lookdev-relief.html`.
- Unity path: `Shaders/ToonRelief.hlsl`, `Paint/PaintSurface.cs` height mode.

## Not either/or
Both options read the same input (a scalar field painted with the same symmetric brush). A could use the field as colour and B as height; a mix (colour bleed + a little relief) is possible later. Decide the look first, then the mix.

## Kill list (agreed)
- Flat pink/blue/yellow colour strokes picked by the user
- "Everything white"
- Outlines
- Neon as a brush
