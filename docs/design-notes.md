# Alive Things, design notes

Decisions made so far, so we don't re-argue them. Dates are 2026.

## One line
Pick up a cup. Be quiet for ten minutes. It comes alive.
拿起一个杯子，安静十分钟，它活了。

## The three pillars (one per act of the demo video)
1. **Room.** A real object from your desk becomes yours. Passthrough, hands, one photo, an inflated soft copy that keeps the object's look.
2. **Focus.** The room fades, you draw on it slowly. Anyone can draw: the brush makes the patterns, you make the rhythm. Zen doodle, wabi-sabi, no eraser.
3. **My Space.** A dark painted garden where creatures live without you. Needs-based free will, whispers made of their own patterns, friendships.

## Decisions
- **Core loop is the living garden, not a quest.** Hide-and-seek was considered (Nov 5) and demoted to one peeking newcomer in the corner. Reason: a quest leans on music and is linear; the garden is open, emergent, and cheap.
- **Capture is the entry, not a dependency.** A shelf of ready blank objects (cup, bowl, lamp, book, plant) is always present so the demo never dies on bad lighting.
- **Creature surface look: decided (Nov 5).** Whole-body gradient, palette from the object's own colour, no picking. See art-direction.md.
- **Art direction: gouache cut-outs.** Flat colour blobs, no outlines, slight hand-cut wobble. References: Pola Mother's Day (flat flowers), Utanomori (painted navy forest, warm accents). Glow is for the world (fireflies, light pools), not for brushes.
- **Brush = radial symmetry + motion-picked patterns.** (Nov 5.) The Procreate drawing-guide trick: one stroke becomes N mirrored strokes, so anything closes into a pleasing whole. Six patterns picked by the motion itself (tap, straight, wavy, circle, flick, scrub). Strokes snap toward the surface's flow lines. Slow strokes count more. A tick and a light haptic per unit. A flat palm is water: it softens, never erases. Owner confirmed (Nov 5): whole-body gradient (A) reads best; guide default 2 × 6 × mirror; natural stroke width; no pattern menu, all options as gestures.
- **Personality comes from how you painted.** Not random. Slow and dotted → quiet, shy. Loops and speed → playful. Coverage → chatty.
- **Sound is garnish, not structure.** One ambient hum, Animalese-style syllables pitched by personality, a tick per brush unit. No melodies, no soundtrack dependency.
- **Hands only.** Everything is a pinch, a pull, or a palm. No menus. Required by the competition.

## Technical path for "real object → thing in your hand"
1. Pinch near the object → Passthrough Camera API grabs one frame + pinch world position.
2. Segment: MobileSAM/EfficientSAM via Unity Sentis with the pinch point as the prompt. Backup: depth threshold from Depth API. Backup of the backup: GrabCut.
3. Inflate the mask (Capture/SilhouetteInflator.cs): distance-to-edge → height, front and back sheets, rim stitched.
4. Dominant photo colour → clay colour; height RT for carving (Paint/PaintSurface.cs); ToonRelief shader.
5. Scale from pinch depth and mask width; spawn at the real object, float to the palm.
6. Interaction SDK grab; JellyPoke for touch; HoldAndOpenGesture for Focus Mode.

## Competition facts (verify on Devpost)
- Meta VR Start Developer Competition 2026. Entries must be fully usable with hands, end to end.
- Reported deadline: November 18, 2026. Prize pool $1M, 20 prizes up to $100K.
- Deliverables: build + video. The video decides what gets built; the build must do what the video shows.

## Build order (two weeks)
1. Hands + passthrough + one ready cup with JellyPoke (days 1–3)
2. HoldAndOpen → FocusMode, ZenBrush with 2 relief patterns + ToonRelief shader on device (days 4–6)
3. Wake animation, traits from strokes, My Space scene with light pools (days 7–9)
4. CreatureBrain, whispers, second creature (days 10–11)
5. Capture pipeline, with the shelf fallback already in (days 12–13)
6. Sound, lighting polish, shoot the video (last days)
