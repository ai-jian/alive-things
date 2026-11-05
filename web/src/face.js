// Faces, after the owner's reference sheet: big white googly eyes with a round black pupil that darts to look at
// things, no mouth most of the time. Moods swap the eye drawing: open (with a lid for sleepy or wary ones), wide,
// happy ^ ^, content ‿ ‿ (napping), cross (slanted lids). A small o mouth only when talking or surprised, and three
// little surprise marks that pop above the head. Flat cut-outs drawn on canvas, redrawn only when something changes.
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

const INK = '#1c1a2b', WHITE = '#fffdf8';
const tmp = new Vector3();

function canvasPlane(w, h, px, py) {
  const c = document.createElement('canvas'); c.width = px; c.height = py;
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat); mesh.renderOrder = 3;
  return { c, ctx: c.getContext('2d'), tex, mat, mesh };
}

/** one eye: draws itself from a small state, mirrored for the right eye */
function drawEye(e, st, mirror) {
  const { ctx, c } = e; const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  const rx = W * (st.mood === 'wide' ? 0.44 : 0.4), ry = H * (st.mood === 'wide' ? 0.45 : 0.41);
  const line = (draw) => { ctx.strokeStyle = INK; ctx.lineWidth = W * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); draw(); ctx.stroke(); };
  if (st.mood === 'happy') { line(() => { ctx.moveTo(cx - rx * 0.85, cy + ry * 0.3); ctx.quadraticCurveTo(cx, cy - ry * 0.95, cx + rx * 0.85, cy + ry * 0.3); }); e.tex.needsUpdate = true; return; }
  if (st.mood === 'content' || st.blink) { const k = st.blink ? 0.35 : 0.8; line(() => { ctx.moveTo(cx - rx * 0.85, cy - ry * 0.1 * k); ctx.quadraticCurveTo(cx, cy + ry * 0.9 * k, cx + rx * 0.85, cy - ry * 0.1 * k); }); e.tex.needsUpdate = true; return; }
  ctx.save();
  // the white, cut by the lid: a straight line for sleepy/wary, slanted toward the nose for cross.
  // A soft shadow rides under the white (same cut), so it sits on the body without an outline.
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.ellipse(cx, cy + H * 0.035, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
  const lid = st.mood === 'cross' ? Math.max(0.42, st.lid) : st.lid;
  if (lid > 0.02) {
    const yTop = cy - ry + 2 * ry * lid; const slant = st.mood === 'cross' ? ry * 0.55 * (mirror ? -1 : 1) : 0;
    ctx.save(); ctx.clip(); ctx.beginPath(); ctx.moveTo(0, yTop - slant); ctx.lineTo(W, yTop + slant); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  }
  ctx.clip(); ctx.fillStyle = 'rgba(28,20,60,0.18)'; ctx.beginPath(); ctx.ellipse(cx, cy + H * 0.035, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  // the pupil, clipped by the same shape
  const pr = W * (st.mood === 'wide' ? 0.17 : 0.215); const reach = rx - pr * 0.75;
  const px = cx + st.px * reach, py = cy - st.py * (ry - pr * 0.75) + (lid > 0.3 ? ry * lid * 0.5 : 0);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  // a tiny catch-light keeps it alive
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(px + pr * 0.38, py - pr * 0.4, pr * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.restore(); if (lid > 0.02) ctx.restore();
  e.tex.needsUpdate = true;
}

function drawMouth(m, kind, open) {
  const { ctx, c } = m; const W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
  if (!kind) { m.tex.needsUpdate = true; return; }
  ctx.fillStyle = INK; ctx.beginPath();
  if (kind === 'O') { ctx.ellipse(W / 2, H / 2, W * 0.3, H * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.ellipse(W / 2, H / 2, W * (0.2 + 0.08 * open), H * (0.16 + 0.26 * open), 0, 0, Math.PI * 2); ctx.fill(); }
  m.tex.needsUpdate = true;
}

function drawMarks(k) {
  const { ctx, c } = k; const W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,250,240,0.95)'; ctx.lineWidth = W * 0.07; ctx.lineCap = 'round';
  const seg = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0 * W, y0 * H); ctx.lineTo(x1 * W, y1 * H); ctx.stroke(); };
  seg(0.2, 0.55, 0.32, 0.72); seg(0.5, 0.18, 0.52, 0.48); seg(0.84, 0.36, 0.68, 0.6);
  k.tex.needsUpdate = true;
}

/**
 * Builds a face in the caller's units. Eyes sit on a round body of radius `bodyR` around the y axis, at height `y`.
 * @returns {{ group, eyes, feel(mood, seconds, opts?), update(dt, lookWorld), set(base) }}
 */
export function makeFace({ y = 0.62, bodyR = 0.6, size = 0.23, gap = 0.145, traits = {} } = {}) {
  const group = new Group();
  const eyes = [0, 1].map(i => {
    const e = canvasPlane(size, size * 1.1, 128, 140); const x = (i ? 1 : -1) * gap;
    const a = Math.asin(Math.max(-0.9, Math.min(0.9, x / bodyR)));
    e.mesh.position.set(Math.sin(a) * (bodyR + 0.012), y, Math.cos(a) * (bodyR + 0.012)); e.mesh.rotation.y = a; group.add(e.mesh); return e;
  });
  const mouth = canvasPlane(size * 0.55, size * 0.4, 64, 48); mouth.mesh.position.set(0, y - size * 0.62, bodyR + 0.014); group.add(mouth.mesh);
  const marks = canvasPlane(0.3, 0.25, 96, 80); drawMarks(marks); marks.mesh.position.set(bodyR * 0.75, y + 0.55, bodyR * 0.7); marks.mesh.rotation.y = 0.45; marks.mesh.visible = false; group.add(marks.mesh);

  const t = { curious: 0.5, sleepy: 0.3, shy: 0.2, playful: 0.4, ...traits };
  const f = {
    group, eyes, mouth, marks,
    base: { mood: 'open', lid: 0.08 + (t.sleepy > 0.6 ? 0.34 : t.sleepy * 0.2) },   // resting look comes from how you drew
    temp: null, tempT: 0, marksT: 0, talk: false, talkT: 0,
    px: 0, py: 0, tx: 0, ty: 0, sacT: 0.5, blinkT: 2 + Math.random() * 2, key: '', mkey: '',
    /** a passing feeling: 'happy' | 'wide' | 'cross' | 'content' | 'open'; marks: pop the !!! ; mouth: 'o' | 'O' */
    feel(mood, seconds = 1.2, opts = {}) { f.temp = { mood, lid: opts.lid ?? 0, mouth: opts.mouth || null }; f.tempT = seconds; if (opts.marks) f.marksT = 1.1; },
    set(base) { Object.assign(f.base, base); },
    update(dt, lookWorld) {
      if (f.tempT > 0) { f.tempT -= dt; if (f.tempT <= 0) f.temp = null; }
      const st = f.temp || f.base;
      // where to look, in face space: pupils dart (saccades) and hold, the way real eyes do
      if (lookWorld) {
        group.updateWorldMatrix(true, false); tmp.copy(lookWorld); group.worldToLocal(tmp); tmp.y -= y;
        const z = Math.max(0.05, tmp.z + 0.2);
        f.tx = Math.max(-1, Math.min(1, Math.atan2(tmp.x, z) / 0.7)); f.ty = Math.max(-1, Math.min(1, Math.atan2(tmp.y, Math.hypot(tmp.x, z)) / 0.6));
      }
      if (t.shy > 0.5 && !f.temp) { f.ty -= 0.35; f.tx *= 0.5; }   // shy ones look a little down
      f.sacT -= dt;
      const far = Math.hypot(f.tx - f.px, f.ty - f.py) > 0.45;
      if (f.sacT <= 0 || far) {
        const wander = f.sacT <= 0 && Math.random() < 0.25 + 0.35 * t.curious;      // curious eyes wander off on their own
        const gx = wander ? (Math.random() * 2 - 1) * 0.9 : f.tx, gy = wander ? (Math.random() * 2 - 1) * 0.6 : f.ty;
        const l = Math.hypot(gx, gy); const s = l > 1 ? 1 / l : 1;
        f.px = Math.round(gx * s * 8) / 8; f.py = Math.round(gy * s * 8) / 8; f.sacT = 0.5 + Math.random() * (2.4 - 1.4 * t.curious);
      }
      // blink (not while the eyes are already closed)
      f.blinkT -= dt; const blink = f.blinkT < 0.11 && (st.mood === 'open' || st.mood === 'wide' || st.mood === 'cross');
      if (f.blinkT < 0) f.blinkT = 2 + Math.random() * 3 + t.sleepy * 2;
      const key = `${st.mood}|${st.lid.toFixed(2)}|${f.px}|${f.py}|${blink ? 1 : 0}`;
      if (key !== f.key) { f.key = key; const s2 = { mood: st.mood, lid: st.lid, px: f.px, py: f.py, blink }; drawEye(eyes[0], s2, false); drawEye(eyes[1], s2, true); }
      // mouth: only for talking and surprise
      let mk = st.mouth || null, open = mk === 'o' ? 0.5 : 0;
      if (f.talk) { f.talkT += dt; mk = 'o'; open = [0.2, 1, 0.5, 0.9, 0.1][Math.floor(f.talkT * 9) % 5]; }
      const mkey = `${mk}|${open}`; if (mkey !== f.mkey) { f.mkey = mkey; drawMouth(mouth, mk, open); mouth.mesh.visible = !!mk; }
      // surprise marks pop and fade
      if (f.marksT > 0) { f.marksT -= dt; const k = 1 - f.marksT / 1.1; marks.mesh.visible = true; marks.mesh.scale.setScalar(k < 0.15 ? k / 0.15 * 1.15 : 1); marks.mat.opacity = Math.min(1, f.marksT * 3); }
      else marks.mesh.visible = false;
    },
    dispose() { for (const p of [...eyes, mouth, marks]) { p.tex.dispose(); p.mat.dispose(); p.mesh.geometry.dispose(); } },
  };
  return f;
}
