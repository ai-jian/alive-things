// Put the cup on the real table. Uses IWSDK scene understanding (XRPlane entities). The rules want
// passthrough content anchored to detected surfaces, and the cup coming out of the real desk is the point.
import { createSystem, XRPlane } from '@iwsdk/core';
import { Vector3, Quaternion } from 'three';

const head = new Vector3(), planePos = new Vector3(), toHead = new Vector3(), tmpQ = new Quaternion();

export function makePlacementSystem(active, { fallbackAfter = 4 } = {}) {
  class PlacementSystem extends createSystem({ planes: { required: [XRPlane] } }, {}) {
    init() { this.placed = false; this.t = 0; this.lastCup = null; this.spot = null; }
    update(delta) {
      const cup = active.cup; if (!cup) return;
      if (cup.kind !== 'cup') { this.lastCup = cup; return; }          // traced things stay where they were traced
      if (cup !== this.lastCup) { this.lastCup = cup; if (this.spot) { cup.group.position.copy(this.spot); return; } this.placed = false; }
      if (this.placed) return;
      this.t += delta;
      const presenting = this.renderer.xr.isPresenting;
      const headObj = presenting ? this.player.head : this.camera;     // outside XR the rig head never moves
      headObj.getWorldPosition(head);
      let best = null, bestScore = Infinity;
      for (const e of this.queries.planes.entities) {
        const plane = e.getValue(XRPlane, '_plane'); const obj = e.object3D; if (!plane || !obj) continue;
        if (plane.orientation && plane.orientation !== 'horizontal') continue;
        obj.getWorldPosition(planePos);
        const label = (plane.semanticLabel || '').toLowerCase();
        const h = planePos.y, dist = planePos.distanceTo(head);
        if (h < 0.4 || h > head.y) continue;                                  // table height, below the eyes
        let score = dist + Math.abs(h - (head.y - 0.45)) * 2;
        if (label.includes('table') || label.includes('desk')) score -= 1.5;
        if (score < bestScore) { bestScore = score; best = { obj, y: h }; }
      }
      if (best) {
        best.obj.getWorldPosition(planePos);
        toHead.copy(head).sub(planePos); toHead.y = 0; toHead.normalize();
        cup.group.position.copy(planePos).addScaledVector(toHead, Math.min(0.3, planePos.distanceTo(head) * 0.4));
        cup.group.position.y = best.y + 0.002;
        this.placed = true; this.spot = cup.group.position.clone();
      } else if (this.t > fallbackAfter) {
        // no table found: in front of the face, a little below the eyes (a seated desk). Closer and higher on desktop so it is in view.
        const fwd = new Vector3(0, 0, -1).applyQuaternion(headObj.getWorldQuaternion(tmpQ)); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
        const ahead = presenting ? 0.5 : 0.6, below = presenting ? 0.4 : 0.25;
        cup.group.quaternion.identity();
        cup.group.position.copy(head).addScaledVector(fwd, ahead); cup.group.position.y = head.y - below;
        this.placed = true; this.spot = cup.group.position.clone();
      }
    }
  }
  return PlacementSystem;
}
