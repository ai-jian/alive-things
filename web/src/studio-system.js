// The studio: pinch an object and it grows in your hand; let go and it floats up in front of you as a big canvas
// while the room dims around it (a soft vignette: the object, your hands and the space between stay clear).
// Pinch it and lower it: it shrinks back to its real size and lands on the table, asleep. You can pick it up again
// and keep drawing. It wakes only once it has had enough quiet company (about three minutes for the first one),
// then on a tap, or by itself a few seconds after you set it down. The size contrast is the whole point.
import { createSystem, Grabbed } from '@iwsdk/core';
import { Mesh, SphereGeometry, ShaderMaterial, BackSide, Sprite, SpriteMaterial, CanvasTexture, Vector3, Quaternion, AdditiveBlending, Color } from 'three';
import { wakeCup, traitsFromStats, describeTraits } from './creature.js';
import { makeCard } from './hints.js';

export const READY_FIRST = 150;   // s of quiet studio time before the first one can wake (~3 min with the pick-up)
export const READY_LATER = 100;   // later ones: the island is already alive, they come a little quicker
const SET_DOWN = 0.22;            // m below the studio anchor counts as setting it down
const WAKE_ALONE = 4;             // s after landing, untouched, a ready one wakes by itself

const cupPos = new Vector3(), head = new Vector3(), fwd = new Vector3(), anchor = new Vector3(), tmpQ = new Quaternion(), look = new Vector3(), dir = new Vector3();

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 128); g.addColorStop(0, 'rgba(255,236,205,0.8)'); g.addColorStop(0.45, 'rgba(255,226,190,0.25)'); g.addColorStop(1, 'rgba(255,226,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new CanvasTexture(c);
}

/** a dome around the head that dims the room toward the edges of view, clear along the line to the object */
function vignetteDome() {
  const mat = new ShaderMaterial({
    uniforms: { uDir: { value: new Vector3(0, 0, -1) }, uAmt: { value: 0 }, uCol: { value: new Color(0x2a2230) } },
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position, 1.0)).xyz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform vec3 uDir; uniform float uAmt; uniform vec3 uCol; varying vec3 vD;
      void main(){ float c = dot(normalize(vD), uDir); float edge = 1.0 - smoothstep(0.80, 0.97, c); gl_FragColor = vec4(uCol, uAmt * (0.10 + 0.45 * edge)); }`,
    side: BackSide, transparent: true, depthWrite: false,
  });
  const m = new Mesh(new SphereGeometry(4, 32, 20), mat); m.renderOrder = -1; return m;
}

export function makeStudioSystem(active, hands, sound, events, brushStats, placement, isScribbling) {
  class StudioSystem extends createSystem({}, {}) {
    init() {
      this.mode = 'table'; this.fog = 0; this.baseScale = 1; this.bigScale = 1; this.lastCup = null; this.settled = false; this.turn = 0; this.landing = null;
      this.dome = vignetteDome(); this.scene.add(this.dome);
      this.halo = new Sprite(new SpriteMaterial({ map: haloTexture(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })); this.scene.add(this.halo);
      this.tag = makeCard(); this.scene.add(this.tag.mesh); this.tagT = 0;
      window.addEventListener('keydown', (e) => {
        if (e.key === 'f') { this.mode === 'studio' ? this.finish(true) : this.enterStudio(); }
        if (e.key === 'w') { const c = active.cup; if (c) c.quiet = Math.max(c.quiet || 0, this.readyAt()); if (this.mode === 'studio') this.finish(true); this.wake(); }
      });
    }
    readyAt() { return (events.residents || 0) > 0 || events.everWoke ? READY_LATER : READY_FIRST; }
    say(text, seconds = 3.5) { this.tag.draw(text); this.tagT = seconds; this.tagLen = seconds; }

    update(delta, time) {
      const cup = active.cup; if (!cup) return;
      if (cup !== this.lastCup) { this.lastCup = cup; this.mode = 'table'; this.settled = false; this.baseScale = cup.group.scale.x; this.landing = null; cup.quiet = cup.quiet || 0; }
      const grabbed = !!(active.entity && active.entity.hasComponent(Grabbed));
      const headObj = this.renderer.xr.isPresenting ? this.player.head : this.camera; headObj.getWorldPosition(head);
      fwd.set(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(tmpQ)); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      cup.group.getWorldPosition(cupPos); cup.inStudio = this.mode === 'studio';

      // a pinch on a sleeping object (fresh, or set down earlier) opens the studio
      if (this.mode === 'table' && grabbed && !cup.creature && !events.inSpace && !this.landing) this.enterStudio();

      const ready = (cup.quiet || 0) >= this.readyAt();
      if (this.mode === 'studio') {
        anchor.copy(head).addScaledVector(fwd, 0.45); anchor.y = head.y - 0.14;
        const s = cup.group.scale.x, want = this.bigScale;
        cup.group.scale.setScalar(s + (want - s) * Math.min(1, delta * 3));
        if (grabbed) {
          if (this.settled && cupPos.y < anchor.y - SET_DOWN) this.finish(false);
        } else {
          cup.group.position.lerp(anchor, 1 - Math.pow(0.02, delta));
          // face the player, with a slow turntable so the back gets its turn; painting pauses the turn
          look.copy(head); look.y = cupPos.y; const q = cup.group.quaternion.clone(); cup.group.lookAt(look); cup.group.rotateY(this.turn); const target = cup.group.quaternion.clone(); cup.group.quaternion.copy(q).slerp(target, Math.min(1, delta * 2.5));
          if (!cup.touching) this.turn += delta * 0.12; if (this.turn > Math.PI * 2) this.turn -= Math.PI * 2;
          if (!this.settled && cupPos.distanceTo(anchor) < 0.03) { this.settled = true; events.studioFloat = true; }
        }
        // quiet company: time with it counts, frantic scribbling does not
        if (!(isScribbling && isScribbling())) cup.quiet = (cup.quiet || 0) + delta;
        if (ready && !cup.readyAnnounced) { cup.readyAnnounced = true; events.ready = true; sound.wake(0.75); cup.readyPulse = 1; }
      }
      // breathing: barely there at first, clearer as it gets ready
      const r = Math.min(1, (cup.quiet || 0) / this.readyAt());
      if (cup.body && !cup.creature) cup.body.scale.setScalar(1 + (0.004 + 0.014 * r) * Math.sin(time * (1.2 + 0.6 * r)));
      if (cup.readyPulse > 0) cup.readyPulse = Math.max(0, cup.readyPulse - delta * 0.6);

      // setting down: glide to the table, shrink, then rest there asleep
      if (this.landing) {
        const L = this.landing; L.t = Math.min(1, L.t + delta / 0.6); const k = 1 - Math.pow(1 - L.t, 3);
        cup.group.position.lerpVectors(L.from, L.to, k); cup.group.position.y += Math.sin(Math.PI * k) * 0.03;
        cup.group.scale.setScalar(L.fromS + (this.baseScale - L.fromS) * k);
        if (L.t >= 1) { this.landing = null; cup.group.position.copy(L.to); cup.group.scale.setScalar(this.baseScale); cup.group.rotation.set(0, cup.group.rotation.y, 0); placement && placement.rest(cup); cup.landedT = 0; cup.asleep = true; events.landed = true; }
      }
      // asleep on the table: a tap or a little time alone wakes a ready one; an unready one just stirs
      if (this.mode === 'table' && !this.landing && cup.asleep && !cup.creature && !grabbed) {
        cup.landedT = (cup.landedT || 0) + delta;
        const tap = cup.touching && !this.wasTouching;
        if (ready && (tap || cup.landedT > WAKE_ALONE)) this.wake();
        else if (tap && !ready) { cup.pokeAt(new Vector3(0, 0.5, 0.6)); this.say(r < 0.5 ? 'Not yet. It is still asleep.\nKeep it company a while.' : 'Almost. It is stirring.\nA little more quiet.'); sound.tick(0.7, 0.03); }
      }
      this.wasTouching = !!cup.touching;

      // vignette, halo, hum
      const wantFog = this.mode === 'studio' ? 1 : 0; const prev = this.fog; this.fog += (wantFog - this.fog) * Math.min(1, delta * 1.4);
      dir.copy(cupPos).sub(head).normalize(); this.dome.material.uniforms.uDir.value.copy(dir); this.dome.material.uniforms.uAmt.value = this.fog;
      this.dome.visible = this.fog > 0.005;
      if (Math.abs(this.fog - prev) > 1e-4 || cup.approachGlow > 0.001 || cup.readyPulse > 0) {
        this.halo.material.opacity = this.fog * 0.9;
        cup.uniforms.uShade.value = 0.16 + this.fog * 0.06; cup.setGlow(this.fog * 0.3 + (cup.approachGlow || 0) + 0.35 * (cup.readyPulse || 0) * (0.5 + 0.5 * Math.sin(time * 6))); sound.setHum(this.fog);
      }
      this.dome.position.copy(head); this.halo.position.copy(cupPos); this.halo.scale.setScalar(0.3 * cup.group.scale.x / this.baseScale);
      if (cup.creature) cup.creature.update(delta, head);
      if (this.tagT > 0) { this.tagT -= delta; this.tag.mesh.position.copy(cupPos); this.tag.mesh.position.y += 0.12 * cup.group.scale.x / this.baseScale; this.tag.mesh.lookAt(head); this.tag.mat.opacity = Math.min(1, this.tagT, (this.tagLen - this.tagT) * 2); this.tag.mesh.visible = true; } else this.tag.mesh.visible = false;
    }
    enterStudio() {
      const cup = active.cup; if (!cup || this.mode === 'studio' || cup.creature) return;
      this.mode = 'studio'; this.settled = false; this.turn = 0; cup.asleep = false;
      placement && placement.unrest(cup);
      this.baseScale = cup.group.scale.x; cup.homeScale = this.baseScale; this.tableSpot = cup.group.position.clone();
      const h = cup.heightMetres || 0.09; this.bigScale = this.baseScale * Math.max(2.5, Math.min(7, 0.26 / h));   // about 26 cm tall in front of you
      events.focused = true; sound.tick(1.4, 0.05);
    }
    /** set it down: it lands on the table, asleep. It does not wake here. */
    finish(fromKey) {
      const cup = active.cup; if (!cup || this.mode !== 'studio') return;
      this.mode = 'table'; events.studioFloat = false;
      cup.group.getWorldPosition(cupPos);
      const to = fromKey && this.tableSpot ? this.tableSpot.clone() : (placement ? placement.landAt(cupPos) : this.tableSpot.clone());
      this.landing = { t: 0, from: cupPos.clone(), to, fromS: cup.group.scale.x };
      if (fromKey) this.landing.t = 1;
      sound.tick(0.9, 0.04);
    }
    wake() {
      const cup = active.cup; if (!cup || cup.creature) return;
      if (this.landing) { const L = this.landing; this.landing = null; cup.group.position.copy(L.to); cup.group.scale.setScalar(this.baseScale); cup.group.rotation.set(0, cup.group.rotation.y, 0); placement && placement.rest(cup); }
      cup.body && cup.body.scale.setScalar(1); cup.asleep = false;
      const stats = brushStats(); const traits = traitsFromStats(stats);
      cup.creature = wakeCup(cup, { traits, dark: cup.uniforms.uPal.value[0].getHex() }); cup.traits = traits; cup.stats = stats;
      events.awake = true; events.everWoke = true; this.say(describeTraits(traits), 5); sound.wake(1 + traits.playful * 0.3);
    }
  }
  return StudioSystem;
}
