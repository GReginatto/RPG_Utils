// ── Singleton AudioContext ────────────────────────────────────────────────────
let _ctx = null;

export function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

export function createNoiseBuffer(ctx, duration) {
  const len = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ── One-shot SFX ──────────────────────────────────────────────────────────────

export function sfxDiceRoll(vol = 0.7) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = vol;
  out.connect(ctx.destination);
  for (let i = 0; i < 3; i++) {
    const buf = createNoiseBuffer(ctx, 0.05);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, now + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.06);
    src.connect(g); g.connect(out); src.start(now + i * 0.08);
  }
}

export function sfxHit(vol = 0.7) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(130, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.22);
  const g = ctx.createGain();
  g.gain.setValueAtTime(1.0, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.3);
}

export function sfxCritical(vol = 0.7) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(90, now); osc.frequency.exponentialRampToValueAtTime(22, now + 0.55);
  const g = ctx.createGain();
  g.gain.setValueAtTime(1.0, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 0.55);
  [2000, 2800, 3600, 4200].forEach((freq, i) => {
    const sh = ctx.createOscillator(); sh.type = 'sine';
    sh.frequency.setValueAtTime(freq, now + 0.06 + i * 0.07);
    sh.frequency.linearRampToValueAtTime(freq * 1.8, now + 0.2 + i * 0.07);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.18, now + 0.06 + i * 0.07);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.45 + i * 0.07);
    sh.connect(sg); sg.connect(out); sh.start(now + 0.06 + i * 0.07); sh.stop(now + 0.7);
  });
}

export function sfxHeal(vol = 0.7) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + i * 0.11);
    g.gain.linearRampToValueAtTime(0.38, now + i * 0.11 + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.65);
    osc.connect(g); g.connect(out); osc.start(now + i * 0.11); osc.stop(now + i * 0.11 + 0.7);
  });
}

export function sfxDeath(vol = 0.7) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(190, now); osc.frequency.exponentialRampToValueAtTime(32, now + 1.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.75, now); g.gain.setValueAtTime(0.75, now + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
  osc.connect(g); g.connect(out); osc.start(now); osc.stop(now + 2.0);
}

export function sfxTurnBell(vol = 0.7) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(i === 0 ? 0.45 : 0.2, now + i * 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + (i === 0 ? 0.9 : 0.65));
    osc.connect(g); g.connect(out); osc.start(now + i * 0.02); osc.stop(now + 1.0);
  });
}

export function sfxCombatStart(vol = 0.7) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
  [80, 160, 240].forEach(freq => {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.68, now); osc.frequency.linearRampToValueAtTime(freq, now + 0.28);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, now); g.gain.setValueAtTime(0.38, now + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc.connect(lp); lp.connect(g); g.connect(out); osc.start(now); osc.stop(now + 1.4);
  });
}

// ── Ambient management ────────────────────────────────────────────────────────

const activeAmbients = new Map(); // id → { stop: Function, gainNode: GainNode }

export function isAmbientPlaying(id) {
  return activeAmbients.has(id);
}

export function stopAllAmbients() {
  activeAmbients.forEach(a => a.stop());
  activeAmbients.clear();
}

export function toggleAmbient(id, vol = 0.5) {
  if (activeAmbients.has(id)) {
    activeAmbients.get(id).stop();
    activeAmbients.delete(id);
    return false;
  }
  const ctx = getCtx();
  const gainNode = ctx.createGain();
  gainNode.gain.value = vol;
  gainNode.connect(ctx.destination);
  const stop = _startAmbient(id, ctx, gainNode);
  activeAmbients.set(id, { stop, gainNode });
  return true;
}

export function setAmbientVolume(id, vol) {
  const entry = activeAmbients.get(id);
  if (entry) entry.gainNode.gain.value = vol;
}

function _startAmbient(id, ctx, dest) {
  switch (id) {
    case 'rain': {
      const src = ctx.createBufferSource();
      src.buffer = createNoiseBuffer(ctx, 3);
      src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.5;
      src.connect(bp); bp.connect(dest); src.start();
      return () => { try { src.stop(); } catch (_) {} };
    }
    case 'fire': {
      let alive = true;
      const tids = [];
      function pop() {
        if (!alive) return;
        const len = Math.floor(ctx.sampleRate * (0.012 + Math.random() * 0.03));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sqrt(1 - i / len);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 + Math.random() * 380;
        const g = ctx.createGain(); g.gain.value = 0.18 + Math.random() * 0.55;
        src.connect(lp); lp.connect(g); g.connect(dest); src.start();
        tids.push(setTimeout(pop, 25 + Math.random() * 170));
      }
      pop();
      return () => { alive = false; tids.forEach(clearTimeout); };
    }
    case 'forest': {
      const wind = ctx.createBufferSource();
      wind.buffer = createNoiseBuffer(ctx, 2);
      wind.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.28;
      const lfoG = ctx.createGain(); lfoG.gain.value = 180;
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      const wg = ctx.createGain(); wg.gain.value = 0.5;
      wind.connect(lp); lp.connect(wg); wg.connect(dest);
      wind.start(); lfo.start();
      let alive = true; const tids = [];
      function chirp() {
        if (!alive) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(2600 + Math.random() * 700, now);
        osc.frequency.linearRampToValueAtTime(3400 + Math.random() * 400, now + 0.06);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.22, now + 0.02);
        g.gain.linearRampToValueAtTime(0, now + 0.16);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + 0.22);
        tids.push(setTimeout(chirp, 2800 + Math.random() * 6000));
      }
      chirp();
      return () => { try { wind.stop(); lfo.stop(); } catch (_) {} alive = false; tids.forEach(clearTimeout); };
    }
    case 'dungeon': {
      const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 52;
      const dg = ctx.createGain(); dg.gain.value = 0.14;
      drone.connect(dg); dg.connect(dest); drone.start();
      let alive = true; const tids = [];
      function drip() {
        if (!alive) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(1300, now); osc.frequency.exponentialRampToValueAtTime(650, now + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + 0.15);
        tids.push(setTimeout(drip, 700 + Math.random() * 2800));
      }
      drip();
      return () => { try { drone.stop(); } catch (_) {} alive = false; tids.forEach(clearTimeout); };
    }
    case 'ocean': {
      const sr = ctx.sampleRate;
      const len = sr * 4;
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = ctx.createGain(); g.gain.value = 0.4;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.11;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.28;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      src.connect(lp); lp.connect(g); g.connect(dest); src.start(); lfo.start();
      return () => { try { src.stop(); lfo.stop(); } catch (_) {} };
    }
    case 'battle': {
      let alive = true; const tids = [];
      function clash() {
        if (!alive) return;
        const now = ctx.currentTime;
        const len = Math.floor(ctx.sampleRate * (0.04 + Math.random() * 0.09));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
        const g = ctx.createGain(); g.gain.value = 0.12 + Math.random() * 0.22;
        src.connect(hp); hp.connect(g); g.connect(dest); src.start(now);
        tids.push(setTimeout(clash, 180 + Math.random() * 750));
      }
      function drum() {
        if (!alive) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(75, now); osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.55, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now + 0.32);
        tids.push(setTimeout(drum, 480 + Math.random() * 920));
      }
      clash(); drum();
      return () => { alive = false; tids.forEach(clearTimeout); };
    }
    default: return () => {};
  }
}
