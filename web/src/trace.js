// Capture: pinch in the air and trace around any real object. The loop becomes a silhouette, the silhouette is
// inflated into a soft thing at the real size and place, and (on a headset with camera access) the colour inside
// the loop becomes its palette. No computer vision, nothing to fail.
import { createSystem, OneHandGrabbable, CameraSource, CameraUtils } from '@iwsdk/core';
import { Line, BufferGeometry, BufferAttribute, LineBasicMaterial, Vector3, Color, Sprite, SpriteMaterial, CanvasTexture, AdditiveBlending } from 'three';
import { rasterizePolygon, inflateMask, sidesAt } from './inflate.js';
import { makeThing } from './thing.js';
import { dominantColor } from './palette.js';

const HOLD = 0.35, MIN_POINTS = 12, MIN_LENGTH = 0.12, MAX_POINTS = 600;

/** resample a closed loop evenly, then round it (Chaikin ×2) so finger jitter becomes a soft silhouette */
function smoothLoop(poly, N = 72) {
  const n = poly.length; const seg = []; let total = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(d); total += d; }
  let out = []; let acc = 0, i = 0, next = 0; const step = total / N;
  while (out.length < N) { while (acc + seg[i] < next && out.length < N) { acc += seg[i]; i = (i + 1) % n; } const a = poly[i], b = poly[(i + 1) % n]; const t = seg[i] > 0 ? (next - acc) / seg[i] : 0; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); next += step; }
  for (let k = 0; k < 2; k++) { const nx = []; for (let j = 0; j < out.length; j++) { const p = out[j], q = out[(j + 1) % out.length]; nx.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); } out = nx; }
  return out;
}
const head = new Vector3(), tmp = new Vector3(), n = new Vector3(), u = new Vector3(), v = new Vector3();
const UP = new Vector3(0, 1, 0);

function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c); }

export function makeTraceSystem(world, active, hands, sound, events, onThing) {
  class TraceSystem extends createSystem({}, {}) {
    init() {
      this.tracing = null; this.pending = null;
      this.line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: 0.9 }));
      this.line.geometry.setAttribute('position', new BufferAttribute(new Float32Array(MAX_POINTS * 3), 3)); this.line.geometry.setDrawRange(0, 0); this.line.frustumCulled = false; this.line.visible = false; this.scene.add(this.line);
      this.tip = new Sprite(new SpriteMaterial({ map: glowTex(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })); this.tip.scale.setScalar(0.03); this.scene.add(this.tip);
      this.cameraEntity = null; this.useCamera = /OculusBrowser/i.test(navigator.userAgent);
      hands.on('pinchstart', (h) => { if (this.tracing) return; const cup = active.cup; if (cup) { cup.group.getWorldPosition(tmp); if (hands.tip[h].distanceTo(tmp) < 0.2) return; } this.pending = { hand: h, at: hands.tip[h].clone(), t: 0 }; });
      hands.on('pinchend', (h) => { if (this.pending && this.pending.hand === h) this.pending = null; if (this.tracing && this.tracing.hand === h) this.finish(); });
      window.addEventListener('keydown', (e) => { if (e.key === 't') this.demoTrace(); });
    }
    ensureCamera() {
      if (!this.useCamera || this.cameraEntity) return;
      try { this.cameraEntity = world.createEntity(); this.cameraEntity.addComponent(CameraSource, { facing: 'back', width: 1280, height: 960, frameRate: 30 }); } catch (e) { this.cameraEntity = null; }
    }
    update(delta) {
      const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      if (this.pending) {
        this.pending.t += delta;
        if (hands.tip[this.pending.hand].distanceTo(this.pending.at) > 0.03) { this.pending = null; }
        else if (this.pending.t > HOLD) { this.start(this.pending.hand); this.pending = null; }
      }
      if (this.tracing) {
        const p = hands.tip[this.tracing.hand]; const pts = this.tracing.points;
        if (pts.length === 0 || p.distanceTo(pts[pts.length - 1]) > 0.004) { if (pts.length < MAX_POINTS) { pts.push(p.clone()); this.redraw(); if (pts.length % 6 === 0) sound.tick(0.7, 0.02); } }
        this.tip.position.copy(p); this.tip.material.opacity = 0.9;
      } else this.tip.material.opacity *= 0.9;
    }
    start(hand) { this.ensureCamera(); this.tracing = { hand, points: [] }; this.line.visible = true; sound.tick(1.2, 0.05); }
    redraw() { const pts = this.tracing.points; const a = this.line.geometry.attributes.position; for (let i = 0; i < pts.length; i++) a.setXYZ(i, pts[i].x, pts[i].y, pts[i].z); a.needsUpdate = true; this.line.geometry.setDrawRange(0, pts.length); }
    finish() {
      const pts = this.tracing.points; this.tracing = null; this.line.visible = false;
      let len = 0; for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
      if (pts.length < MIN_POINTS || len < MIN_LENGTH) { sound.tick(0.5, 0.03); return; }
      this.build(pts);
    }
    build(pts) {
      // plane facing the player through the centroid
      const c = new Vector3(); for (const p of pts) c.add(p); c.multiplyScalar(1 / pts.length);
      n.copy(head).sub(c).normalize(); if (Math.abs(n.dot(UP)) > 0.9) n.set(0, 0, 1);
      u.crossVectors(UP, n).normalize(); v.crossVectors(n, u).normalize();
      const poly = smoothLoop(pts.map(p => { tmp.copy(p).sub(c); return [tmp.dot(u), tmp.dot(v)]; }));
      const r = rasterizePolygon(poly, 96, 0.05);
      if (r.width < 0.03 || r.height < 0.03) return;
      const geo = inflateMask(r.mask, r.w, r.h, r.width, r.height, 0.45);
      if (!geo) return;
      const dominant = this.sampleColour(pts, poly, r) || new Color().setHSL(Math.random(), 0.35, 0.6);
      const thing = makeThing({ geometry: geo, dominant, width: r.width, height: r.height, sides: sidesAt(r.mask, r.w, r.h, 0.5) });
      thing.shape = { w: r.w, h: r.h, width: r.width, height: r.height, mask: r.mask };
      thing.spawnT = 0;
      // place at the real spot, front toward the player; the bbox centre is offset from the centroid by the margin
      thing.group.position.copy(c).addScaledVector(u, r.minX + r.width / 2).addScaledVector(v, r.minY + r.height / 2);
      thing.group.lookAt(head);
      const entity = world.createTransformEntity(thing.group); entity.addComponent(OneHandGrabbable, { rotate: true, translate: true }); thing.entity = entity;
      events.traced = true; sound.wake(1.3);
      onThing(thing, entity);
    }
    /** average colour of the camera frame inside the traced loop, using the eye projection as the camera model */
    sampleColour(pts, poly, r) {
      if (!this.cameraEntity) return null;
      let canvas = null; try { canvas = CameraUtils.captureFrame(this.cameraEntity); } catch (e) { canvas = null; }
      if (!canvas) return null;
      const cam = this.renderer.xr.getCamera(); const eye = cam.cameras && cam.cameras[0] ? cam.cameras[0] : cam;
      const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
      let minx = W, miny = H, maxx = 0, maxy = 0; const px = [];
      for (const p of pts) { const q = p.clone().project(eye); const x = (q.x + 1) / 2 * W, y = (1 - q.y) / 2 * H; px.push([x, y]); minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); }
      minx = Math.max(0, minx | 0); miny = Math.max(0, miny | 0); maxx = Math.min(W - 1, Math.ceil(maxx)); maxy = Math.min(H - 1, Math.ceil(maxy));
      if (maxx - minx < 4 || maxy - miny < 4) return null;
      const img = ctx.getImageData(minx, miny, maxx - minx, maxy - miny); const mask = new Uint8Array((maxx - minx) * (maxy - miny));
      for (let j = 0; j < maxy - miny; j++) for (let i = 0; i < maxx - minx; i++) { const x = minx + i, y = miny + j; let inside = false; for (let a = 0, b = px.length - 1; a < px.length; b = a++) { const [xa, ya] = px[a], [xb, yb] = px[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside; } mask[j * (maxx - minx) + i] = inside ? 1 : 0; }
      return dominantColor(img.data, mask);
    }
    /** emulator helper: a hand-drawn loop in front of the player becomes a thing */
    demoTrace() {
      const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      const fwd = new Vector3(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(this.line.quaternion.clone())); fwd.y = 0; fwd.normalize(); this.line.quaternion.identity();
      const c = head.clone().addScaledVector(fwd, 0.45); c.y -= 0.25; c.x += 0.15;
      const right = new Vector3(-fwd.z, 0, fwd.x); const pts = [];
      for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; const rr = 0.045 * (1 + 0.10 * Math.sin(a * 2) + 0.04 * Math.cos(a * 3)); pts.push(c.clone().addScaledVector(right, Math.cos(a) * rr).addScaledVector(UP, Math.sin(a) * rr * 1.2)); }
      this.build(pts);
    }
  }
  return TraceSystem;
}
