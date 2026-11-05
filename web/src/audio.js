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
