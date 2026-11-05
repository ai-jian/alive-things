// The studio: pinch an object and it grows in your hand; let go and it floats up in front of you as a big canvas
// while the room fades to warm dark fog. Paint. When it feels done, pinch it and set it down: it shrinks back to
// its real size, lands, and wakes. The size contrast is the whole point.
import { createSystem, Grabbed } from '@iwsdk/core';
import { Mesh, SphereGeometry, MeshBasicMaterial, BackSide, Sprite, SpriteMaterial, CanvasTexture, Vector3, Quaternion, AdditiveBlending } from 'three';
import { wakeCup, traitsFromStats, describeTraits } from './creature.js';
import { makeCard } from './hints.js';

const cupPos = new Vector3(), head = new Vector3(), fwd = new Vector3(), anchor = new Vector3(), tmpQ = new Quaternion(), look = new Vector3();

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 128); g.addColorStop(0, 'rgba(255,236,205,0.8)'); g.addColorStop(0.45, 'rgba(255,226,190,0.25)'); g.addColorStop(1, 'rgba(255,226,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new CanvasTexture(c);
}

export function makeStudioSystem(active, hands, sound, events, brushStats, getTableY) {
  class StudioSystem extends createSystem({}, {}) {
    init() {
      this.mode = 'table'; this.fog = 0; this.baseScale = 1; this.bigScale = 1; this.lastCup = null; this.settled = false; this.turn = 0;
      this.dome = new Mesh(new SphereGeometry(4, 32, 20), new MeshBasicMaterial({ color: 0x2a2230, side: BackSide, transparent: true, opacity: 0, depthWrite: false }));
      this.dome.renderOrder = -1; this.scene.add(this.dome);
      this.halo = new Sprite(new SpriteMaterial({ map: haloTexture(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })); this.scene.add(this.halo);
      this.tag = makeCard(); this.scene.add(this.tag.mesh); this.tagT = 0;
      window.addEventListener('keydown', (e) => { if (e.key === 'f') { this.mode === 'studio' ? this.finish(true) : this.enterStudio(); } if (e.key === 'w') { if (this.mode === 'studio') this.finish(true); else this.wake(); } });
    }
    update(delta) {
      const cup = active.cup; if (!cup) return;
      if (cup !== this.lastCup) { this.lastCup = cup; this.mode = 'table'; this.settled = false; this.baseScale = cup.group.scale.x; }
      const grabbed = !!(active.entity && active.entity.hasComponent(Grabbed));
      const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      fwd.set(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(tmpQ)); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      cup.group.getWorldPosition(cupPos); cup.inStudio = this.mode === 'studio';

      // first pinch on a sleeping object opens the studio
      if (this.mode === 'table' && grabbed && !cup.creature && !events.inSpace) this.enterStudio();

      if (this.mode === 'studio') {
        anchor.copy(head).addScaledVector(fwd, 0.42); anchor.y = head.y - 0.1;
        const s = cup.group.scale.x, want = this.bigScale;
        if (grabbed) {
          // growing in the hand; setting it down (below chest height) finishes
          cup.group.scale.setScalar(s + (want - s) * Math.min(1, delta * 3));
          if (this.settled && cupPos.y < anchor.y - 0.22) this.finish(false);
        } else {
          cup.group.scale.setScalar(s + (want - s) * Math.min(1, delta * 3));
          cup.group.position.lerp(anchor, 1 - Math.pow(0.02, delta));
          // face the player, with a slow turntable so the back gets its turn; painting pauses the turn
          look.copy(head); look.y = cupPos.y; const q = cup.group.quaternion.clone(); cup.group.lookAt(look); cup.group.rotateY(Math.PI + this.turn); const target = cup.group.quaternion.clone(); cup.group.quaternion.copy(q).slerp(target, Math.min(1, delta * 2.5));
          if (!cup.touching) this.turn += delta * 0.12; if (this.turn > Math.PI * 2) this.turn -= Math.PI * 2;
          if (!this.settled && cupPos.distanceTo(anchor) < 0.03) { this.settled = true; events.studioFloat = true; }
        }
      }
      // fog, halo, hum
      const wantFog = this.mode === 'studio' ? 1 : 0; const prev = this.fog; this.fog += (wantFog - this.fog) * Math.min(1, delta * 1.4);
      if (Math.abs(this.fog - prev) > 1e-4 || cup.approachGlow > 0.001) {
        this.dome.material.opacity = this.fog * 0.9; this.halo.material.opacity = this.fog * 0.9;
        cup.uniforms.uShade.value = 0.16 + this.fog * 0.06; cup.setGlow(this.fog * 0.3 + (cup.approachGlow || 0)); sound.setHum(this.fog);
      }
      this.dome.position.copy(head); this.halo.position.copy(cupPos); this.halo.scale.setScalar(0.3 * cup.group.scale.x / this.baseScale);
      if (cup.creature) cup.creature.update(delta, head);
      if (this.tagT > 0) { this.tagT -= delta; this.tag.mesh.position.copy(cupPos); this.tag.mesh.position.y += 0.12; this.tag.mesh.lookAt(head); this.tag.mat.opacity = Math.min(1, this.tagT, (5 - this.tagT) * 2); this.tag.mesh.visible = true; } else this.tag.mesh.visible = false;
    }
    enterStudio() {
      const cup = active.cup; if (!cup || this.mode === 'studio' || cup.creature) return;
      this.mode = 'studio'; this.settled = false; this.turn = 0;
      this.baseScale = cup.group.scale.x; this.tableSpot = cup.group.position.clone();
      const h = cup.heightMetres || 0.09; this.bigScale = this.baseScale * Math.max(2.5, Math.min(7, 0.3 / h));   // about 30 cm tall in front of you
      events.focused = true; sound.tick(1.4, 0.05);
    }
    finish(fromKey) {
      const cup = active.cup; if (!cup || this.mode !== 'studio') return;
      this.mode = 'table'; events.studioFloat = false;
      cup.group.scale.setScalar(this.baseScale);
      if (fromKey && this.tableSpot) cup.group.position.copy(this.tableSpot);
      else { const y = getTableY ? getTableY() : null; if (y !== null && y !== undefined) cup.group.position.y = y + 0.002; }
      cup.group.rotation.set(0, cup.group.rotation.y, 0);
      this.wake();
    }
    wake() {
      const cup = active.cup; if (!cup || cup.creature) return;
      const stats = brushStats(); const traits = traitsFromStats(stats);
      cup.creature = wakeCup(cup, { traits, dark: cup.uniforms.uPal.value[0].getHex() }); cup.traits = traits; cup.stats = stats;
      events.awake = true; this.tag.draw(describeTraits(traits)); this.tagT = 5; sound.wake(1 + traits.playful * 0.3);
    }
  }
  return StudioSystem;
}
