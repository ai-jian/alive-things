// Paint layer: intensity + wetness fields on the object's UV space, with the composite symmetry guide
// (around × mandala × mirror) and wet-ink diffusion. Ported from docs/lookdev-gradient.html.
// Budget work for a 72 Hz headset: the canvas is split into 32 px tiles. Diffusion runs only on tiles that are
// still wet, bytes are rebuilt only for tiles that changed, and only the changed rectangle goes to the GPU.
import { DataTexture, RedFormat, UnsignedByteType, RepeatWrapping, ClampToEdgeWrapping, LinearFilter } from 'three';

const T = 32;                                     // tile size in px
// exp(-2 q) for q = d² / r², tabulated: the stamps call it hundreds of thousands of times a second
const LUT_N = 2048, LUT_MAX = 8, LUT = new Float32Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) LUT[i] = Math.exp(-2 * (i / LUT_N) * LUT_MAX);
const gq = (q) => q >= LUT_MAX ? 0 : LUT[(q * (LUT_N / LUT_MAX)) | 0];

export class PaintLayer {
  /** set once by main.js so uploads can send only the changed rectangle */
  static renderer = null;

  /**
   * @param {object} o
   * @param {number} o.circumference  physical length of one U unit in metres (around the object)
   * @param {number} o.wallHeight     physical length of one V unit in metres (up the object)
   */
  constructor({ width = 1024, height = 512, circumference = 1, wallHeight = 1, bleed = 0.55 } = {}) {
    this.W = width; this.H = height; this.bleed = bleed;
    this.heat = new Float32Array(width * height);
    this.wet = new Float32Array(width * height);
    this.tmp = new Float32Array(width * height);
    this.bytes = new Uint8Array(width * height);
    this.texture = new DataTexture(this.bytes, width, height, RedFormat, UnsignedByteType);
    this.texture.wrapS = RepeatWrapping; this.texture.wrapT = ClampToEdgeWrapping;
    this.texture.minFilter = this.texture.magFilter = LinearFilter;
    this.TX = Math.ceil(width / T); this.TY = Math.ceil(height / T);
    this.wetT = new Uint8Array(this.TX * this.TY);       // tile is wet: diffuse it
    this.dirtyT = new Uint8Array(this.TX * this.TY);     // tile changed since the last upload
    this.inkT = new Uint16Array(this.TX * this.TY);      // sampled inked pixels per tile, for coverage
    this.anyWet = false; this.anyDirty = false; this.fullUpload = true; this.frozen = false;
    this.pxX = width / circumference; this.pxY = height / wallHeight;   // texture px per metre
    this.around = 2; this.mandala = 6; this.mirror = true;
    this.centre = { x: 0, y: height * 0.5 };
    this.folds = [4, 6, 8, 12];
    this.coverage = 0;
  }

  // kept for callers that only want "something changed"
  get dirty() { return this.anyDirty; }
  set dirty(v) { if (v) this.markAll(); }

  setCentreUV(u, v) { this.centre = { x: u * this.W, y: (1 - v) * this.H }; }
  stepFold(dir) { const i = Math.max(0, this.folds.indexOf(this.mandala)); this.mandala = this.folds[(i + dir + this.folds.length) % this.folds.length]; return this.mandala; }
  clear() { this.heat.fill(0); if (this.wet) this.wet.fill(0); this.wetT.fill(0); this.anyWet = false; this.markAll(); }
  /** everything changed (restored from a save, cleared) */
  markAll() { this.dirtyT.fill(1); this.anyDirty = true; this.fullUpload = true; }
  /** dry instantly: stop all diffusion (landing demo, restored creatures) */
  dry() { if (this.wet) this.wet.fill(0); this.wetT.fill(0); this.anyWet = false; }
  /** a finished creature never paints again: drop the working buffers (about 4 MB each) */
  freeze() { this.dry(); this.wet = null; this.tmp = null; this.frozen = true; }

  // ---- marks (uv in 0..1, dirUV unit vector in texture px space, radius/strength as in the web test) ----
  line(u, v, dir, radiusPx, strength) { if (this.frozen) return; this._sym((x, y, d) => this._lineK(x, y, radiusPx, d, strength), u * this.W, (1 - v) * this.H, dir); }
  dot(u, v, radiusPx, strength) { if (this.frozen) return; this._sym((x, y) => this._dotK(x, y, radiusPx, strength), u * this.W, (1 - v) * this.H, { x: 1, y: 0 }); }
  water(u, v, radiusPx, amount) { if (this.frozen) return; this._sym((x, y) => this._wet(x, y, radiusPx, amount), u * this.W, (1 - v) * this.H, { x: 1, y: 0 }); }

  _sym(fn, x, y, dir) {
    const { W, H, pxX, pxY, centre, mandala, around, mirror } = this;
    let dx = x - centre.x; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
    const px = dx / pxX, py = (y - centre.y) / pxY, pdx = dir.x / pxX, pdy = dir.y / pxY, pm = Math.hypot(pdx, pdy) || 1;
    const local = [];
    for (let k = 0; k < mandala; k++) {
      const a = k * 2 * Math.PI / mandala, c = Math.cos(a), s = Math.sin(a);
      local.push([px * c - py * s, px * s + py * c, (pdx * c - pdy * s) / pm, (pdx * s + pdy * c) / pm]);
      if (mirror) local.push([-px * c - py * s, -px * s + py * c, (-pdx * c - pdy * s) / pm, (-pdx * s + pdy * c) / pm]);
    }
    for (let j = 0; j < around; j++) {
      const shift = j * W / around;
      for (const [lx, ly, ldx, ldy] of local) {
        const cx = centre.x + shift + lx * pxX, cy = centre.y + ly * pxY; if (cy < 4 || cy > H - 4) continue;
        const dm = Math.hypot(ldx * pxX, ldy * pxY) || 1;
        fn(((cx % W) + W) % W, cy, { x: ldx * pxX / dm, y: ldy * pxY / dm });
      }
    }
  }

  // a short oriented dab: gaussian across the stroke, flat along it
  _lineK(cx, cy, r, d, strength) {
    const { W, H, heat, wet } = this; const R = r * 1.8, along = r * 1.5, s2 = 1 / ((r * 0.8) * (r * 0.8)), amp = strength * 0.12, wk = 2 * this.bleed;
    const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) { const dy = y - cy; const row = y * W;
      for (let x = x0; x <= x1; x++) { const dx = x - cx; const al = dx * d.x + dy * d.y; if (al > along || al < -along) continue;
        const ac = -dx * d.y + dy * d.x; const v = amp * gq(ac * ac * s2); if (v < 1e-4) continue;
        const i = row + (x < 0 ? x + W : x >= W ? x - W : x); const h = heat[i] + v; heat[i] = h > 1 ? 1 : h; const w = wet[i] + v * wk; wet[i] = w > 1 ? 1 : w; } }
    this._touch(x0 - 2, y0 - 2, x1 + 2, y1 + 2, true);
  }
  _dotK(cx, cy, r, strength) {
    const { W, H, heat, wet } = this; const R = r * 1.6, s2 = 1 / ((r * 1.3) * (r * 1.3)), amp = strength * 0.22, wk = 2 * this.bleed;
    const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(H - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) { const dy = y - cy; const row = y * W;
      for (let x = x0; x <= x1; x++) { const dx = x - cx; const v = amp * gq((dx * dx + dy * dy) * s2); if (v < 1e-4) continue;
        const i = row + (x < 0 ? x + W : x >= W ? x - W : x); const h = heat[i] + v; heat[i] = h > 1 ? 1 : h; const w = wet[i] + v * wk; wet[i] = w > 1 ? 1 : w; } }
    this._touch(x0 - 2, y0 - 2, x1 + 2, y1 + 2, true);
  }
  _wet(cx, cy, radius, amount) {
    const { W, H, wet } = this;
    const x0 = Math.floor(cx - radius), x1 = Math.ceil(cx + radius), y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(H - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - cx, y - cy); if (d > radius) continue; const i = y * W + (((x % W) + W) % W); wet[i] = Math.min(1, wet[i] + amount * (1 - d / radius)); }
    this._touch(x0 - 2, y0 - 2, x1 + 2, y1 + 2, false);
  }
  /** mark the tiles under a pixel box as wet (and changed, if ink was laid) */
  _touch(x0, y0, x1, y1, inked) {
    const { TX, TY } = this; const ty0 = Math.max(0, Math.floor(y0 / T)), ty1 = Math.min(TY - 1, Math.floor(y1 / T));
    const tx0 = Math.floor(x0 / T), tx1 = Math.floor(x1 / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let t = tx0; t <= tx1; t++) { const tx = ((t % TX) + TX) % TX, k = ty * TX + tx; this.wetT[k] = 1; if (inked) this.dirtyT[k] = 1; }
    this.anyWet = true; if (inked) this.anyDirty = true;
  }

  /** One diffusion step over the wet tiles. Called at ~20 Hz (every other or third frame). */
  diffuse(dt) {
    if (!this.anyWet || this.frozen) return;
    const { W, H, TX, TY, heat, wet, tmp, wetT, dirtyT } = this; const k = 0.22 * this.bleed * Math.min(1.8, dt * 30), decay = Math.pow(0.35, dt);   // step strength follows the step rate
    const list = []; for (let i = 0; i < wetT.length; i++) if (wetT[i]) list.push(i);
    for (const t of list) {
      const tx = t % TX, ty = (t / TX) | 0; const x0 = tx * T, y0 = Math.max(1, ty * T), x1 = Math.min(W, x0 + T), y1 = Math.min(H - 1, ty * T + T);
      let still = false;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * W + x; const w = wet[i]; if (w < 0.01) { tmp[i] = heat[i]; continue; }
        const l = y * W + (x === 0 ? W - 1 : x - 1), r = y * W + (x === W - 1 ? 0 : x + 1), u = i - W, d = i + W;
        tmp[i] = heat[i] + (heat[l] + heat[r] + heat[u] + heat[d] - 4 * heat[i]) * k * w;
        const sp = w * 0.55; if (wet[l] < sp) wet[l] = sp; if (wet[r] < sp) wet[r] = sp; if (wet[u] < sp) wet[u] = sp; if (wet[d] < sp) wet[d] = sp; still = true;
      }
      if (still) { dirtyT[t] = 1; this.anyDirty = true;
        // ink creeping over a tile edge wakes the neighbour
        wetT[ty * TX + (tx + 1) % TX] = 1; wetT[ty * TX + (tx + TX - 1) % TX] = 1; if (ty > 0) wetT[t - TX] = 1; if (ty < TY - 1) wetT[t + TX] = 1;
      } else wetT[t] = 2;   // dry: settle below, then let go
    }
    let any = false;
    for (const t of list) {
      const tx = t % TX, ty = (t / TX) | 0; const x0 = tx * T, y0 = Math.max(1, ty * T), x1 = Math.min(W, x0 + T), y1 = Math.min(H - 1, ty * T + T);
      for (let y = y0; y < y1; y++) { const row = y * W; for (let x = x0; x < x1; x++) { const i = row + x; heat[i] = tmp[i]; wet[i] *= decay; } }
      if (wetT[t] === 2) wetT[t] = 0; else any = true;
    }
    // neighbours woken this step that were not in the list stay flagged for the next step
    if (!any) for (let i = 0; i < wetT.length; i++) if (wetT[i]) { any = true; break; }
    this.anyWet = any;
  }

  /** rebuild bytes for changed tiles and send only that rectangle to the GPU */
  upload() {
    if (!this.anyDirty) return;
    const { W, H, TX, TY, heat, bytes, dirtyT, inkT } = this;
    let tx0 = TX, ty0 = TY, tx1 = -1, ty1 = -1;
    for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) {
      const t = ty * TX + tx; if (!dirtyT[t]) continue; dirtyT[t] = 0;
      if (tx < tx0) tx0 = tx; if (tx > tx1) tx1 = tx; if (ty < ty0) ty0 = ty; if (ty > ty1) ty1 = ty;
      const x0 = tx * T, y0 = ty * T, x1 = Math.min(W, x0 + T), y1 = Math.min(H, y0 + T); let ink = 0;
      for (let y = y0; y < y1; y++) { const row = y * W; for (let x = x0; x < x1; x++) { const i = row + x; const h = heat[i]; bytes[i] = h >= 1 ? 255 : (h * 255) | 0; if (((x | y) & 3) === 0 && h > 0.04) ink++; } }
      inkT[t] = ink;
    }
    this.anyDirty = false;
    let sum = 0; for (let i = 0; i < inkT.length; i++) sum += inkT[i]; this.coverage = sum / ((W >> 2) * (H >> 2));   // measured share of the surface that carries ink
    if (tx1 < 0) return;
    const r = PaintLayer.renderer; const props = r && r.properties.get(this.texture);
    if (this.fullUpload || !props || !props.__webglTexture || props.__version !== this.texture.version) { this.texture.needsUpdate = true; this.fullUpload = false; return; }
    const gl = r.getContext(); const x = tx0 * T, y = ty0 * T, w = Math.min(W, (tx1 + 1) * T) - x, h = Math.min(H, (ty1 + 1) * T) - y;
    r.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, W); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RED, gl.UNSIGNED_BYTE, bytes);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  }
}
