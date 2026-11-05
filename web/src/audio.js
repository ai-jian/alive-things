// All sound is synthesized: a low hum for Focus, ticks for the brush, chirps for creatures. No audio files.
export class Sound {
  constructor() { this.ctx = null; this.hum = null; }
  ensure() {
    if (this.ctx) return this.ctx;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    const c = this.ctx;
    // hum: two detuned sines through a lowpass, a slow LFO on the filter
    const g = c.createGain(); g.gain.value = 0; g.connect(c.destination);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 0.7; f.connect(g);
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55; o1.connect(f);
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 110.6; const g2 = c.createGain(); g2.gain.value = 0.25; o2.connect(g2).connect(f);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 80; lfo.connect(lg).connect(f.frequency);
    o1.start(); o2.start(); lfo.start();
    this.hum = { gain: g };
    return c;
  }
  resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
  setHum(level, seconds = 1.5) { const c = this.ensure(); if (!c || !this.hum) return; const t = c.currentTime; this.hum.gain.gain.cancelScheduledValues(t); this.hum.gain.gain.setTargetAtTime(level * 0.18, t, seconds / 3); }
  tick(pitch = 1, vol = 0.04) {
    const c = this.ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = (1400 + Math.random() * 300) * pitch;
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.06);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.07);
  }
  // ---- spatial: voices come from where the creature is ----
  _panner(pos) {
    const c = this.ctx; const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 0.25; p.rolloffFactor = 1.3; p.maxDistance = 6;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(c.destination); return p;
  }
  setListener(pos, fwd, up) {
    const c = this.ctx; if (!c) return; const l = c.listener;
    if (l.positionX) { l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z; l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z; l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z; }
    else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  }
  /**
   * A whispered phrase in a wordless language. Each syllable is a buzz through two vowel formants.
   * pitch/speed/volume come from personality; question = rising contour, answer = falling.
   * Returns the phrase length in seconds so the partner can reply after it.
   */
  whisper({ pitch = 1, speed = 1, syllables = 4, volume = 0.045, question = false, pos = null } = {}) {
    const c = this.ensure(); if (!c) return 0.8;
    const out = pos ? this._panner(pos) : c.destination;
    const soft = c.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 2600; soft.connect(out);
    let t = c.currentTime + 0.02; const base = 290 * pitch;
    const vowels = [[700, 1200], [420, 1900], [320, 900], [520, 1050], [280, 2200], [600, 1500]];
    const n = Math.max(2, Math.min(7, syllables));
    for (let i = 0; i < n; i++) {
      const dur = (0.075 + Math.random() * 0.05) / speed;
      const k = n > 1 ? i / (n - 1) : 0;
      const contour = question ? k * 0.38 : (i === n - 1 ? -0.22 : k * 0.08);
      const f0 = base * (1 + contour + (Math.random() - 0.5) * 0.14);
      const osc = c.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f0 * (0.92 + Math.random() * 0.16), t + dur);
      const [F1, F2] = vowels[(Math.random() * vowels.length) | 0]; const fs = Math.sqrt(pitch);
      const b1 = c.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = F1 * fs; b1.Q.value = 5;
      const b2 = c.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = F2 * fs; b2.Q.value = 7;
      const g2 = c.createGain(); g2.gain.value = 0.45;
      const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(volume, t + 0.014); env.gain.setValueAtTime(volume, t + dur * 0.55); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(b1).connect(env); osc.connect(b2).connect(g2).connect(env); env.connect(soft);
      osc.start(t); osc.stop(t + dur + 0.03);
      t += dur + (0.035 + Math.random() * 0.05) / speed;
    }
    return t - c.currentTime;
  }
  /** a short wordless syllable; pitch from personality, playful = higher and faster */
  chirp(pitch = 1, syllables = 2) {
    const c = this.ensure(); if (!c) return;
    let t = c.currentTime;
    for (let i = 0; i < syllables; i++) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle';
      const f0 = (520 + Math.random() * 180) * pitch; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (0.8 + Math.random() * 0.5), t + 0.09);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.11); t += 0.12;
    }
  }
  /** soft rising chime for the wake */
  wake(pitch = 1) {
    const c = this.ensure(); if (!c) return; let t = c.currentTime;
    for (const r of [1, 1.25, 1.5, 2]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 440 * r * pitch; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.55); t += 0.11; }
  }
}
