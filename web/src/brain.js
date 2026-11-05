// Free will for the garden. Four needs rise at rates set by traits; the highest picks the behaviour.
// Flat garden disc, simple steering. Whispers are wordless cards in the creature's own palette.
import { Vector3, CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

const tmp = new Vector3(), tmp2 = new Vector3();

export class Brain {
  constructor(cup, garden, sound) {
    this.cup = cup; this.garden = garden; this.sound = sound; this.t = cup.traits || { curious: .5, sleepy: .3, social: .5, playful: .4, shy: .2 };
    this.need = { explore: Math.random() * 0.3, rest: 0, company: Math.random() * 0.3, play: 0 };
    this.state = 'idle'; this.timer = 1 + Math.random() * 2; this.target = new Vector3(); this.partner = null; this.affinity = new Map();
    this.speed = 0.04 * (1 - 0.5 * this.t.sleepy) + 0.03 * this.t.playful;   // m/s, tabletop scale
    this.whisper = makeWhisper(); garden.group.add(this.whisper.mesh); this.whisperT = 0;
    this.pickWander();
  }
  pos() { return this.cup.group.position; }
  pickWander() { const r = Math.sqrt(Math.random()) * this.garden.radius * 0.85; const a = Math.random() * Math.PI * 2; this.target.set(Math.cos(a) * r, this.pos().y, Math.sin(a) * r); }
  decide(all) {
    const n = this.need; this.partner = null;
    const top = Math.max(n.explore, n.rest, n.company, n.play);
    if (top < 0.35) { this.enter('idle', 2 + Math.random() * 3); return; }
    if (top === n.rest) { this.enter('nap', 8 + Math.random() * 8); n.rest = 0; return; }
    if (top === n.company) { const other = this.nearest(all); if (other) { this.partner = other; this.enter('approach', 8); return; } }
    if (top === n.play && this.t.curious > 0.4) { this.enter('look', 3 + Math.random() * 3); n.play *= 0.4; return; }
    this.pickWander(); this.enter('wander', 3 + Math.random() * 5); n.explore *= 0.4;
  }
  enter(s, seconds) { this.state = s; this.timer = seconds; if (this.cup.creature) this.cup.creature.walking = (s === 'wander' || s === 'approach'); }
  nearest(all) { let best = null, bd = Infinity; for (const o of all) { if (o === this) continue; let d = o.pos().distanceToSquared(this.pos()); d *= 1 - 0.5 * (this.affinity.get(o) || 0); if (d < bd) { bd = d; best = o; } } return best; }
  bond(o, d) { const v = Math.min(1, (this.affinity.get(o) || 0) + d); this.affinity.set(o, v); }
  moveToward(to, dt, stopAt) {
    tmp.copy(to).sub(this.pos()); tmp.y = 0; const dist = tmp.length(); if (dist <= stopAt) return true;
    tmp.normalize(); this.pos().addScaledVector(tmp, Math.min(dist, this.speed * dt));
    const yaw = Math.atan2(tmp.x, tmp.z); this.cup.group.rotation.y += ((yaw - this.cup.group.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 5);
    // stay on the disc
    const r = Math.hypot(this.pos().x, this.pos().z); if (r > this.garden.radius * 0.95) { this.pos().x *= 0.98; this.pos().z *= 0.98; }
    return false;
  }
  update(dt, all, head) {
    const t = this.t, n = this.need;
    n.explore = Math.min(1, n.explore + dt * 0.02 * (0.5 + t.curious)); n.rest = Math.min(1, n.rest + dt * 0.015 * (0.3 + t.sleepy));
    n.company = Math.min(1, n.company + dt * 0.02 * (0.3 + t.social) * (all.length > 1 ? 1 : 0.2)); n.play = Math.min(1, n.play + dt * 0.018 * (0.2 + t.playful));
    this.timer -= dt; if (this.timer <= 0) this.decide(all);
    switch (this.state) {
      case 'wander': if (this.moveToward(this.target, dt, 0.01)) this.timer = 0; break;
      case 'approach': if (!this.partner) { this.timer = 0; break; } if (this.moveToward(this.partner.pos(), dt, 0.09)) { this.enter('whisper', 3 + Math.random() * 2); this.partner.invite(this); this.bond(this.partner, 0.2); n.company = 0; } break;
      case 'whisper': if (this.partner) { tmp2.copy(this.partner.pos()).sub(this.pos()); const yaw = Math.atan2(tmp2.x, tmp2.z); this.cup.group.rotation.y += ((yaw - this.cup.group.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 4); }
        this.whisperT -= dt; if (this.whisperT <= 0) { this.whisperT = 0.9 + Math.random() * 0.6; this.whisper.say(this.cup); this.sound.chirp(0.8 + 0.8 * t.playful - 0.2 * t.sleepy, 1 + Math.round(t.social)); } break;
      case 'look': if (head) { tmp2.copy(head).sub(this.pos()); const yaw = Math.atan2(tmp2.x, tmp2.z); this.cup.group.rotation.y += ((yaw - this.cup.group.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 3); } break;
      default: break;
    }
    if (this.cup.creature) { this.cup.creature.napping = this.state === 'nap'; }
    // whisper card placement + fade
    const w = this.whisper; w.alpha += (((this.state === 'whisper') ? 1 : 0) - w.alpha) * Math.min(1, dt * 4); w.mat.opacity = w.alpha; w.mesh.visible = w.alpha > 0.02;
    if (w.mesh.visible) { w.mesh.position.copy(this.pos()); w.mesh.position.y += 0.1; if (head) w.mesh.lookAt(head); }
    // nap pose
    this.cup.group.rotation.x += (((this.state === 'nap') ? 0.18 : 0) - this.cup.group.rotation.x) * Math.min(1, dt * 2);
  }
  invite(from) { this.partner = from; this.enter('whisper', 3 + Math.random() * 2); this.bond(from, 0.2); this.need.company = 0; }
  poke(dir) { if (this.t.shy > 0.5) { this.enter('idle', 1.2); this.cup.group.position.addScaledVector(dir.clone().setY(0).normalize(), -0.015); } else { this.enter('idle', 0.8); this.need.play = 0; } }
}

/** wordless speech: marks in the creature's palette (dots for dotty creatures, strokes for the rest) */
function makeWhisper() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128; const ctx = canvas.getContext('2d');
  const tex = new CanvasTexture(canvas); tex.colorSpace = SRGBColorSpace;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new Mesh(new PlaneGeometry(0.07, 0.035), mat); mesh.renderOrder = 11;
  const w = { mesh, mat, alpha: 0, say(cup) {
    ctx.clearRect(0, 0, 256, 128); ctx.fillStyle = 'rgba(255,253,248,0.95)'; ctx.beginPath(); ctx.roundRect(4, 4, 248, 100, 30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(110, 104); ctx.lineTo(128, 124); ctx.lineTo(146, 104); ctx.fill();
    const pal = cup.uniforms.uPal.value; const st = cup.stats || {}; const dotty = (st.dotRatio || 0) > 0.3;
    for (let i = 0; i < 3; i++) { const c = pal[1 + ((i * 2) % 4)]; ctx.fillStyle = `rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})`; ctx.strokeStyle = ctx.fillStyle; const x = 60 + i * 68, y = 54;
      if (dotty || Math.random() < 0.4) { ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); } else { ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 18, y + 10); ctx.quadraticCurveTo(x, y - 24, x + 18, y + 8); ctx.stroke(); } }
    tex.needsUpdate = true; } };
  return w;
}
