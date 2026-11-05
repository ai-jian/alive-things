// What a cup becomes when you let go: eyes, a mouth, feet, a personality grown from how you drew.
// Visual layer only here; the My Space brain drives movement later.
import { Group, Mesh, SphereGeometry, TorusGeometry, CylinderGeometry, CircleGeometry, MeshBasicMaterial, Vector3 } from 'three';

/** Personality from stroke stats. Never random. Mirrors unity/.../CreatureTraits.cs. */
export function traitsFromStats(s) {
  const slow = 1 - Math.min(1, (s.averageSpeed || 0) / 0.5);
  const c = x => Math.max(0, Math.min(1, x));
  return {
    curious: c(0.3 + 0.7 * (s.turnRatio || 0)),
    sleepy: c(0.2 + 0.5 * slow + 0.3 * (s.dwellRatio || 0)),
    social: c(0.2 + 0.8 * (s.coverage || 0)),
    playful: c(0.1 + 0.5 * (s.turnRatio || 0) + 0.4 * (1 - slow)),
    shy: c(0.6 * (s.dotRatio || 0) * slow + 0.2 * (s.dwellRatio || 0)),
  };
}
export function describeTraits(t) {
  const a = t.sleepy > .6 ? 'quiet' : t.playful > .6 ? 'bouncy' : t.social > .6 ? 'chatty' : 'calm';
  const b = t.curious > .6 ? 'curious' : t.shy > .5 ? 'shy' : t.social > .5 ? 'friendly' : 'dreamy';
  return `${a} · ${b}`;
}

const head = new Vector3();

/** Adds a face and limbs to a cup (in cup units, parented to cup.group). Returns the creature controller. */
export function wakeCup(cup, { traits, dark }) {
  const fit = cup.wakeFit || { unit: 1, offset: [0, 0, 0] }; const unit = fit.unit; const hw = fit.halfWidth || 0.6;   // half width in parts units
  const ink = new MeshBasicMaterial({ color: dark || 0x2a2a6b });
  const blush = new MeshBasicMaterial({ color: 0xf3a7b6, transparent: true, opacity: 0.7 });
  const face = new Group();
  const eyeL = new Mesh(new SphereGeometry(0.045, 14, 10), ink); eyeL.position.set(-0.17, 0.62, 0.575);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.17;
  const mouth = new Mesh(new TorusGeometry(0.07, 0.016, 8, 18, Math.PI), ink); mouth.position.set(0, 0.48, 0.60); mouth.rotation.z = Math.PI;
  const cheekL = new Mesh(new CircleGeometry(0.05, 14), blush); cheekL.position.set(-0.3, 0.5, 0.53); cheekL.rotation.y = -0.5;
  const cheekR = cheekL.clone(); cheekR.position.x = 0.3; cheekR.rotation.y = 0.5;
  face.add(eyeL, eyeR, mouth, cheekL, cheekR);
  const legs = []; const limbs = new Group();
  for (const x of [-0.22, 0.22]) {
    const g = new Group(); const leg = new Mesh(new CylinderGeometry(0.03, 0.03, 0.22, 8), ink); leg.position.y = -0.11;
    const foot = new Mesh(new SphereGeometry(0.075, 12, 8), ink); foot.scale.set(1.3, 0.5, 1); foot.position.y = -0.22;
    g.add(leg, foot); g.position.set(x, 0, 0.1); limbs.add(g); legs.push(g);
  }
  const armL = new Mesh(new CylinderGeometry(0.025, 0.025, 0.3, 8), ink); armL.position.set(-(hw + 0.06), 0.55, 0); armL.rotation.z = 1.2;
  const armR = armL.clone(); armR.position.set(hw + (cup.handle ? 0.35 : 0.06), cup.handle ? 0.72 : 0.55, 0); armR.rotation.z = -0.9;
  limbs.add(armL, armR);
  const parts = new Group(); parts.add(face, limbs); parts.scale.setScalar(0.001); parts.position.set(fit.offset[0], fit.offset[1], fit.offset[2]); cup.group.add(parts);

  const c = {
    traits, parts, legs, eyeL, eyeR, awake: true, t: 0, pop: 0, blinkT: 2 + Math.random() * 2, walking: false, lookTarget: null,
    update(dt, headWorld) {
      c.t += dt;
      // pop in with a little overshoot
      if (c.pop < 1) { c.pop = Math.min(1, c.pop + dt * 2.2); const k = c.pop; const s = k < 0.8 ? k / 0.8 * 1.15 : 1.15 - (k - 0.8) / 0.2 * 0.15; parts.scale.setScalar(Math.max(0.001, s) * unit); }
      // blink
      c.blinkT -= dt; const ey = c.blinkT < 0.12 ? 0.1 : 1; eyeL.scale.y = eyeR.scale.y = ey; if (c.blinkT < 0) c.blinkT = 2 + Math.random() * 3 + traits.sleepy * 2;
      // feet
      const f = c.walking ? 9 : 0; for (let i = 0; i < legs.length; i++) legs[i].rotation.x = f ? Math.sin(c.t * f + i * Math.PI) * 0.4 : 0;
      // glance at the player sometimes (curious ones more)
      if (headWorld) { const local = cup.group.worldToLocal(head.copy(headWorld)); const want = Math.atan2(local.x, local.z); const amt = 0.15 + 0.25 * traits.curious; face.rotation.y += ((Math.max(-0.6, Math.min(0.6, want)) * amt) - face.rotation.y) * Math.min(1, dt * 2); }
    },
  };
  return c;
}
