// My Space: the dark painted garden, tabletop sized so everything stays within arm's reach while seated.
// Opaque dome around the player, a garden disc at table height, light pools, fireflies, a hanging plant that
// speaks in one-line cards, a doorway disc on the table to go in and a door home to come back.
import { createSystem, Grabbed, OneHandGrabbable } from '@iwsdk/core';
import { Group, Mesh, SphereGeometry, CircleGeometry, PlaneGeometry, CylinderGeometry, MeshBasicMaterial, BackSide, Points, BufferGeometry, BufferAttribute, PointsMaterial, Sprite, SpriteMaterial, CanvasTexture, Vector3, Color, AdditiveBlending, LatheGeometry, Vector2, DoubleSide, ShapeGeometry, Shape, SRGBColorSpace } from 'three';
import { Brain } from './brain.js';
import { makeCard } from './hints.js';
import { makeCup } from './cup.js';
import { wakeCup } from './creature.js';
import { loadAll, upsert, serialize, restorePaint, decodeMask } from './store.js';
import { makeThing } from './thing.js';
import { inflateMask } from './inflate.js';

const head = new Vector3(), tmp = new Vector3();

function radialTexture(inner, outer) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 6, 128, 128, 128); g.addColorStop(0, inner); g.addColorStop(0.55, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new CanvasTexture(c); }

function flatDisc(tex, size, blending) { const m = new Mesh(new PlaneGeometry(size, size), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: blending || AdditiveBlending })); m.rotation.x = -Math.PI / 2; return m; }

function makeDome() {
  const geo = new SphereGeometry(5, 32, 24); const col = new Float32Array(geo.attributes.position.count * 3); const top = new Color(0x0f1030), horizon = new Color(0x2b2f5e), low = new Color(0x1d2140);
  for (let i = 0; i < geo.attributes.position.count; i++) { const y = geo.attributes.position.getY(i) / 5; const c = y > 0 ? top.clone().lerp(horizon, 1 - y) : horizon.clone().lerp(low, -y); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, transparent: true, opacity: 0, depthWrite: false }));
}
function makeHills(radius, colour = 0x3a3f78, scale = 1) {
  const g = new Group(); const mat = new MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false });
  for (let i = 0; i < 7; i++) { const sh = new Shape(); const w = (0.16 + Math.random() * 0.18) * scale, h = (0.04 + Math.random() * 0.07) * scale; sh.moveTo(-w, 0); sh.quadraticCurveTo(-w * 0.4, h * 1.6, 0.05, h); sh.quadraticCurveTo(w * 0.5, h * 0.8, w, 0); sh.lineTo(-w, 0);
    const m = new Mesh(new ShapeGeometry(sh), mat); const a = i / 7 * Math.PI * 2 + Math.random() * 0.4; m.position.set(Math.cos(a) * radius * 1.05, 0, Math.sin(a) * radius * 1.05); m.lookAt(0, 0, 0); m.rotateY(Math.PI); g.add(m); }
  return g;
}
function makePlant() {
  const g = new Group(); const pot = new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(0.03, 0), new Vector2(0.038, 0.045), new Vector2(0, 0.045)].map(v => v), 24), new MeshBasicMaterial({ color: 0xf3a7b6 }));
  const leafMat = new MeshBasicMaterial({ color: 0xa9d38f, side: DoubleSide }); const leaf = (rx, ry, rot) => { const sh = new Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.05, 0.04, 0.0, 0.11); sh.quadraticCurveTo(-0.05, 0.04, 0, 0); const m = new Mesh(new ShapeGeometry(sh), leafMat); m.position.y = 0.045; m.rotation.set(rx, ry, rot); return m; };
  g.add(pot, leaf(0, 0, 0.5), leaf(0, 1.2, -0.4), leaf(0, 2.4, 0.3), leaf(0, 3.6, -0.5), leaf(0, 4.8, 0.2));
  const ink = new MeshBasicMaterial({ color: 0x2e2a36 }); const e1 = new Mesh(new SphereGeometry(0.004, 8, 6), ink); e1.position.set(-0.01, 0.028, 0.036); const e2 = e1.clone(); e2.position.x = 0.01; g.add(e1, e2);
  const smile = new Mesh(new LatheGeometry([new Vector2(0.007, 0), new Vector2(0.009, 0)], 12, 0, Math.PI), ink); smile.rotation.set(Math.PI / 2, 0, Math.PI); smile.position.set(0, 0.02, 0.037); g.add(smile);
  const glow = new Sprite(new SpriteMaterial({ map: radialTexture('rgba(255,236,205,0.6)', 'rgba(255,236,205,0.12)'), transparent: true, depthWrite: false, blending: AdditiveBlending })); glow.scale.setScalar(0.22); glow.position.y = 0.05; g.add(glow);
  const string = new Mesh(new PlaneGeometry(0.002, 0.5), new MeshBasicMaterial({ color: 0xc9c8e6 })); string.position.y = 0.045 + 0.25; g.add(string);
  return g;
}

export function makeSpaceSystem(world, hands, sound, events, getActiveCup) {
  class SpaceSystem extends createSystem({}, {}) {
    init() {
      this.inSpace = false; this.fade = 0; this.wantIn = false; this.residents = []; this.brains = []; this.partyDone = false; this.lastSave = 0;
      this.radius = 0.45;
      const g = this.group = new Group(); g.visible = false; this.scene.add(g);
      this.dome = makeDome(); g.add(this.dome);
      const floorTex = radialTexture('rgba(96,98,170,1)', 'rgba(44,46,104,1)'); floorTex.colorSpace = SRGBColorSpace;
      this.floor = new Mesh(new CircleGeometry(this.radius * 1.15, 64), new MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0, depthWrite: false })); this.floor.rotation.x = -Math.PI / 2; g.add(this.floor);
      // a wide soft haze under everything so the table edge melts into the dark
      this.haze = new Mesh(new CircleGeometry(this.radius * 2.6, 48), new MeshBasicMaterial({ map: radialTexture('rgba(60,62,130,0.55)', 'rgba(40,42,100,0.15)'), transparent: true, opacity: 0, depthWrite: false })); this.haze.rotation.x = -Math.PI / 2; this.haze.position.y = -0.003; g.add(this.haze);
      this.hills = makeHills(this.radius); g.add(this.hills);
      this.hillsFar = makeHills(this.radius * 1.9, 0x2a2e63, 1.7); g.add(this.hillsFar);
      const dotTex = radialTexture('rgba(255,240,210,1)', 'rgba(255,240,210,0.35)');
      this.fireflyLayers = [];
      for (let L = 0; L < 3; L++) {
        const n = 50, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = 0.15 + Math.random() * 1.4, a = Math.random() * Math.PI * 2; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.02 + Math.random() * 0.9; pos[i * 3 + 2] = Math.sin(a) * r; }
        const pg = new BufferGeometry(); pg.setAttribute('position', new BufferAttribute(pos, 3));
        const pts = new Points(pg, new PointsMaterial({ color: 0xffe9c4, size: 0.005 + L * 0.002, map: dotTex, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false, blending: AdditiveBlending })); pts.userData.phase = L * 2.1; g.add(pts); this.fireflyLayers.push(pts);
      }
      this.fireflies = this.fireflyLayers[0];
      // stars on the dome, a pale moon
      { const n = 220, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.asin(Math.random()) ; const r = 4.6; pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r + 0.2; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
        const sg = new BufferGeometry(); sg.setAttribute('position', new BufferAttribute(pos, 3)); this.stars = new Points(sg, new PointsMaterial({ color: 0xf1ebe2, size: 0.022, map: dotTex, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false })); g.add(this.stars); }
      this.moon = new Sprite(new SpriteMaterial({ map: radialTexture('rgba(255,244,226,1)', 'rgba(255,236,210,0.55)'), transparent: true, opacity: 0, depthWrite: false })); this.moon.scale.setScalar(0.42); this.moon.position.set(-1.3, 1.5, -2.6); g.add(this.moon);
      this.moonGlow = new Sprite(new SpriteMaterial({ map: radialTexture('rgba(255,236,210,0.35)', 'rgba(255,236,210,0.06)'), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })); this.moonGlow.scale.setScalar(1.3); this.moonGlow.position.copy(this.moon.position); g.add(this.moonGlow);
      // light beam texture for the pools (vertical alpha gradient)
      { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,236,205,0)'); gr.addColorStop(0.6, 'rgba(255,236,205,0.12)'); gr.addColorStop(1, 'rgba(255,236,205,0.35)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 128); this.beamTex = new CanvasTexture(c); }
      this.poolTex = radialTexture('rgba(255,236,205,0.9)', 'rgba(255,226,190,0.3)'); this.pools = [];
      this.plant = makePlant(); this.plant.position.set(0.28, 0.42, -0.22); g.add(this.plant);
      this.plantCard = makeCard(); this.plantCard.mesh.scale.setScalar(0.8); g.add(this.plantCard.mesh); this.plantT = 0;
      // doorway on the real table (room) and door home (space)
      const doorTex = radialTexture('rgba(255,236,205,0.95)', 'rgba(200,190,255,0.35)');
      this.door = flatDisc(doorTex, 0.16); this.scene.add(this.door); this.doorOn = false;
      this.home = flatDisc(doorTex, 0.12); g.add(this.home); this.home.position.set(-0.32, 0.006, 0.2);
      this.homeCard = makeCard(); this.homeCard.mesh.scale.setScalar(0.6); this.homeCard.draw('home'); g.add(this.homeCard.mesh);
      this.restored = false;
      window.addEventListener('keydown', (e) => { if (e.key === 'g') this.toggle(); });
    }
    toggle() { if (this.inSpace) this.leave(); else { const cup = getActiveCup(); if (cup && cup.creature && !cup.inSpace) { this.enterSpace(cup); this.onAdopted && this.onAdopted(cup); } else this.enterSpace(); } }
    say(line) { this.plantCard.draw(line); this.plantT = 4.5; }
    placeGarden() {
      // garden sits where the cup's table is, in front of the player
      const cup = getActiveCup(); const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      const y = cup ? cup.group.position.y : head.y - 0.4;
      const fwd = tmp.set(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(this.group.quaternion)); fwd.y = 0; fwd.normalize(); this.group.quaternion.identity();
      this.group.position.copy(head).addScaledVector(fwd, 0.6); this.group.position.y = y;
      this.group.rotation.y = Math.atan2(fwd.x, fwd.z) + Math.PI;
      this.dome.position.set(0, head.y - y, 0);
    }
    enterSpace(bringCup) {
      this.placeGarden(); this.group.visible = true; this.wantIn = true; this.inSpace = true; events.inSpace = true;
      if (!this.restored) { this.restored = true; for (const rec of loadAll()) this.adopt(this.rebuild(rec), rec); }
      if (bringCup) this.adopt(bringCup);
      sound.setHum(0.5);
    }
    leave() { this.wantIn = false; this.inSpace = false; events.inSpace = false; sound.setHum(0); }
    rebuild(rec) {
      let cup = null;
      if (rec.kind === 'thing' && rec.shape) { const sh = decodeMask(rec); const geo = inflateMask(sh.mask, sh.w, sh.h, sh.width, sh.height, 0.55); if (geo) { cup = makeThing({ geometry: geo, dominant: new Color(rec.dominant), width: sh.width, height: sh.height }); cup.shape = sh; } }
      if (!cup) cup = makeCup({ dominant: new Color(rec.dominant), heightMetres: 0.09 });
      cup.id = rec.id; cup.traits = rec.traits; cup.dominant = new Color(rec.dominant); cup.bornAt = rec.bornAt; restorePaint(cup, rec);
      cup.creature = wakeCup(cup, { traits: rec.traits, dark: cup.uniforms.uPal.value[0].getHex() }); cup.creature.pop = 1; cup.creature.parts.scale.setScalar(cup.wakeFit ? cup.wakeFit.unit : 1);
      return cup;
    }
    adopt(cup) {
      // move the cup into the garden group at a free spot
      // hand the object over from the ECS to the garden: the transform system owns entity objects, so release it first
      if (cup.entity) { try { cup.entity.dispose({ disposeResources: false }); } catch (e) { try { cup.entity.destroy(); } catch (e2) {} } cup.entity = null; }
      if (cup.group.parent !== this.group) { cup.group.parent && cup.group.parent.remove(cup.group); this.group.add(cup.group); }
      cup.inSpace = true;
      const a = Math.PI + (Math.random() - 0.5) * Math.PI * 1.2, r = 0.1 + Math.random() * 0.22; cup.group.position.set(Math.cos(a) * r, 0.002, Math.sin(a) * r); cup.group.rotation.set(0, Math.random() * Math.PI * 2, 0);
      cup.setGlow(0.6); cup.uniforms.uUnder.value = 0.8; cup.uniforms.uShade.value = 0.12; cup.uniforms.uLightDir.value.set(0.15, 1.0, 0.25).normalize();
      const pool = flatDisc(this.poolTex, 1); pool.scale.setScalar(0.001); this.group.add(pool);
      const beam = new Mesh(new CylinderGeometry(0.02, 0.075, 0.3, 24, 1, true), new MeshBasicMaterial({ map: this.beamTex, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, blending: AdditiveBlending })); beam.position.y = 0.15; this.group.add(beam);
      this.pools.push({ pool, beam, cup, grow: 0 });
      const brain = new Brain(cup, { group: this.group, radius: this.radius }, sound); this.brains.push(brain); this.residents.push(cup);
      upsert(serialize(cup));
      if (this.residents.length === 1) this.say('it looks a little lonely out here.');
      if (this.residents.length === 3 && !this.partyDone) { this.partyDone = true; this.say('you brought friends!'); for (const b of this.brains) b.enter('look', 3); sound.wake(1.2); }
    }
    update(delta, time) {
      const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      const cup = getActiveCup();
      // doorway appears on the table once the cup is awake and set down
      const awake = cup && cup.creature && !cup.inSpace && cup.entity; const grabbed = !!(cup && cup.entity && cup.entity.hasComponent(Grabbed));
      const wantDoor = awake && !this.inSpace;
      this.doorOn += ((wantDoor ? 1 : 0) - this.doorOn) * Math.min(1, delta * 2); this.door.material.opacity = this.doorOn * 0.9; this.door.visible = this.doorOn > 0.02;
      if (wantDoor) {
        if (!this.doorPlaced) { this.doorPlaced = true; cup.group.getWorldPosition(this.door.position); tmp.copy(head).sub(this.door.position); tmp.y = 0; tmp.normalize(); const side = new Vector3(-tmp.z, 0, tmp.x); this.door.position.addScaledVector(side, 0.22); this.door.position.y += 0.004; }
        // released on the doorway → go in
        cup.group.getWorldPosition(tmp); if (!grabbed && cup.wasGrabbed && tmp.distanceTo(this.door.position) < 0.09) { this.enterSpace(cup); this.doorPlaced = false; this.onAdopted && this.onAdopted(cup); }
        cup.wasGrabbed = grabbed;
      }
      // fade in / out
      const target = this.wantIn ? 1 : 0; this.fade += (target - this.fade) * Math.min(1, delta * 1.2);
      const f = this.fade; this.dome.material.opacity = f; this.floor.material.opacity = f; this.hills.children.forEach(m => m.material.opacity = f * 0.9);
      this.home.material.opacity = f * 0.8; this.homeCard.mat.opacity = f * 0.9; this.plantCard.mat.opacity = Math.min(f, this.plantT > 0 ? Math.min(1, this.plantT) : 0);
      if (f < 0.01 && !this.wantIn && this.group.visible) this.group.visible = false;
      // the room's object stays in the room while you are in the garden
      if (cup && !cup.inSpace) cup.group.visible = f < 0.6;
      if (!this.group.visible) return;
      // ambience
      for (const L of this.fireflyLayers) { L.rotation.y = time * 0.015 + L.userData.phase; L.position.y = Math.sin(time * 0.3 + L.userData.phase) * 0.02; L.material.opacity = f * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time * 1.1 + L.userData.phase))); }
      this.stars.material.opacity = f * (0.42 + 0.12 * Math.sin(time * 0.7)); this.moon.material.opacity = f * 0.95; this.moonGlow.material.opacity = f * 0.8; this.haze.material.opacity = f; this.hillsFar.children.forEach(m => m.material.opacity = f * 0.95);
      // plant: sway, look, speak
      this.plant.rotation.z = Math.sin(time * 0.7) * 0.05; this.plantCard.mesh.position.copy(this.plant.position); this.plantCard.mesh.position.y += 0.09; this.plantCard.mesh.lookAt(this.group.worldToLocal(head.clone()));
      if (this.plantT > 0) this.plantT -= delta;
      this.homeCard.mesh.position.copy(this.home.position); this.homeCard.mesh.position.y += 0.05; this.homeCard.mesh.lookAt(this.group.worldToLocal(head.clone()));
      // brains
      const headLocal = this.group.worldToLocal(head.clone());
      for (const b of this.brains) b.update(delta, this.brains, headLocal);
      for (const p of this.pools) { p.grow = Math.min(1, p.grow + delta); const nap = p.cup.creature && p.cup.creature.napping; p.pool.scale.setScalar(0.2 * p.grow * (nap ? 0.8 : 1) * (1 + Math.sin(time * 1.5) * 0.03)); p.pool.position.copy(p.cup.group.position); p.pool.position.y = 0.005; p.pool.material.opacity = f * 0.55;
        p.beam.position.set(p.cup.group.position.x, 0.15, p.cup.group.position.z); p.beam.scale.set(p.grow, 1, p.grow); p.beam.material.opacity = f * (nap ? 0.12 : 0.2) * (1 + Math.sin(time * 1.5 + 1) * 0.08);
        p.cup.creature && p.cup.creature.update(delta, head); p.cup.tick(delta, time); }
      // touching the home disc with a fingertip leaves
      for (const h of ['left', 'right']) { const t = this.group.worldToLocal(hands.tip[h].clone()); if (t.distanceTo(this.home.position) < 0.05) { this.leave(); break; } }
      // periodic save
      if (time - this.lastSave > 10) { this.lastSave = time; for (const c of this.residents) upsert(serialize(c)); }
    }
  }
  return SpaceSystem;
}
