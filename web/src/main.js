// Alive Things, WebXR build. v0: passthrough + hands + one cup on the real table + grab + gesture brush + jelly.
import { World, SessionMode, ReferenceSpaceType, OneHandGrabbable } from '@iwsdk/core';
import { Color } from 'three';
import { makeCup } from './cup.js';
import { makeBrushSystem } from './brush-system.js';
import { makePlacementSystem } from './place-on-table.js';

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

// The first ready object. Its palette comes from its own colour (a cream cup → violet-dusk ramp).
const cup = makeCup({ dominant: new Color(0.93, 0.88, 0.78), heightMetres: 0.09 });
cup.group.position.set(0, 1.4, -0.6);                 // until the table is found (in view on desktop)
const cupEntity = world.createTransformEntity(cup.group);
cupEntity.addComponent(OneHandGrabbable, { rotate: true, translate: true });

world.registerSystem(makePlacementSystem(cup));
world.registerSystem(makeBrushSystem(cup, cupEntity));

// Passthrough in AR: no world background. In the browser fallback keep a soft paper colour.
world.scene.background = null;
world.renderer.setClearColor(0xefe9df, 1);
world.renderer.xr.addEventListener('sessionstart', () => { world.renderer.setClearColor(0x000000, 0); cup.setGlow(0); });
world.renderer.xr.addEventListener('sessionend', () => { world.renderer.setClearColor(0xefe9df, 1); });

// a little dev handle
window.alive = { world, cup, cupEntity };
