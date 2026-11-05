// Put things on the real table. Uses IWSDK scene understanding (XRPlane entities). The rules want passthrough
// content anchored to detected surfaces, and the object coming out of the real desk is the point.
// - Keeps looking for a table the whole session; if one turns up late, a cup left floating glides down onto it.
// - The spot is on the near edge of the table, inside its outline and within a seated reach.
// - Anything resting on the table is pinned to the plane (stored in the plane's own space), so it stays put as
//   tracking refines the plane's pose.
import { createSystem, XRPlane, Grabbed } from '@iwsdk/core';
import { Vector3, Vector2, Quaternion } from 'three';

const REACH = 0.55;        // m: farthest a spot may be from the eyes, horizontally (2 ft rule)
const MARGIN = 0.07;       // m: keep this far inside the table edge
const head = new Vector3(), planePos = new Vector3(), tmp = new Vector3(), tmpQ = new Quaternion(), fwd = new Vector3();

/** closest point to p on the segment ab (2D) */
function closestOnSeg(p, a, b, out) { const abx = b.x - a.x, aby = b.y - a.y; const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1))); return out.set(a.x + abx * t, a.y + aby * t); }
function inside(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }

export function makePlacementSystem(active, events, { fallbackAfter = 4 } = {}) {
  class PlacementSystem extends createSystem({ planes: { required: [XRPlane] } }, {}) {
    init() { this.t = 0; this.table = null; this.spot = null; this.fallback = false; this.resting = new Set(); }

    /** the best horizontal plane at desk height, as { obj, y, poly: Vector2[] (world xz), centroid: Vector2 } */
    findTable() {
      let best = null, bestScore = Infinity; this.planeInfo = [];
      for (const e of this.queries.planes.entities) {
        const plane = e.getValue(XRPlane, '_plane'); const obj = e.object3D; if (!plane || !obj) continue;
        obj.getWorldPosition(planePos); this.planeInfo.push({ o: plane.orientation, y: +planePos.y.toFixed(2), label: plane.semanticLabel, n: plane.polygon ? plane.polygon.length : 0 });
        if (plane.orientation && plane.orientation !== 'horizontal') continue;
        obj.getWorldPosition(planePos);
        const label = (plane.semanticLabel || '').toLowerCase();
        const h = planePos.y; if (h < 0.4 || h > head.y - 0.1) continue;            // table height, below the eyes
        let score = Math.hypot(planePos.x - head.x, planePos.z - head.z) + Math.abs(h - (head.y - 0.45)) * 2;
        if (label.includes('table') || label.includes('desk')) score -= 1.5;
        if (score < bestScore) { bestScore = score; best = { obj, plane, y: h }; }
      }
      if (!best) return null;
      obj3dUpdate(best.obj);
      const poly = []; const pts = best.plane.polygon || [];
      for (const p of pts) { tmp.set(p.x, 0, p.z); best.obj.localToWorld(tmp); poly.push(new Vector2(tmp.x, tmp.z)); }
      if (poly.length < 3) { best.obj.getWorldPosition(tmp); const r = 0.3; poly.push(new Vector2(tmp.x - r, tmp.z - r), new Vector2(tmp.x + r, tmp.z - r), new Vector2(tmp.x + r, tmp.z + r), new Vector2(tmp.x - r, tmp.z + r)); }
      const centroid = poly.reduce((a, p) => a.add(p), new Vector2()).multiplyScalar(1 / poly.length);
      return { obj: best.obj, y: best.y, poly, centroid };
    }

    /** a point on the table inside its outline, within reach; xz suggestion optional */
    clampToTable(x, z, out = new Vector3()) {
      const T = this.table; if (!T) return null;
      const p = new Vector2(x, z), q = new Vector2(), best = new Vector2(); let bd = Infinity;
      if (!inside(p, T.poly)) { for (let i = 0; i < T.poly.length; i++) { closestOnSeg(p, T.poly[i], T.poly[(i + 1) % T.poly.length], q); const d = q.distanceTo(p); if (d < bd) { bd = d; best.copy(q); } } p.copy(best); }
      // step inside the edge, toward the middle of the table
      const toC = T.centroid.clone().sub(p); const len = toC.length(); if (len > 1e-4) p.addScaledVector(toC, Math.min(len, MARGIN) / len);
      // and within a seated reach of the eyes
      const hx = p.x - head.x, hz = p.y - head.z, hd = Math.hypot(hx, hz); if (hd > REACH) { p.x = head.x + hx / hd * REACH; p.y = head.z + hz / hd * REACH; }
      // on the table beats within reach: if that pulled it off the edge, walk it back in toward the middle
      for (let i = 0; i < 60 && !inside(p, T.poly); i++) { const d = T.centroid.clone().sub(p); const l = d.length(); if (l < 0.01) break; p.addScaledVector(d, 0.01 / l); }
      return out.set(p.x, T.y + 0.002, p.y);
    }
    /** where a fresh object should sit: the near edge of the table, in front of you */
    homeSpot() {
      const T = this.table; if (!T) return null;
      // aim at the point of the table nearest to you, then a little in
      let best = null, bd = Infinity; const p = new Vector2(head.x, head.z), q = new Vector2();
      if (inside(p, T.poly)) best = new Vector2(head.x + fwd.x * 0.4, head.z + fwd.z * 0.4);
      else for (let i = 0; i < T.poly.length; i++) { closestOnSeg(p, T.poly[i], T.poly[(i + 1) % T.poly.length], q); const d = q.distanceTo(p); if (d < bd) { bd = d; best = q.clone(); } }
      const toC = T.centroid.clone().sub(best); const len = toC.length(); if (len > 1e-4) best.addScaledVector(toC, Math.min(len, 0.14) / len);
      return this.clampToTable(best.x, best.y);
    }
    /** where something released at a world point lands. Never mid-air if there is a table. */
    landAt(world) { if (this.table) return this.clampToTable(world.x, world.z); return this.spot ? this.spot.clone() : world.clone(); }

    /** pin an object resting on the table to the plane, so it follows the plane's refined pose */
    rest(cup) { if (!this.table || !cup) return; const T = this.table; cup.restPlane = T.obj; cup.restLocal = T.obj.worldToLocal(cup.group.position.clone()); this.resting.add(cup); }
    unrest(cup) { if (!cup) return; cup.restPlane = null; cup.restLocal = null; this.resting.delete(cup); }

    update(delta) {
      const presenting = this.renderer.xr.isPresenting;
      const headObj = presenting ? this.player.head : this.camera;
      headObj.getWorldPosition(head); fwd.set(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(tmpQ)); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
      this.t += delta;
      // keep looking: planes arrive late, and get refined
      const found = this.findTable(); if (found) this.table = found;
      if (events) { events.tableFound = !!this.table; this.homeT = (this.homeT || 0) - delta; if (this.table && this.homeT <= 0) { this.homeT = 0.5; events.tableHome = this.homeSpot(); } }

      const cup = active.cup;
      // things resting on the table ride with the plane
      for (const c of this.resting) {
        if (!c.restPlane || !c.restPlane.parent) { this.unrest(c); continue; }
        const moving = (c === cup && (c.inStudio || (active.entity && active.entity.hasComponent(Grabbed)))) || c.creature && c.inSpace;
        if (moving) { this.unrest(c); continue; }
        obj3dUpdate(c.restPlane); c.group.position.copy(c.restLocal); c.restPlane.localToWorld(c.group.position);
      }
      if (!cup || cup.kind !== 'cup' || cup.placedOnce) return;            // traced things stay where they were traced
      const grabbed = active.entity && active.entity.hasComponent(Grabbed); if (grabbed || cup.inStudio) { cup.placedOnce = true; return; }
      if (this.table) {
        const s = this.homeSpot();
        if (s) {
          if (this.fallback) { cup.group.position.lerp(s, 1 - Math.pow(0.05, delta)); if (cup.group.position.distanceTo(s) > 0.004) return; }
          cup.group.position.copy(s); cup.group.quaternion.identity(); this.spot = s.clone(); this.fallback = false; cup.placedOnce = true; this.rest(cup);
        }
      } else if (this.t > fallbackAfter && this.fallbackCup !== cup) {
        // no table yet: in front, a little below the eyes (a seated desk). Keep looking; it glides down when one turns up.
        const ahead = presenting ? 0.45 : 0.6, below = presenting ? 0.4 : 0.25;
        if (!this.fallback) { this.spot = head.clone().addScaledVector(fwd, ahead); this.spot.y = head.y - below; }
        cup.group.quaternion.identity(); cup.group.position.copy(this.spot); this.fallback = true; this.fallbackCup = cup;
      }
    }
    /** a new object will want a fresh spot */
    reset(cup) { if (cup) cup.placedOnce = false; }
  }
  return PlacementSystem;
}

function obj3dUpdate(o) { o.updateWorldMatrix(true, false); }
