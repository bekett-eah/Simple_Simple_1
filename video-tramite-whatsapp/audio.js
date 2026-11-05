/* Banda sonora original sintetizada con Web Audio (OfflineAudioContext) + locución.
 * 100 BPM, progresión C–G–Am–F (alegre y amable), efectos sincronizados a window.CUES
 * y música que baja cuando habla la narradora (window.NARRA). */
(() => {
  const SR = 48000;
  const BEAT = 0.6;
  const BAR = BEAT * 4;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const PROG = [
    { ch: [60, 64, 67, 72], bass: 36 }, // C
    { ch: [59, 62, 67, 71], bass: 43 }, // G
    { ch: [57, 60, 64, 69], bass: 45 }, // Am
    { ch: [57, 60, 65, 69], bass: 41 }, // F
  ];

  function noiseBuffer(ctx, secs, seed = 4242) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = seed;
    for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; }
    return b;
  }
  function impulse(ctx, secs) {
    const len = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let s = 77 + ch * 31;
      for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = ((s / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / len, 3); }
    }
    return b;
  }

  async function loadVoice(ctx) {
    const out = {};
    await Promise.all((window.NARRA || []).map(async (n) => {
      const r = await fetch(`voz/${n.id}.wav`);
      if (r.ok) out[n.id] = await ctx.decodeAudioData(await r.arrayBuffer());
    }));
    return out;
  }

  async function render({ withVoice = true } = {}) {
    const DURATION = window.__duration || 78;
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * DURATION), SR);
    const CUES = window.CUES || {};
    const NARRA = window.NARRA || [];

    // música y efectos → compresor → mezcla final (con la voz) → limitador
    const mix = ctx.createGain();
    mix.gain.value = 0.8;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    mix.connect(lim).connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    master.connect(comp).connect(mix);

    const rev = ctx.createConvolver();
    rev.buffer = impulse(ctx, 2.2);
    const revOut = ctx.createGain(); revOut.gain.value = 0.28;
    rev.connect(revOut).connect(master);

    // Bus de música: baja mientras habla la narradora
    const music = ctx.createGain();
    music.connect(master);
    const LOW = 0.3;
    music.gain.setValueAtTime(0.95, 0);
    NARRA.forEach(({ t, d }) => {
      if (!d) return;
      music.gain.setValueAtTime(0.95, Math.max(0, t - 0.25));
      music.gain.linearRampToValueAtTime(LOW, t);
      music.gain.setValueAtTime(LOW, t + d);
      music.gain.linearRampToValueAtTime(0.95, t + d + 0.45);
    });
    music.gain.setValueAtTime(0.95, DURATION - 1.4);
    music.gain.linearRampToValueAtTime(0.0001, DURATION);

    const NOISE = noiseBuffer(ctx, 3);
    const sfx = ctx.createGain(); sfx.gain.value = 0.8; sfx.connect(master);

    const noiseHit = (t, { type = 'highpass', freq = 7000, q = 0.7, v = 0.1, dec = 0.05, dest = music, send = 0, off = 0 }) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = NOISE; f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
      s.connect(f).connect(g).connect(dest);
      if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg).connect(rev); }
      s.start(t, off % 2.5); s.stop(t + dec + 0.02);
    };

    /* ---------------- instrumentos ---------------- */
    const kick = (t, v = 0.55) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g).connect(music); o.start(t); o.stop(t + 0.35);
    };
    const shaker = (t, v) => noiseHit(t, { freq: 6500, v, dec: 0.045, off: t * 5.7 });
    const snap = (t, v = 0.16) => noiseHit(t, { type: 'bandpass', freq: 2200, q: 1.2, v, dec: 0.09, send: 0.45, off: t * 3.3 });
    const bass = (t, midi, dur = 0.5, v = 0.2) => {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = mtof(midi);
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(f).connect(g).connect(music); o.start(t); o.stop(t + dur + 0.05);
    };
    // marimba: senoidal con armónico 4x que se apaga rápido
    const marimba = (t, midi, v = 0.08, pan = 0) => {
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      const sg = ctx.createGain(); sg.gain.value = 0.35;
      p.connect(music); p.connect(sg).connect(rev);
      [[1, 1, 0.55], [4, 0.28, 0.08], [10, 0.06, 0.03]].forEach(([mul, amp, dec]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = mtof(midi) * mul;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * amp, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
        o.connect(g).connect(p); o.start(t); o.stop(t + dec + 0.05);
      });
    };
    const pad = (t, notes, dur, v = 0.022) => {
      const f = ctx.createBiquadFilter(), g = ctx.createGain(), sg = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 1500;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.5); g.gain.setValueAtTime(v, t + dur - 0.2); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
      sg.gain.value = 0.5;
      f.connect(g).connect(music); g.connect(sg).connect(rev);
      notes.forEach((m) => [-6, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.6);
      }));
    };
    const bell = (t, midi, v = 0.06, dest = sfx) => {
      [[1, 1, 1.2], [2.76, 0.3, 0.5], [5.4, 0.12, 0.25]].forEach(([mul, amp, dec]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), sg = ctx.createGain();
        o.type = 'sine'; o.frequency.value = mtof(midi) * mul;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * amp, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
        sg.gain.value = 0.5;
        o.connect(g).connect(dest); g.connect(sg).connect(rev); o.start(t); o.stop(t + dec + 0.05);
      });
    };

    /* ---------------- efectos ---------------- */
    const whoosh = (t, v = 0.22, dur = 0.8) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
      s.buffer = NOISE; f.type = 'bandpass'; f.Q.value = 1.3;
      f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur * 0.45); f.frequency.exponentialRampToValueAtTime(600, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      p.pan.setValueAtTime(-0.6, t); p.pan.linearRampToValueAtTime(0.6, t + dur);
      s.connect(f).connect(g).connect(p).connect(sfx);
      s.start(t, (t * 1.3) % 1.5); s.stop(t + dur + 0.05);
    };
    const pop = (t, v = 0.11) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1150, t + 0.06);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(sfx); o.start(t); o.stop(t + 0.14);
    };
    const tap = (t) => {
      noiseHit(t, { type: 'bandpass', freq: 3200, q: 2, v: 0.12, dec: 0.025, dest: sfx, off: t * 7 });
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 1700;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g).connect(sfx); o.start(t); o.stop(t + 0.06);
    };
    const type = (t) => noiseHit(t, { type: 'highpass', freq: 4200, v: 0.05, dec: 0.018, dest: sfx, off: t * 13 });
    const chime = (t) => { bell(t, 84, 0.07); bell(t + 0.09, 88, 0.06); bell(t + 0.18, 91, 0.06); };
    const ding = (t) => { bell(t, 84, 0.09); bell(t + 0.13, 91, 0.08); };
    const thump = (t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(sfx); o.start(t); o.stop(t + 0.4);
      noiseHit(t, { type: 'lowpass', freq: 900, v: 0.2, dec: 0.12, dest: sfx, off: t });
    };

    /* ---------------- arreglo ---------------- */
    const groove = (t) => (t >= 2.4 && t < 67.2) || (t >= 68.4 && t < 76.8);
    const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
    const bars = Math.ceil(DURATION / BAR);
    for (let bar = 0; bar < bars; bar++) {
      const t = bar * BAR;
      if (t >= DURATION - 0.5) break;
      const c = PROG[bar % 4];
      const last = t >= 76.8 - BAR && t < 76.8;
      pad(t, c.ch, BAR, t < 2.4 ? 0.03 : 0.022);
      for (let b = 0; b < 4; b++) {
        const bt = t + b * BEAT;
        if (!groove(bt)) continue;
        kick(bt, b === 0 ? 0.55 : 0.38);
        if (b === 1 || b === 3) snap(bt);
        for (let s = 0; s < 4; s++) shaker(bt + s * BEAT / 4, s === 2 ? 0.05 : 0.025);
      }
      for (let e = 0; e < 8; e++) {
        const bt = t + e * BEAT / 2;
        if (groove(bt) && (e === 0 || e === 3 || e === 4 || e === 6)) bass(bt, c.bass + (e === 6 ? 7 : 0), 0.45);
        if (bt >= 0.95 && bt < 76.8) marimba(bt, c.ch[ARP[e]] + 12, e % 2 ? 0.05 : 0.075, e % 2 ? 0.35 : -0.35);
      }
      if (last) bass(t, c.bass, 1.2);
    }
    // acorde final
    pad(76.8, [48, 60, 64, 67, 72], 1.0, 0.04);
    bell(76.8, 84, 0.08, music); bell(76.85, 88, 0.06, music); bell(76.9, 91, 0.06, music);

    (CUES.whoosh || []).forEach((t) => whoosh(t));
    (CUES.swoosh || []).forEach((t) => whoosh(t, 0.12, 0.45));
    (CUES.pop || []).forEach((t) => pop(t));
    (CUES.tap || []).forEach((t) => tap(t));
    (CUES.type || []).forEach((t) => type(t));
    (CUES.chime || []).forEach((t) => chime(t));
    (CUES.ding || []).forEach((t) => ding(t));
    (CUES.thump || []).forEach((t) => thump(t));

    // Locución
    if (withVoice) {
      const voz = await loadVoice(ctx);
      const vg = ctx.createGain(); vg.gain.value = 1.15;
      vg.connect(mix);
      NARRA.forEach(({ id, t }) => {
        if (!voz[id]) return;
        const s = ctx.createBufferSource(); s.buffer = voz[id];
        s.connect(vg); s.start(t);
      });
    }

    return ctx.startRendering();
  }

  function toWav(buf) {
    const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    w(36, 'data'); data.setUint32(40, len * ch * 2, true);
    const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const v = Math.max(-1, Math.min(1, chans[c][i]));
        data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        o += 2;
      }
    }
    return new Uint8Array(data.buffer);
  }

  async function renderWavBase64() {
    const bytes = toWav(await render({ withVoice: true }));
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  window.SimpleAudio = { render, renderWavBase64 };
})();
