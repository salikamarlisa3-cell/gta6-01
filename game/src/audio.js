// Procedural WebAudio sounds for AZURA HEAT: engine hum, sirens, shots, punches, pickups.
// No audio files: every sound is synthesized so the game loads with zero network requests.

export function createAudio() {
  let ctx = null;
  let unlocked = false;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (!unlocked) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t);
  }

  return {
    unlock() { unlocked = true; ensure(); },
    toggleMute() { muted = !muted; if (muted) this.setEngine(0, false); return muted; },
    isMuted() { return muted; },
    shot() { noise(0.12, 0.3, 3000); tone(160, 0.1, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.25, 600); tone(90, 0.08, 'sine', 0.2, 50); },
    crash() { noise(0.25, 0.35, 900); tone(70, 0.2, 'sawtooth', 0.15, 40); },
    pickup() { tone(660, 0.09, 'sine', 0.15); setTimeout(() => tone(990, 0.12, 'sine', 0.15), 70); },
    cash() { tone(880, 0.08, 'triangle', 0.18); setTimeout(() => tone(1320, 0.14, 'triangle', 0.18), 80); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.16), i * 110)); },
    fail() { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sawtooth', 0.1), i * 120)); },
    reload() { tone(300, 0.05, 'square', 0.1); setTimeout(() => tone(450, 0.05, 'square', 0.1), 120); },
    door() { tone(200, 0.07, 'square', 0.12, 120); },
    horn() { tone(340, 0.25, 'square', 0.1); },
    setEngine(speedRatio, active) {
      if (!ensure() || muted) { if (engineGain) engineGain.gain.value = 0; return; }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain(); engineGain.gain.value = 0;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(ctx.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 60 + Math.abs(speedRatio) * 140;
      engineGain.gain.value = active ? 0.045 : 0;
    },
    setSiren(active) {
      if (!ensure() || muted) { if (sirenGain) sirenGain.gain.value = 0; return; }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
        sirenOsc.start();
      }
      if (active) {
        const t = ctx.currentTime;
        sirenOsc.frequency.setValueAtTime(700 + Math.sin(t * 4) * 250, t);
        sirenGain.gain.value = 0.03;
      } else if (sirenGain) sirenGain.gain.value = 0;
    },
  };
}
