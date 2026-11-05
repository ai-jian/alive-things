// The peeking newcomer (storyboard v5, shot 11; PRD F14). A tiny blank one hides behind a hill at the far edge of
// the garden. Now and then it leans out and looks at you. Stare at it, or reach for it slowly, and it ducks back.
// Catch it with a quick pinch while it is out and it comes home with you: the next blank canvas on your table.
import { Group, Mesh, SphereGeometry, CircleGeometry, MeshBasicMaterial, Vector3, Shape, ShapeGeometry, DoubleSide, Quaternion, CanvasTexture, AdditiveBlending } from 'three';

function poolTexture() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,236,205,0.9)'); g.addColorStop(0.5, 'rgba(255,226,190,0.3)'); g.addColorStop(1, 'rgba(255,226,190,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new CanvasTexture(c); }
import { makeCup } from './cup.js';
import { makeFace } from './face.js';

const tmp = new Vector3(), fwd = new Vector3(), toIt = new Vector3(), q = new Quaternion();

export class Newcomer {
  /**
   * @param {object} garden  { group, radius, hills } from the space system
   * @param {Sound} sound
   */
  constructor(garden, sound) {
    this.garden = garden; this.sound = sound;
    this.state = 'away';                 // away → hidden ⇄ peeking → caught
    this.p = 0;                          // 0 hidden … 1 fully out
    this.timer = 0; this.stare = 0; this.cup = null; this.spot = null; this.peeks = 0;
    this.angle = -Math.PI * 0.74;        // far left side of the disc (local +z faces the player), clear of the centre
    this.side = 1;                       // which way it leans out from behind its hill
  }

  /** make it exist: a small pale pot with only eyes, behind its own little hill */
  appear() {
    if (this.cup) return;
    const cup = makeCup({ palette: 'dusk', heightMetres: 0.06 });
    // blank: pale, quiet, no handle, no paint yet
    cup.uniforms.uBaseLo.value = 0.62; cup.uniforms.uBaseHi.value = 0.92; cup.uniforms.uShade.value = 0.08; cup.uniforms.uUnder.value = 0.3;
    if (cup.handle) { cup.group.remove(cup.handle); cup.handle = null; }
    // the same googly eyes as everyone, only wider and warier
    const face = makeFace({ y: 0.64, bodyR: 0.6, size: 0.27, gap: 0.16, traits: { shy: 0.9, curious: 0.9, sleepy: 0 } });
    cup.group.add(face.group); cup.peekEyes = face.group; cup.isNewcomer = true;
    this.cup = cup; this.face = face; this.surprised = false;
    // its own hill, so it truly hides behind something
    const r = this.garden.radius, a = this.angle;
    const sh = new Shape(); const w = 0.09, h = 0.075; sh.moveTo(-w, 0); sh.quadraticCurveTo(-w * 0.5, h * 1.5, 0.01, h); sh.quadraticCurveTo(w * 0.55, h * 0.9, w, 0); sh.lineTo(-w, 0);
    const hill = new Mesh(new ShapeGeometry(sh), new MeshBasicMaterial({ color: 0x343a74, transparent: true, opacity: 0.95, side: DoubleSide, depthWrite: true }));
    hill.position.set(Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9); hill.lookAt(0, 0, 0); hill.rotateY(Math.PI);
    this.garden.hills.add(hill); this.hill = hill;
    this.hidden = new Vector3(Math.cos(a) * r * 1.02, -0.035, Math.sin(a) * r * 1.02);
    // peek out to the side of the hill, a little inward
    const tangent = new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(this.side);
    this.out = new Vector3(Math.cos(a) * r * 0.9, 0.002, Math.sin(a) * r * 0.9).addScaledVector(tangent, 0.075);
    cup.group.position.copy(this.hidden); this.garden.group.add(cup.group);
    // just enough light to read it: a faint pool that only shows while it is out
    const pool = new Mesh(new CircleGeometry(0.07, 32), new MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; this.garden.group.add(pool); this.pool = pool;
    this.state = 'hidden'; this.timer = 1.5 + Math.random() * 2;
  }

  /** remove from the garden (it was caught, or the garden is being cleared) */
  release() {
    if (!this.cup) return null; const cup = this.cup;
    if (cup.group.parent) cup.group.parent.remove(cup.group);
    if (cup.peekEyes) { cup.group.remove(cup.peekEyes); cup.peekEyes = null; }
    if (this.face) { this.face.dispose(); this.face = null; }
    if (this.hill) { this.garden.hills.remove(this.hill); this.hill = null; }
    if (this.pool) { this.garden.group.remove(this.pool); this.pool = null; }
    this.cup = null; this.state = 'away'; this.p = 0; this.peeks = 0;
    return cup;
  }

  /**
   * @param {number} dt
   * @param {Vector3} headLocal      head in garden-local space
   * @param {Vector3} headFwdLocal   head forward in garden-local space (unit)
   * @param {Vector3[]} tipsLocal    fingertips in garden-local space
   * @param {boolean[]} pinching     same order as tipsLocal
   * @param {number} fade            garden fade 0..1
   * @returns {'caught'|null}
   */
  update(dt, time, headLocal, headFwdLocal, tipsLocal, pinching, fade, scale = 1) {
    const cup = this.cup; if (!cup) return null;
    const pos = cup.group.position;
    // how close the nearest hand is, and whether a pinch closed right on it
    let near = Infinity, caughtBy = -1;
    // distances in real metres, so it behaves the same on the small island over the table and when you are inside
    for (let i = 0; i < tipsLocal.length; i++) { const d = tipsLocal[i].distanceTo(pos) * scale; near = Math.min(near, d); if (pinching[i] && d < Math.max(0.05, 0.06 * scale) && this.p > 0.45) caughtBy = i; }
    if (caughtBy >= 0) { this.state = 'caught'; return 'caught'; }
    // being stared at: the head looks straight at it
    toIt.copy(pos).sub(headLocal).normalize();
    const looked = headFwdLocal.dot(toIt) > Math.cos(10 * Math.PI / 180);
    this.stare = looked && this.p > 0.3 ? this.stare + dt : Math.max(0, this.stare - dt * 2);

    this.timer -= dt;
    if (this.state === 'hidden') {
      if (this.timer <= 0) { this.state = 'peeking'; this.timer = 3 + Math.random() * 3; this.peeks++;
        tmp.copy(pos); this.garden.group.localToWorld(tmp);
        this.sound.whisper({ pitch: 1.5, speed: 1.35, syllables: 2, volume: 0.02, question: true, pos: tmp });
        if (this.peeks === 1 && this.onFirstPeek) this.onFirstPeek(); }
    } else if (this.state === 'peeking') {
      // shy: a long stare or a slow hand sends it back; a fast pinch can still catch it
      if (this.stare > 1.1 || near < Math.max(0.1, 0.12 * Math.min(scale, 2)) || this.timer <= 0) { this.state = 'hidden'; this.timer = 4 + Math.random() * 5; this.stare = 0; }
    }
    const want = this.state === 'peeking' ? 1 : 0;
    const speed = want > this.p ? 1.6 : 5;                        // eases out, darts back
    this.p += (want - this.p) * Math.min(1, dt * speed);
    pos.lerpVectors(this.hidden, this.out, this.p);
    pos.y += Math.sin(time * 6) * 0.002 * this.p;                // a tiny nervous bob
    // lean out from behind the hill and look at you
    tmp.copy(headLocal).sub(pos); const yaw = Math.atan2(tmp.x, tmp.z);
    cup.group.rotation.set(0, yaw, -this.side * 0.32 * this.p);
    // blink, and fade with the garden
    // eyes on you; being stared at makes them go wide just before it ducks
    if (this.stare > 0.55 && !this.surprised) { this.surprised = true; this.face.feel('wide', 0.8, { marks: true, mouth: 'o' }); }
    if (this.state === 'hidden') this.surprised = false;
    tmp.copy(headLocal); this.garden.group.localToWorld(tmp); this.face.update(dt, tmp);
    for (const e of this.face.eyes) e.mat.opacity = fade;
    cup.setGlow(0.35 * this.p);
    if (this.pool) { this.pool.position.set(pos.x, 0.004, pos.z); this.pool.material.opacity = 0.7 * this.p * fade; }
    cup.tick(dt, time);
    return null;
  }
}
