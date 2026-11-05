// Alive Things, WebXR build. v0.2: landing card, in-XR hints, emulator baked into the page.
import { World, SessionMode, ReferenceSpaceType, OneHandGrabbable } from '@iwsdk/core';
import { Color } from 'three';
import { makeCup } from './cup.js';
import { makeBrushSystem } from './brush-system.js';
import { makePlacementSystem } from './place-on-table.js';
import { makeHintSystem } from './hints.js';
import { makeFocusSystem } from './focus-system.js';
import { Hands } from './hands.js';
import { Sound } from './audio.js';
import { makeSpaceSystem } from './space.js';

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
    locomotion: false,
    spatialUI: false,
  },
});

// What the player has done so far. The hint card advances on these; traits will read them later.
const events = { strokes: 0, dwell: false, grabbed: false, centreSet: false, foldChanged: false, focused: false, awake: false };
const hands = new Hands(world);
const sound = new Sound();

// The active object on the table. Its palette comes from its own colour; the player never picks.
const active = { cup: null, entity: null };
const colours = [0xeee0c6, 0x9ec5e8, 0xb7d9a3, 0xf3a7b6, 0xf2b63c]; let colourIndex = 0;
function spawnCup() {
  const cup = makeCup({ dominant: new Color(colours[colourIndex++ % colours.length]), heightMetres: 0.09 });
  cup.group.position.set(0, 1.4, -0.6);
  const entity = world.createTransformEntity(cup.group);
  entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
  cup.entity = entity; active.cup = cup; active.entity = entity;
  events.strokes = 0; events.dwell = false; events.focused = false; events.awake = false; events.grabbed = false;
  const b = world.getSystem(BrushSystem); if (b) b.resetStats();
  return cup;
}

world.registerSystem(makePlacementSystem(active));
const BrushSystem = makeBrushSystem(active, events, hands, sound);
world.registerSystem(BrushSystem);
world.registerSystem(makeFocusSystem(active, hands, sound, events, () => world.getSystem(BrushSystem).summary()));
world.registerSystem(makeHintSystem(active, events));
const SpaceSystem = makeSpaceSystem(world, hands, sound, events, () => active.cup);
world.registerSystem(SpaceSystem);
world.getSystem(SpaceSystem).onAdopted = () => { spawnCup(); };   // a fresh object waits on the table when you come back
spawnCup();

// Passthrough in AR: no world background. In the browser fallback keep a soft paper colour.
world.scene.background = null;
world.renderer.setClearColor(0xefe9df, 1);

// ---- landing card and session lifecycle ----
const landing = document.getElementById('landing');
const enter = document.getElementById('enter');
const note = document.getElementById('note');
const reenter = document.getElementById('reenter');

let arSupported = false;
try { arSupported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) { arSupported = false; }
if (!arSupported) {
  enter.disabled = true; enter.textContent = 'WebXR not available here';
  note.innerHTML = 'Open this page in the <b>Meta Quest browser</b>. On a desktop, the built-in emulator panel (top right) can also start a session.';
}
enter.addEventListener('click', () => { sound.resume(); world.launchXR(); });
reenter.addEventListener('click', () => { sound.resume(); world.launchXR(); });

world.renderer.xr.addEventListener('sessionstart', () => {
  world.renderer.setClearColor(0x000000, 0);
  landing.classList.add('hidden'); reenter.style.display = 'none';
});
world.renderer.xr.addEventListener('sessionend', () => {
  world.renderer.setClearColor(0xefe9df, 1);
  reenter.style.display = 'block';
});

window.alive = { world, active, events, hands, sound, get cup() { return active.cup; }, get brush() { return world.getSystem(BrushSystem); }, get space() { return world.getSystem(SpaceSystem); } };
