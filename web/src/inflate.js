// Silhouette → puffy mesh (simplified Teddy inflation). Port of unity/.../SilhouetteInflator.cs.
// mask: Uint8Array w*h, 1 = inside. Returns a BufferGeometry in metres, centred, front sheet toward +z.
import { BufferGeometry, BufferAttribute } from 'three';

export function inflateMask(mask, w, h, worldWidth, worldHeight, thickness = 0.5) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  // chamfer distance transform
  const big = w + h, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? big : 0;
  const G = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!mask[y * w + x]) continue; d[y * w + x] = Math.min(d[y * w + x], G(x - 1, y) + 3, G(x, y - 1) + 3, G(x - 1, y - 1) + 4, G(x + 1, y - 1) + 4); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { if (!mask[y * w + x]) continue; d[y * w + x] = Math.min(d[y * w + x], G(x + 1, y) + 3, G(x, y + 1) + 3, G(x + 1, y + 1) + 4, G(x - 1, y + 1) + 4); }
  let maxD = 0; for (let i = 0; i < d.length; i++) maxD = Math.max(maxD, d[i]);
  if (maxD <= 0) return null;
  const sx = worldWidth / w, sy = worldHeight / h, maxZ = Math.min(worldWidth, worldHeight) * thickness * 0.5;
  const verts = [], uvs = [], tris = [];
  const front = new Int32Array(w * h).fill(-1), back = new Int32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    const z = Math.sqrt(d[y * w + x] / maxD) * maxZ;
    const px = (x + 0.5) * sx - worldWidth / 2, py = (h - y - 0.5) * sy - worldHeight / 2;
    const u = (x + 0.5) / w, v = 1 - (y + 0.5) / h;
    front[y * w + x] = verts.length / 3; verts.push(px, py, z); uvs.push(u, v);
    back[y * w + x] = verts.length / 3; verts.push(px, py, -z); uvs.push(u, v);
  }
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    if (!(inside(x, y) && inside(x + 1, y) && inside(x, y + 1) && inside(x + 1, y + 1))) continue;
    let a = front[y * w + x], b = front[y * w + x + 1], c = front[(y + 1) * w + x], e = front[(y + 1) * w + x + 1];
    tris.push(a, b, c, b, e, c);                       // front faces +z (counter-clockwise seen from +z)
    a = back[y * w + x]; b = back[y * w + x + 1]; c = back[(y + 1) * w + x]; e = back[(y + 1) * w + x + 1];
    tris.push(a, c, b, b, c, e);
  }
  // rim: stitch front and back where an inside edge borders the outside
  const stitch = (x0, y0, x1, y1, horizontal) => {
    const boundary = horizontal ? (!inside(x0, y0 - 1) || !inside(x0, y0 + 1) || !inside(x1, y1 - 1) || !inside(x1, y1 + 1)) : (!inside(x0 - 1, y0) || !inside(x0 + 1, y0) || !inside(x1 - 1, y1) || !inside(x1 + 1, y1));
    if (!boundary) return;
    const f0 = front[y0 * w + x0], f1 = front[y1 * w + x1], b0 = back[y0 * w + x0], b1 = back[y1 * w + x1];
    tris.push(f0, f1, b0, f1, b1, b0, f0, b0, f1, f1, b0, b1);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!inside(x, y)) continue; if (inside(x + 1, y)) stitch(x, y, x + 1, y, true); if (inside(x, y + 1)) stitch(x, y, x, y + 1, false); }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(tris); geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

/** where the sides of the silhouette are at a given height fraction (0 = bottom, 1 = top): [leftFrac, rightFrac] of width */
export function sidesAt(mask, w, h, heightFrac) {
  const row = Math.max(0, Math.min(h - 1, Math.round((1 - heightFrac) * (h - 1))));
  let l = -1, r = -1; for (let x = 0; x < w; x++) if (mask[row * w + x]) { if (l < 0) l = x; r = x; }
  if (l < 0) return [0.5, 0.5];
  return [l / w, (r + 1) / w];
}

/** polygon (array of [x,y] in metres, any winding) → mask grid of g×g over its bbox with a margin. */
export function rasterizePolygon(poly, g = 96, margin = 0.06) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const bw = maxX - minX, bh = maxY - minY, mx = bw * margin, my = bh * margin;
  minX -= mx; maxX += mx; minY -= my; maxY += my;
  const w = g, h = Math.max(8, Math.round(g * (maxY - minY) / (maxX - minX)));
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = minX + (i + 0.5) / w * (maxX - minX), y = maxY - (j + 0.5) / h * (maxY - minY);
    let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; }
    mask[j * w + i] = c ? 1 : 0;
  }
  // smooth the mask edge a little (one dilate+erode) so finger jitter doesn't make spikes
  const tmp = new Uint8Array(w * h); const nb = (m, i, j) => (i >= 0 && j >= 0 && i < w && j < h) ? m[j * w + i] : 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) n += nb(mask, i + di, j + dj); tmp[j * w + i] = n >= 4 ? 1 : 0; }
  return { mask: tmp, w, h, width: maxX - minX, height: maxY - minY, minX, minY };
}
