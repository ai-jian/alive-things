// Colour is never chosen by the player. Ready objects use the four palettes from docs/lookdev-gradient.html;
// captured objects get a ramp built from their own dominant colour with the same structure (deep → light).
import { Color } from 'three';

const P = (arr) => arr.map(([r, g, b]) => new Color(r, g, b));
export const PALETTES = {
  dusk:  P([[0.16, 0.16, 0.42], [0.42, 0.30, 0.58], [0.76, 0.46, 0.62], [0.96, 0.64, 0.60], [1.0, 0.84, 0.72], [1.0, 0.96, 0.88]]),
  dawn:  P([[0.10, 0.36, 0.46], [0.28, 0.62, 0.66], [0.62, 0.84, 0.78], [0.90, 0.93, 0.76], [1.0, 0.96, 0.80], [1.0, 1.0, 0.94]]),
  peach: P([[0.06, 0.10, 0.55], [0.10, 0.30, 0.95], [0.15, 0.75, 0.45], [0.98, 0.45, 0.70], [1.0, 0.78, 0.66], [1.0, 0.97, 0.92]]),
  moss:  P([[0.14, 0.22, 0.20], [0.26, 0.42, 0.34], [0.50, 0.64, 0.44], [0.78, 0.80, 0.52], [0.96, 0.92, 0.70], [1.0, 0.99, 0.90]]),
};
export const PALETTE_ORDER = ['dusk', 'dawn', 'peach', 'moss'];
export function namedPalette(name) { return (PALETTES[name] || PALETTES.dusk).map(c => c.clone()); }

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

/**
 * Six stops from one colour, shaped like the dusk ramp: deep and hue-shifted at the bottom, the colour itself
 * in the middle, warm light at the top. Weak colours (white cups, grey books) are pushed to a real hue first.
 * @param {Color} dominant  @returns {Color[]}
 */
export function paletteFromColor(dominant, driftDeep = -28, driftLight = 24) {
  let [h, s] = rgb2hsv(dominant.r, dominant.g, dominant.b);
  if (s < 0.12) { h = 0.70; }                               // near-neutral: borrow dusk's violet
  s = Math.max(s, 0.62);                                     // always a real colour, never mud
  const vals = [0.36, 0.52, 0.70, 0.86, 0.95, 1.0];
  const sats = [1.0, 0.92, 0.78, 0.55, 0.30, 0.10];
  const drift = [1, 0.6, 0, -0.4, -0.8, -1];
  return vals.map((v, i) => {
    const d = drift[i] > 0 ? driftDeep * drift[i] : driftLight * -drift[i];
    const hh = ((h + d / 360) % 1 + 1) % 1;
    const [r, g, b] = hsv2rgb(hh, Math.min(1, s * sats[i] + (i >= 4 ? 0.06 : 0)), Math.min(1, v));
    return new Color(r, g, b);
  });
}

/** Dominant colour of an image region (camera path). pixels: Uint8ClampedArray RGBA. */
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
