// Persistence in localStorage, built to stay small and never fail silently.
// - One small list of creature records (position, traits, friendships): rewritten only when something changed.
// - Each creature's paint is saved once, as a grey PNG at half resolution under its own key (tens of KB, not 175).
// - Island memory: how long it has grown, when you were last here, which days you came.
// Old v1 saves (paint inline as base64) still load.
const KEY = 'alive-things/v2', OLD = 'alive-things/v1', PAINT = 'alive-things/paint/', META = 'alive-things/island';

function downsample(heat, W, H) { const w = W >> 1, h = H >> 1, out = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * 2) * W + x * 2; out[y * w + x] = Math.min(255, ((heat[i] + heat[i + 1] + heat[i + W] + heat[i + W + 1]) / 4) * 255) | 0; } return out; }
function upsample(bytes, w, h, heat, stride = 1) { const W = w * 2; for (let y = 0; y < h * 2; y++) for (let x = 0; x < W; x++) heat[y * W + x] = bytes[((y >> 1) * w + (x >> 1)) * stride] / 255; }
const b64 = { enc: (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }, dec: (str) => { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; } };

export const status = { full: false, lastError: null };
function put(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { status.full = true; status.lastError = e && e.name; console.warn('[alive] save failed:', key, e && e.name); return false; } }
function get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

export function loadAll() {
  try { const j = JSON.parse(get(KEY) || 'null'); if (Array.isArray(j)) return j; } catch (e) {}
  try { const old = JSON.parse(get(OLD) || '[]'); return Array.isArray(old) ? old : []; } catch (e) { return []; }
}
let lastWritten = '';
/** write the whole (small) list only if it differs from what is stored */
export function saveAll(list) { const s = JSON.stringify(list); if (s === lastWritten) return true; const ok = put(KEY, s); if (ok) lastWritten = s; return ok; }

/** a creature's record, without paint (that is saved once, separately) */
export function serialize(cup, extra = {}) {
  const rec = { id: cup.id || (cup.id = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)), kind: cup.kind || 'cup', dominant: cup.dominant ? cup.dominant.getHex() : 0xeee0c6, paletteName: cup.paletteName || null, traits: cup.traits, bornAt: cup.bornAt || (cup.bornAt = Date.now()), ...extra };
  if (cup.kind === 'thing' && cup.shape) rec.shape = cup.shape.poly ? { poly: cup.shape.poly, width: cup.shape.width, height: cup.shape.height } : { w: cup.shape.w, h: cup.shape.h, width: cup.shape.width, height: cup.shape.height, mask: cup.shape.mask instanceof Uint8Array ? b64.enc(cup.shape.mask) : cup.shape.mask };
  return rec;
}
/** save the finished paint once: a grey PNG at half size */
export function savePaint(cup) {
  if (!cup.id) serialize(cup);
  const { W, H, heat } = cup.paint; if (!heat) return false;
  const w = W >> 1, h = H >> 1, small = downsample(heat, W, H);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const img = x.createImageData(w, h);
  for (let i = 0; i < small.length; i++) { const v = small[i]; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return put(PAINT + cup.id, c.toDataURL('image/png'));
}
export function removePaint(id) { try { localStorage.removeItem(PAINT + id); } catch (e) {} }
export function decodeMask(rec) { return rec.shape && rec.shape.mask ? { ...rec.shape, mask: b64.dec(rec.shape.mask) } : null; }
/** paint comes back asynchronously (PNG decode); old inline saves come back at once */
export function restorePaint(cup, rec) {
  if (rec.paint && rec.paint.data) { const bytes = b64.dec(rec.paint.data); upsample(bytes, rec.paint.w, rec.paint.h, cup.paint.heat); cup.paint.markAll(); cup.paintSaved = false; return; }
  const url = get(PAINT + rec.id); if (!url) return; cup.paintSaved = true;
  const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data; if (cup.paint.heat) { upsample(d, im.width, im.height, cup.paint.heat, 4); cup.paint.markAll(); } }; im.src = url;
}

export function loadIsland() { try { return { age: 0, lastSeen: 0, days: [], ...(JSON.parse(get(META) || '{}')) }; } catch (e) { return { age: 0, lastSeen: 0, days: [] }; } }
export function saveIsland(m) { return put(META, JSON.stringify(m)); }
