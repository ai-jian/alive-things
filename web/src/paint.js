// Paint layer: intensity + wetness fields on the object's UV space, with the composite symmetry guide
// (around × mandala × mirror) and wet-ink diffusion. Ported from docs/lookdev-gradient.html.
import { DataTexture, RedFormat, UnsignedByteType, RepeatWrapping, ClampToEdgeWrapping, LinearFilter } from 'three';

export class PaintLayer {
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
    this.dirty = true; this.wetBox = null;
    this.pxX = width / circumference; this.pxY = height / wallHeight;   // texture px per metre
    this.around = 2; this.mandala = 6; this.mirror = true;
    this.centre = { x: 0, y: height * 0.5 };
    this.folds = [4, 6, 8, 12];
    this.coverage = 0;
  }

  setCentreUV(u, v) { this.centre = { x: u * this.W, y: (1 - v) * this.H }; }
  stepFold(dir) { const i = Math.max(0, this.folds.indexOf(this.mandala)); this.mandala = this.folds[(i + dir + this.folds.length) % this.folds.length]; return this.mandala; }
  clear() { this.heat.fill(0); this.wet.fill(0); this.wetBox = null; this.dirty = true; this.coverage = 0; }

  // ---- marks (uv in 0..1, dirUV unit vector in texture px space, radius/strength as in the web test) ----
  line(u, v, dir, radiusPx, strength) { this._sym((x, y, d) => this._kernel(x, y, radiusPx * 1.8, (dx, dy) => { const al = dx * d.x + dy * d.y, ac = -dx * d.y + dy * d.x; if (Math.abs(al) > radiusPx * 1.5) return 0; return strength * 0.12 * gauss(ac, radiusPx * 0.8); }), u * this.W, (1 - v) * this.H, dir); }
  dot(u, v, radiusPx, strength) { this._sym((x, y) => this._kernel(x, y, radiusPx * 1.6, (dx, dy) => strength * 0.22 * gauss(Math.hypot(dx, dy), radiusPx * 1.3)), u * this.W, (1 - v) * this.H, { x: 1, y: 0 }); }
  water(u, v, radiusPx, amount) { this._sym((x, y) => this._wet(x, y, radiusPx, amount), u * this.W, (1 - v) * this.H, { x: 1, y: 0 }); }

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

  _kernel(cx, cy, radius, fn) {
    const { W, H } = this;
    const x0 = Math.floor(cx - radius), x1 = Math.ceil(cx + radius), y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(H - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = fn(x - cx, y - cy); if (v <= 0) continue;
      const i = y * W + (((x % W) + W) % W);
      this.heat[i] = Math.min(1, this.heat[i] + v); this.wet[i] = Math.min(1, this.wet[i] + v * 2 * this.bleed);
    }
    this._grow(x0 - 2, y0 - 2, x1 + 2, y1 + 2); this.dirty = true;
    this.coverage = Math.min(1, this.coverage + (radius * radius * 2.5) / (W * H));   // one unit ≈ its own footprint
  }
  _wet(cx, cy, radius, amount) {
    const { W, H } = this;
    const x0 = Math.floor(cx - radius), x1 = Math.ceil(cx + radius), y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(H - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - cx, y - cy); if (d > radius) continue; const i = y * W + (((x % W) + W) % W); this.wet[i] = Math.min(1, this.wet[i] + amount * (1 - d / radius)); }
    this._grow(x0 - 2, y0 - 2, x1 + 2, y1 + 2);
  }
  _grow(x0, y0, x1, y1) { const b = this.wetBox; if (!b) this.wetBox = { x0, y0, x1, y1 }; else { b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1); } }

  /** One diffusion step over the wet region. Call at ~30 Hz. */
  diffuse(dt) {
    const b = this.wetBox; if (!b) return;
    const { W, H, heat, wet, tmp } = this; let any = false; const k = 0.22 * this.bleed, decay = Math.pow(0.45, dt);
    const y0 = Math.max(1, b.y0), y1 = Math.min(H - 2, b.y1);
    for (let y = y0; y <= y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const xi = ((x % W) + W) % W, i = y * W + xi; const w = wet[i]; if (w < 0.01) { tmp[i] = heat[i]; continue; }
      const l = y * W + ((xi - 1 + W) % W), r = y * W + ((xi + 1) % W), u = i - W, d = i + W;
      tmp[i] = heat[i] + (heat[l] + heat[r] + heat[u] + heat[d] - 4 * heat[i]) * k * w;
      wet[l] = Math.max(wet[l], w * 0.55); wet[r] = Math.max(wet[r], w * 0.55); wet[u] = Math.max(wet[u], w * 0.55); wet[d] = Math.max(wet[d], w * 0.55); any = true;
    }
    for (let y = y0; y <= y1; y++) for (let x = b.x0; x <= b.x1; x++) { const i = y * W + (((x % W) + W) % W); heat[i] = tmp[i]; wet[i] *= decay; }
    this._grow(b.x0 - 1, b.y0 - 1, b.x1 + 1, b.y1 + 1);
    if (!any) this.wetBox = null; else this.dirty = true;
    if (this.wetBox && this.wetBox.x1 - this.wetBox.x0 > W * 1.5) { this.wetBox.x0 = 0; this.wetBox.x1 = W - 1; }
  }

  upload() { if (!this.dirty) return; const { heat, bytes } = this; for (let i = 0; i < heat.length; i++) bytes[i] = Math.min(255, heat[i] * 255) | 0; this.texture.needsUpdate = true; this.dirty = false; }
}

const gauss = (d, r) => Math.exp(-(d * d) / (2 * r * r * 0.25));
