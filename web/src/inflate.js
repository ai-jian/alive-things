// Silhouette → soft pillow mesh.
// inflatePolygon (current): build straight from the smoothed outline. Boundary vertices snap onto the real curve,
// interior heights come from the exact distance to the outline, two Laplacian passes smooth the sheet, and the front
// and back sheets share their rim vertices so the pillow is closed and the rim is rounded. No stair-steps, no bands.
// inflateMask (legacy): the old raster path, kept so saved creatures from before still rebuild.
import { BufferGeometry, BufferAttribute } from 'three';

/** closed polygon [[x,y]...] in metres → BufferGeometry in metres, centred on the bbox, front toward +z, uv = bbox-normalised. */
export function inflatePolygon(poly, { cells = 112, thickness = 0.45, profile = 0.5 } = {}) {
  const n = poly.length; if (n < 3) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const width = maxX - minX, height = maxY - minY; if (width < 1e-4 || height < 1e-4) return null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const s = Math.max(width, height) / cells;                      // cell size
  const w = Math.ceil(width / s) + 3, h = Math.ceil(height / s) + 3;
  const ox = cx - (w * s) / 2, oy = cy - (h * s) / 2;              // grid origin so the shape sits centred with a 1-cell margin
  const px = (i) => ox + (i + 0.5) * s, py = (j) => oy + (j + 0.5) * s;

  // inside test (even-odd) and exact distance / nearest point on the outline
  const inside = new Uint8Array(w * h), dist = new Float32Array(w * h), nearX = new Float32Array(w * h), nearY = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = px(i), y = py(j); let c = false; let best = Infinity, bx = x, by = y;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const [xa, ya] = poly[a], [xb, yb] = poly[b];
      if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c;
      // distance to segment a-b
      const dx = xb - xa, dy = yb - ya; const L2 = dx * dx + dy * dy; let t = L2 > 0 ? ((x - xa) * dx + (y - ya) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = xa + dx * t, qy = ya + dy * t; const d = Math.hypot(x - qx, y - qy); if (d < best) { best = d; bx = qx; by = qy; }
    }
    inside[j * w + i] = c ? 1 : 0; dist[j * w + i] = best; nearX[j * w + i] = bx; nearY[j * w + i] = by;
  }
  const at = (i, j) => (i >= 0 && j >= 0 && i < w && j < h) ? inside[j * w + i] : 0;
  let maxD = 0; for (let k = 0; k < w * h; k++) if (inside[k]) maxD = Math.max(maxD, dist[k]);
  if (maxD <= 0) return null;
  const maxZ = Math.min(width, height) * thickness * 0.5;

  // vertices: one per inside cell for the front sheet; back sheet shares rim vertices, duplicates the interior
  const idxF = new Int32Array(w * h).fill(-1), idxB = new Int32Array(w * h).fill(-1), isRim = new Uint8Array(w * h);
  const pos = [], uv = [];
  const addV = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u, v); return pos.length / 3 - 1; };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i; if (!inside[k]) continue;
    const rim = !(at(i - 1, j) && at(i + 1, j) && at(i, j - 1) && at(i, j + 1)); isRim[k] = rim ? 1 : 0;
    let x = px(i), y = py(j), z;
    if (rim) { x = nearX[k]; y = nearY[k]; z = 0; }                         // snap onto the outline
    else z = Math.pow(dist[k] / maxD, profile) * maxZ;
    const u = (x - minX) / width, v = (y - minY) / height;
    idxF[k] = addV(x - cx, y - cy, z, u, v);
    idxB[k] = rim ? idxF[k] : addV(x - cx, y - cy, -z, u, v);
  }
  // Laplacian smoothing of interior vertices (x, y, z), rim stays put; front and back move together
  for (let it = 0; it < 2; it++) {
    const next = pos.slice();
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
      const k = j * w + i; if (!inside[k] || isRim[k]) continue;
      const nb = [k - 1, k + 1, k - w, k + w].filter(q => inside[q]); if (nb.length < 3) continue;
      let sx = 0, sy = 0, sz = 0; for (const q of nb) { const f = idxF[q] * 3; sx += pos[f]; sy += pos[f + 1]; sz += Math.abs(pos[f + 2]); }
      const f = idxF[k] * 3, b = idxB[k] * 3; const nx = (pos[f] + sx / nb.length) / 2, ny = (pos[f + 1] + sy / nb.length) / 2, nz = (Math.abs(pos[f + 2]) + sz / nb.length) / 2;
      next[f] = nx; next[f + 1] = ny; next[f + 2] = nz; next[b] = nx; next[b + 1] = ny; next[b + 2] = -nz;
    }
    for (let q = 0; q < pos.length; q++) pos[q] = next[q];
  }
  // faces: full quads get two triangles; three-cornered quads at the rim get one
  const tris = [];
  const quad = (a, b, c, d, back) => { if (back) tris.push(a, c, b, b, c, d); else tris.push(a, b, c, b, d, c); };
  const tri = (a, b, c, back) => { if (back) tris.push(a, c, b); else tris.push(a, b, c); };
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const k00 = j * w + i, k10 = k00 + 1, k01 = k00 + w, k11 = k01 + 1;
    const m = (inside[k00] ? 1 : 0) + (inside[k10] ? 2 : 0) + (inside[k01] ? 4 : 0) + (inside[k11] ? 8 : 0);
    for (const back of [false, true]) {
      const I = back ? idxB : idxF;
      if (m === 15) quad(I[k00], I[k10], I[k01], I[k11], back);
      else if (m === 7) tri(I[k00], I[k10], I[k01], back);
      else if (m === 11) tri(I[k00], I[k10], I[k11], back);
      else if (m === 13) tri(I[k00], I[k11], I[k01], back);
      else if (m === 14) tri(I[k10], I[k11], I[k01], back);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(tris); geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return { geometry: geo, width, height, minX, minY };
}

/** where the outline's sides are at a height fraction (0 = bottom, 1 = top): [leftFrac, rightFrac] of width */
export function sidesFromPolygon(poly, heightFrac = 0.5) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const y = minY + (maxY - minY) * heightFrac; const xs = [];
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > y) !== (yb > y)) xs.push(xa + (xb - xa) * (y - ya) / (yb - ya)); }
  if (xs.length < 2) return [0.5, 0.5];
  const w = maxX - minX; return [(Math.min(...xs) - minX) / w, (Math.max(...xs) - minX) / w];
}

// ---------------------------------------------------------------- legacy raster path (saved creatures from before)
export function inflateMask(mask, w, h, worldWidth, worldHeight, thickness = 0.5) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
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
    tris.push(a, b, c, b, e, c);
    a = back[y * w + x]; b = back[y * w + x + 1]; c = back[(y + 1) * w + x]; e = back[(y + 1) * w + x + 1];
    tris.push(a, c, b, b, c, e);
  }
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
export function sidesAt(mask, w, h, heightFrac) {
  const row = Math.max(0, Math.min(h - 1, Math.round((1 - heightFrac) * (h - 1))));
  let l = -1, r = -1; for (let x = 0; x < w; x++) if (mask[row * w + x]) { if (l < 0) l = x; r = x; }
  if (l < 0) return [0.5, 0.5];
  return [l / w, (r + 1) / w];
}
