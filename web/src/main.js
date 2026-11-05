// Alive Things, WebXR build. v0.2: landing card, in-XR hints, emulator baked into the page.
import { World, SessionMode, ReferenceSpaceType, OneHandGrabbable, Grabbed, createSystem } from '@iwsdk/core';
import { Color, Vector2 } from 'three';
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
import { PaintLayer } from './paint.js';

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
    camera: !!window.REAL_HEADSET,   // headset passthrough camera for the palette; never the desktop webcam
    locomotion: false,
    spatialUI: false,
  },
});

// What the player has done so far. The hint card advances on these; traits will read them later.
const events = { residents: 0, ready: false, landed: false, everWoke: false, tableFound: false, strokes: 0, dwell: false, grabbed: false, centreSet: false, foldChanged: false, focused: false, studioFloat: false, awake: false, traced: false, inSpace: false, newcomerCaught: false, adopted: false, islandOpen: false };
PaintLayer.renderer = world.renderer;   // lets paint send only the changed rectangle to the GPU
const hands = new Hands(world);
const sound = new Sound();

// The active object: the one you pick up, draw on and wake. Its palette comes from its own colour; the player never picks.
// Other objects you started stay on the table, asleep, and become active again when you pick them up.
const active = { cup: null, entity: null };
const waiting = new Set();
// on a headset the real object comes first: trace around something on your desk. The ready cup is the fallback.
const traceFirst = !!window.REAL_HEADSET || /[?&]tracefirst/.test(location.search);
events.traceFirst = traceFirst;
function nextPalette() { const k = (events.paletteIndex = (events.paletteIndex || 0) + 1); return PALETTE_ORDER[(k - 1) % PALETTE_ORDER.length]; }
function resetObjectEvents() { Object.assign(events, { strokes: 0, dwell: false, focused: false, awake: false, grabbed: false, studioFloat: false, ready: false, landed: false }); }
function makeActive(obj, entity) {
  const old = active.cup, brush = world.getSystem(BrushSystem);
  if (old === obj) return;
  if (old && brush) old.brushStats = brush.getStats();
  active.cup = obj; active.entity = entity; waiting.delete(obj);
  resetObjectEvents(); if (obj.creature) events.awake = true;
  if (brush) brush.setStats(obj.brushStats || null);
  if (!old) return;
  // the one you were holding goes back to the table, asleep; an awake one hops onto the island
  if (old.inStudio) { old.group.scale.setScalar(old.homeScale || old.scale || 1); old.group.position.copy(placement.landAt(old.group.position)); old.inStudio = false; old.asleep = true; placement.rest(old); }
  if (old.creature && !old.inSpace) world.getSystem(SpaceSystem).adoptFromRoom(old);
  else if (!old.creature && old.entity) {
    if (old.kind === 'cup' && old.paint.coverage < 0.01 && !(old.quiet > 5)) { try { old.entity.dispose({ disposeResources: true }); } catch (e) {} }
    else waiting.add(old);
  }
}
function spawnCup() {
  const cup = makeCup({ palette: nextPalette(), heightMetres: 0.09 });
  cup.group.position.set(0, 1.4, -0.6);
  const entity = world.createTransformEntity(cup.group);
  entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
  cup.entity = entity; makeActive(cup, entity);
  return cup;
}

const PlacementSystem = makePlacementSystem(active, events);
world.registerSystem(PlacementSystem);
const BrushSystem = makeBrushSystem(active, events, hands, sound);
world.registerSystem(BrushSystem);
const placement = { landAt: (p) => world.getSystem(PlacementSystem).landAt(p), rest: (c) => world.getSystem(PlacementSystem).rest(c), unrest: (c) => world.getSystem(PlacementSystem).unrest(c), get table() { return world.getSystem(PlacementSystem).table; }, get planes() { return world.getSystem(PlacementSystem).planeInfo; } };
const StudioSystem = makeStudioSystem(active, hands, sound, events, () => world.getSystem(BrushSystem).summary(), placement, () => world.getSystem(BrushSystem).scribbling());
world.registerSystem(StudioSystem);
world.registerSystem(makeHintSystem(active, events));
const SpaceSystem = makeSpaceSystem(world, hands, sound, events, () => active.cup);
world.registerSystem(SpaceSystem);
world.getSystem(SpaceSystem).onAdopted = (cup) => { if (cup === active.cup) spawnCup(); };   // a fresh object waits on the table when you come back
// the shy newcomer, once caught, comes home with you: it becomes the next blank canvas on the table
world.getSystem(SpaceSystem).onNewcomer = (nc) => {
  world.getSystem(SpaceSystem).leave();
  // it keeps its own small shape; on arrival it gets a real palette and the normal light
  nc.uniforms.uPal.value = namedPalette(nextPalette());
  nc.uniforms.uBaseLo.value = 0.10; nc.uniforms.uBaseHi.value = 0.55; nc.uniforms.uShade.value = 0.16; nc.uniforms.uUnder.value = 0; nc.setGlow(0);
  nc.group.rotation.set(0, 0, 0); nc.group.position.set(0, 1.4, -0.6); nc.group.visible = true; nc.spawnT = 0; nc.placedOnce = false;
  const entity = world.createTransformEntity(nc.group);
  entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
  nc.entity = entity; makeActive(nc, entity);
};
// capture: a traced loop becomes the active thing
const TraceSystem = makeTraceSystem(world, active, hands, sound, events, (thing, entity) => makeActive(thing, entity));
world.registerSystem(TraceSystem);
world.getSystem(TraceSystem).getTableY = () => { const t = placement.table; return t ? t.y : null; };

// objects waiting on the table: keep their ink settling, and pick one up to make it the active one again.
// On a headset with nothing traced yet, the ready cup appears after a while (or after two traces that did not take).
world.registerSystem(class WaitingSystem extends createSystem({}, {}) {
  init() { this.xrT = 0; }
  update(delta, time) {
    for (const o of waiting) { o.tick(delta, time); if (o.entity && o.entity.hasComponent(Grabbed)) { makeActive(o, o.entity); break; } }
    if (!this.renderer.xr.isPresenting) return; this.xrT += delta;
    if (!active.cup && (this.xrT > 45 || (events.traceFailed || 0) >= 2)) { spawnCup(); events.offeredCup = true; }
  }
});
if (!traceFirst) spawnCup();

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
  world.getSystem(TraceSystem).ensureCamera();   // ask for the camera now, not in the middle of the first trace
  landing.classList.add('hidden'); reenter.style.display = 'none';
});
world.renderer.xr.addEventListener('sessionend', () => {
  world.renderer.setClearColor(0x1d2140, 1);
  reenter.style.display = 'block'; landing.classList.remove('hidden');
  setTimeout(() => space.showcase(), 300);
});

window.alive = { world, active, events, hands, sound, placement, waiting, get traceSystem() { return world.getSystem(TraceSystem); }, get placementSystem() { const s = world.getSystem(PlacementSystem); s.Vector2 = Vector2; return s; }, debugSpawnCup: () => spawnCup(), get cup() { return active.cup; }, get brush() { return world.getSystem(BrushSystem); }, get space() { return world.getSystem(SpaceSystem); } };
