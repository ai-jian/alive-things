// My Space as a floating island (Nov 6, owner): first seen from above, small, hovering over your table, with the
// creatures playing and whispering on it. Hold it with both hands and pull them apart to enlarge it; past a threshold it
// carries you in and you are their size, under a soft dusk sky. Inside, pinch the air and pull to move; push both hands
// together to shrink it back onto the table. Island content lives in local units (radius 0.45) and only the root scales.
import { createSystem, Grabbed } from '@iwsdk/core';
import { Group, Mesh, SphereGeometry, CylinderGeometry, PlaneGeometry, MeshBasicMaterial, BackSide, Points, BufferGeometry, BufferAttribute, PointsMaterial, Sprite, SpriteMaterial, CanvasTexture, Vector3, Color, AdditiveBlending, LatheGeometry, Vector2, DoubleSide, ShapeGeometry, Shape, Quaternion, SplineCurve } from 'three';
import { Brain } from './brain.js';
import { Newcomer } from './newcomer.js';
import { makeCard } from './hints.js';
import { makeCup } from './cup.js';
import { wakeCup } from './creature.js';
import { loadAll, upsert, serialize, restorePaint, decodeMask } from './store.js';
import { makeThing } from './thing.js';
import { inflateMask, sidesAt, inflatePolygon, sidesFromPolygon } from './inflate.js';

const R = 0.45;                 // island radius in local units (brains and the newcomer are built on this)
const MINI = 0.36;              // god view: ~32 cm across over the table
const ENTER_AT = MINI * 2.4;    // pull it this big and it carries you in
const INSIDE = 6.0;             // creature scale: a 9 cm cup becomes ~54 cm, eye to eye with you seated
const EXIT_AT = 3.0;            // push it this small from inside and you come back out
const Y = new Vector3(0, 1, 0);
const head = new Vector3(), tmp = new Vector3(), tmp2 = new Vector3(), fwd = new Vector3();

/** a painted mandala for the landing demo: one slow S-curve through the symmetry guide, like the look test */
function seedStrokes(cup) {
  const P = cup.paint; P.setCentreUV(0, 0.5);
  for (let i = 0; i < 16; i++) { const t = i / 15; const taper = Math.sin(t * Math.PI); const ang = -0.4 + t * 1.2; const x = P.centre.x + 6 + t * 80, y = P.centre.y - 2 - t * 26 + 14 * Math.sin(t * 4);
    P.line(x / P.W, 1 - y / P.H, { x: Math.cos(ang), y: -Math.sin(ang) * 0.4 }, 5 + 12 * taper, 0.4 + 0.6 * taper); }
  for (let i = 0; i < 3; i++) P.dot(0.1 + i * 0.04, 0.42, 7, 0.8);
  P.wetBox = null; P.wet.fill(0); P.upload();
}

function radialTexture(inner, outer) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 6, 128, 128, 128); g.addColorStop(0, inner); g.addColorStop(0.55, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new CanvasTexture(c); }
function flatDisc(tex, size, blending) { const m = new Mesh(new PlaneGeometry(size, size), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: blending || AdditiveBlending })); m.rotation.x = -Math.PI / 2; return m; }
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** vertex-coloured soft shape: colour by height (and, for the island, by how much the surface faces up) */
function tint(geo, fn) { geo.computeVertexNormals(); const p = geo.attributes.position, n = geo.attributes.normal, col = new Float32Array(p.count * 3), c = new Color(); for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i), n.getY(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } geo.setAttribute('color', new BufferAttribute(col, 3)); return geo; }
const C = (h) => new Color(h);

/** the cushion: a soft lathe, lavender on top, deep indigo underneath */
function makeIsland() {
  const pts = new SplineCurve([[0, 0.012], [0.25, 0.008], [0.42, 0], [0.465, -0.022], [0.48, -0.055], [0.462, -0.095], [0.39, -0.14], [0.22, -0.175], [0, -0.185]].map(([x, y]) => new Vector2(x, y))).getPoints(40);
  const geo = tint(new LatheGeometry(pts, 96), (c, x, y, z, ny) => {
    const r = Math.hypot(x, z) / R;
    const top = C(0xb3a6f6).lerp(C(0x6c5fd6), Math.min(1, r * r));
    const side = C(0x4b3fb6), under = C(0x1c185e);
    const t = (ny + 1) / 2;
    if (t > 0.86) c.copy(side).lerp(top, Math.min(1, (t - 0.86) / 0.1)); else c.copy(under).lerp(side, Math.pow(t / 0.86, 1.6));
  });
  return new Mesh(geo, new MeshBasicMaterial({ vertexColors: true }));
}
function makeBlob(r, squash, lo, hi) { const g = tint(new SphereGeometry(r, 32, 20), (c, x, y) => c.copy(C(lo)).lerp(C(hi), Math.min(1, Math.max(0, (y / r + 1) / 2)))); g.scale(1, squash, 1); return new Mesh(g, new MeshBasicMaterial({ vertexColors: true })); }
/** Softfield-ish flora: a magenta mushroom tree, soft mounds, reeds, a few warm seeds */
function makeFlora() {
  const g = new Group();
  const tree = new Group(); const stem = new Mesh(new CylinderGeometry(0.008, 0.012, 0.16, 10), new MeshBasicMaterial({ color: 0xb48ad8 })); stem.position.y = 0.08;
  const cap = makeBlob(0.075, 0.42, 0xc02e86, 0xff9ccb); cap.position.y = 0.165; cap.rotation.z = 0.25; tree.add(stem, cap); tree.position.set(-0.2, 0, -0.14); g.add(tree);
  const mound = makeBlob(0.085, 0.62, 0x4a35b0, 0xc489e6); mound.position.set(0.05, 0, -0.22); g.add(mound);
  const mound2 = makeBlob(0.05, 0.6, 0x5a3cb8, 0xe0a0e8); mound2.position.set(-0.3, 0, 0.12); g.add(mound2);
  const reeds = new Group(); for (let i = 0; i < 6; i++) { const h = 0.08 + Math.random() * 0.09; const reed = makeBlob(0.012, h / 0.024, 0x7a4fd0, 0xf0a6d8); reed.position.set((Math.random() - 0.5) * 0.06, h / 2, (Math.random() - 0.5) * 0.05); reed.rotation.z = (Math.random() - 0.5) * 0.3; reeds.add(reed); } reeds.position.set(0.24, 0, 0.02); g.add(reeds);
  const seedTex = radialTexture('rgba(255,190,120,1)', 'rgba(255,150,90,0.35)');
  for (let i = 0; i < 9; i++) { const s = new Sprite(new SpriteMaterial({ map: seedTex, transparent: true, depthWrite: false, blending: AdditiveBlending })); s.scale.setScalar(0.018 + Math.random() * 0.012); s.position.set(-0.2 + (Math.random() - 0.5) * 0.14, 0.03 + Math.random() * 0.1, -0.14 + (Math.random() - 0.5) * 0.12); s.userData.ph = Math.random() * 6; g.add(s); }
  return g;
}
function makeHills() {
  const g = new Group(); const mat = new MeshBasicMaterial({ color: 0x5546bd, transparent: true, opacity: 0.95, side: DoubleSide });
  for (let i = 0; i < 6; i++) { const sh = new Shape(); const w = 0.07 + Math.random() * 0.06, h = 0.025 + Math.random() * 0.03; sh.moveTo(-w, 0); sh.quadraticCurveTo(-w * 0.4, h * 1.6, 0.01, h); sh.quadraticCurveTo(w * 0.5, h * 0.8, w, 0); sh.lineTo(-w, 0);
    const m = new Mesh(new ShapeGeometry(sh), mat); const a = i / 6 * Math.PI * 2 + 0.4 + Math.random() * 0.3; m.position.set(Math.cos(a) * R * 0.86, 0, Math.sin(a) * R * 0.86); m.lookAt(0, 0, 0); m.rotateY(Math.PI); g.add(m); }
  return g;
}
function makePlant() {
  const g = new Group(); const pot = new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(0.03, 0), new Vector2(0.038, 0.045), new Vector2(0, 0.045)], 24), new MeshBasicMaterial({ color: 0xf3a7b6 }));
  const leafMat = new MeshBasicMaterial({ color: 0xa9d38f, side: DoubleSide }); const leaf = (ry, rot) => { const sh = new Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.05, 0.04, 0.0, 0.11); sh.quadraticCurveTo(-0.05, 0.04, 0, 0); const m = new Mesh(new ShapeGeometry(sh), leafMat); m.position.y = 0.045; m.rotation.set(0, ry, rot); return m; };
  g.add(pot, leaf(0, 0.5), leaf(1.2, -0.4), leaf(2.4, 0.3), leaf(3.6, -0.5), leaf(4.8, 0.2));
  const ink = new MeshBasicMaterial({ color: 0x2e2a36 }); const e1 = new Mesh(new SphereGeometry(0.004, 8, 6), ink); e1.position.set(-0.01, 0.028, 0.036); const e2 = e1.clone(); e2.position.x = 0.01; g.add(e1, e2);
  const smile = new Mesh(new LatheGeometry([new Vector2(0.007, 0), new Vector2(0.009, 0)], 12, 0, Math.PI), ink); smile.rotation.set(Math.PI / 2, 0, Math.PI); smile.position.set(0, 0.02, 0.037); g.add(smile);
  return g;
}
/** the sky you are under once inside: deep dusk above, a pink-lavender horizon, stars */
function makeSky() {
  const sky = new Group();
  const geo = new SphereGeometry(30, 40, 24); const col = new Float32Array(geo.attributes.position.count * 3);
  const top = C(0x12143c), mid = C(0x3a3488), hor = C(0xc489b8), low = C(0x241f5c);
  for (let i = 0; i < geo.attributes.position.count; i++) { const y = geo.attributes.position.getY(i) / 30; const c = y > 0.25 ? mid.clone().lerp(top, Math.min(1, (y - 0.25) / 0.6)) : y > 0 ? hor.clone().lerp(mid, y / 0.25) : hor.clone().lerp(low, Math.min(1, -y / 0.3)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const dome = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, transparent: true, opacity: 0, depthWrite: false })); dome.renderOrder = -2; sky.add(dome);
  const n = 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = 0.15 + Math.asin(Math.random()) * 0.9; pos[i * 3] = Math.cos(a) * Math.cos(e) * 28; pos[i * 3 + 1] = Math.sin(e) * 28; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 28; }
  const sg = new BufferGeometry(); sg.setAttribute('position', new BufferAttribute(pos, 3));
  const stars = new Points(sg, new PointsMaterial({ color: 0xf1ebe2, size: 0.12, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.3)'), transparent: true, opacity: 0, depthWrite: false })); sky.add(stars);
  return { sky, dome, stars };
}

export function makeSpaceSystem(world, hands, sound, events, getActiveCup) {
  class SpaceSystem extends createSystem({}, {}) {
    init() {
      this.mode = 'closed';            // closed → opening → mini ⇄ entering/inside/exiting; 'showcase' on the landing
      this.residents = []; this.brains = []; this.pools = []; this.partyDone = false; this.lastSave = 0; this.inSpace = false;
      this.radius = R; this.skyFade = 0; this.anim = null; this.gesture = null; this.everEntered = false; this.insideT = 0;
      const g = this.group = new Group(); g.visible = false; g.scale.setScalar(MINI); this.scene.add(g);
      g.add(makeIsland());
      this.hills = makeHills(); g.add(this.hills);
      this.flora = makeFlora(); g.add(this.flora);
      // the light: a warm orb floating over the island
      this.orb = new Sprite(new SpriteMaterial({ map: radialTexture('rgba(255,236,200,1)', 'rgba(255,200,140,0.6)'), transparent: true, depthWrite: false })); this.orb.scale.setScalar(0.07); this.orb.position.set(0.06, 0.42, -0.08); g.add(this.orb);
      this.orbGlow = new Sprite(new SpriteMaterial({ map: radialTexture('rgba(255,200,150,0.45)', 'rgba(255,160,120,0.1)'), transparent: true, depthWrite: false, blending: AdditiveBlending })); this.orbGlow.scale.setScalar(0.55); this.orbGlow.position.copy(this.orb.position); g.add(this.orbGlow);
      const dotTex = radialTexture('rgba(255,240,210,1)', 'rgba(255,240,210,0.35)');
      this.fireflyLayers = [];
      for (let L = 0; L < 3; L++) {
        const n = 30, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = Math.random() * R * 1.15, a = Math.random() * Math.PI * 2; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.02 + Math.random() * 0.45; pos[i * 3 + 2] = Math.sin(a) * r; }
        const pg = new BufferGeometry(); pg.setAttribute('position', new BufferAttribute(pos, 3));
        const pts = new Points(pg, new PointsMaterial({ color: 0xffe9c4, size: 0.006 + L * 0.003, map: dotTex, transparent: true, opacity: 0.6, sizeAttenuation: true, depthWrite: false, blending: AdditiveBlending })); pts.userData.phase = L * 2.1; g.add(pts); this.fireflyLayers.push(pts);
      }
      { const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,236,205,0)'); gr.addColorStop(0.6, 'rgba(255,236,205,0.12)'); gr.addColorStop(1, 'rgba(255,236,205,0.35)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 128); this.beamTex = new CanvasTexture(c); }
      this.poolTex = radialTexture('rgba(255,236,205,0.9)', 'rgba(255,226,190,0.3)');
      this.plant = makePlant(); this.plant.position.set(0.3, 0, -0.2); g.add(this.plant);
      this.plantCard = makeCard(); this.plantCard.mesh.scale.setScalar(0.8); g.add(this.plantCard.mesh); this.plantT = 0;
      // the shy one: peeks over the island's edge
      this.newcomer = new Newcomer({ group: g, radius: R, hills: this.hills }, sound);
      this.newcomer.onFirstPeek = () => this.say('someone is shy over there.');
      this.gardenTime = 0; this.nextNewcomerAt = 20;
      // sky (world, follows the head), doorway disc on the real table, one card for island gestures
      const s = makeSky(); this.sky = s.sky; this.skyDome = s.dome; this.stars = s.stars; this.sky.visible = false; this.scene.add(this.sky);
      this.door = flatDisc(radialTexture('rgba(255,236,205,0.95)', 'rgba(200,190,255,0.35)'), 0.18); this.scene.add(this.door); this.doorOn = 0; this.doorPlaced = false;
      this.card = makeCard(); this.scene.add(this.card.mesh); this.cardT = 0; this.cardText = '';
      // creatures you already have come back
      for (const rec of loadAll()) this.adopt(this.rebuild(rec), { restored: true });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'g') this.toggle();
        // emulator: 'n' makes the newcomer appear and peek at once; pressed again, it is caught (on a headset: a quick pinch while it is out)
        if (e.key === 'n' && this.isOpen()) { const nc = this.newcomer; if (!nc.cup) { nc.appear(); nc.timer = 0.2; } else this.catchNewcomer(); }
      });
    }
    isOpen() { return this.mode !== 'closed' && this.mode !== 'showcase'; }
    headObj() { return this.renderer.xr.isPresenting ? this.player.head : this.camera; }
    /** yaw that turns the island's local +z toward the player */
    facingYaw() { this.headObj().getWorldPosition(head); fwd.copy(this.group.position).sub(head); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); return Math.atan2(-fwd.x, -fwd.z); }

    // ---------------------------------------------------------------- landing: the god view preview, outside XR
    showcase() {
      if (this.mode === 'showcase') return; this.mode = 'showcase';
      if (this.residents.length === 0) {
        const cup = makeCup({ palette: 'dusk', heightMetres: 0.09 }); seedStrokes(cup);
        cup.traits = { curious: .6, sleepy: .3, social: .6, playful: .5, shy: .1 };
        cup.creature = wakeCup(cup, { traits: cup.traits, dark: cup.uniforms.uPal.value[0].getHex() }); cup.creature.pop = 1; cup.creature.parts.scale.setScalar(1);
        this.adopt(cup, { persist: false, showcase: true }); this.demo = cup;
        cup.group.position.set(0.04, 0.002, 0.02);
      }
      this.group.visible = true; this.group.scale.setScalar(1); this.group.position.set(0, 1.1, -0.9); this.group.rotation.set(0, 0, 0);
      this.sky.visible = true; this.skyFade = 1; this.orbitT = 0; this.plantCard.mesh.visible = false;
    }
    clearShowcase() {
      if (this.mode !== 'showcase') return; this.plantCard.mesh.visible = true;
      if (this.demo) { this.removeResident(this.demo); this.demo = null; }
      this.mode = 'closed'; this.group.visible = false; this.sky.visible = false; this.skyFade = 0;
    }
    removeResident(cup) { const i = this.residents.indexOf(cup); if (i < 0) return; this.residents.splice(i, 1); this.brains.splice(i, 1); const p = this.pools.splice(i, 1)[0]; this.group.remove(p.pool, p.beam); this.group.remove(cup.group); }

    // ---------------------------------------------------------------- open / enter / exit
    /** the island appears, small, floating over a spot on the table */
    openIsland(spot) {
      if (this.isOpen()) return;
      this.miniPos = spot.clone(); this.miniPos.y += 0.14;
      this.group.visible = true; this.group.position.copy(this.miniPos); this.group.scale.setScalar(0.001); this.group.rotation.set(0, this.facingYaw(), 0);
      this.mode = 'opening'; this.anim = { t: 0, dur: 1.1 }; events.islandOpen = true; sound.wake(0.9);
      if (!this.doorPlaced) { this.door.position.set(spot.x, spot.y + 0.004, spot.z); this.doorPlaced = true; }
      this.showCard('Pinch it with both hands\nand pull them apart to go in.', 9);
    }
    enter() {
      if (this.mode !== 'mini') return;
      const h = this.headObj(); h.getWorldPosition(head); fwd.set(0, 0, -1).applyQuaternion(h.getWorldQuaternion(new Quaternion())); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      const to = head.clone().addScaledVector(fwd, 0.2 * INSIDE); to.y = head.y - 0.5;
      this.anim = { t: 0, dur: 1.6, fromPos: this.group.position.clone(), fromS: this.group.scale.x, fromYaw: this.group.rotation.y, toPos: to, toS: INSIDE, toYaw: Math.atan2(fwd.x, fwd.z) + Math.PI };
      this.mode = 'entering'; this.gesture = null; this.sky.visible = true; sound.setHum(0.6);
    }
    exit() {
      if (this.mode !== 'inside') return;
      const to = this.miniPos ? this.miniPos.clone() : this.group.position.clone();
      this.anim = { t: 0, dur: 1.4, fromPos: this.group.position.clone(), fromS: this.group.scale.x, fromYaw: this.group.rotation.y, toPos: to, toS: MINI, toYaw: null };
      this.mode = 'exiting'; this.gesture = null; sound.setHum(0);
    }
    leave() { if (this.mode === 'inside') this.exit(); }
    toggle() {
      const cup = getActiveCup();
      if (this.mode === 'closed' || this.mode === 'showcase') { if (cup && cup.creature && !cup.inSpace && cup.entity) this.adoptFromRoom(cup); else if (this.residents.length) this.openIsland(this.spotBeside(cup)); }
      else if (this.mode === 'mini') { if (cup && cup.creature && !cup.inSpace && cup.entity) this.adoptFromRoom(cup); else this.enter(); }
      else if (this.mode === 'inside') this.exit();
    }
    spotBeside(cup) {
      this.headObj().getWorldPosition(head);
      const at = cup ? cup.group.position.clone() : head.clone().add(new Vector3(0, -0.4, -0.5));
      tmp.copy(head).sub(at); tmp.y = 0; tmp.normalize(); const side = new Vector3(-tmp.z, 0, tmp.x);
      return at.addScaledVector(side, 0.28);
    }
    /** an awake creature set down on the doorway (or on the island) moves in */
    adoptFromRoom(cup) {
      if (!this.isOpen()) this.openIsland(this.doorPlaced ? this.door.position.clone() : this.spotBeside(cup));
      this.adopt(cup); events.adopted = true; this.doorOn = Math.min(this.doorOn, 0.6);
      if (this.onAdopted) this.onAdopted(cup);
    }
    say(line) { this.plantCard.draw(line); this.plantT = 4.5; }
    showCard(text, seconds) { if (this.cardText !== text) { this.card.draw(text); this.cardText = text; } this.cardT = seconds; }
    catchNewcomer() { const nc = this.newcomer.release(); if (!nc) return; this.nextNewcomerAt = this.gardenTime + 120; events.newcomerCaught = true; sound.wake(1.4); if (this.mode === 'inside') this.exit(); if (this.onNewcomer) this.onNewcomer(nc); }

    rebuild(rec) {
      let cup = null;
      if (rec.kind === 'thing' && rec.shape && rec.shape.poly) { const r = inflatePolygon(rec.shape.poly, { cells: 112, thickness: 0.45 }); if (r) { cup = makeThing({ geometry: r.geometry, dominant: new Color(rec.dominant), width: r.width, height: r.height, sides: sidesFromPolygon(rec.shape.poly, 0.5) }); cup.shape = rec.shape; } }
      else if (rec.kind === 'thing' && rec.shape) { const sh = decodeMask(rec); const geo = sh && inflateMask(sh.mask, sh.w, sh.h, sh.width, sh.height, 0.45); if (geo) { cup = makeThing({ geometry: geo, dominant: new Color(rec.dominant), width: sh.width, height: sh.height, sides: sidesAt(sh.mask, sh.w, sh.h, 0.5) }); cup.shape = sh; } }
      if (!cup) cup = makeCup({ palette: rec.paletteName || 'dusk', dominant: rec.paletteName ? null : new Color(rec.dominant), heightMetres: 0.09 });
      cup.id = rec.id; cup.traits = rec.traits; cup.dominant = new Color(rec.dominant); cup.bornAt = rec.bornAt; restorePaint(cup, rec);
      cup.creature = wakeCup(cup, { traits: rec.traits, dark: cup.uniforms.uPal.value[0].getHex() }); cup.creature.pop = 1; cup.creature.parts.scale.setScalar(cup.wakeFit ? cup.wakeFit.unit : 1);
      return cup;
    }
    adopt(cup, opts = {}) {
      // hand the object over from the ECS to the island: the transform system owns entity objects, so release it first
      if (cup.entity) { try { cup.entity.dispose({ disposeResources: false }); } catch (e) { try { cup.entity.destroy(); } catch (e2) {} } cup.entity = null; }
      if (cup.group.parent !== this.group) { cup.group.parent && cup.group.parent.remove(cup.group); this.group.add(cup.group); }
      cup.inSpace = true; cup.group.visible = true;
      const a = Math.PI + (Math.random() - 0.5) * Math.PI * 1.2, r = 0.1 + Math.random() * 0.2; cup.group.position.set(Math.cos(a) * r, 0.002, Math.sin(a) * r); cup.group.rotation.set(0, Math.random() * Math.PI * 2, 0);
      cup.group.scale.setScalar(cup.scale || 1);
      cup.setGlow(0.6); cup.uniforms.uUnder.value = 0.8; cup.uniforms.uShade.value = 0.12; cup.uniforms.uLightDir.value.set(0.15, 1.0, 0.25).normalize();
      const pool = flatDisc(this.poolTex, 1); pool.scale.setScalar(0.001); this.group.add(pool);
      const beam = new Mesh(new CylinderGeometry(0.02, 0.075, 0.3, 24, 1, true), new MeshBasicMaterial({ map: this.beamTex, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, blending: AdditiveBlending })); beam.position.y = 0.15; this.group.add(beam);
      this.pools.push({ pool, beam, cup, grow: 0 });
      this.brains.push(new Brain(cup, { group: this.group, radius: R }, sound)); this.residents.push(cup);
      if (opts.persist !== false) upsert(serialize(cup)); else cup.noPersist = true;
      if (opts.showcase || opts.restored) return;
      if (this.residents.length === 1) this.say('it looks a little lonely out here.');
      if (this.residents.length === 3 && !this.partyDone) { this.partyDone = true; this.say('you brought friends!'); for (const b of this.brains) b.enter('look', 3); sound.wake(1.2); }
    }

    // ---------------------------------------------------------------- hands: hold, move, pull apart, push together
    gestures(delta) {
      if (this.mode !== 'mini' && this.mode !== 'inside') { this.gesture = null; return; }
      const tips = [hands.tip.left, hands.tip.right], pinch = [hands.pinching.left, hands.pinching.right];
      const s = this.group.scale.x, c = this.group.position;
      const near = (p) => { if (this.mode === 'inside') return true; tmp.copy(p).sub(c); const dy = tmp.y; tmp.y = 0; return tmp.length() < R * s + 0.05 && dy > -0.12 && dy < R * s * 0.9 + 0.06; };
      const both = pinch[0] && pinch[1] && near(tips[0]) && near(tips[1]);
      const one = !both ? [0, 1].find(i => pinch[i] && near(tips[i])) : undefined;
      const g = this.gesture;
      if (both) {
        const mid = tips[0].clone().add(tips[1]).multiplyScalar(0.5), d = tips[0].distanceTo(tips[1]), ang = Math.atan2(tips[1].z - tips[0].z, tips[1].x - tips[0].x);
        if (!g || g.kind !== 'two') { this.gesture = { kind: 'two', s0: s, pos0: c.clone(), mid0: mid, d0: Math.max(d, 0.02), ang0: ang, yaw0: this.group.rotation.y }; return; }
        const ratio = d / g.d0, dAng = -(ang - g.ang0);
        const ns = Math.max(0.2, Math.min(9, g.s0 * ratio));
        const k = ns / g.s0; const off = g.pos0.clone().sub(g.mid0).applyAxisAngle(Y, dAng).multiplyScalar(k);
        this.group.scale.setScalar(ns); this.group.position.copy(mid).add(off); this.group.rotation.y = g.yaw0 + dAng;
        if (this.mode === 'mini' && ns > ENTER_AT) this.enter();
        else if (this.mode === 'inside' && ns < EXIT_AT) this.exit();
      } else if (one !== undefined) {
        const p = tips[one];
        if (!g || g.kind !== 'one' || g.hand !== one) { this.gesture = { kind: 'one', hand: one, last: p.clone() }; return; }
        tmp.copy(p).sub(g.last); if (this.mode === 'inside') tmp.multiplyScalar(1.6);   // pulling the world: a little gain so a seated reach goes somewhere
        this.group.position.add(tmp); g.last.copy(p);
        if (this.mode === 'mini') this.miniPos = this.group.position.clone();
      } else {
        // let go: a mini island that was stretched but not past the threshold settles back to its size
        if (g && this.mode === 'mini') this.anim = { t: 0, dur: 0.5, fromPos: c.clone(), fromS: s, fromYaw: this.group.rotation.y, toPos: c.clone(), toS: MINI, toYaw: this.group.rotation.y, settle: true };
        if (g && this.mode === 'mini') this.miniPos = c.clone();
        this.gesture = null;
      }
    }

    update(delta, time) {
      const presenting = this.renderer.xr.isPresenting;
      const headObj = this.headObj(); headObj.getWorldPosition(head);
      const cup = getActiveCup();

      // landing: slow orbit above the island, the god view
      if (this.mode === 'showcase' && !presenting) {
        this.orbitT += delta; const a = 0.3 + this.orbitT * 0.06; const c = this.group.position;
        this.camera.position.set(c.x + Math.sin(a) * 1.05, c.y + 0.5 + Math.sin(this.orbitT * 0.2) * 0.03, c.z + Math.cos(a) * 1.05);
        this.camera.lookAt(c.x, c.y + 0.06, c.z); this.camera.updateMatrixWorld(); this.camera.getWorldPosition(head);
      }

      // with creatures already saved, the island comes back over your table once the table is found
      if (this.mode === 'closed' && presenting && this.residents.length && cup && cup.entity) { this.openDelay = (this.openDelay || 0) + delta; if (this.openDelay > 3) this.openIsland(this.spotBeside(cup)); }

      // doorway on the table: shown under the island while it is open, and beside an awake creature waiting to go in
      const awake = !!(cup && cup.creature && !cup.inSpace && cup.entity); const grabbed = !!(cup && cup.entity && cup.entity.hasComponent(Grabbed));
      if (awake && !this.doorPlaced) { this.door.position.copy(this.spotBeside(cup)); this.door.position.y = cup.group.position.y + 0.004; this.doorPlaced = true; }
      const wantDoor = (awake || this.isOpen()) && this.mode !== 'inside' && this.mode !== 'entering';
      this.doorOn += ((wantDoor ? (awake ? 1 : 0.55) : 0) - this.doorOn) * Math.min(1, delta * 2); this.door.material.opacity = this.doorOn * 0.9; this.door.visible = this.doorOn > 0.02;
      if (awake) {
        // released on the doorway, or on the island itself → it moves in
        cup.group.getWorldPosition(tmp);
        const onDoor = tmp.distanceTo(this.door.position) < 0.1;
        const onIsland = this.isOpen() && (() => { tmp2.copy(tmp).sub(this.group.position); const dy = tmp2.y; tmp2.y = 0; return tmp2.length() < R * this.group.scale.x + 0.03 && dy > -0.1 && dy < 0.12; })();
        if (!grabbed && cup.wasGrabbed && (onDoor || onIsland)) this.adoptFromRoom(cup);
        cup.wasGrabbed = grabbed;
        if (!this.isOpen()) this.showCard('Set it down on the glowing disc.', 0.5);
      }

      this.gestures(delta);

      // animations: opening, entering, exiting, settling
      if (this.anim) {
        const A = this.anim; A.t = Math.min(1, A.t + delta / A.dur); const k = ease(A.t);
        if (this.mode === 'opening') { const o = A.t < 0.75 ? A.t / 0.75 * 1.12 : 1.12 - (A.t - 0.75) / 0.25 * 0.12; this.group.scale.setScalar(MINI * Math.max(0.001, o)); }
        else {
          this.group.scale.setScalar(A.fromS + (A.toS - A.fromS) * k); this.group.position.lerpVectors(A.fromPos, A.toPos, k);
          if (A.toYaw !== null && A.toYaw !== undefined) { let d = A.toYaw - A.fromYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.group.rotation.y = A.fromYaw + d * k; }
        }
        if (A.t >= 1) {
          if (this.mode === 'opening') this.mode = 'mini';
          else if (this.mode === 'entering') { this.mode = 'inside'; this.insideT = 0; if (!this.everEntered) { this.everEntered = true; this.showCard('Pinch the air and pull to move.\nPush both hands together to come back.', 8); } }
          else if (this.mode === 'exiting') { this.mode = 'mini'; this.group.rotation.y = this.facingYaw(); }
          this.anim = null;
        }
      }
      // mini: a gentle float
      if (this.mode === 'mini' && !this.gesture && !this.anim && this.miniPos) this.group.position.y = this.miniPos.y + Math.sin(time * 0.9) * 0.004;

      this.inSpace = this.mode === 'inside' || this.mode === 'entering'; events.inSpace = this.inSpace;
      // tell the trace brush where the island is, so a pinch on it never starts a trace
      events.island = this.isOpen() && this.mode !== 'inside' && this.mode !== 'entering' ? { pos: this.group.position, r: R * this.group.scale.x + 0.08 } : null;
      // sky and the room: the dusk closes in as you go in
      const wantSky = this.mode === 'inside' || this.mode === 'entering' || this.mode === 'showcase' ? 1 : 0;
      this.skyFade += (wantSky - this.skyFade) * Math.min(1, delta * (this.mode === 'showcase' ? 10 : 1.6));
      this.sky.visible = this.skyFade > 0.01; this.sky.position.copy(head); this.skyDome.material.opacity = this.skyFade; this.stars.material.opacity = this.skyFade * (0.55 + 0.12 * Math.sin(time * 0.7));
      if (cup && !cup.inSpace) cup.group.visible = this.skyFade < 0.6;

      // the island card: above the island while small, near you once inside
      if (this.cardT > 0) {
        this.cardT -= delta; const op = Math.min(1, this.cardT * 2, 1);
        if (this.mode === 'inside') { fwd.set(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(new Quaternion())); this.card.mesh.position.copy(head).addScaledVector(fwd, 0.55); this.card.mesh.position.y -= 0.12; this.card.mesh.scale.setScalar(1.6); }
        else { this.card.mesh.position.copy(this.isOpen() ? this.group.position : this.door.position); this.card.mesh.position.y += this.isOpen() ? R * this.group.scale.x * 0.9 + 0.08 : 0.12; this.card.mesh.scale.setScalar(1.1); }
        this.card.mesh.lookAt(head); this.card.mat.opacity = op; this.card.mesh.visible = true;
      } else this.card.mesh.visible = false;

      if (!this.group.visible) return;
      // ambience
      for (const L of this.fireflyLayers) { L.rotation.y = time * 0.015 + L.userData.phase; L.position.y = Math.sin(time * 0.3 + L.userData.phase) * 0.01; L.material.opacity = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time * 1.1 + L.userData.phase)); }
      this.orb.position.y = 0.42 + Math.sin(time * 0.5) * 0.01; this.orbGlow.position.copy(this.orb.position); this.orbGlow.material.opacity = 0.85 + Math.sin(time * 1.3) * 0.1;
      for (const s of this.flora.children) if (s.isSprite) s.material.opacity = 0.6 + 0.4 * Math.sin(time * 1.7 + s.userData.ph);
      this.plant.rotation.z = Math.sin(time * 0.7) * 0.05;
      const headLocal = this.group.worldToLocal(head.clone());
      this.plantCard.mesh.position.copy(this.plant.position); this.plantCard.mesh.position.y += 0.12; this.plantCard.mesh.lookAt(headLocal);
      this.plantCard.mat.opacity = this.plantT > 0 ? Math.min(1, this.plantT) : 0; if (this.plantT > 0) this.plantT -= delta;
      // the ear is where the head is
      { const q = headObj.getWorldQuaternion(new Quaternion()); sound.setListener(head, new Vector3(0, 0, -1).applyQuaternion(q), new Vector3(0, 1, 0).applyQuaternion(q)); }
      // creatures
      for (const b of this.brains) b.update(delta, this.brains, headLocal);
      for (const p of this.pools) { p.grow = Math.min(1, p.grow + delta); const nap = p.cup.creature && p.cup.creature.napping; p.pool.scale.setScalar(0.2 * p.grow * (nap ? 0.8 : 1) * (1 + Math.sin(time * 1.5) * 0.03)); p.pool.position.copy(p.cup.group.position); p.pool.position.y = 0.005; p.pool.material.opacity = 0.55;
        p.beam.position.set(p.cup.group.position.x, 0.15, p.cup.group.position.z); p.beam.scale.set(p.grow, 1, p.grow); p.beam.material.opacity = (nap ? 0.12 : 0.2) * (1 + Math.sin(time * 1.5 + 1) * 0.08);
        p.cup.creature && p.cup.creature.update(delta, head); p.cup.tick(delta, time); }
      // the newcomer: waits until you have spent a little while with the island and at least one creature
      if (this.isOpen()) { this.gardenTime += delta; if (!this.newcomer.cup && this.residents.length >= 1 && this.gardenTime >= this.nextNewcomerAt) this.newcomer.appear(); }
      if (this.newcomer.cup) {
        const gq = this.group.getWorldQuaternion(new Quaternion()).invert();
        const fwdLocal = new Vector3(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(new Quaternion())).applyQuaternion(gq);
        const tips = ['left', 'right'].map(h => this.group.worldToLocal(hands.tip[h].clone())), pinch = [hands.pinching.left, hands.pinching.right];
        if (this.newcomer.update(delta, time, headLocal, fwdLocal, tips, pinch, 1, this.group.scale.x) === 'caught') { this.gesture = null; this.catchNewcomer(); }
      }
      // periodic save
      if (time - this.lastSave > 10) { this.lastSave = time; for (const c of this.residents) if (!c.noPersist) upsert(serialize(c)); }
    }
  }
  return SpaceSystem;
}
