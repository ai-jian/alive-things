// Persistence: creatures survive between sessions in localStorage. Paint is stored at half resolution as base64.
const KEY = 'alive-things/v1';

function downsample(heat, W, H) { const w = W >> 1, h = H >> 1, out = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * 2) * W + x * 2; out[y * w + x] = Math.min(255, ((heat[i] + heat[i + 1] + heat[i + W] + heat[i + W + 1]) / 4) * 255) | 0; } return out; }
function upsample(bytes, w, h, heat) { const W = w * 2; for (let y = 0; y < h * 2; y++) for (let x = 0; x < W; x++) heat[y * W + x] = bytes[(y >> 1) * w + (x >> 1)] / 255; }
const b64 = { enc: (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }, dec: (str) => { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; } };

export function loadAll() { try { const j = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(j) ? j : []; } catch (e) { return []; } }
export function saveAll(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

/** serialize a creature-bearing cup */
export function serialize(cup, extra = {}) {
  const { W, H } = cup.paint;
  const rec = { id: cup.id || (cup.id = 'c' + Date.now().toString(36)), kind: cup.kind || 'cup', dominant: cup.dominant ? cup.dominant.getHex() : 0xeee0c6, paletteName: cup.paletteName || null, traits: cup.traits, paint: { w: W >> 1, h: H >> 1, data: b64.enc(downsample(cup.paint.heat, W, H)) }, bornAt: cup.bornAt || Date.now(), ...extra };
  if (cup.kind === 'thing' && cup.shape) rec.shape = { w: cup.shape.w, h: cup.shape.h, width: cup.shape.width, height: cup.shape.height, mask: b64.enc(cup.shape.mask) };
  return rec;
}
export function decodeMask(rec) { return rec.shape ? { ...rec.shape, mask: b64.dec(rec.shape.mask) } : null; }
export function restorePaint(cup, rec) { if (!rec.paint) return; const bytes = b64.dec(rec.paint.data); upsample(bytes, rec.paint.w, rec.paint.h, cup.paint.heat); cup.paint.dirty = true; cup.paint.coverage = 0.5; }
export function upsert(rec) { const all = loadAll(); const i = all.findIndex(r => r.id === rec.id); if (i >= 0) all[i] = rec; else all.push(rec); return saveAll(all); }
