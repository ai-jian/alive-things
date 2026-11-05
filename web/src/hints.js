// In-XR guidance: one soft card floating above the object, facing the player, that advances with what
// the player has actually done. No menus, no arrows, one sentence at a time. Fades out when the basics are learned.
import { createSystem } from '@iwsdk/core';
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3, Quaternion } from 'three';

// Required steps wait until you have really done them. Optional ones (`optional`) step aside after `timeout` seconds.
// `show`: the card shows for that long, then gets out of the way while the step stays open.
const STEPS = [
  { key: 'trace',  text: 'Trace around a real cup on your desk.\nPinch the air, hold, then draw its outline.', done: ev => ev.traced || ev.offeredCup, only: ev => ev.traceFirst },
  { key: 'grab',   text: ev => ev.offeredCup && !ev.traced ? 'Or start with this cup.\nPinch it to pick it up.' : 'Reach for it.\nPinch to pick it up.', done: ev => ev.grabbed || ev.focused },
  { key: 'float',  text: 'Let go.\nIt comes to you.', done: ev => ev.studioFloat || ev.strokes > 0 },
  { key: 'touch',  text: 'Touch it with one fingertip.\nDraw slowly.', done: ev => ev.strokes >= 1 },
  { key: 'dwell',  text: 'Now stop moving, but keep touching.\nWatch the ink bloom.', done: ev => ev.dwell, optional: true, timeout: 25 },
  { key: 'centre', text: 'Press and hold to move the centre.\nTwist two fingertips to change the fold.', done: ev => ev.centreSet || ev.foldChanged, optional: true, timeout: 25 },
  { key: 'quiet',  text: 'Keep it company.\nIt wakes when it has had enough quiet.', done: ev => ev.ready || ev.awake, show: 9 },
  { key: 'down',   text: 'It is ready. Pinch it\nand set it down on the table.', done: ev => ev.awake },
  { key: 'door',   text: 'A glowing disc opened beside it.\nSet it down there when you are ready.', done: ev => ev.adopted },
  { key: 'trace2', text: 'Pinch in the air and hold, then trace\naround anything on your desk.', done: ev => ev.traced, optional: true, timeout: 45 },
  { key: 'bye',    text: 'It learned you while you drew.\nStay as long as you like.', done: () => false, optional: true, timeout: 7 },
];

export function makeCard() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const tex = new CanvasTexture(canvas); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const mesh = new Mesh(new PlaneGeometry(0.16, 0.06), mat);
  mesh.renderOrder = 10;
  function draw(text) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // soft rounded paper card
    const r = 56; ctx.fillStyle = 'rgba(255,253,248,0.94)';
    ctx.beginPath(); ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, r); ctx.fill();
    ctx.fillStyle = '#2e2a36'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = text.split('\n'); let size = lines.length > 1 ? 62 : 68;
    ctx.font = `600 ${size}px Nunito, system-ui, sans-serif`;
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width)); if (widest > canvas.width - 90) { size = Math.floor(size * (canvas.width - 90) / widest); ctx.font = `600 ${size}px Nunito, system-ui, sans-serif`; }
    lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * (size * 1.25)));
    tex.needsUpdate = true;
  }
  return { mesh, mat, draw };
}

const head = new Vector3(), target = new Vector3();

const fwd = new Vector3(), hq = new Quaternion();
const textOf = (st, ev) => typeof st.text === 'function' ? st.text(ev) : st.text;

export function makeHintSystem(active, events) {
  class HintSystem extends createSystem({}, {}) {
    init() {
      this.card = makeCard(); this.scene.add(this.card.mesh);
      this.step = 0; this.stepT = 0; this.alpha = 0; this.visibleWanted = true; this.started = false; this.drawn = '';
    }
    current() { while (STEPS[this.step] && STEPS[this.step].only && !STEPS[this.step].only(events)) this.step++; return STEPS[this.step]; }
    update(delta) {
      const presenting = this.renderer.xr.isPresenting;
      if (presenting && !this.started) { this.started = true; this.stepT = 0; }
      let s = this.current();
      if (this.started && s) {
        this.stepT += delta;
        const timedOut = s.optional && s.timeout !== undefined && this.stepT > s.timeout;
        if (s.done(events) || timedOut) { this.step++; this.stepT = 0; s = this.current(); if (!s) this.visibleWanted = false; }
      }
      if (s) { const t = textOf(s, events); if (t !== this.drawn) { this.drawn = t; this.card.draw(t); } }
      const headObj = presenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      const cup = active.cup;
      if (cup) {
        // above the object, scaled with it, facing the player
        cup.group.getWorldPosition(target);
        const grow = cup.group.scale.x / (cup.scale || 1); const h = (cup.heightMetres || 0.09) * grow;
        target.y += h * 1.15 + 0.03;
        this.card.mesh.scale.setScalar(Math.max(1, Math.min(2.2, 0.6 + grow * 0.35)));
      } else {
        // nothing on the table yet: float the card in front of you, a little low
        fwd.set(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(hq)); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
        target.copy(head).addScaledVector(fwd, 0.5); target.y -= 0.15; this.card.mesh.scale.setScalar(1.3);
      }
      this.card.mesh.position.lerp(target, 1 - Math.pow(0.001, delta));
      this.card.mesh.lookAt(head);
      const shown = s && (!s.show || this.stepT < s.show);
      const want = this.started && this.visibleWanted && shown && !events.inSpace ? 1 : 0;
      this.alpha += (want - this.alpha) * Math.min(1, delta * 3);
      this.card.mat.opacity = this.alpha;
      this.card.mesh.visible = this.alpha > 0.01;
    }
  }
  return HintSystem;
}
