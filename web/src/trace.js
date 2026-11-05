// Capture: pinch in the air and trace around any real object. The loop becomes a silhouette, the silhouette is
// inflated into a soft thing at the real size and place, and (on a headset with camera access) the colour inside
// the loop becomes its palette. No computer vision, nothing to fail.
import { createSystem, OneHandGrabbable, CameraSource, CameraUtils } from '@iwsdk/core';
import { Line, BufferGeometry, BufferAttribute, LineBasicMaterial, Vector3, Color, Sprite, SpriteMaterial, CanvasTexture, AdditiveBlending } from 'three';
import { inflatePolygon, sidesFromPolygon } from './inflate.js';
import { makeThing } from './thing.js';
import { dominantColor, PALETTE_ORDER } from './palette.js';

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

/** normal of the best-fit plane through a point cloud (smallest eigenvector of the covariance, by power iteration) */
function bestFitNormal(pts, c, out) {
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const p of pts) { const x = p.x - c.x, y = p.y - c.y, z = p.z - c.z; xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z; }
  // the inverse iteration needs the smallest eigenvalue: iterate on (tr·I − C), whose largest eigenvector is C's smallest
  const tr = xx + yy + zz + 1e-9; const M = [tr - xx, -xy, -xz, -xy, tr - yy, -yz, -xz, -yz, tr - zz];
  let a = 0.3, b = 0.9, d = 0.3;
  for (let i = 0; i < 40; i++) { const na = M[0] * a + M[1] * b + M[2] * d, nb = M[3] * a + M[4] * b + M[5] * d, nd = M[6] * a + M[7] * b + M[8] * d; const l = Math.hypot(na, nb, nd) || 1; a = na / l; b = nb / l; d = nd / l; }
  return out.set(a, b, d).normalize();
}

function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(1, 'rgba(255,240,210,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c); }

export function makeTraceSystem(world, active, hands, sound, events, onThing) {
  class TraceSystem extends createSystem({}, {}) {
    init() {
      this.tracing = null; this.pending = null;
      this.line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: 0.9 }));
      this.line.geometry.setAttribute('position', new BufferAttribute(new Float32Array(MAX_POINTS * 3), 3)); this.line.geometry.setDrawRange(0, 0); this.line.frustumCulled = false; this.line.visible = false; this.scene.add(this.line);
      this.tip = new Sprite(new SpriteMaterial({ map: glowTex(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })); this.tip.scale.setScalar(0.03); this.scene.add(this.tip);
      this.cameraEntity = null; this.useCamera = !!window.REAL_HEADSET;
      hands.on('pinchstart', (h) => { if (this.tracing || events.inSpace || (active.cup && active.cup.inStudio)) return; if (events.island && hands.tip[h].distanceTo(events.island.pos) < events.island.r) return; const cup = active.cup; if (cup) { cup.group.getWorldPosition(tmp); if (hands.tip[h].distanceTo(tmp) < 0.2) return; } this.pending = { hand: h, at: hands.tip[h].clone(), t: 0 }; });
      hands.on('pinchend', (h) => { if (this.pending && this.pending.hand === h) this.pending = null; if (this.tracing && this.tracing.hand === h) this.finish(); });
      window.addEventListener('keydown', (e) => { if (e.key === 't') this.demoTrace(); });
    }
    ensureCamera() {
      if (!this.useCamera || this.cameraEntity) return;
      try { this.cameraEntity = world.createEntity(); this.cameraEntity.addComponent(CameraSource, { facing: 'back', width: 1280, height: 960, frameRate: 30 }); } catch (e) { this.cameraEntity = null; }
    }
    update(delta) {
      const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      // both hands pinching is an island gesture, never a trace
      if (this.pending && hands.pinching.left && hands.pinching.right) this.pending = null;
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
    nextPalette() { const k = (events.paletteIndex = (events.paletteIndex || 0) + 1); return PALETTE_ORDER[(k - 1) % PALETTE_ORDER.length]; }
    start(hand) { this.ensureCamera(); this.tracing = { hand, points: [] }; this.line.visible = true; sound.tick(1.2, 0.05); }
    redraw() { const pts = this.tracing.points; const a = this.line.geometry.attributes.position; for (let i = 0; i < pts.length; i++) a.setXYZ(i, pts[i].x, pts[i].y, pts[i].z); a.needsUpdate = true; this.line.geometry.setDrawRange(0, pts.length); }
    finish() {
      const pts = this.tracing.points; this.tracing = null; this.line.visible = false;
      let len = 0; for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
      if (pts.length < MIN_POINTS || len < MIN_LENGTH) { if (len > 0.04) this.failed(); else sound.tick(0.5, 0.03); return; }
      this.build(pts);
    }
    build(pts) {
      // the plane the finger actually drew in (best fit), not a plane facing the eyes
      const c = new Vector3(); for (const p of pts) c.add(p); c.multiplyScalar(1 / pts.length);
      bestFitNormal(pts, c, n); tmp.copy(head).sub(c); if (n.dot(tmp) < 0) n.negate();
      const flat = Math.abs(n.y) > 0.75;      // a loop drawn around the object on the table: a footprint
      let poly, place;
      if (flat) {
        // footprint → a soft upright pebble as wide as the footprint across your view, a little taller than wide
        tmp.copy(head).sub(c); tmp.y = 0; if (tmp.lengthSq() < 1e-6) tmp.set(0, 0, 1); n.copy(tmp.normalize());
        u.crossVectors(UP, n).normalize();
        let lo = Infinity, hi = -Infinity, dlo = Infinity, dhi = -Infinity; for (const p of pts) { tmp.copy(p).sub(c); const a = tmp.dot(u), d = tmp.dot(n); lo = Math.min(lo, a); hi = Math.max(hi, a); dlo = Math.min(dlo, d); dhi = Math.max(dhi, d); }
        const w = Math.max(0.04, hi - lo), h = w * 1.15; const raw = [];
        for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2; const sx = Math.cos(t), sy = Math.sin(t); const e = 4; raw.push([Math.sign(sx) * Math.pow(Math.abs(sx), 2 / e) * w / 2, Math.sign(sy) * Math.pow(Math.abs(sy), 2 / e) * h / 2]); }
        poly = smoothLoop(raw);
        let minY = Infinity; for (const p of pts) minY = Math.min(minY, p.y);
        const tableY = this.getTableY ? this.getTableY() : null;
        place = c.clone().addScaledVector(u, (lo + hi) / 2).addScaledVector(n, (dlo + dhi) / 2); place.y = (tableY != null && Math.abs(tableY - minY) < 0.15 ? tableY : minY) + h / 2;
        v.copy(UP);
      } else {
        // upright axis = world up projected into the drawing plane, so a tilted trace still stands up
        v.copy(UP).addScaledVector(n, -UP.dot(n)).normalize(); u.crossVectors(v, n).normalize();
        poly = smoothLoop(pts.map(p => { tmp.copy(p).sub(c); return [tmp.dot(u), tmp.dot(v)]; }));
      }
      const r = inflatePolygon(poly, { cells: 112, thickness: 0.45 });
      if (!r || r.width < 0.03 || r.height < 0.03) { this.failed(); return; }
      // colour from the camera; without a frame, a reference palette in turn (never a random hue)
      const dominant = this.sampleColour(pts, poly, r);
      const thing = makeThing({ geometry: r.geometry, dominant: dominant || undefined, paletteName: dominant ? null : this.nextPalette(), width: r.width, height: r.height, sides: sidesFromPolygon(poly, 0.5) });
      thing.shape = { poly: poly.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]), width: r.width, height: r.height };
      thing.spawnT = 0; thing.footprint = flat;
      // place at the real spot (bbox centre), front toward the player, standing up
      if (flat) thing.group.position.copy(place).addScaledVector(UP, r.minY + r.height / 2);
      else thing.group.position.copy(c).addScaledVector(u, r.minX + r.width / 2).addScaledVector(v, r.minY + r.height / 2);
      tmp.copy(head); tmp.y = thing.group.position.y; thing.group.lookAt(tmp);
      const entity = world.createTransformEntity(thing.group); entity.addComponent(OneHandGrabbable, { rotate: true, translate: true }); thing.entity = entity;
      events.traced = true; sound.wake(1.3);
      onThing(thing, entity);
    }
    failed() { events.traceFailed = (events.traceFailed || 0) + 1; sound.tick(0.5, 0.03); }
    /** average colour of the camera frame inside the traced loop, using the eye projection as the camera model */
    sampleColour(pts, poly, r) {
      if (!this.cameraEntity) return null;
      let canvas = null; try { canvas = CameraUtils.captureFrame(this.cameraEntity); } catch (e) { canvas = null; }
      if (!canvas) return null;
      const cam = this.renderer.xr.getCamera(); const eye = cam.cameras && cam.cameras[0] ? cam.cameras[0] : cam;
      const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
      let minx = W, miny = H, maxx = 0, maxy = 0; const px = [];
      // the passthrough camera does not sit at the eye, so the projected loop is only roughly right:
      // sample its inner part (shrunk 45% toward the middle), which still lands on the object when the edge misses
      let sx = 0, sy = 0; const raw = pts.map(p => { const q = p.clone().project(eye); const x = (q.x + 1) / 2 * W, y = (1 - q.y) / 2 * H; sx += x; sy += y; return [x, y]; }); sx /= raw.length; sy /= raw.length;
      for (const [rx, ry] of raw) { const x = sx + (rx - sx) * 0.55, y = sy + (ry - sy) * 0.55; px.push([x, y]); minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); }
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
