# Art direction: DECIDED (Nov 5, owner)

**Option A, whole-body gradient.** Palette comes from the object's own colour, the player never picks a colour. Guide 2 × 6 × mirror. Two marks. All controls are gestures. Live proof: `docs/lookdev-gradient.html`. Option B (carved relief) is archived below for reference only; its shader include was removed from the Unity project.

## What is already agreed (independent of the option)
- Drawing is for people who can't draw. The system guarantees the result looks good; the user supplies path and rhythm.
- **Radial symmetry guide**, like Procreate's drawing guide: one stroke becomes N mirrored strokes (N = 4, 6, 8, 12), optionally mirrored across the axis too. This is the thing that makes zen doodling feel good and it closes any stroke into a pleasing whole. On a 3D object it can sit on the front as a mandala (centre placed by touch) or wrap around the object's axis.
- Six pattern units picked by the motion itself (tap, straight, wavy, circle, flick, scrub).
- Strokes snap gently toward the object's flow lines. Slow strokes count more.
- No eraser. A flat palm is water (softens / smooths).
- No outlines anywhere. World is flat gouache cut-outs (Pola, Utanomori references). Glow lives in the world (fireflies, light pools), not in a brush.
- Hands only. No menus.

## Option A: bleed + palette (DECIDED)
References: the ZZAi figure video (blue → green → pink → peach gradients, soft bleeding, mirrored patterns, black ground), the pastel pointillist trees, the 烛吉 glowing objects.
- The user paints **intensity**, not colour. Fresh strokes bleed outward like wet ink for a second or two.
- A palette gradient maps intensity to colour: thin = deep, layered = hot and light. Palettes are curated (four to six). Nothing the user does can clash.
- Painted areas glow softly in My Space. Clay underneath stays soft-lit.
- Live proofs: `docs/lookdev-symmetry.html` (first pass: strokes only, six patterns) and `docs/lookdev-gradient.html` (second pass, owner's notes applied: the whole body is gradient-mapped, strokes push up the same gradient; one composite guide = N around the axis × M mandala × mirror, so a front stroke also lands on the back; marks cut to two, a line and a dot, because six patterns were indistinguishable at object scale; no bands, no specular, flat Monument Valley quiet).
- Owner's taste note (Nov 5): less is more, Monument Valley. Flat, pastel, clean silhouettes, soft gradients, nothing noisy.
- **Decided Nov 5 (owner):** whole-body gradient is better than strokes-only. Guide default is 2 around × 6 mandala × mirror. Stroke width must vary naturally (slow/deep = thick, fast = thin, tapered ends). No pattern menu: every former option is a gesture or is gone.
- **Gesture map (third pass, `docs/lookdev-gradient.html`):** fingertip drag = line (width from speed, press depth, taper in); tap = dot; hold still while touching = ink pools and blooms; press-and-hold 0.9 s with the fingertip still (under 4 mm of travel) = set mandala centre; travelling on afterwards turns it into a stroke; two fingertips twist = fold 4/6/8/12 (spokes flash); flat palm = water; turn the holding hand = look; open the holding hand = done. Base direction fixed (deep at the bottom). Bleed amount = dwell time. Palette: **decided**, auto from the object's dominant colour (`Paint/PaletteFromObject.cs`), no picking.
- Unity path (in the repo): `Paint/PaintSurface.cs` (intensity + wet RTs, `Shaders/Stamp.shader`, `Shaders/Diffuse.shader`), `Paint/ZenBrush.cs` (guide, width, dwell, long press, twist, palm water), `Paint/PaletteFromObject.cs` (dominant colour → six stops), `Shaders/GradientSurface.hlsl` (Shader Graph custom function).

## Option B: carved relief, 3渲2 (archived, not chosen)
- The user carves height instead of colour; a three-band toon ramp and relief normals let the light draw the pattern; one clay colour per creature, optional glaze in grooves.
- Live proof: `docs/lookdev-relief.html`.
- Unity path: removed. The three.js proof `docs/lookdev-relief.html` stays as a record.

## Not either/or
Both options read the same input (a scalar field painted with the same symmetric brush). A could use the field as colour and B as height; a mix (colour bleed + a little relief) is possible later. Decide the look first, then the mix.

## Kill list (agreed)
- Flat pink/blue/yellow colour strokes picked by the user
- "Everything white"
- Outlines
- Neon as a brush
