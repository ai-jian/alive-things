// A "thing": any captured object. Same gradient surface and paint layer as the cup, but a generic mesh with a
// raycast-based touch model instead of the cup's analytic one.
import { Group, Mesh, Vector3, Raycaster, Color, ShaderMaterial, DoubleSide } from 'three';
import { PaintLayer } from './paint.js';
import { paletteFromColor } from './palette.js';
import { gradientShader } from './cup.js';

const ray = new Raycaster(), origin = new Vector3(), dir = new Vector3(), centre = new Vector3();

export function makeThing({ geometry, dominant = new Color(0.9, 0.86, 0.78), width = 0.1, height = 0.1, sides = null }) {
  const paint = new PaintLayer({ circumference: width, wallHeight: height });
  paint.around = 1;                                   // front and back sheets share UVs already
  paint.setCentreUV(0.5, 0.5);
  const uniforms = {
    uHeat: { value: paint.texture }, uPaint: { value: 1 }, uBaseLo: { value: 0.10 }, uBaseHi: { value: 0.55 }, uShade: { value: 0.16 }, uGlow: { value: 0 }, uUnder: { value: 0 },
    uLightDir: { value: new Vector3(0.5, 0.8, 0.6).normalize() }, uPal: { value: paletteFromColor(dominant) },
    uPoke: { value: new Vector3() }, uAmt: { value: 0 }, uWob: { value: 0 }, uTime: { value: 0 }, uHeightNorm: { value: height },
  };
  const { vert, frag } = gradientShader();
  const body = new Mesh(geometry, new ShaderMaterial({ uniforms, vertexShader: vert.replace('vY = position.y / 1.04;', 'vY = position.y / uHeightNorm + 0.5;').replace('uniform vec3 uPoke;', 'uniform float uHeightNorm; uniform vec3 uPoke;'), fragmentShader: frag, side: DoubleSide }));
  const group = new Group(); group.add(body);
  const poke = { amt: 0, vel: 0 };
  const bb = geometry.boundingBox; const radius = Math.max(width, height);
  const thing = {
    kind: 'thing', group, body, handle: null, paint, uniforms, scale: 1, dominant, paletteName: null, heightMetres: height, creature: null, traits: null, _acc: 0,
    // where a face and feet go, in metres: front of the puffy body, bottom edge
    // where a face, arms and feet go: arms at the silhouette's sides at shoulder height, face on the front, feet at the bottom
    wakeFit: (() => { const unit = height / 1.04; const hw = sides ? Math.max(0.5 - sides[0], sides[1] - 0.5) * width / unit : (width / 2) / unit; return { unit, halfWidth: Math.max(0.2, hw - 0.03), offset: [0, -height / 2, Math.min(width, height) * 0.55 * 0.5 - 0.575 * unit] }; })(),
    setDominant(c) { thing.dominant = c; uniforms.uPal.value = paletteFromColor(c); },
    setGlow(g) { uniforms.uGlow.value = g; },
    /** touch model: cast from outside toward the centre through the point; gap = signed distance along that ray */
    surface(localPt) {
      // world-space cast from outside the object toward its centre, through the point
      body.getWorldPosition(centre); const pW = body.localToWorld(localPt.clone());
      dir.copy(pW).sub(centre); const dist = dir.length(); if (dist < 1e-5) return { u: 0.5, v: 0.5, gap: -radius, depth: radius, onWall: true };
      dir.normalize(); origin.copy(centre).addScaledVector(dir, radius * 1.5);
      ray.set(origin, dir.clone().negate()); ray.far = radius * 1.5;
      let hit = ray.intersectObject(body, false)[0];
      if (!hit) { ray.set(centre, dir); ray.far = radius * 1.5; const hits = ray.intersectObject(body, false); hit = hits[hits.length - 1]; }
      if (!hit) return { u: 0, v: 0, gap: 1, depth: 0, onWall: false };
      const hitDist = hit.point.distanceTo(centre);
      const gap = dist - hitDist;
      return { u: hit.uv ? hit.uv.x : 0.5, v: hit.uv ? hit.uv.y : 0.5, gap, depth: Math.max(0, -gap), onWall: true, wallR: hitDist };
    },
    pokeAt(localPt) { uniforms.uPoke.value.copy(localPt); poke.vel = 3.0; uniforms.uWob.value = 0.05; },
    tick(dt, time) {
      poke.vel += (-70 * poke.amt - 6 * poke.vel) * dt; poke.amt += poke.vel * dt;
      uniforms.uAmt.value = Math.max(0, poke.amt); uniforms.uWob.value *= Math.pow(0.08, dt); uniforms.uTime.value = time;
      thing._acc += dt; if (thing._acc > 1 / 30) { paint.diffuse(thing._acc); thing._acc = 0; }
      paint.upload();
    },
  };
  void bb;
  return thing;
}
