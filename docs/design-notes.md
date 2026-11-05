# Alive Things, design notes

Decisions made so far, so we don't re-argue them. Dates are 2026.

## One line
Pick up a cup. Be quiet for ten minutes. It comes alive.
拿起一个杯子，安静十分钟，它活了。

## The three pillars (one per act of the demo video)
1. **Room.** A real object from your desk becomes yours. It notices your hand before you touch it. Pinch it (or trace around anything) and it is yours.
2. **Studio.** Let go and it floats up in front of you, big, while the room fades. You draw on it slowly. Anyone can draw: the brush makes the patterns, you make the rhythm. Set it down and it shrinks back and wakes.
3. **My Space.** A dark painted garden where creatures live without you. Needs-based free will, whispers in a wordless language, friendships.

## Decisions
- **Core loop is the living garden, not a quest.** Hide-and-seek was considered (Nov 5) and demoted to one peeking newcomer in the corner. Reason: a quest leans on music and is linear; the garden is open, emergent, and cheap.
- **Capture is the entry, not a dependency.** A shelf of ready blank objects (cup, bowl, lamp, book, plant) is always present so the demo never dies on bad lighting.
- **Creature surface look: decided (Nov 5).** Whole-body gradient, palette from the object's own colour, no picking. See art-direction.md.
- **Art direction: gouache cut-outs.** Flat colour blobs, no outlines, slight hand-cut wobble. References: Pola Mother's Day (flat flowers), Utanomori (painted navy forest, warm accents). Glow is for the world (fireflies, light pools), not for brushes.
- **Brush = radial symmetry + motion-picked patterns.** (Nov 5.) The Procreate drawing-guide trick: one stroke becomes N mirrored strokes, so anything closes into a pleasing whole. Six patterns picked by the motion itself (tap, straight, wavy, circle, flick, scrub). Strokes snap toward the surface's flow lines. Slow strokes count more. A tick and a light haptic per unit. A flat palm is water: it softens, never erases. Owner confirmed (Nov 5): whole-body gradient (A) reads best; guide default 2 × 6 × mirror; natural stroke width; no pattern menu, all options as gestures.
- **Personality comes from how you painted.** Not random. Slow and dotted → quiet, shy. Loops and speed → playful. Coverage → chatty.
- **Sound is garnish, not structure.** One ambient hum, Animalese-style syllables pitched by personality, a tick per brush unit. No melodies, no soundtrack dependency.
- **Hands only.** Everything is a pinch, a pull, or a palm. No menus. Required by the competition.

## Nov 6: the studio flow replaces Focus Mode (owner)
- Reason, in the owner's words: the object should come to you and become a big canvas in front of you, so there is a size contrast and parallax; painting a tiny object at arm's length has no visual kick, and the old two-hand gesture made the player do all the work with no reaction from the object.
- New flow: pinch → it grows in the hand → let go → floats to an anchor 42 cm ahead at about 30 cm tall, fog + hum, slow turntable paused by touch → pinch and lower below chest height → shrinks, lands, wakes. One pinch does everything.
- Objects react before touch: glow, turn toward the hand, lean.
- Landing page: no illustration (it read as machine-made); the page shows the live garden with the player's creatures or a painted demo cup.
- Colours: the four palettes from the gradient look test, verbatim. Captured colours use the same deep-to-light ramp with a saturation floor.
- Traced loops are resampled and rounded (Chaikin ×2) so a shaky finger still gives a clean silhouette.
- Whispers became a spatial wordless language with call and response; arms grow from the object's sides.
- Storyboard v5 documents the shots; v4 is history.

## Nov 6, late: the garden becomes a floating island (owner)
- Reason, in the owner's words: start from a god view, see from far away that small creatures are playing and chatting on it; hold the floating island, scale it up with a gesture, and go inside at the creatures' own size to explore. Reference: a Softfield-style soft island (lavender to dusk, glowing orb, magenta mushroom tree, soft blobs and reeds).
- Built: mini island (36%) hovering over the door disc; one hand moves, two hands scale and turn; past 2.4× it animates to 6× with the eye at creature height and a dusk sky dome; push hands together below 3× to come out. Inside, one-hand pinch drags the world.
- Same seated 2 ft rule: nothing asks you to walk; you move the world, not yourself.
- A pinch on or near the island never starts a trace; both hands pinching cancels a pending trace.

## Nov 6, late: faces after the owner's reference sheet
- Owner sent a sheet of soft gradient blobs with big white googly eyes. Faces now follow it: two white eyes with a round black pupil and a catch-light, a soft shadow instead of an outline, no mouth at rest, no cheeks.
- Pupils dart and hold (saccades) toward you or toward whoever they are talking to; curious ones glance away on their own, shy ones look down.
- Moods: open, wide (startled, small o mouth, three marks above the head), happy ^ ^ (waking, a good talk, the party, a playful one being touched), content ‿ ‿ (napping), cross (slanted lids), and a resting lid that comes from how sleepy you drew it.
- Touching a creature on the island with a fingertip now gets a reaction by personality.

## Nov 6, late: fixes after an outside critique (owner agreed with all points)
Owner decisions (asked, not assumed):
- **Ten minutes stays.** The first creature needs about three minutes of quiet company; the island grows across ten minutes (flowers, mushrooms, a line from the plant at 3, 8 and 10 minutes) and a flower per day you return.
- **Real object first.** The first card asks you to trace a real cup on your desk; the ready cup is the fallback after 45 s.
- **Passthrough stays visible.** The studio fog became a vignette clear along the line to the object (your real hands stay visible); inside the island the sky thins near and below the horizon.
- **Setting down is not waking.** Lowering lands it asleep; you can pick it up and keep drawing; a ready one wakes on a tap or by itself shortly after.
Engineering fixes: tiled paint (wet tiles only, partial uploads, a lookup table for the stamps), smoothed fingertip with touch hysteresis and stroke bridging, rate-limited ticks; saving as a small list plus one PNG per creature with quota reporting; six lively creatures at most; personalities from more signals and judged against a typical session; table search all session, spots clamped onto the table and within reach, resting objects pinned to the plane; trace projected on the plane you drew in and flat loops as footprints; camera at session start and no random colours; old objects stay on the table and can be picked up again; the newcomer hides under the rim from above, gaze measured against its size, quick vs slow hands; hints wait for required steps.

## Technical path for "real object → thing in your hand"
1. Pinch near the object → Passthrough Camera API grabs one frame + pinch world position.
2. Segment: MobileSAM/EfficientSAM via Unity Sentis with the pinch point as the prompt. Backup: depth threshold from Depth API. Backup of the backup: GrabCut.
3. Inflate the mask (Capture/SilhouetteInflator.cs): distance-to-edge → height, front and back sheets, rim stitched.
4. Dominant photo colour → clay colour; height RT for carving (Paint/PaintSurface.cs); ToonRelief shader.
5. Scale from pinch depth and mask width; spawn at the real object, float to the palm.
6. Interaction SDK grab; JellyPoke for touch; HoldAndOpenGesture for Focus Mode.

## Competition facts (official rules read Nov 5, full list in PRD §12)
- Deadline Nov 18, 2026 12:00 PM PT. Hands-first mandatory. Seated, 2 ft radius. 60 fps. ≤10 min sessions. Video ≤3 min, English subtitles.
- WebXR (IWSDK) entries submitted as a link. Native as APK on a Competition channel.
- Passthrough must be purposeful and anchored to detected planes.
- **Platform decision:** WebXR primary, Unity secondary. Capture becomes finger-tracing (no camera on the web).

## Build order (two weeks)
1. Hands + passthrough + one ready cup with JellyPoke (days 1–3)
2. HoldAndOpen → FocusMode, ZenBrush with 2 relief patterns + ToonRelief shader on device (days 4–6)
3. Wake animation, traits from strokes, My Space scene with light pools (days 7–9)
4. CreatureBrain, whispers, second creature (days 10–11)
5. Capture pipeline, with the shelf fallback already in (days 12–13)
6. Sound, lighting polish, shoot the video (last days)
