// Focus Mode and the wake. Hold the cup in one hand (pinch), pinch with the other hand near it and pull away:
// the room fades to warm dark fog, the hum comes up, only the cup is lit. Let go of the cup: it wakes.
import { createSystem, Grabbed } from '@iwsdk/core';
import { Mesh, SphereGeometry, MeshBasicMaterial, BackSide, Sprite, SpriteMaterial, CanvasTexture, Vector3, AdditiveBlending } from 'three';
import { wakeCup, traitsFromStats, describeTraits } from './creature.js';
import { makeCard } from './hints.js';

const OPEN_DISTANCE = 0.15, ARM_RADIUS = 0.14;
const cupPos = new Vector3(), head = new Vector3();

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 128); g.addColorStop(0, 'rgba(255,236,205,0.85)'); g.addColorStop(0.45, 'rgba(255,226,190,0.28)'); g.addColorStop(1, 'rgba(255,226,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new CanvasTexture(c);
}

export function makeFocusSystem(active, hands, sound, events, brushStats) {
  class FocusSystem extends createSystem({}, {}) {
    init() {
      this.focus = 0; this.wantFocus = false; this.armed = null; this.holder = null; this.creature = null; this.tagT = 0;
      this.dome = new Mesh(new SphereGeometry(4, 32, 20), new MeshBasicMaterial({ color: 0x2a2230, side: BackSide, transparent: true, opacity: 0, depthWrite: false }));
      this.dome.renderOrder = -1; this.scene.add(this.dome);
      this.halo = new Sprite(new SpriteMaterial({ map: haloTexture(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })); this.halo.scale.setScalar(0.26); this.scene.add(this.halo);
      this.tag = makeCard(); this.scene.add(this.tag.mesh);
      hands.on('pinchstart', (h) => {
        const cup = active.cup; if (!cup) return;
        const holding = active.entity.hasComponent(Grabbed);
        if (!holding) return;
        const other = this.holder ? hands.other(this.holder) : h;
        if (h === other) { cup.group.getWorldPosition(cupPos); if (hands.tip[h].distanceTo(cupPos) < ARM_RADIUS) this.armed = { hand: h, at: hands.tip[h].clone() }; }
      });
      hands.on('pinchend', (h) => { if (this.armed && this.armed.hand === h) this.armed = null; });
      // emulator / desktop shortcuts
      window.addEventListener('keydown', (e) => { if (e.key === 'f') this.wantFocus = !this.wantFocus; if (e.key === 'w') this.wake(); });
    }
    update(delta) {
      const cup = active.cup; if (!cup) return;
      if (cup !== this.lastCup) { this.lastCup = cup; this.creature = cup.creature || null; this.wantFocus = false; this.armed = null; this.holder = null; }
      const holding = active.entity.hasComponent(Grabbed);
      cup.group.getWorldPosition(cupPos);
      if (holding && !this.holder) this.holder = hands.pinchingNear(cupPos, 0.2);
      if (!holding && this.holder) { this.holder = null; this.armed = null; if (this.wantFocus) { this.wantFocus = false; this.wake(); } }
      if (this.armed && hands.tip[this.armed.hand].distanceTo(this.armed.at) > OPEN_DISTANCE) { this.wantFocus = true; this.armed = null; events.focused = true; }
      // ease the fog
      const target = this.wantFocus ? 1 : 0;
      const prev = this.focus; this.focus += (target - this.focus) * Math.min(1, delta * 1.4);
      if (Math.abs(this.focus - prev) > 1e-4 || cup.approachGlow > 0.001) {
        this.dome.material.opacity = this.focus * 0.88;
        this.halo.material.opacity = this.focus * 0.9;
        cup.uniforms.uShade.value = 0.16 + this.focus * 0.08;
        cup.setGlow(this.focus * 0.35 + (cup.approachGlow || 0));
        sound.setHum(this.focus);
      }
      const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      this.dome.position.copy(head);
      this.halo.position.copy(cupPos); this.halo.position.y += 0.03;
      if (this.creature) this.creature.update(delta, head);
      if (this.tagT > 0) { this.tagT -= delta; this.tag.mesh.position.copy(cupPos); this.tag.mesh.position.y += 0.12; this.tag.mesh.lookAt(head); this.tag.mat.opacity = Math.min(1, this.tagT, (5 - this.tagT) * 2); this.tag.mesh.visible = true; } else this.tag.mesh.visible = false;
    }
    wake() {
      const cup = active.cup; if (!cup || this.creature) return;
      const stats = brushStats();
      const traits = traitsFromStats(stats);
      this.creature = wakeCup(cup, { traits, dark: cup.uniforms.uPal.value[0].getHex() });
      events.awake = true; cup.creature = this.creature; cup.traits = traits; cup.stats = stats;
      this.tag.draw(describeTraits(traits)); this.tagT = 5;
      sound.wake(1 + traits.playful * 0.3);
    }
  }
  return FocusSystem;
}
