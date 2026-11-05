# Alive Things, PRD

Status: v1.1, 2026-11-05. Owner: ai-jian. Target: Meta VR Start Developer Competition 2026. Official rules read (Devpost PDF, Nov 4 capture): see section 12.

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
- Track: Productivity ("creative tools, habits tied to a recurring context such as wind-down") vs Entertainment. Owner decides; see section 12.
- (resolved) Palette comes from the photo's dominant colour; no user pick.
- Does Focus Mode dim passthrough via OVRPassthroughLayer colour controls or a fog quad? Test both on device.

## 12. Official rules, the parts that bind us (Devpost, read Nov 5)
- **Deadline: November 18, 2026, 12:00 PM Pacific** (2:00 PM Central). Judging to ~Dec 9, winners ~Dec 11.
- Entrant must be a **Meta VR Start Program member** with a Meta developer account (Developer Access on). One entry per person.
- **Division: New Experience** = conceived and built within the window starting Sept 24, 2026. No pre-existing codebase. (We started Nov 5. Fine.)
- **Tracks:** Entertainment, Gaming, Productivity. Hands-first is mandatory. Productivity explicitly lists "creative tools, or habits tied to a recurring context (morning routine, commute, wind-down)". Prizes: Gaming/Entertainment $100k + $50k runner-up; Productivity $70k + $35k.
- **Special awards ($25k each)** that fit us: Best First Five Minutes, Best Reason to Come Back, Boldest Original Concept. Judge's Choice ×2 ($20k).
- **Submission formats:** native engines → APK in a "Competition" release channel on the Meta developer dashboard. **IWSDK / WebXR → a link** (GitHub Pages or any host). WebXR is explicitly allowed.
- **Video:** under 3 minutes, real gameplay on a Quest or XR simulator, YouTube/Vimeo, English or English subtitles. "Don't lean on AI-generated video."
- **Guidelines (judged):** seated-optimized, every interaction inside a **2 ft radius**; fast cold start, satisfying in **≤10 minutes**; original, not a wrapper.
- **Judging, 4 × 25%:** Innovation & Creativity (leverage device capabilities: spatial depth, hands, gaze, passthrough, scene understanding, persistent anchors). Experience Design (seated, hands-first, habit-forming; **passthrough must be purposeful**, the real room must change the experience; FoV-aware, works on narrower-FoV glasses). Technical (min **60 fps**, bug-free; for passthrough, **scene understanding: anchor content to detected planes/surfaces**, hold up in untested rooms). Polish & Presentation (art direction, sound, honest video).
- Permitted tools: anything public or available to Start members. Must comply with Meta content guidelines; 10+ rating.
- Entry must stay available free of charge until winners are announced.

### What this changes for us
- **Platform: WebXR via IWSDK is a legitimate primary path.** It can be built and deployed from the cloud session and tested on a Quest browser via a link. Unity stays as the fallback/port target.
- **The cup must sit on the real detected table** (plane detection). The room is not a backdrop; the object comes from it and returns to it.
- **Seated, 2 ft:** everything happens at the desk. Hide-and-seek is formally dead.
- **10 minutes, fast start:** no onboarding wall. First creature in under two minutes.
- **Come back:** My Space must visibly grow; creatures remember. Persist locally.
- **Video ≤ 3 min:** storyboard is 2:00. Good.
- **Track recommendation:** Productivity (wind-down creative tool, habit). Less crowded than Gaming, and the brief literally describes us. Entertainment is the alternative. Owner decides.
