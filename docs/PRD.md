# Alive Things, PRD

Status: v1, 2026-11-05. Owner: ai-jian. Target: Meta VR Start Developer Competition 2026 (submission reported as Nov 18, 2026; verify on Devpost).

## 1. One line
Pick up a cup. Be quiet for ten minutes. It comes alive.
拿起一个杯子，安静十分钟，它活了。

## 2. Goals
- G1. A two-minute demo that makes a judge feel calm, then smile. The build must do everything the video shows.
- G2. Fully usable with hands only, end to end. No controllers, no menus.
- G3. Anyone can make something beautiful in five minutes without knowing how to draw.
- G4. The creatures feel alive without the player: they wander, nap, meet, whisper.

## 3. Non-goals (v1)
- Saving between sessions, sharing, multiplayer.
- Real 3D scanning. A soft inflated silhouette is the product, not a limitation.
- Music or melodies. Ambient hum and chirps only.
- A quest or progression system. Light prompts from the plant guide at most.

## 4. Who it's for
Someone at the end of a long day who wants ten quiet minutes with their hands busy and their mind empty. Also: anyone watching the video.

## 5. Core loop
1. **Take.** In passthrough, reach for a real object. It glows. Pinch: a photo is taken, a soft copy lifts out into your hand. (Fallback: a shelf of ready objects.)
2. **Focus.** Hold it in one hand, pull with the other. The room fades to warm dark fog. Only the object is lit.
3. **Carve.** Drag a fingertip slowly. Relief patterns rise along the path, chosen by how you move. Light draws them. A palm smooths. No eraser.
4. **Wake.** Open your hand. It blinks, grows feet, gets a personality derived from how you carved.
5. **Keep.** Place it in My Space, a dark painted garden. It gets a pool of light and starts to live: wander, nap, meet others, whisper in its own patterns, make friends.
6. Repeat with another object. At three, a tiny party.

## 6. Features and priority

| ID | Feature | Pri | Acceptance |
|---|---|---|---|
| F1 | Passthrough + hand tracking | P0 | Hands visible and tracked in passthrough at 72 fps |
| F2 | Ready-object shelf (cup, bowl, lamp, book, plant) | P0 | Pinch-grab any of five objects; they are soft and jelly-poke |
| F3 | Hold-and-open gesture → Focus Mode | P0 | Pull >15 cm with the other hand enters Focus in under 2 s; release exits |
| F4 | Zen brush with symmetry guide | P0 | 2 × 6 × mirror guide; line and dot; width follows slowness, depth and taper; dwell blooms; long-press sets centre; twist changes fold; tick + haptic per stamp |
| F5 | Whole-body gradient surface | P0 | Palette built from the object's colour; strokes push up the same palette; shadow side slides down the palette; no outlines; reads at 72 fps |
| F6 | Water gesture smooths | P1 | Flat palm over a carving softens it within 1 s; nothing is removed |
| F7 | Wake: traits from strokes, blink, feet, tag | P0 | Tag shows two words that change with carving style |
| F8 | My Space scene | P0 | Dark painted garden, light pool per creature, fireflies |
| F9 | Creature brain | P0 | Needs-based states: idle, wander, approach, whisper, nap, follow, flinch |
| F10 | Whisper bubbles from own patterns + chirps | P1 | Bubbles show icons weighted by what was carved; pitch varies by trait |
| F11 | Affinity and following | P1 | After three meetings two creatures follow each other sometimes |
| F12 | Plant guide prompts, three-creature party | P2 | One line at one creature, party at three |
| F13 | Real object capture (photo → mask → inflated mesh) | P1 | Works on a plain desk in daylight for a cup; otherwise falls back to F2 silently |
| F14 | Hidden blank newcomer in a corner | P2 | One creature peeks from the dark edge after five minutes |
| F15 | Sound: hum, ticks, chirps | P1 | No melody assets required |

## 7. Technical constraints
- Meta Quest 3 / 3S, Horizon OS v74+ (Passthrough Camera API), Unity 2022.3 LTS, URP, Meta XR All-in-One SDK + Interaction SDK, Unity Sentis for segmentation.
- 72 fps target. Height maps 1024², half float. Vertex displacement on meshes under ~15k verts each; at most six creatures live.
- Hands only. Everything is a pinch, a pull, or a palm.

## 8. Risks and mitigations
- **Capture fails in bad light / clutter** → shelf fallback is always present; demo video shows one real capture shot, rest can be shelf.
- **Carving doesn't read on headset** → tune bump scale and band thresholds on device first; glaze colour in grooves as a safety net.
- **Gesture classification feels wrong** → manual pattern pick as a hidden fallback (hold two fingers?), tune thresholds with five testers.
- **Creature behaviour feels random** → fewer states done well; lengthen state durations; always face the player sometimes.
- **Time** → the storyboard is the scope. Nothing outside a shot gets built.

## 9. Milestones (two weeks)
1. Days 1–3: F1, F2, jelly poke on device.
2. Days 4–6: F3, F4 with two patterns, F5.
3. Days 7–9: F7, F8, F6.
4. Days 10–11: F9, F10, F11, second creature.
5. Days 12–13: F13 with fallback in place, F15.
6. Last days: lighting, F12, shoot and cut the video.

## 10. Demo video
2:00, three acts: Room (0:00–0:24), Focus (0:24–1:06), My Space (1:06–1:46), Title. Shot list and build notes: `docs/storyboard-v4.html`. Shot 5 (carving) is the heart; shot 10 (garden wide) is the thumbnail.

## 11. Open questions
- Exact Devpost rules: file formats, max video length, whether a store listing is required.
- (resolved) Palette comes from the photo's dominant colour; no user pick.
- Does Focus Mode dim passthrough via OVRPassthroughLayer colour controls or a fog quad? Test both on device.
