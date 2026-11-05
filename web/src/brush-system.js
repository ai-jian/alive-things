// The gesture brush as an IWSDK system. Reads index fingertips from the player rig, decides what the touch
// means (line, dot, dwell bloom, long-press centre, two-finger twist), and paints through the symmetry guide.
import { createSystem, Grabbed } from '@iwsdk/core';
import { Vector3, Vector2, Raycaster } from 'three';

const TOUCH = 0.012;        // m: how close a fingertip must be to the wall to count as touching
const MAX_DEPTH = 0.02;     // m: press this deep for full width
const LONG_PRESS = 0.6;     // s
const DWELL = 0.15;         // s
const SPACING_PX = 7;

const tmpA = new Vector3(), tmpB = new Vector3();

export function makeBrushSystem(cup, cupEntity, events = { strokes: 0, dwell: false, grabbed: false, centreSet: false, foldChanged: false }) {
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
      this.pinching = { left: false, right: false };
      this.twist = null;
      this.audio = null;
      this._bindSession = (s) => {
        if (!s || this._session === s) return; this._session = s;
        s.addEventListener('selectstart', e => { this.pinching[e.inputSource.handedness] = true; });
        s.addEventListener('selectend', e => { this.pinching[e.inputSource.handedness] = false; });
      };
    }
    _mouseHit() {
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

    _hand() { return { down: false, pressDone: false, downT: 0, lastMoveT: 0, strokeLen: 0, smoothSpeed: 0, lastU: 0, lastV: 0, lastX: 0, lastY: 0, downU: 0, downV: 0, moved: 0, tipWorld: new Vector3(), touching: false }; }

    update(delta, time) {
      this._bindSession(this.renderer.xr.getSession());
      cup.tick(delta, time);
      const grabbed = cupEntity.hasComponent(Grabbed); if (grabbed) events.grabbed = true;
      const tips = this.player.indexTipSpaces;
      const touches = [];
      for (const side of ['left', 'right', 'mouse']) {
        const h = this.hands[side];
        if (side === 'mouse') { if (!this.mouse.down || !this.mouse.tip) { if (h.down) this._end(h, time); continue; } h.tipWorld.copy(this.mouse.tip); }
        else tips[side].getWorldPosition(h.tipWorld);
        const local = cup.body.worldToLocal(tmpA.copy(h.tipWorld));
        const s = cup.surface(local);
        // a hand that is pinching is holding the cup, not painting
        const touching = (side === 'mouse' || !this.pinching[side]) && s.onWall && s.gap < TOUCH / cup.scale && s.gap > -0.5;
        if (touching) touches.push({ side, s, local: local.clone() });
        this._handStep(h, touching, s, local, time, delta);
      }
      // two fingertips on the wall: twist changes the fold
      if (touches.length === 2) {
        const a = touches[0].local, b = touches[1].local;
        const ang = Math.atan2(b.y - a.y, Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z));
        if (this.twist == null) { this.twist = { a0: ang, acc: 0 }; for (const side of ['left', 'right']) this._end(this.hands[side], time); }
        else { let d = ang - this.twist.a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.twist.acc += d; this.twist.a0 = ang;
          const step = Math.PI / 5; while (this.twist.acc > step) { this.twist.acc -= step; cup.paint.stepFold(1); events.foldChanged = true; this.tick(1.3); } while (this.twist.acc < -step) { this.twist.acc += step; cup.paint.stepFold(-1); events.foldChanged = true; this.tick(0.8); } }
      } else this.twist = null;
    }

    _handStep(h, touching, s, local, time, delta) {
      if (!touching) { if (h.down) this._end(h, time); h.touching = false; return; }
      if (this.twist) return;
      const x = s.u * cup.paint.W, y = (1 - s.v) * cup.paint.H;
      if (!h.down) {
        h.down = true; h.pressDone = false; h.counted = false; h.downT = h.lastMoveT = time; h.strokeLen = 0; h.smoothSpeed = 0; h.moved = 0;
        h.lastU = s.u; h.lastV = s.v; h.lastX = x; h.lastY = y; h.downU = s.u; h.downV = s.v;
        cup.pokeAt(local);
        return;
      }
      let dx = x - h.lastX, dy = y - h.lastY; if (dx > cup.paint.W / 2) dx -= cup.paint.W; if (dx < -cup.paint.W / 2) dx += cup.paint.W;
      const len = Math.hypot(dx, dy);
      if (len < SPACING_PX) {
        if (!h.pressDone && h.strokeLen === 0 && time - h.downT > LONG_PRESS) { h.pressDone = true; cup.paint.setCentreUV(s.u, s.v); events.centreSet = true; this.tick(0.6); }
        else if (!h.pressDone && h.strokeLen > 0 && time - h.lastMoveT > DWELL) { const r = 10 + Math.min(30, (time - h.lastMoveT) * 25); cup.paint.water(h.lastU, h.lastV, r, delta * 1.5); if (time - h.lastMoveT > 0.6) events.dwell = true; }
        return;
      }
      if (h.pressDone) return;
      const speedPx = len / Math.max(delta, 1e-4);                       // px per second
      const speedM = speedPx / cup.paint.pxX;                            // metres per second along the surface
      h.smoothSpeed = h.smoothSpeed * 0.6 + speedM * 0.4; h.lastMoveT = time;
      const slow = 1 - Math.min(1, h.smoothSpeed / 0.5);
      const taperIn = Math.min(1, h.strokeLen / 28);
      const press = 0.6 + 0.8 * Math.min(1, s.depth * cup.scale / MAX_DEPTH);
      const width = (4 + 12 * slow) * (0.35 + 0.65 * taperIn) * press;
      const a = (0.3 + 0.7 * slow) * (0.4 + 0.6 * taperIn);
      const dir = { x: dx / len, y: dy / len };
      const nx = (((h.lastX + dir.x * SPACING_PX) % cup.paint.W) + cup.paint.W) % cup.paint.W, ny = h.lastY + dir.y * SPACING_PX;
      cup.paint.line(nx / cup.paint.W, 1 - ny / cup.paint.H, dir, width, a);
      h.lastX = nx; h.lastY = ny; h.lastU = nx / cup.paint.W; h.lastV = 1 - ny / cup.paint.H; h.strokeLen += SPACING_PX; h.moved += len;
      if (h.strokeLen >= SPACING_PX * 4 && !h.counted) { h.counted = true; events.strokes++; }
      this.tick(1);
    }

    _end(h, time) {
      if (!h.down) return;
      if (!h.pressDone && h.strokeLen === 0 && time - h.downT < 0.25) { cup.paint.dot(h.downU, h.downV, 9, 1.0); this.tick(1); }
      h.down = false;
    }

    tick(pitch = 1) {
      try {
        this.audio = this.audio || new (window.AudioContext || window.webkitAudioContext)();
        const c = this.audio, o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = (1400 + Math.random() * 300) * pitch;
        g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.06);
        o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.07);
      } catch (e) { /* audio not available yet */ }
    }
  }
  return BrushSystem;
}
