// Alive Things, WebXR build. v0.2: landing card, in-XR hints, emulator baked into the page.
import { World, SessionMode, ReferenceSpaceType, OneHandGrabbable } from '@iwsdk/core';
import { Color } from 'three';
import { makeCup } from './cup.js';
import { makeBrushSystem } from './brush-system.js';
import { makePlacementSystem } from './place-on-table.js';
import { makeHintSystem } from './hints.js';
import { makeStudioSystem } from './studio-system.js';
import { PALETTE_ORDER, namedPalette } from './palette.js';
import { Hands } from './hands.js';
import { Sound } from './audio.js';
import { makeSpaceSystem } from './space.js';
import { makeTraceSystem } from './trace.js';

const world = await World.create(document.getElementById('app'), {
  xr: {
    sessionMode: SessionMode.ImmersiveAR,
    referenceSpace: { type: ReferenceSpaceType.LocalFloor },
    features: { handTracking: { required: true }, planeDetection: true, anchors: true, hitTest: true },
    offer: 'always',
  },
  features: {
    grabbing: { useHandPinchForGrab: true },
    sceneUnderstanding: true,
    camera: /OculusBrowser/i.test(navigator.userAgent),   // headset passthrough camera for the palette; never the desktop webcam
    locomotion: false,
    spatialUI: false,
  },
});

// What the player has done so far. The hint card advances on these; traits will read them later.
const events = { strokes: 0, dwell: false, grabbed: false, centreSet: false, foldChanged: false, focused: false, studioFloat: false, awake: false, traced: false, inSpace: false, newcomerCaught: false };
const hands = new Hands(world);
const sound = new Sound();

// The active object on the table. Its palette comes from its own colour; the player never picks.
const active = { cup: null, entity: null };
let paletteIndex = 0;
function spawnCup() {
  const cup = makeCup({ palette: PALETTE_ORDER[paletteIndex++ % PALETTE_ORDER.length], heightMetres: 0.09 });
  cup.group.position.set(0, 1.4, -0.6);
  const entity = world.createTransformEntity(cup.group);
  entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
  cup.entity = entity; active.cup = cup; active.entity = entity;
  events.strokes = 0; events.dwell = false; events.focused = false; events.awake = false; events.grabbed = false; events.studioFloat = false;
  const b = world.getSystem(BrushSystem); if (b) b.resetStats();
  return cup;
}

const PlacementSystem = makePlacementSystem(active);
world.registerSystem(PlacementSystem);
const BrushSystem = makeBrushSystem(active, events, hands, sound);
world.registerSystem(BrushSystem);
const StudioSystem = makeStudioSystem(active, hands, sound, events, () => world.getSystem(BrushSystem).summary(), () => { const p = world.getSystem(PlacementSystem); return p && p.spot ? p.spot.y : null; });
world.registerSystem(StudioSystem);
world.registerSystem(makeHintSystem(active, events));
const SpaceSystem = makeSpaceSystem(world, hands, sound, events, () => active.cup);
world.registerSystem(SpaceSystem);
world.getSystem(SpaceSystem).onAdopted = () => { spawnCup(); };   // a fresh object waits on the table when you come back
// the shy newcomer, once caught, comes home with you: it becomes the next blank canvas on the table
world.getSystem(SpaceSystem).onNewcomer = (nc) => {
  const space = world.getSystem(SpaceSystem); space.leave();
  const old = active.cup;
  if (old && old !== nc && !old.creature && old.entity && old.paint.coverage < 0.01) { try { old.entity.dispose({ disposeResources: true }); } catch (e) {} }
  // it keeps its own small shape; on arrival it gets a real palette and the normal light
  nc.uniforms.uPal.value = namedPalette(PALETTE_ORDER[paletteIndex++ % PALETTE_ORDER.length]);
  nc.uniforms.uBaseLo.value = 0.10; nc.uniforms.uBaseHi.value = 0.55; nc.uniforms.uShade.value = 0.16; nc.uniforms.uUnder.value = 0; nc.setGlow(0);
  nc.group.rotation.set(0, 0, 0); nc.group.position.set(0, 1.4, -0.6); nc.group.visible = true; nc.spawnT = 0;
  const entity = world.createTransformEntity(nc.group);
  entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
  nc.entity = entity; active.cup = nc; active.entity = entity;
  events.strokes = 0; events.dwell = false; events.focused = false; events.awake = false; events.grabbed = false; events.studioFloat = false;
  const b = world.getSystem(BrushSystem); if (b) b.resetStats();
};
// capture: a traced loop becomes the active thing; an untouched cup on the table makes way for it
world.registerSystem(makeTraceSystem(world, active, hands, sound, events, (thing, entity) => {
  const old = active.cup;
  if (old && !old.creature && old.entity && old.paint.coverage < 0.01) { try { old.entity.dispose({ disposeResources: true }); } catch (e) {} }
  active.cup = thing; active.entity = entity;
  events.strokes = 0; events.dwell = false; events.focused = false; events.awake = false; events.grabbed = false; events.studioFloat = false;
  const b = world.getSystem(BrushSystem); if (b) b.resetStats();
}));
spawnCup();

// Passthrough in AR: no world background. Outside XR the landing shows the live garden.
world.scene.background = null;
world.renderer.setClearColor(0x1d2140, 1);
const space = world.getSystem(SpaceSystem);
if (!world.renderer.xr.isPresenting) space.showcase();

// ---- landing card and session lifecycle ----
const landing = document.getElementById('landing');
const enter = document.getElementById('enter');
const note = document.getElementById('note');
const reenter = document.getElementById('reenter');

let arSupported = false;
try { arSupported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { arSupported = false; }
if (!arSupported) {
  enter.disabled = true; enter.textContent = 'WebXR not available here';
  note.innerHTML = 'Open this page in the <b>Meta Quest browser</b>.';
}
enter.addEventListener('click', () => { sound.resume(); world.launchXR(); });
reenter.addEventListener('click', () => { sound.resume(); world.launchXR(); });

world.renderer.xr.addEventListener('sessionstart', () => {
  world.renderer.setClearColor(0x000000, 0);
  space.clearShowcase();
  landing.classList.add('hidden'); reenter.style.display = 'none';
});
world.renderer.xr.addEventListener('sessionend', () => {
  world.renderer.setClearColor(0x1d2140, 1);
  reenter.style.display = 'block'; landing.classList.remove('hidden');
  setTimeout(() => space.showcase(), 300);
});

window.alive = { world, active, events, hands, sound, get cup() { return active.cup; }, get brush() { return world.getSystem(BrushSystem); }, get space() { return world.getSystem(SpaceSystem); } };
