// In-XR guidance: one soft card floating above the cup, facing the player, that advances with what
// the player has actually done. No menus, no arrows, one sentence at a time. Fades out when the basics are learned.
import { createSystem } from '@iwsdk/core';
import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';

const STEPS = [
  { key: 'touch',  text: 'Touch the cup with one fingertip.\nDraw slowly.', done: ev => ev.strokes >= 1 },
  { key: 'dwell',  text: 'Now stop moving, but keep touching.\nWatch the ink bloom.', done: ev => ev.dwell, timeout: 20 },
  { key: 'grab',   text: 'Pinch to pick it up.\nTurn it. Your strokes went round.', done: ev => ev.grabbed, timeout: 25 },
  { key: 'focus',  text: 'Hold it. Pinch beside it with\nyour other hand and pull away.', done: ev => ev.focused, timeout: 30 },
  { key: 'draw2',  text: 'Just you and the cup now.\nDraw slowly. Hold still to bloom.', done: ev => ev.strokes >= 4, timeout: 40 },
  { key: 'release',text: 'When it feels done,\nopen your hand.', done: ev => ev.awake, timeout: 60 },
  { key: 'bye',    text: 'It learned you while you drew.\nStay as long as you like.', done: () => false, timeout: 7 },
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

export function makeHintSystem(active, events) {
  class HintSystem extends createSystem({}, {}) {
    init() {
      this.card = makeCard(); this.scene.add(this.card.mesh);
      this.step = 0; this.stepT = 0; this.alpha = 0; this.visibleWanted = true; this.started = false;
      this.card.draw(STEPS[0].text);
    }
    update(delta) {
      const presenting = this.renderer.xr.isPresenting;
      // only teach inside XR (or the emulator); the landing page covers the browser
      if (presenting && !this.started) { this.started = true; this.stepT = 0; }
      const s = STEPS[this.step];
      if (this.started && s) {
        this.stepT += delta;
        const timedOut = s.timeout !== undefined && this.stepT > s.timeout;
        if (s.done(events) || timedOut) {
          this.step++; this.stepT = 0;
          if (STEPS[this.step]) this.card.draw(STEPS[this.step].text); else this.visibleWanted = false;
        }
      }
      const cup = active.cup; if (!cup) return;
      // place above the cup, face the player
      const headObj = presenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      cup.group.getWorldPosition(target); target.y += 0.115;
      this.card.mesh.position.lerp(target, 1 - Math.pow(0.001, delta));
      this.card.mesh.lookAt(head);
      const want = this.started && this.visibleWanted && STEPS[this.step] && !events.inSpace ? 1 : 0;
      this.alpha += (want - this.alpha) * Math.min(1, delta * 3);
      this.card.mat.opacity = this.alpha;
      this.card.mesh.visible = this.alpha > 0.01;
    }
  }
  return HintSystem;
}
