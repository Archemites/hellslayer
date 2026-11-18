'use strict';
/* ============================================================
   HELLSLAYER - Motor Thrash Metal (11 Faixas por Episódio/Área)
   via WebAudioFont (MIDI API) com fallback limpo WebAudio.
   Composições originais inspiradas em clássicos do Thrash Metal.
   ============================================================ */
window.ThrashMusic = (() => {
  const CDN_PLAYER = 'https://surikov.github.io/webaudiofont/npm/dist/WebAudioFontPlayer.js';
  const CDN_SOUND = 'https://surikov.github.io/webaudiofontdata/sound/';

  const PRESETS = {
    guitarDist: { file: '0300_LesPaul_sf2_file.js', varName: '_tone_0300_LesPaul_sf2_file' },
    guitarDrive: { file: '0290_LesPaul_sf2_file.js', varName: '_tone_0290_LesPaul_sf2_file' },
    bass: { file: '0340_FluidR3_GM_sf2_file.js', varName: '_tone_0340_FluidR3_GM_sf2_file' },
    kick: { file: '12836_0_FluidR3_GM_sf2_file.js', varName: '_drum_36_0_FluidR3_GM_sf2_file' },
    snare: { file: '12838_0_FluidR3_GM_sf2_file.js', varName: '_drum_38_0_FluidR3_GM_sf2_file' },
    hhClosed: { file: '12842_0_FluidR3_GM_sf2_file.js', varName: '_drum_42_0_FluidR3_GM_sf2_file' },
    crash: { file: '12849_0_FluidR3_GM_sf2_file.js', varName: '_drum_49_0_FluidR3_GM_sf2_file' }
  };

  let ctx = null;
  let dest = null;
  let noiseBuf = null;
  let player = null;
  let loadStarted = false;
  let loadFailed = false;
  const fonts = {};
  const ALL_PRESET_KEYS = Object.keys(PRESETS);

  let guitarBus = null;
  let bassBus = null;
  let drumBus = null;

  const LOOKAHEAD = 1.0;
  const MAX_STEPS_PER_TICK = 48;

  let currentTrackId = 'title';
  let step = 0;
  let nextT = 0;

  function makeSoftCurve(amount, n) {
    const len = n || 2048;
    const curve = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const x = (i * 2) / len - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    return curve;
  }

  const SOFT_CURVE = makeSoftCurve(4, 2048);

  function loadScript(url, onload, onerror) {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = onload;
    s.onerror = onerror || (() => {});
    document.head.appendChild(s);
  }

  function syncLoadedFonts() {
    if (!ctx) return;
    if (!player && typeof WebAudioFontPlayer === 'function') {
      player = new WebAudioFontPlayer();
    }
    if (!player) return;
    for (const key of ALL_PRESET_KEYS) {
      if (fonts[key]) continue;
      const data = window[PRESETS[key].varName];
      if (data) {
        try {
          player.adjustPreset(ctx, data);
          fonts[key] = data;
        } catch (e) {}
      }
    }
  }

  function areAllFontsReady() {
    return !!(player && ALL_PRESET_KEYS.every((k) => fonts[k]));
  }

  function loadOnlineMidiFonts() {
    if (loadStarted) return;
    loadStarted = true;
    const onErr = () => { loadFailed = true; };
    loadScript(CDN_PLAYER, syncLoadedFonts, onErr);
    for (const key of ALL_PRESET_KEYS) {
      loadScript(CDN_SOUND + PRESETS[key].file, syncLoadedFonts, onErr);
    }
  }

  function buildAudioChains() {
    // Guitarra: HPF limpo -> leve corpo -> corte suave de médio -> Cab LPF macio
    const gHP = ctx.createBiquadFilter();
    gHP.type = 'highpass'; gHP.frequency.value = 100;

    const gBody = ctx.createBiquadFilter();
    gBody.type = 'lowshelf'; gBody.frequency.value = 150; gBody.gain.value = 2.0;

    const gScoop = ctx.createBiquadFilter();
    gScoop.type = 'peaking'; gScoop.frequency.value = 520; gScoop.Q.value = 0.9; gScoop.gain.value = -3.0;

    const gCab = ctx.createBiquadFilter();
    gCab.type = 'lowpass'; gCab.frequency.value = 3400; gCab.Q.value = 0.7;

    const gGain = ctx.createGain();
    gGain.gain.value = 0.44;

    gHP.connect(gBody);
    gBody.connect(gScoop);
    gScoop.connect(gCab);
    gCab.connect(gGain);
    gGain.connect(dest);
    guitarBus = gHP;

    // Baixo: firme e redondo para colar com o bumbo
    const bHP = ctx.createBiquadFilter();
    bHP.type = 'highpass'; bHP.frequency.value = 40;

    const bLP = ctx.createBiquadFilter();
    bLP.type = 'lowpass'; bLP.frequency.value = 1100;

    const bGain = ctx.createGain();
    bGain.gain.value = 0.52;

    bHP.connect(bLP);
    bLP.connect(bGain);
    bGain.connect(dest);
    bassBus = bHP;

    // Bateria: compressão leve e limpa
    const dComp = ctx.createDynamicsCompressor();
    dComp.threshold.value = -14;
    dComp.knee.value = 10;
    dComp.ratio.value = 3.5;
    dComp.attack.value = 0.005;
    dComp.release.value = 0.14;

    const dGain = ctx.createGain();
    dGain.gain.value = 0.8;

    dComp.connect(dGain);
    dGain.connect(dest);
    drumBus = dComp;
  }

  function init(audioCtx, musicGainNode, sharedNoiseBuf) {
    ctx = audioCtx;
    dest = musicGainNode;
    noiseBuf = sharedNoiseBuf;
    buildAudioChains();
    nextT = ctx.currentTime + 0.1;
    loadOnlineMidiFonts();
    syncLoadedFonts();
    setTimeout(() => {
      if (!areAllFontsReady()) loadFailed = true;
    }, 6000);
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // ---------- Triggers (WebAudioFont + Fallback Limpo) ----------
  function playGuitarNote(midi, t, dur, vol, useDrive, isClean) {
    const preset = useDrive ? (fonts.guitarDrive || fonts.guitarDist) : (fonts.guitarDist || fonts.guitarDrive);
    if (player && preset) {
      player.queueWaveTable(ctx, guitarBus, preset, t, midi, dur, vol);
      return;
    }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = isClean ? 'triangle' : 'sawtooth';
    o.frequency.setValueAtTime(midiToFreq(midi), t);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol * (isClean ? 0.42 : 0.38), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.05, dur));
    if (isClean) {
      o.connect(g); g.connect(guitarBus);
    } else {
      const shaper = ctx.createWaveShaper();
      shaper.curve = SOFT_CURVE;
      o.connect(shaper); shaper.connect(g); g.connect(guitarBus);
    }
    o.start(t); o.stop(t + dur + 0.03);
  }

  function playPowerChord(rootMidi, t, dur, vol, mode) {
    if (mode === 'chug') {
      playGuitarNote(rootMidi, t, dur, vol, true, false);
    } else if (mode === 'lead') {
      playGuitarNote(rootMidi, t, dur, vol, false, false);
    } else if (mode === 'clean') {
      playGuitarNote(rootMidi, t, dur, vol, true, true);
    } else {
      playGuitarNote(rootMidi, t, dur, vol, false, false);
      playGuitarNote(rootMidi + 7, t, dur, vol * 0.72, false, false);
    }
  }

  function playBassNote(midi, t, dur, vol) {
    const safeMidi = Math.max(28, midi);
    if (player && fonts.bass) {
      player.queueWaveTable(ctx, bassBus, fonts.bass, t, safeMidi, dur, vol);
      return;
    }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(midiToFreq(safeMidi), t);
    g.gain.setValueAtTime(vol * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bassBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function playDrum(kind, t, vol) {
    const midiMap = { kick: 36, snare: 38, hhClosed: 42, crash: 49 };
    const preset = fonts[kind];
    if (player && preset) {
      const dur = kind === 'crash' ? 1.1 : 0.22;
      player.queueWaveTable(ctx, drumBus, preset, t, midiMap[kind], dur, vol);
      return;
    }
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(135, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.09);
      g.gain.setValueAtTime(vol * 0.72, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.16);
    } else if (kind === 'snare') {
      const sn = ctx.createBufferSource(); sn.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500;
      const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      sn.connect(f); f.connect(g); g.connect(drumBus); sn.start(t); sn.stop(t + 0.13);
    } else {
      const sn = ctx.createBufferSource(); sn.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'crash' ? 4000 : 6200;
      const dur = kind === 'crash' ? 0.45 : 0.04;
      const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      sn.connect(f); f.connect(g); g.connect(drumBus); sn.start(t); sn.stop(t + dur + 0.02);
    }
  }

  // ---------- Helpers de Partitura (Zero-GC) ----------
  // Negativo (-m): palm-mute chug | 1..127: power chord | 1000+m: single lead | 2000+m: clean/arpeggio
  const E = 40, F = 41, Fs = 42, G = 43, Gs = 44, A = 45, Bb = 46, B = 47,
        C = 48, Cs = 49, Cs3 = 49, D = 50, Ds = 51, Ds3 = 51, E3 = 52, F3 = 53, Fs3 = 54, G3 = 55,
        Gs3 = 56, A3 = 57, Bb3 = 58, B3 = 59, C4 = 60, Cs4 = 61, D4 = 62, Ds4 = 63, E4 = 64;
  const cE = -E, cF = -F, cFs = -Fs, cG = -G, cA = -A, cB = -B;
  const L = m => 1000 + m; // Single lead/melody note
  const Q = m => 2000 + m; // Clean/eerie arpeggio note

  // ============================================================
  // TELA DE TÍTULO
  // ============================================================

  // Título: Inspirada no riff principal de "Seek & Destroy" (Metallica) — Pesada, forte e marcante
  const TITLE_TRACK = [
    // Sec A (0-3): Riff principal pesado em A com chugs em 16ª e gancho em power chords
    cA, cA, 0, cA,      G, 0, A, 0,            C, 0, B, 0,           A, 0, G, 0,
    cA, cA, 0, cA,      G, 0, E, 0,            G, 0, A, 0,           0, cE, E, 0,
    cA, cA, 0, cA,      G, 0, A, 0,            C, 0, B, 0,           A, 0, G, 0,
    G, 0, Fs, 0,        F, 0, E, 0,            G, 0, A, 0,           cA, cA, E, 0,
    // Sec B (4-7): Peso dobrado com pedal em A/E e ataques cromáticos
    A, 0, cA, cA,       G, 0, A, 0,            C, 0, B, 0,           A, 0, G, 0,
    E, 0, cE, cE,       G, 0, A, 0,            Bb, 0, A, 0,          G, 0, E, 0,
    A, 0, cA, cA,       G, 0, A, 0,            C, 0, B, 0,           A, 0, G, 0,
    G, 0, Fs, 0,        F, 0, E, 0,            E, 0, G, 0,           A, 0, 0, 0,
    // Sec C (8-11): Refrão esmagador estilo Kill 'Em All
    E, 0, cE, cE,       G, 0, A, 0,            E, 0, cE, cE,         C, 0, B, 0,
    A, 0, G, 0,         E, 0, G, 0,            A, 0, cA, cA,         G, 0, E, 0,
    E, 0, cE, cE,       G, 0, A, 0,            E, 0, cE, cE,         D, 0, C, 0,
    B, 0, Bb, 0,        A, 0, G, 0,            Fs, 0, F, 0,          E, 0, 0, 0
  ];

  // ============================================================
  // EPISÓDIO 1
  // ============================================================

  // Ep.1 Área 1: Inspirada em "South of Heaven" (Slayer) — Intro sombria arpejada + peso doom-thrash
  const EP1_A1 = [
    // Sec A (0-3): Arpejo sombrio e lento com trítone/cromatismo sinistro
    Q(E), 0, Q(E3), 0,  Q(Bb3), 0, Q(A3), 0,   Q(G3), 0, Q(Fs3), 0,  Q(F3), 0, Q(E3), 0,
    Q(E), 0, Q(E3), 0,  Q(C4), 0, Q(B3), 0,    Q(Bb3), 0, Q(A3), 0,  Q(Gs3), 0, Q(G3), 0,
    Q(E), 0, Q(E3), 0,  Q(Bb3), 0, Q(A3), 0,   Q(G3), 0, Q(Fs3), 0,  Q(F3), 0, Q(E3), 0,
    Q(F), 0, 0, Q(E),   0, 0, Q(Bb), 0,        Q(A), 0, Q(Gs), 0,   Q(G), 0, Q(Fs), 0,
    // Sec B (4-7): Riff pesado doom-thrash com chugs e power chords arrastados
    E, 0, 0, cE,        cE, 0, E, 0,           Bb, 0, 0, A,         0, 0, G, 0,
    E, 0, 0, cE,        cE, 0, E, 0,           C, 0, 0, B,          0, 0, Bb, 0,
    E, 0, 0, cE,        cE, 0, E, 0,           Bb, 0, 0, A,         0, 0, Fs, 0,
    F, 0, 0, cE,        cE, 0, Bb, 0,          A, 0, Gs, 0,         G, 0, Fs, 0,
    // Sec C (8-11): Queda opressiva antes de voltar pro arpejo
    E, 0, cE, cE,       F, 0, cE, cE,          Bb, 0, 0, A,         0, 0, F, 0,
    E, 0, cE, cE,       F, 0, cE, cE,          B, 0, 0, Bb,         0, 0, A, 0,
    E, 0, cE, cE,       F, 0, cE, cE,          C, 0, B, 0,          Bb, 0, A, 0,
    G, 0, Fs, 0,        F, 0, 0, 0,            E, 0, 0, 0,          0, 0, 0, 0
  ];

  // Ep.1 Área 2: Inspirada em "Hardening of the Arteries" (Slayer) — Thrash veloz e implacável
  const EP1_A2 = [
    // Sec A (0-3): Pedal furioso em E com facadas cromáticas rápidas
    cE, cE, cE, cE,     F, 0, cE, cE,          Fs, 0, cE, cE,       G, 0, F, 0,
    cE, cE, cE, cE,     Bb, 0, cE, cE,         A, 0, cE, cE,        G, 0, Fs, 0,
    cE, cE, cE, cE,     F, 0, cE, cE,          Fs, 0, cE, cE,       G, 0, Gs, 0,
    A, 0, Gs, 0,        G, 0, Fs, 0,           F, 0, E, 0,          F, 0, 0, 0,
    // Sec B (4-7): Ataque de power chords em alta velocidade
    E, 0, F, 0,         G, 0, Bb, 0,           A, 0, G, 0,          Fs, 0, F, 0,
    E, 0, cE, cE,       B, 0, cE, cE,          Bb, 0, cE, cE,       A, 0, G, 0,
    E, 0, F, 0,         G, 0, Bb, 0,           C, 0, B, 0,          Bb, 0, A, 0,
    G, 0, Fs, 0,        F, 0, cE, cE,          Bb, 0, A, 0,         F, 0, 0, 0,
    // Sec C (8-11): Galope frenético de fechamento
    cE, cE, F, 0,       cE, cE, Fs, 0,         cE, cE, G, 0,        cE, cE, Bb, 0,
    cE, cE, A, 0,       cE, cE, G, 0,          cE, cE, Fs, 0,       cE, cE, F, 0,
    E, 0, cE, cE,       Bb, 0, cE, cE,         C, 0, B, 0,          Bb, 0, A, 0,
    G, 0, Fs, 0,        F, 0, E, 0,            F, 0, Fs, 0,         G, 0, 0, 0
  ];

  // Ep.1 Área 3: Inspirada em "Repentless" (Slayer) — Agressão moderna sincopada e brutal
  const EP1_A3 = [
    // Sec A (0-3): Chug sincopado + golpes de b2 e trítono
    cE, cE, 0, cE,      F, 0, cE, cE,          0, cE, Bb, 0,        A, 0, F, 0,
    cE, cE, 0, cE,      F, 0, cE, cE,          0, cE, C, 0,         B, 0, Bb, 0,
    cE, cE, 0, cE,      F, 0, cE, cE,          0, cE, Bb, 0,        A, 0, G, 0,
    E, 0, F, 0,         Bb, 0, A, 0,           F, 0, E, 0,          cE, cE, 0, 0,
    // Sec B (4-7): Descida cromática esmagadora
    G, 0, cE, cE,       Fs, 0, cE, cE,         F, 0, cE, cE,        E, 0, 0, 0,
    Bb, 0, cE, cE,      A, 0, cE, cE,          Gs, 0, cE, cE,       G, 0, Fs, 0,
    G, 0, cE, cE,       Fs, 0, cE, cE,         F, 0, cE, cE,        E, 0, F, 0,
    C, 0, B, 0,         Bb, 0, A, 0,           Gs, 0, G, 0,         F, 0, 0, 0,
    // Sec C (8-11): Breakdown seco estilo marretada
    E, 0, 0, 0,         F, 0, 0, cE,           E, 0, 0, 0,          Bb, 0, A, 0,
    E, 0, 0, 0,         F, 0, 0, cE,           C, 0, B, 0,          F, 0, 0, 0,
    cE, cE, E, 0,       cE, cE, F, 0,          cE, cE, Bb, 0,       A, 0, F, 0,
    E, 0, F, 0,         E, 0, F, 0,            Bb, 0, A, 0,         F, 0, 0, 0
  ];

  // ============================================================
  // EPISÓDIO 2
  // ============================================================

  // Ep.2 Área 1 (a4): Inspirada em "Looking Down the Cross" (Megadeth) — Intro sombria + thrash técnico
  const EP2_A1 = [
    // Sec A (0-3): Arpejo menor sombrio e sinuoso
    Q(E), 0, Q(G3), 0,  Q(Fs3), 0, Q(E3), 0,   Q(Ds3), 0, Q(E3), 0, Q(B), 0, Q(C), 0,
    Q(E), 0, Q(G3), 0,  Q(A3), 0, Q(G3), 0,    Q(Fs3), 0, Q(E3), 0, Q(Ds3), 0, Q(B), 0,
    Q(E), 0, Q(G3), 0,  Q(Fs3), 0, Q(E3), 0,   Q(C4), 0, Q(B3), 0,  Q(A3), 0, Q(G3), 0,
    Q(Fs3), 0, Q(E3), 0, Q(Ds3), 0, Q(E3), 0,  L(B), 0, L(Bb), 0,   L(A), 0, L(G), 0,
    // Sec B (4-7): Explosão thrash angular estilo Mustaine
    cE, cE, B, 0,       cE, cE, Bb, 0,         cE, cE, A, 0,        G, 0, Fs, 0,
    cE, cE, B, 0,       cE, cE, C, 0,          cE, cE, B, 0,        Bb, 0, A, 0,
    cE, cE, E3, 0,      cE, cE, D, 0,          cE, cE, C, 0,        B, 0, A, 0,
    G, 0, Fs, 0,        F, 0, E, 0,            Bb, 0, A, 0,         G, 0, Fs, 0,
    // Sec C (8-11): Riff cromático cortante em uníssono
    E, 0, cE, cE,       L(G), 0, L(Gs), 0,     L(A), 0, L(Bb), 0,   L(B), 0, L(D), 0,
    E, 0, cE, cE,       L(C), 0, L(B), 0,      L(Bb), 0, L(A), 0,   L(G), 0, L(Fs), 0,
    cE, cE, E, 0,       cE, cE, G, 0,          A, 0, Bb, 0,         B, 0, 0, 0,
    C, 0, B, 0,         Bb, 0, A, 0,           G, 0, Fs, 0,         F, 0, 0, 0
  ];

  // Ep.2 Área 2 (a5): Inspirada em "Take No Prisoners" (Megadeth) — Cirúrgico, sincopado e veloz
  const EP2_A2 = [
    // Sec A (0-3): Cortes secos e staccato cirúrgico com pausas
    cE, 0, Fs, 0,       G, 0, 0, cE,           A, 0, Bb, 0,         0, 0, cE, cE,
    E, 0, 0, cE,        G, 0, Fs, 0,           F, 0, E, 0,          0, 0, cE, cE,
    cE, 0, Fs, 0,       G, 0, 0, cE,           B, 0, Bb, 0,         A, 0, G, 0,
    C, 0, B, 0,         Bb, 0, A, 0,           G, 0, Fs, 0,         F, 0, 0, 0,
    // Sec B (4-7): Uníssono cromático rápido estilo Rust in Peace
    cE, cE, L(E3), 0,   L(D), 0, L(Cs), 0,     L(C), 0, L(B), 0,    L(Bb), 0, L(A), 0,
    cE, cE, L(G), 0,    L(Gs), 0, L(A), 0,     L(Bb), 0, L(B), 0,   L(C), 0, L(D), 0,
    cE, cE, L(E3), 0,   L(D), 0, L(Cs), 0,     L(C), 0, L(B), 0,    L(Bb), 0, L(A), 0,
    G, 0, Fs, 0,        F, 0, E, 0,            Bb, 0, A, 0,         G, 0, 0, 0,
    // Sec C (8-11): Golpes duplos de power chord + pedal
    E, 0, E, 0,         0, cE, G, 0,           Fs, 0, F, 0,         E, 0, 0, 0,
    A, 0, A, 0,         0, cE, C, 0,           B, 0, Bb, 0,         A, 0, 0, 0,
    cE, cE, E, 0,       cE, cE, G, 0,          cE, cE, A, 0,        Bb, 0, B, 0,
    C, 0, B, 0,         Bb, 0, A, 0,           G, 0, Fs, 0,         F, 0, 0, 0
  ];

  // Ep.2 Área 3 (extra / pronta em ThrashMusic): Inspirada em "Holy Wars... The Punishment Due" (Megadeth)
  const EP2_A3 = [
    // Sec A (0-3): Galope veloz + subidas rápidas em E-F#-G-A
    cE, cE, cE, L(Fs),  L(G), L(A), cE, cE,    cE, L(G), L(Fs), L(E), cE, cE, L(D), 0,
    cE, cE, cE, L(Fs),  L(G), L(A), cE, cE,    cE, L(Bb), L(A), L(G), L(Fs), 0, L(E), 0,
    cE, cE, cE, L(Fs),  L(G), L(A), cE, cE,    cE, L(B), L(A), L(G), cE, cE, L(Fs), 0,
    E, 0, G, 0,         A, 0, Bb, 0,           B, 0, A, 0,          G, 0, Fs, 0,
    // Sec B (4-7): Sabor frígio dominante (escala exótica) sobre pedal
    L(E3), 0, L(F3), 0, L(Gs3), 0, L(A3), 0,   L(B3), 0, L(A3), 0,  L(Gs3), 0, L(F3), 0,
    L(E3), 0, cE, cE,   L(Gs3), 0, L(F3), 0,   L(E3), 0, L(D), 0,   L(C), 0, L(B), 0,
    L(E3), 0, L(F3), 0, L(Gs3), 0, L(A3), 0,   L(C4), 0, L(B3), 0,  L(A3), 0, L(Gs3), 0,
    F, 0, E, 0,         Gs, 0, A, 0,           B, 0, A, 0,          Gs, 0, F, 0,
    // Sec C (8-11): Fúria final em galope
    E, 0, cE, cE,       G, 0, cE, cE,          A, 0, cE, cE,        Bb, 0, A, 0,
    E, 0, cE, cE,       C, 0, cE, cE,          B, 0, cE, cE,        Bb, 0, A, 0,
    cE, cE, E, 0,       cE, cE, F, 0,          cE, cE, Gs, 0,       A, 0, B, 0,
    C, 0, B, 0,         Bb, 0, A, 0,           G, 0, Fs, 0,         F, 0, 0, 0
  ];

  // ============================================================
  // EPISÓDIO 3
  // ============================================================

  // Ep.3 Área 1 (a6_gate): Inspirada em "Dead to This World" (Violator) — Crossover/Thrash veloz e sujo
  const EP3_GATE = [
    // Sec A (0-3): Riff rápido old-school de roda punk/thrash
    cE, cE, G, 0,       cE, cE, A, 0,          Bb, 0, A, 0,         G, 0, E, 0,
    cE, cE, G, 0,       cE, cE, C, 0,          B, 0, A, 0,          G, 0, Fs, 0,
    cE, cE, G, 0,       cE, cE, A, 0,          Bb, 0, A, 0,         G, 0, E, 0,
    F, 0, E, 0,         G, 0, Fs, 0,           F, 0, E, 0,          D, 0, 0, 0,
    // Sec B (4-7): Ataque d-beat acelerado
    E, 0, cE, F,        0, cE, E, 0,           G, 0, cE, A,         0, cE, Bb, 0,
    E, 0, cE, F,        0, cE, E, 0,           C, 0, B, 0,          A, 0, G, 0,
    E, 0, cE, F,        0, cE, E, 0,           G, 0, cE, A,         0, cE, B, 0,
    C, 0, B, 0,         Bb, 0, A, 0,           G, 0, Fs, 0,         F, 0, 0, 0,
    // Sec C (8-11): Refrão crossover direto na cara
    E, 0, 0, G,         0, 0, A, 0,            Bb, 0, A, 0,         G, 0, 0, 0,
    E, 0, 0, C,         0, 0, B, 0,            A, 0, G, 0,          Fs, 0, 0, 0,
    cE, cE, E, 0,       cE, cE, G, 0,          cE, cE, A, 0,        Bb, 0, B, 0,
    C, 0, B, 0,         A, 0, G, 0,            Fs, 0, F, 0,         E, 0, 0, 0
  ];

  // Ep.3 Maximus Boss (a6_maximus): Inspirada em "Ride the Lightning" (Metallica) — Épico e eletrizante
  const EP3_MAXIMUS = [
    // Sec A (0-3): Abertura dramática em arpejo menor/diminuto + peso elétrico
    L(E3), 0, L(G3), 0, L(B3), 0, L(E4), 0,    L(Ds4), 0, L(B3), 0, L(G3), 0, L(Fs3), 0,
    L(E3), 0, L(G3), 0, L(C4), 0, L(E4), 0,    L(D4), 0, L(B3), 0,  L(A3), 0, L(G3), 0,
    E, 0, cE, cE,       G, 0, cE, cE,          A, 0, cE, cE,        B, 0, A, 0,
    G, 0, Fs, 0,        E, 0, 0, 0,            B, 0, A, 0,          G, 0, Fs, 0,
    // Sec B (4-7): Galope thrash clássico dos anos 80
    E, 0, cE, cE,       G, 0, cE, cE,          A, 0, cE, cE,        G, 0, Fs, 0,
    E, 0, cE, cE,       C, 0, cE, cE,          B, 0, cE, cE,        A, 0, G, 0,
    E, 0, cE, cE,       G, 0, cE, cE,          A, 0, cE, cE,        Bb, 0, B, 0,
    C, 0, B, 0,         A, 0, G, 0,            Fs, 0, G, 0,         A, 0, 0, 0,
    // Sec C (8-11): Ponte heroica/dramática de boss fight
    C, 0, 0, C,         D, 0, 0, D,            E3, 0, 0, D,         C, 0, B, 0,
    A, 0, 0, A,         B, 0, 0, B,            C, 0, B, 0,          A, 0, G, 0,
    E, 0, cE, cE,       G, 0, cE, cE,          A, 0, G, 0,          Fs, 0, E, 0,
    B, 0, Bb, 0,        A, 0, G, 0,            Fs, 0, F, 0,         E, 0, 0, 0
  ];

  // Ep.3 Igreja / Nave (a6_nave): Inspirada em "Satan Is Real" (Kreator) — Thrash teutônico melódico e marcial
  const EP3_NAVE = [
    // Sec A (0-3): Riff melódico em menor harmônica com pedal firme
    cE, cE, B, 0,       C, 0, Gs, 0,           A, 0, F, 0,          E, 0, 0, 0,
    cE, cE, B, 0,       C, 0, D, 0,            C, 0, B, 0,          A, 0, Gs, 0,
    cE, cE, B, 0,       C, 0, Gs, 0,           A, 0, F, 0,          E, 0, F, 0,
    G, 0, F, 0,         E, 0, Ds, 0,           E, 0, 0, 0,          0, 0, 0, 0,
    // Sec B (4-7): Linha melódica cortante estilo Kreator sobre pedal
    L(E3), 0, L(F3), 0, L(Gs3), 0, L(A3), 0,   L(B3), 0, L(A3), 0,  L(Gs3), 0, L(F3), 0,
    L(E3), 0, cE, cE,   L(C4), 0, L(B3), 0,    L(A3), 0, L(Gs3), 0, L(F3), 0, L(E3), 0,
    L(E3), 0, L(F3), 0, L(Gs3), 0, L(A3), 0,   L(B3), 0, L(C4), 0,  L(B3), 0, L(A3), 0,
    Gs, 0, A, 0,        B, 0, C, 0,            B, 0, A, 0,          Gs, 0, F, 0,
    // Sec C (8-11): Refrão marcial de horda infernal
    E, 0, 0, cE,        G, 0, 0, cE,           F, 0, 0, cE,         E, 0, 0, 0,
    C, 0, 0, C,         B, 0, 0, B,            A, 0, Gs, 0,         F, 0, 0, 0,
    E, 0, cE, cE,       G, 0, cE, cE,          F, 0, cE, cE,        E, 0, Ds, 0,
    E, 0, F, 0,         Gs, 0, A, 0,           B, 0, A, 0,          F, 0, 0, 0
  ];

  // Ep.3 Cripta (a6_crypt1/2/3): Inspirada em "The Antichrist" (Slayer) — Speed/Thrash maligno dos primórdios
  const EP3_CRYPT = [
    // Sec A (0-3): Galope maligno estilo Show No Mercy
    cE, cE, cE, G,      0, cE, A, 0,           Bb, 0, B, 0,         G, 0, Fs, 0,
    cE, cE, cE, G,      0, cE, A, 0,           C, 0, B, 0,          A, 0, G, 0,
    cE, cE, cE, G,      0, cE, A, 0,           Bb, 0, B, 0,         G, 0, Fs, 0,
    F, 0, E, 0,         Bb, 0, A, 0,           G, 0, Fs, 0,         F, 0, 0, 0,
    // Sec B (4-7): Riff rápido de catacumba em notas simples
    L(E3), 0, L(G3), 0, L(Fs3), 0, L(E3), 0,   L(D), 0, L(C), 0,    L(B), 0, L(A), 0,
    L(G), 0, cE, cE,    L(A), 0, cE, cE,       L(Bb), 0, L(B), 0,   L(C), 0, L(B), 0,
    L(E3), 0, L(G3), 0, L(Fs3), 0, L(E3), 0,   L(D), 0, L(C), 0,    L(B), 0, L(A), 0,
    G, 0, Fs, 0,        F, 0, E, 0,            B, 0, Bb, 0,         A, 0, 0, 0,
    // Sec C (8-11): Golpes rápidos antes de reiniciar o galope
    E, 0, cE, cE,       C, 0, cE, cE,          B, 0, cE, cE,        Bb, 0, 0, 0,
    E, 0, cE, cE,       A, 0, cE, cE,          G, 0, cE, cE,        Fs, 0, 0, 0,
    cE, cE, F, 0,       cE, cE, Fs, 0,         cE, cE, G, 0,        cE, cE, Bb, 0,
    B, 0, Bb, 0,        A, 0, G, 0,            Fs, 0, F, 0,         E, 0, 0, 0
  ];

  // Ep.3 Final Boss Galius (a6_galius1/2): Inspirada em "Am I Evil?" (Metallica / Diamond Head)
  // Seção A: Marcha monumental e sinistra (E -> F -> subida cromática) | Seção B/C: Explosão thrash épica
  const EP3_GALIUS = [
    // Sec A (0-3): A Marcha Maligna (stomp pesado e ameaçador)
    E, 0, 0, 0,         F, 0, 0, 0,            E, 0, cE, cE,        F, 0, 0, 0,
    E, 0, 0, 0,         F, 0, 0, 0,            E, 0, Bb, 0,         A, 0, F, 0,
    E, 0, 0, 0,         F, 0, 0, 0,            E, 0, cE, cE,        F, 0, Fs, 0,
    G, 0, Gs, 0,        A, 0, Bb, 0,           B, 0, C, 0,          Cs, 0, D, 0,
    // Sec B (4-7): Explosão Thrash rápida e triunfante
    cE, cE, E, 0,       cE, cE, G, 0,          A, 0, B, 0,          D, 0, B, 0,
    cE, cE, E, 0,       cE, cE, C, 0,          B, 0, A, 0,          G, 0, Fs, 0,
    cE, cE, E, 0,       cE, cE, G, 0,          A, 0, B, 0,          C, 0, B, 0,
    A, 0, G, 0,         Fs, 0, E, 0,           D, 0, B, 0,          A, 0, G, 0,
    // Sec C (8-11): Clímax épico de batalha final
    E3, 0, cE, cE,      D, 0, cE, cE,          C, 0, cE, cE,        B, 0, A, 0,
    G, 0, cE, cE,       A, 0, cE, cE,          B, 0, 0, C,          0, 0, B, 0,
    E, 0, cE, cE,       G, 0, cE, cE,          A, 0, G, 0,          Fs, 0, F, 0,
    E, 0, 0, cE,        Bb, 0, A, 0,           G, 0, Fs, 0,         F, 0, 0, 0
  ];

  const TRACKS = {
    title: { id: 'title', baseBpm: 140, combatBoost: 10, drumStyle: 'title', steps: TITLE_TRACK },
    ep1_a1: { id: 'ep1_a1', baseBpm: 120, combatBoost: 14, drumStyle: 'doom', steps: EP1_A1 },
    ep1_a2: { id: 'ep1_a2', baseBpm: 186, combatBoost: 18, drumStyle: 'thrash', steps: EP1_A2 },
    ep1_a3: { id: 'ep1_a3', baseBpm: 178, combatBoost: 16, drumStyle: 'thrash', steps: EP1_A3 },
    ep2_a1: { id: 'ep2_a1', baseBpm: 154, combatBoost: 18, drumStyle: 'gallop', steps: EP2_A1 },
    ep2_a2: { id: 'ep2_a2', baseBpm: 186, combatBoost: 16, drumStyle: 'thrash', steps: EP2_A2 },
    ep2_a3: { id: 'ep2_a3', baseBpm: 170, combatBoost: 16, drumStyle: 'gallop', steps: EP2_A3 },
    ep3_gate: { id: 'ep3_gate', baseBpm: 192, combatBoost: 16, drumStyle: 'dbeat', steps: EP3_GATE },
    ep3_maximus: { id: 'ep3_maximus', baseBpm: 156, combatBoost: 16, drumStyle: 'gallop', steps: EP3_MAXIMUS },
    ep3_nave: { id: 'ep3_nave', baseBpm: 164, combatBoost: 16, drumStyle: 'thrash', steps: EP3_NAVE },
    ep3_crypt: { id: 'ep3_crypt', baseBpm: 182, combatBoost: 16, drumStyle: 'gallop', steps: EP3_CRYPT },
    ep3_galius: { id: 'ep3_galius', baseBpm: 138, combatBoost: 18, drumStyle: 'march', steps: EP3_GALIUS }
  };

  function getActiveTrack() {
    return TRACKS[currentTrackId] || TRACKS.ep1_a1;
  }

  function playDrumsForStyle(style, bar, sub, t, intensity) {
    // Crash no início de cada seção de 4 compassos
    if (sub === 0 && bar % 4 === 0) {
      playDrum('crash', t, 0.52);
    }

    if (style === 'title') {
      if (sub === 0 || sub === 2 || sub === 3 || sub === 8 || sub === 10 || sub === 11) {
        playDrum('kick', t, (sub === 0 || sub === 8) ? 0.94 : 0.78);
      }
      if (sub === 4 || sub === 12) playDrum('snare', t, 0.92);
      if (sub === 0 && bar % 2 === 0) playDrum('crash', t, 0.48);
      if (bar % 4 === 3 && (sub === 14 || sub === 15)) playDrum('snare', t, 0.80);
      if (sub % 2 === 0) playDrum('hhClosed', t, 0.36);
      return;
    }

    if (style === 'march') {
      // Sec A (bar < 4): marcha pesada e monumental; Sec B/C (bar >= 4): thrash rápido
      if (bar < 4) {
        if (sub === 0 || sub === 4 || sub === 8 || sub === 10 || sub === 12) {
          playDrum('kick', t, sub % 4 === 0 ? 0.94 : 0.78);
        }
        if (sub === 4 || sub === 12) {
          playDrum('snare', t, 0.9);
        }
        if (sub === 0 && bar % 2 === 0) {
          playDrum('crash', t, 0.45);
        }
        if (sub % 4 === 0) playDrum('hhClosed', t, 0.36);
      } else {
        if (sub === 0 || sub === 3 || sub === 8 || sub === 11 || (intensity > 0.5 && (sub === 6 || sub === 14))) {
          playDrum('kick', t, 0.9);
        }
        if (sub === 4 || sub === 12) playDrum('snare', t, 0.88);
        if (bar % 4 === 3 && (sub === 14 || sub === 15)) playDrum('snare', t, 0.74);
        if (sub % 2 === 0) playDrum('hhClosed', t, 0.35);
      }
      return;
    }

    if (style === 'doom') {
      // Half-time / doom-thrash: Sec A intro mais espaçada, Sec B/C pesadíssima
      if (bar < 4) {
        if (sub === 0 || sub === 8) playDrum('kick', t, 0.82);
        if (sub === 8 && intensity > 0.2) playDrum('snare', t, 0.72);
        if (sub % 4 === 0) playDrum('hhClosed', t, 0.28);
      } else {
        if (sub === 0 || sub === 6 || sub === 8 || (intensity > 0.4 && sub === 14)) {
          playDrum('kick', t, 0.92);
        }
        if (sub === 4 || sub === 12) playDrum('snare', t, 0.88);
        if (bar % 4 === 3 && (sub === 14 || sub === 15) && intensity > 0.25) playDrum('snare', t, 0.72);
        if (sub % 2 === 0) playDrum('hhClosed', t, 0.32);
      }
      return;
    }

    if (style === 'dbeat') {
      // Crossover / D-beat frenético (Violator)
      if (sub === 0 || sub === 4 || sub === 8 || sub === 12) playDrum('kick', t, 0.88);
      if (sub === 2 || sub === 6 || sub === 10 || sub === 14) {
        if (intensity > 0.12 || sub === 6 || sub === 14) playDrum('snare', t, 0.84);
      }
      if (bar % 4 === 3 && sub >= 12 && intensity > 0.35) playDrum('snare', t, 0.72);
      if (sub % 2 === 0) playDrum('hhClosed', t, 0.36);
      return;
    }

    if (style === 'gallop') {
      // Galope clássico de thrash (kick em 0, 2, 3, 8, 10, 11 no combate)
      if (sub === 0 || sub === 8 || (intensity > 0.25 && (sub === 3 || sub === 11)) || (intensity > 0.55 && (sub === 2 || sub === 10))) {
        playDrum('kick', t, 0.88);
      }
      if (sub === 4 || sub === 12) {
        if (intensity > 0.1 || sub === 4) playDrum('snare', t, 0.85);
      }
      if (bar % 4 === 3 && (sub === 14 || sub === 15) && intensity > 0.3) playDrum('snare', t, 0.72);
      if (sub % 2 === 0) playDrum('hhClosed', t, 0.34);
      return;
    }

    // Padrão 'thrash'
    if (sub === 0 || sub === 8 || (intensity > 0.45 && (sub === 3 || sub === 11))) {
      playDrum('kick', t, 0.88);
    }
    if (sub === 4 || sub === 12) {
      if (intensity > 0.15 || sub === 4) playDrum('snare', t, 0.85);
    }
    if (bar % 4 === 3 && (sub === 14 || sub === 15) && intensity > 0.3) {
      playDrum('snare', t, 0.72);
    }
    if (sub % 2 === 0) {
      playDrum('hhClosed', t, 0.34);
    }
  }

  function playStep(s, t, intensity, track) {
    const steps = track.steps;
    const totalBars = steps.length >> 4;
    const bar = (s >> 4) % totalBars;
    const sub = s & 15;
    const raw = steps[s];

    if (raw !== 0) {
      const nextZero = steps[(s + 1) % steps.length] === 0;
      let mode = 'chord';
      let midi = raw;
      if (raw < 0) {
        mode = 'chug';
        midi = -raw;
      } else if (raw >= 2000) {
        mode = 'clean';
        midi = raw - 2000;
      } else if (raw >= 1000) {
        mode = 'lead';
        midi = raw - 1000;
      }

      const gDur = mode === 'chug' ? 0.085 : (mode === 'clean' ? (nextZero ? 0.34 : 0.20) : (nextZero ? 0.24 : 0.14));
      const gVol = mode === 'chug' ? 0.56 : (mode === 'clean' ? 0.46 : (mode === 'lead' ? 0.60 : 0.68));

      if (track.id === 'title' || intensity > 0.08 || sub % 2 === 0 || mode === 'clean') {
        playPowerChord(midi, t, gDur, gVol, mode);
        if (mode === 'clean') {
          // No arpejo limpo, o baixo marca apenas a cabeça do tempo para deixar a guitarra respirar
          if (sub === 0 || sub === 8) playBassNote(midi - 12, t, 0.36, 0.65);
        } else {
          playBassNote(midi - 12, t, mode === 'chug' ? 0.09 : gDur, mode === 'chug' ? 0.65 : 0.8);
        }
      }
    }

    playDrumsForStyle(track.drumStyle, bar, sub, t, intensity);
  }

  function sched(intensity, muted) {
    if (!ctx || muted) {
      if (ctx) nextT = ctx.currentTime + 0.1;
      return false;
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      nextT = ctx.currentTime + 0.05;
      return false;
    }
    if (!areAllFontsReady() && !loadFailed) {
      syncLoadedFonts();
      if (!areAllFontsReady()) {
        nextT = ctx.currentTime + 0.05;
        return false;
      }
    }
    const track = getActiveTrack();
    const bpm = track.baseBpm + intensity * track.combatBoost;
    const stepDur = 60 / bpm / 4;
    const now = ctx.currentTime;

    if (nextT < now) {
      const skipped = Math.floor((now - nextT) / stepDur);
      if (skipped > 0) step = (step + skipped) % track.steps.length;
      nextT = now + 0.02;
    }
    let count = 0;
    while (nextT < now + LOOKAHEAD && count < MAX_STEPS_PER_TICK) {
      playStep(step, nextT, intensity, track);
      nextT += stepDur;
      step = (step + 1) % track.steps.length;
      count++;
    }
    return true;
  }

  function setTrack(id) {
    if (!TRACKS[id] || id === currentTrackId) return;
    currentTrackId = id;
    step = 0;
  }

  function getTrack() {
    return currentTrackId;
  }

  function listTracks() {
    return Object.keys(TRACKS);
  }

  function resetSong() {
    step = 0;
  }

  function isOnlineMidiReady() {
    return areAllFontsReady();
  }

  if (typeof document !== 'undefined' && document.head) {
    loadOnlineMidiFonts();
  }

  return { init, sched, setTrack, getTrack, listTracks, resetSong, isOnlineMidiReady };
})();
