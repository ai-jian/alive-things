// The player never picks colours. One dominant colour → six stops: deep and hue-shifted at the bottom,
// the object's colour in the middle, warm light at the top. Mirrors unity/.../PaletteFromObject.cs.
import { Color } from 'three';

function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  return m === 0 ? [v, t, p] : m === 1 ? [q, v, p] : m === 2 ? [p, v, t] : m === 3 ? [p, q, v] : m === 4 ? [t, p, v] : [v, p, q];
}
function rgb2hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0; if (d > 0) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return [h, max === 0 ? 0 : d / max, max];
}

/** @param {Color} dominant  @returns {Color[]} six stops, deep → light */
export function paletteFromColor(dominant, driftDeep = -25, driftLight = 22) {
  let [h, s] = rgb2hsv(dominant.r, dominant.g, dominant.b);
  if (s < 0.15) { h = 0.72; s = 0.35; }                  // near-neutral objects borrow a soft violet dusk
  const vals = [0.34, 0.50, 0.68, 0.84, 0.94, 1.0];
  const sats = [0.95, 0.90, 0.80, 0.60, 0.35, 0.12];
  const drift = [1, 0.6, 0, -0.4, -0.8, -1];
  return vals.map((v, i) => {
    const d = drift[i] > 0 ? driftDeep * drift[i] : driftLight * -drift[i];
    const hh = ((h + d / 360) % 1 + 1) % 1;
    const [r, g, b] = hsv2rgb(hh, Math.min(1, s * sats[i] + (i >= 4 ? 0.05 : 0)), Math.min(1, v));
    return new Color(r, g, b);
  });
}

/** Dominant colour of an image region (for the camera path, when available). pixels: Uint8ClampedArray RGBA. */
export function dominantColor(pixels, mask) {
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    if (mask && !mask[p]) continue;
    const [, s, v] = rgb2hsv(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255);
    const wt = 0.2 + s * 0.8 * v;
    r += pixels[i] * wt; g += pixels[i + 1] * wt; b += pixels[i + 2] * wt; w += wt;
  }
  return w > 0 ? new Color(r / w / 255, g / w / 255, b / w / 255) : new Color(0.5, 0.5, 0.5);
}
