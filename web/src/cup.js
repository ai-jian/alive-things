// The first ready object: a cup. Lathe body with the whole-body gradient shader, a handle, and an analytic
// surface model (radius as a function of height) so the brush never needs raycasts.
import { Group, Mesh, LatheGeometry, TorusGeometry, Vector2, Vector3, ShaderMaterial, Color } from 'three';
import { PaintLayer } from './paint.js';
import { paletteFromColor } from './palette.js';

// profile in "cup units" (height 1.04). Wall is points 3..5.
const PROFILE = [[0, 0], [0.42, 0], [0.52, 0.04], [0.56, 0.12], [0.60, 0.6], [0.64, 0.98], [0.66, 1.04], [0.58, 1.04], [0.56, 0.98], [0.52, 0.20], [0.44, 0.14], [0, 0.14]];
const WALL_Y0 = 0.12, WALL_Y1 = 0.98, WALL_R0 = 0.56, WALL_R1 = 0.64;     // outer wall: y range and radius range
const V0 = 0.12, V1 = 0.88;                                                 // texture V band owned by the wall

const vert = /* glsl */`
  uniform vec3 uPoke; uniform float uAmt; uniform float uWob; uniform float uTime;
  varying vec2 vUv; varying vec3 vN; varying float vY;
  void main(){
    vUv = uv; vec3 p = position;
    float dj = distance(p, uPoke); float fj = smoothstep(0.55, 0.0, dj);
    p -= normalize(p * vec3(1.0, 0.0, 1.0) + vec3(0.0001)) * fj * uAmt * 0.34;
    float wj = sin(uTime * 9.0 + p.y * 5.0) * uWob; p.x *= 1.0 + wj; p.z *= 1.0 + wj; p.y *= 1.0 - wj * 0.8;
    vY = position.y / 1.04;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const frag = /* glsl */`
  uniform sampler2D uHeat; uniform float uPaint, uBaseLo, uBaseHi, uShade, uGlow, uUnder; uniform vec3 uLightDir; uniform vec3 uPal[6];
  varying vec2 vUv; varying vec3 vN; varying float vY;
  vec3 pal(float t){
    t = clamp(t, 0.0, 1.0) * 5.0;
    vec3 c = mix(uPal[0], uPal[1], clamp(t, 0.0, 1.0));
    c = mix(c, uPal[2], clamp(t - 1.0, 0.0, 1.0));
    c = mix(c, uPal[3], clamp(t - 2.0, 0.0, 1.0));
    c = mix(c, uPal[4], clamp(t - 3.0, 0.0, 1.0));
    return mix(c, uPal[5], clamp(t - 4.0, 0.0, 1.0));
  }
  void main(){
    float base = mix(uBaseLo, uBaseHi, clamp(vY, 0.0, 1.0));
    vec3 N = normalize(vN); vec3 L = normalize((viewMatrix * vec4(uLightDir, 0.0)).xyz);
    float lit = smoothstep(-0.25, 0.55, dot(N, L));
    base -= uShade * (1.0 - lit);
    // in the garden the light pool shines up from below: faces that look down get warmer
    vec3 downV = normalize((viewMatrix * vec4(0.0, -1.0, 0.0, 0.0)).xyz);
    base += max(dot(N, downV), 0.0) * uUnder * 0.2;
    float h = uPaint > 0.5 ? texture2D(uHeat, vUv).r : 0.0;
    float t = base + h * 0.32;
    vec3 col = pal(t) + pal(min(t + 0.12, 0.95)) * smoothstep(0.0, 0.8, h) * uGlow * 0.25;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export function gradientShader() { return { vert, frag }; }

export function makeCup({ dominant = new Color(0.93, 0.88, 0.78), heightMetres = 0.09 } = {}) {
  const scale = heightMetres / 1.04;
  const circumference = 2 * Math.PI * ((WALL_R0 + WALL_R1) / 2) * scale;
  const wallHeight = (WALL_Y1 - WALL_Y0) * scale / (V1 - V0);     // metres per full V unit
  const paint = new PaintLayer({ circumference, wallHeight });

  // geometry: subdivide the wall so the jelly reads
  const prof = PROFILE.map(p => new Vector2(p[0], p[1]));
  const fine = [];
  for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; const steps = (i === 3 || i === 4) ? 14 : 1; for (let s = 0; s < steps; s++) fine.push(new Vector2(a.x + (b.x - a.x) * s / steps, a.y + (b.y - a.y) * s / steps)); }
  fine.push(prof[prof.length - 1]);
  const geo = new LatheGeometry(fine, 96);
  { const uv = geo.attributes.uv, n = fine.length - 1, wallStart = 3, wallEnd = 31;
    const vOf = k => k <= wallStart ? k / wallStart * V0 : k <= wallEnd ? V0 + (k - wallStart) / (wallEnd - wallStart) * (V1 - V0) : V1 + (k - wallEnd) / (n - wallEnd) * (1 - V1);
    for (let i = 0; i < uv.count; i++) { const k = Math.round(uv.getY(i) * n); uv.setY(i, vOf(k)); } uv.needsUpdate = true; }
  geo.computeVertexNormals();

  const uniforms = {
    uHeat: { value: paint.texture }, uPaint: { value: 1 }, uBaseLo: { value: 0.10 }, uBaseHi: { value: 0.55 }, uShade: { value: 0.16 }, uGlow: { value: 0 }, uUnder: { value: 0 },
    uLightDir: { value: new Vector3(0.5, 0.8, 0.6).normalize() }, uPal: { value: paletteFromColor(dominant) },
    uPoke: { value: new Vector3() }, uAmt: { value: 0 }, uWob: { value: 0 }, uTime: { value: 0 },
  };
  const bodyMat = new ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag });
  const handleMat = new ShaderMaterial({ uniforms: { ...uniforms, uPaint: { value: 0 } }, vertexShader: vert, fragmentShader: frag });
  const body = new Mesh(geo, bodyMat);
  const handle = new Mesh(new TorusGeometry(0.30, 0.075, 14, 28, Math.PI * 1.25), handleMat);
  handle.position.set(0.56, 0.56, 0); handle.rotation.set(0, 0, -Math.PI * 0.62);
  const group = new Group(); group.add(body, handle); group.scale.setScalar(scale);

  const poke = { amt: 0, vel: 0 };
  const cup = {
    kind: 'cup', group, body, handle, paint, uniforms, scale, dominant,
    setDominant(c) { cup.dominant = c; uniforms.uPal.value = paletteFromColor(c); },
    setGlow(g) { uniforms.uGlow.value = g; },
    /** Analytic surface model in cup units: returns {u, v, depth, onWall} for a point in the cup's local space. */
    surface(localPt) {
      const y = localPt.y, r = Math.hypot(localPt.x, localPt.z);
      const onWall = y >= WALL_Y0 && y <= WALL_Y1;
      const wallR = WALL_R0 + (WALL_R1 - WALL_R0) * (y - WALL_Y0) / (WALL_Y1 - WALL_Y0);
      let u = Math.atan2(localPt.x, localPt.z) / (2 * Math.PI); if (u < 0) u += 1;   // LatheGeometry: x = r sin(phi), z = r cos(phi)
      const v = V0 + (y - WALL_Y0) / (WALL_Y1 - WALL_Y0) * (V1 - V0);
      return { u, v, gap: r - wallR, depth: Math.max(0, wallR - r), onWall, wallR };
    },
    pokeAt(localPt) { uniforms.uPoke.value.copy(localPt); poke.vel = 3.0; uniforms.uWob.value = 0.05; },
    /** per-frame: jelly spring, paint diffusion, texture upload. dt seconds. */
    tick(dt, time) {
      poke.vel += (-70 * poke.amt - 6 * poke.vel) * dt; poke.amt += poke.vel * dt;
      uniforms.uAmt.value = Math.max(0, poke.amt); uniforms.uWob.value *= Math.pow(0.08, dt); uniforms.uTime.value = time;
      cup._acc = (cup._acc || 0) + dt; if (cup._acc > 1 / 30) { paint.diffuse(cup._acc); cup._acc = 0; }
      paint.upload();
    },
    _acc: 0,
  };
  return cup;
}
