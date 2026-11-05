// Alive Things, WebXR build. v0.2: landing card, in-XR hints, emulator baked into the page.
import { World, SessionMode, ReferenceSpaceType, OneHandGrabbable } from '@iwsdk/core';
import { Color } from 'three';
import { makeCup } from './cup.js';
import { makeBrushSystem } from './brush-system.js';
import { makePlacementSystem } from './place-on-table.js';
import { makeHintSystem } from './hints.js';

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
const events = { strokes: 0, dwell: false, grabbed: false, centreSet: false, foldChanged: false };

// The first ready object. Its palette comes from its own colour (a cream cup → violet-dusk ramp).
const cup = makeCup({ dominant: new Color(0.93, 0.88, 0.78), heightMetres: 0.09 });
cup.group.position.set(0, 1.4, -0.6);                 // until the table is found (in view on desktop)
const cupEntity = world.createTransformEntity(cup.group);
cupEntity.addComponent(OneHandGrabbable, { rotate: true, translate: true });

world.registerSystem(makePlacementSystem(cup));
const BrushSystem = makeBrushSystem(cup, cupEntity, events);
world.registerSystem(BrushSystem);
world.registerSystem(makeHintSystem(cup, events));

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
enter.addEventListener('click', () => world.launchXR());
reenter.addEventListener('click', () => world.launchXR());

world.renderer.xr.addEventListener('sessionstart', () => {
  world.renderer.setClearColor(0x000000, 0); cup.setGlow(0);
  landing.classList.add('hidden'); reenter.style.display = 'none';
});
world.renderer.xr.addEventListener('sessionend', () => {
  world.renderer.setClearColor(0xefe9df, 1);
  reenter.style.display = 'block';
});

window.alive = { world, cup, cupEntity, events, get brush() { return world.getSystem(BrushSystem); } };
