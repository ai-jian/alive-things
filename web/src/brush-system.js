// The gesture brush as an IWSDK system. Reads index fingertips from the player rig, decides what the touch
// means (line, dot, dwell bloom, long-press centre, two-finger twist), and paints through the symmetry guide.
import { createSystem, Grabbed } from '@iwsdk/core';
import { Vector3, Vector2, Raycaster } from 'three';

const TOUCH_IN = 0.015;     // m: a fingertip this close to the wall starts touching
const TOUCH_OUT = 0.03;     // m: and keeps touching until it is this far off (hand tracking jitters a few mm)
const BRIDGE = 0.12;        // s: a stroke survives losing the wall this long, so jitter does not break lines
const MAX_DEPTH = 0.03;     // m: press this deep for full width
const LONG_PRESS = 0.8;     // s
const STILL = 0.012;        // m: a long press allows this much drift of the smoothed fingertip
const TICK_GAP = 0.09;      // s: ticks never come faster than this
const DWELL = 0.15;         // s
const SPACING_PX = 7;

const tmpA = new Vector3(), tmpB = new Vector3();

export function makeBrushSystem(active, events, hands, sound) {
  class BrushSystem extends createSystem({}, {}) {
    init() {
      this.hands = { left: this._hand(), right: this._hand(), mouse: this._hand() };
      // Desktop / emulator fallback: drag on the cup with the mouse to paint. The pointer becomes a virtual fingertip.
      this.mouse = { down: false, ndc: new Vector2(), ray: new Raycaster(), tip: null };
      const el = this.renderer.domElement;
      // the emulator mirrors the XR view on its own canvas, so take the rect from whichever canvas was hit
      const toNdc = (ev) => { const c = ev.target && ev.target.tagName === 'CANVAS' ? ev.target : el; const r = c.getBoundingClientRect(); this.mouse.ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); };
      // listen on window in the capture phase: the emulator overlay and the input system stop propagation before the canvas sees anything
      const overUI = (ev) => { const t = ev.target; if (!t || t.tagName === 'CANVAS' || t === document.body || t === document.documentElement || t.id === 'app') return false; return true; };
      window.addEventListener('pointerdown', (ev) => { if (ev.button !== 0 || overUI(ev)) return; toNdc(ev); if (this._mouseHit()) this.mouse.down = true; }, true);
      window.addEventListener('pointermove', (ev) => { if (!this.mouse.down) return; toNdc(ev); this._mouseHit(); }, true);
      const up = () => { this.mouse.down = false; this.mouse.tip = null; };
      window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      this.pinching = hands.pinching;
      this.twist = null;
      this.stats = { speedAccum: 0, speedSamples: 0, dots: 0, stamps: 0, turnAccum: 0, dwellTime: 0, touchTime: 0 };
    }
    _mouseHit() {
      const cup = active.cup; if (!cup) return false;
      const cam = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
      if (!cam || !cam.projectionMatrixInverse) return false;
      this.mouse.ray.setFromCamera(this.mouse.ndc, cam);
      const hit = this.mouse.ray.intersectObject(cup.body, false)[0];
      if (!hit) { this.mouse.tip = null; return false; }
      // push the virtual fingertip 4 mm into the wall so it counts as a light press
      const n = hit.face.normal.clone().transformDirection(cup.body.matrixWorld);
      this.mouse.tip = hit.point.clone().addScaledVector(n, -0.004);
      return true;
    }

    _hand() { return { lostT: 0, smooth: null, down: false, pressDone: false, downT: 0, lastMoveT: 0, strokeLen: 0, smoothSpeed: 0, lastU: 0, lastV: 0, lastX: 0, lastY: 0, downU: 0, downV: 0, moved: 0, tipWorld: new Vector3(), touching: false }; }

    update(delta, time) {
      hands.update(time);
      const cup = active.cup; if (!cup) return;
      cup.tick(delta, time);
      const grabbed = active.entity && active.entity.hasComponent(Grabbed); if (grabbed) events.grabbed = true;
      // a hand coming close makes it glow a little, like it noticed you
      let near = Infinity; cup.group.getWorldPosition(tmpB); for (const side of ['left', 'right']) near = Math.min(near, hands.tip[side].distanceTo(tmpB));
      const wantGlow = near < 0.14 && !events.inSpace ? 0.35 * (1 - near / 0.14) : 0; cup.approachGlow = (cup.approachGlow || 0) + (wantGlow - (cup.approachGlow || 0)) * Math.min(1, delta * 4);
      // on the table it notices you: turns a little toward the nearest hand and leans in
      if (!grabbed && !cup.inStudio && !events.inSpace && !cup.creature) {
        let nearest = null; for (const side of ['left', 'right']) if (hands.tip[side].distanceTo(tmpB) === near) nearest = hands.tip[side];
        if (nearest && near < 0.25) { const local = cup.group.worldToLocal(tmpA.copy(nearest)); const yaw = Math.atan2(local.x, local.z); cup.group.rotation.y += yaw * 0.35 * Math.min(1, delta * 3); }
        cup.group.rotation.x += ((-0.12 * (cup.approachGlow || 0) / 0.35) - cup.group.rotation.x) * Math.min(1, delta * 4);
      }
      if (cup.spawnT !== undefined && cup.spawnT < 1) { cup.spawnT = Math.min(1, cup.spawnT + delta * 1.5); const k = cup.spawnT; const s = k < 0.7 ? k / 0.7 * 1.12 : 1.12 - (k - 0.7) / 0.3 * 0.12; cup.group.scale.setScalar(Math.max(0.001, s) * (cup.scale || 1)); /* relative to the object's own base scale */ cup.group.position.y += delta * 0.02 * (1 - k); }
      const touches = [];
      for (const side of ['left', 'right', 'mouse']) {
        const h = this.hands[side];
        if (side === 'mouse') { if (!this.mouse.down || !this.mouse.tip) { if (h.down) this._end(h, time); continue; } h.tipWorld.copy(this.mouse.tip); }
        else {
          // adaptive smoothing: heavy when the finger is nearly still (kills tracking jitter), light when it moves
          const raw = hands.tip[side]; if (!h.smooth) h.smooth = raw.clone();
          const v = raw.distanceTo(h.smooth) / Math.max(delta, 1e-3); const a = Math.min(1, 0.25 + v * 1.5);
          h.smooth.lerp(raw, a); h.tipWorld.copy(h.smooth);
        }
        const local = cup.body.worldToLocal(tmpA.copy(h.tipWorld));
        const s = cup.surface(local);
        // a hand that is pinching is holding the cup, not painting; once touching, it takes more distance to let go
        const limit = (h.touching ? TOUCH_OUT : TOUCH_IN) / cup.group.scale.x;
        const touching = (side === 'mouse' || !this.pinching[side]) && s.onWall && s.gap < limit && s.gap > -0.5;
        if (touching) touches.push({ side, s, local: local.clone() });
        this._handStep(h, touching, s, local, time, delta);
      }
      cup.touching = touches.length > 0;
      // two fingertips on the wall: twist changes the fold
      if (touches.length === 2) {
        const a = touches[0].local, b = touches[1].local;
        const ang = Math.atan2(b.y - a.y, Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z));
        if (this.twist == null) { this.twist = { a0: ang, acc: 0 }; for (const side of ['left', 'right']) this._end(this.hands[side], time); }
        else { let d = ang - this.twist.a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.twist.acc += d; this.twist.a0 = ang;
          const step = Math.PI / 5; while (this.twist.acc > step) { this.twist.acc -= step; cup.paint.stepFold(1); events.foldChanged = true; this.tick(1.3, true); } while (this.twist.acc < -step) { this.twist.acc += step; cup.paint.stepFold(-1); events.foldChanged = true; this.tick(0.8, true); } }
      } else this.twist = null;
    }

    _handStep(h, touching, s, local, time, delta) {
      const cup = active.cup;
      if (!touching) {
        // a short loss of contact keeps the stroke alive; a real lift ends it
        if (h.down) { h.lostT += delta; if (h.lostT > BRIDGE) { this._end(h, time); h.touching = false; } } else h.touching = false;
        return;
      }
      h.touching = true; h.lostT = 0;
      if (this.twist) return;
      const x = s.u * cup.paint.W, y = (1 - s.v) * cup.paint.H;
      if (!h.down) {
        h.down = true; h.pressDone = false; h.counted = false; h.downT = h.lastMoveT = time; h.strokeLen = 0; h.smoothSpeed = 0; h.moved = 0;
        h.downWorld = (h.downWorld || new Vector3()).copy(h.tipWorld); h.moveMax = 0;
        h.lastU = s.u; h.lastV = s.v; h.lastX = x; h.lastY = y; h.downU = s.u; h.downV = s.v;
        cup.pokeAt(local);
        return;
      }
      h.moveMax = Math.max(h.moveMax || 0, h.tipWorld.distanceTo(h.downWorld));
      let dx = x - h.lastX, dy = y - h.lastY; if (dx > cup.paint.W / 2) dx -= cup.paint.W; if (dx < -cup.paint.W / 2) dx += cup.paint.W;
      const len = Math.hypot(dx, dy);
      if (len < SPACING_PX) {
        // a long press means the fingertip really stayed put in space, whatever the canvas scale
        if (!h.pressDone && h.strokeLen === 0 && h.moveMax < STILL && time - h.downT > LONG_PRESS) { h.pressDone = true; cup.paint.setCentreUV(s.u, s.v); events.centreSet = true; cup.centreMoved = true; this.tick(0.6, true); }
        else if (!h.pressDone && h.strokeLen > 0 && time - h.lastMoveT > DWELL) { const r = 10 + Math.min(30, (time - h.lastMoveT) * 25); cup.paint.water(h.lastU, h.lastV, r, delta * 1.5); this.stats.dwellTime += delta; if (time - h.lastMoveT > 0.6) events.dwell = true; }
        return;
      }
      // a held press that then travels becomes a stroke: the centre stays where it was set, painting starts here
      if (h.pressDone) { if (h.moveMax > STILL + 0.01) { h.pressDone = false; h.lastX = x; h.lastY = y; h.lastU = s.u; h.lastV = s.v; h.lastMoveT = time; } return; }
      const speedPx = len / Math.max(delta, 1e-4);                       // px per second
      const speedM = speedPx / cup.paint.pxX * (cup.group.scale.x / (cup.scale || 1));   // hand speed in metres, however big the canvas is
      h.smoothSpeed = h.smoothSpeed * 0.6 + speedM * 0.4; h.lastMoveT = time; this.stats.speedAccum += speedM; this.stats.speedSamples++; this.stats.touchTime += delta;
      const slow = 1 - Math.min(1, h.smoothSpeed / 0.5);
      const taperIn = Math.min(1, h.strokeLen / 28);
      const press = 0.75 + 0.5 * Math.min(1, Math.max(0, s.depth) * cup.group.scale.x / MAX_DEPTH);
      const width = (4 + 12 * slow) * (0.35 + 0.65 * taperIn) * press;
      const a = (0.3 + 0.7 * slow) * (0.4 + 0.6 * taperIn);
      const dir = { x: dx / len, y: dy / len };
      if (h.lastDir) this.stats.turnAccum += Math.abs(Math.atan2(h.lastDir.x * dir.y - h.lastDir.y * dir.x, h.lastDir.x * dir.x + h.lastDir.y * dir.y)) * 180 / Math.PI; h.lastDir = dir; this.stats.stamps++;
      const nx = (((h.lastX + dir.x * SPACING_PX) % cup.paint.W) + cup.paint.W) % cup.paint.W, ny = h.lastY + dir.y * SPACING_PX;
      cup.paint.line(nx / cup.paint.W, 1 - ny / cup.paint.H, dir, width, a);
      h.lastX = nx; h.lastY = ny; h.lastU = nx / cup.paint.W; h.lastV = 1 - ny / cup.paint.H; h.strokeLen += SPACING_PX; h.moved += len;
      if (h.strokeLen >= SPACING_PX * 4 && !h.counted) { h.counted = true; events.strokes++; }
      this.tick(1);
    }

    _end(h, time) {
      const cup = active.cup; if (!h.down || !cup) return;
      if (!h.pressDone && h.strokeLen === 0 && time - h.downT < 0.25 + BRIDGE) { cup.paint.dot(h.downU, h.downV, 9, 1.0); this.stats.dots++; this.stats.stamps++; this.tick(1); }
      h.lastDir = null;
      h.down = false;
    }

    tick(pitch = 1, force) { const now = performance.now() / 1000; if (!force && now - (this.lastTick || 0) < TICK_GAP) return; this.lastTick = now; sound.tick(pitch, force ? 0.04 : 0.022); }
    /** a hand moving fast on the surface: frantic, not quiet */
    scribbling() { for (const side of ['left', 'right', 'mouse']) { const h = this.hands[side]; if (h.down && h.smoothSpeed > 0.35) return true; } return false; }
    getStats() { return this.stats; }
    setStats(st) { if (st) this.stats = st; else this.resetStats(); }
    resetStats() { this.stats = { speedAccum: 0, speedSamples: 0, dots: 0, stamps: 0, turnAccum: 0, dwellTime: 0, touchTime: 0 }; }
    /** stats for traits */
    summary() { const st = this.stats, cup = active.cup; return { averageSpeed: st.speedSamples ? st.speedAccum / st.speedSamples : 0, coverage: cup ? cup.paint.coverage : 0, dotRatio: st.stamps ? st.dots / st.stamps : 0, turnRatio: st.stamps ? Math.min(1, st.turnAccum / (st.stamps * 20)) : 0, dwellRatio: st.touchTime + st.dwellTime > 0 ? st.dwellTime / (st.touchTime + st.dwellTime) : 0, mandala: cup ? cup.paint.mandala : 6, centreMoved: !!(cup && cup.centreMoved) }; }
  }
  return BrushSystem;
}
