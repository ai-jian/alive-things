# Alive Things, PRD

Status: v1.2, 2026-11-06 (sections 3, 5, 6, 7 rewritten to match the WebXR build after an outside critique). Owner: ai-jian. Target: Meta VR Start Developer Competition 2026. Official rules read (Devpost PDF, Nov 4 capture): see section 12.

## 1. One line
Pick up a cup. Be quiet for ten minutes. It comes alive.
拿起一个杯子，安静十分钟，它活了。

## 2. Goals
- G1. A two-minute demo that makes a judge feel calm, then smile. The build must do everything the video shows.
- G2. Fully usable with hands only, end to end. No controllers, no menus.
- G3. Anyone can make something beautiful in five minutes without knowing how to draw.
- G4. The creatures feel alive without the player: they wander, nap, meet, whisper.

## 3. Non-goals (v1)
- Sharing, multiplayer, accounts. (Saving on the device is in: see F16.)
- Real 3D scanning. A soft inflated silhouette is the product, not a limitation.
- Music or melodies. Ambient hum, ticks and wordless whispers only.
- A quest or progression system. Light prompts from the plant guide at most.

## 4. Who it's for
Someone at the end of a long day who wants ten quiet minutes with their hands busy and their mind empty. Also: anyone watching the video.

## 5. Core loop (as built, WebXR)
1. **Take.** In passthrough, the first card asks you to trace around a real cup on your desk: pinch the air, hold, draw its outline (any plane; a flat loop around it on the desk works too). The loop becomes a soft copy at real size and place, coloured from the camera. If nothing is traced in 45 s (or two traces fail), a ready cup appears on the detected table.
2. **Focus.** Pinch it: it grows in your hand. Let go: it floats to you, about 26 cm tall, 45 cm ahead. The room dims at the edges only; the object, your hands and the space between stay clear.
3. **Draw.** One fingertip on the surface: lines and dots through the 2 × 6 × mirror guide, ink blooms when you hold still, long-press moves the centre, a two-finger twist changes the fold. Strokes are a tint of the object's own gradient.
4. **Quiet.** It breathes, a little more as it gets ready. The first one needs about three minutes of quiet company (frantic scribbling does not count); later ones about two. A soft chime says it is ready.
5. **Set down.** Pinch it and lower it: it lands on the table where you lowered it, asleep. Pick it up again to keep drawing. Once ready, a tap wakes it, or it wakes by itself a few seconds after you set it down: face, arms, feet, a two-word personality from how you drew.
6. **Keep.** A disc appears beside it; set it there and a small floating island opens above the table with it on board (god view). Pull the island apart with both hands to go in at creature height; push your hands together to come back. They wander, nap, meet, whisper; friendships form.
7. **Come back.** The island remembers: positions, friendships, its age. It grows over ten minutes of your company (flowers, mushrooms, a few words from the plant) and adds a flower for each day you return. While you are away they move, nap and make friends.

## 6. Features and status

| ID | Feature | Pri | Status (Nov 6) |
|---|---|---|---|
| F1 | Passthrough + hand tracking, objects on the detected table | P0 | Built. Objects rest pinned to the table plane; table search continues all session; spots clamped inside the table and within reach. Device check pending. |
| F2 | Ready-object fallback | P0 | Built as one ready cup (four reference palettes in turn), shown after 45 s without a trace or after two failed traces. |
| F3 | Pinch → studio (grows, floats to you) | P0 | Built (`studio-system.js`). Replaced the hold-and-pull gesture. |
| F4 | Zen brush with symmetry guide | P0 | Built: 2 × 6 × mirror, line and dot, width from slowness and press, dwell blooms, long-press centre, twist fold, ticks (rate-limited). Fingertip smoothed; touch has enter/leave distances; short contact loss does not break a line. No haptics (hands only). |
| F5 | Whole-body gradient surface | P0 | Built, palettes from `docs/lookdev-gradient.html`. |
| F6 | Flat palm softens | P1 | **Not built.** |
| F7 | Wake: traits from strokes, face, feet, arms, tag | P0 | Built. Traits from speed, pauses, dots, turns, coverage, centre and fold changes; words chosen by what stands out from a typical session. Googly-eye faces with moods (`face.js`). |
| F8 | My Space: floating island | P0 | Built (`space.js`): mini island over the table, two-hand scale to go in, dusk sky with the room faintly visible at the edges. |
| F9 | Creature brain | P0 | Built: idle, wander, approach, whisper, nap, look; poke reactions. At most six live at once; older ones sleep. |
| F10 | Whispers + chirps | P1 | Built: spatial wordless voices in turns, cards in the creature's palette. |
| F11 | Affinity and following | P1 | Affinity built and saved; following not built. |
| F12 | Plant guide, three-creature party | P2 | Built. |
| F13 | Real object capture (trace + camera colour) | P1 | Built; first step on a headset. Camera colour unverified on device. |
| F14 | Hidden blank newcomer | P2 | Built: hides under the island rim from above, behind its hill inside; gaze measured against its size; slow hands send it back, quick hands startle it still; a pinch catches it. |
| F15 | Sound: hum, ticks, chirps | P1 | Built. |
| F16 | Saving and coming back | P0 | Built: small creature list, paint as PNG once per creature, island memory (age, days, last seen), quota failures reported by the plant. |

## 7. Technical constraints
- Meta Quest 3 / 3S browser, WebXR via Meta's Immersive Web SDK (three.js). Unity in `unity/` is a dormant port target.
- Rules: at least 60 fps (aim for 72). Paint work is tiled: diffusion only on wet tiles at ~20 Hz, texture uploads only for changed rectangles.
- Hands only. Everything is a pinch, a touch, or a two-hand pull.

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
