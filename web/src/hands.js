// Shared hand state for all systems: pinch per hand (from WebXR select events, which hand tracking fires on pinch),
// fingertip world positions from the IWSDK rig, and a few helpers. One place that knows about sessions.
import { Vector3 } from 'three';

export class Hands {
  constructor(world) {
    this.world = world;
    this.pinching = { left: false, right: false };
    this.pinchStart = { left: 0, right: 0 };
    this.tip = { left: new Vector3(), right: new Vector3() };
    this.session = null;
    this.listeners = [];
  }
  /** call once per frame before systems read it */
  update(time) {
    const s = this.world.renderer.xr.getSession();
    if (s && s !== this.session) {
      this.session = s;
      s.addEventListener('selectstart', e => { const h = e.inputSource.handedness; if (h === 'left' || h === 'right') { this.pinching[h] = true; this.pinchStart[h] = time; this._emit('pinchstart', h); } });
      s.addEventListener('selectend', e => { const h = e.inputSource.handedness; if (h === 'left' || h === 'right') { this.pinching[h] = false; this._emit('pinchend', h); } });
      s.addEventListener('end', () => { this.pinching.left = this.pinching.right = false; this.session = null; });
    }
    const tips = this.world.player.indexTipSpaces;
    tips.left.getWorldPosition(this.tip.left);
    tips.right.getWorldPosition(this.tip.right);
  }
  on(type, fn) { this.listeners.push([type, fn]); }
  _emit(type, hand) { for (const [t, fn] of this.listeners) if (t === type) fn(hand); }
  other(hand) { return hand === 'left' ? 'right' : 'left'; }
  /** which hand is pinching closest to a world point, or null */
  pinchingNear(point, maxDist) {
    let best = null, bd = maxDist;
    for (const h of ['left', 'right']) if (this.pinching[h]) { const d = this.tip[h].distanceTo(point); if (d < bd) { bd = d; best = h; } }
    return best;
  }
}
