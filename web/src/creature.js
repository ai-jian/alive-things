// What a cup becomes when you let go: googly eyes (face.js), feet, arms, a personality grown from how you drew.
// Visual layer only here; the My Space brain drives movement later.
import { Group, Mesh, SphereGeometry, CylinderGeometry, MeshBasicMaterial, Vector3, TubeGeometry, QuadraticBezierCurve3 } from 'three';
import { makeFace } from './face.js';

/** a short curved arm rooted at the object's side; the group pivots at the shoulder */
function makeArm(side, root, ink) {
  const s = side;
  const curve = new QuadraticBezierCurve3(new Vector3(0, 0, 0), new Vector3(s * 0.16, -0.02, 0.1), new Vector3(s * 0.22, -0.2, 0.17));
  const tube = new Mesh(new TubeGeometry(curve, 10, 0.026, 8, false), ink);
  const hand = new Mesh(new SphereGeometry(0.042, 10, 8), ink); hand.position.copy(curve.getPoint(1));
  const g = new Group(); g.add(tube, hand); g.position.copy(root); g.userData.side = s; g.rotation.z = s * -0.15;
  return g;
}

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
  const face = new Group();
  const eyes = makeFace({ y: 0.62, bodyR: 0.6, traits }); face.add(eyes.group);
  const legs = []; const limbs = new Group();
  for (const x of [-0.22, 0.22]) {
    const g = new Group(); const leg = new Mesh(new CylinderGeometry(0.03, 0.03, 0.22, 8), ink); leg.position.y = -0.11;
    const foot = new Mesh(new SphereGeometry(0.075, 12, 8), ink); foot.scale.set(1.3, 0.5, 1); foot.position.y = -0.22;
    g.add(leg, foot); g.position.set(x, 0, 0.1); limbs.add(g); legs.push(g);
  }
  // arms grow from the sides, at mid height (below the handle on a cup)
  const armL = makeArm(-1, new Vector3(-hw, 0.52, 0.05), ink);
  const armR = makeArm(1, new Vector3(hw, cup.handle ? 0.32 : 0.52, 0.05), ink);
  limbs.add(armL, armR); const arms = [armL, armR];
  const parts = new Group(); parts.add(face, limbs); parts.scale.setScalar(0.001); parts.position.set(fit.offset[0], fit.offset[1], fit.offset[2]); cup.group.add(parts);

  const c = {
    traits, parts, legs, arms, face: eyes, awake: true, t: 0, pop: 0, walking: false, napping: false, talkT: 0, lookTarget: null,
    /** a passing feeling, see face.js */
    feel(mood, seconds, opts) { eyes.feel(mood, seconds, opts); },
    update(dt, headWorld) {
      c.t += dt;
      // pop in with a little overshoot
      if (c.pop < 1) { c.pop = Math.min(1, c.pop + dt * 2.2); const k = c.pop; const s = k < 0.8 ? k / 0.8 * 1.15 : 1.15 - (k - 0.8) / 0.2 * 0.15; parts.scale.setScalar(Math.max(0.001, s) * unit); }
      // eyes: napping closes them, talking opens the little mouth, pupils follow what it is looking at
      eyes.base.mood = c.napping ? 'content' : 'open'; eyes.talk = c.talkT > 0; if (!eyes.talk) eyes.talkT = 0;
      eyes.update(dt, c.lookTarget || headWorld);
      // feet
      const f = c.walking ? 9 : 0; for (let i = 0; i < legs.length; i++) legs[i].rotation.x = f ? Math.sin(c.t * f + i * Math.PI) * 0.4 : 0;
      // arms: breathe at rest, swing when walking, lift and wave a little while talking, droop when napping
      if (c.talkT > 0) c.talkT -= dt;
      for (let i = 0; i < arms.length; i++) {
        const a = arms[i], s = a.userData.side;
        let z = s * -0.15 + Math.sin(c.t * 1.6 + i) * 0.04;
        if (c.walking) z += Math.sin(c.t * 9 + i * Math.PI) * 0.35 * s;
        if (c.talkT > 0) z += s * -(0.55 + Math.sin(c.t * 7 + i * 1.3) * 0.2) * (0.6 + 0.4 * traits.playful);
        if (c.napping) z = s * 0.25;
        a.rotation.z += (z - a.rotation.z) * Math.min(1, dt * 8);
        a.rotation.x = c.talkT > 0 ? Math.sin(c.t * 6 + i) * 0.15 : 0;
      }
      // glance at the player sometimes (curious ones more)
      if (headWorld) { const local = cup.group.worldToLocal(head.copy(headWorld)); const want = Math.atan2(local.x, local.z); const amt = 0.15 + 0.25 * traits.curious; face.rotation.y += ((Math.max(-0.6, Math.min(0.6, want)) * amt) - face.rotation.y) * Math.min(1, dt * 2); }
    },
  };
  eyes.feel('happy', 1.6);   // wakes up pleased
  return c;
}
