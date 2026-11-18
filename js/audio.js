'use strict';
/* ============================================================
   HELLSLAYER - áudio 100% procedural (WebAudio)
   ============================================================ */
const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false, userVol = 0.55, goreVol = 0.55, userMusicVol = 0.5, screamsEnabled = true;
  let musicCtx = null, musicMaster = null, musicFadeGain = null, schedWorker = null;
  let intensity = 0, step = 0, nextT = 0, timer = null;
  const MUSIC_INIT_FADE_IN = 1.8;
  const MUSIC_FADE_OUT = 0.7;
  const MUSIC_FADE_IN = 1.2;
  let fadeMode = 'idle', fadeStartT = 0, fadeDur = 0, fadeStartVal = 0, fadeTarget = 0;
  let pendingTrack = null, cutsceneDucked = false, initialFadeDone = false;
  const SAMPLE_URLS = {
    gore0: 'soundeffect/gore/gore-explode.mp3',
    gore1: 'soundeffect/gore/gore-gush.mp3',
    hitGeneral: 'soundeffect/impact/generalimpact/body-impact.mp3',
    hitCut: 'soundeffect/impact/cutimpact/knife-cut.mp3',
    hitCross: 'soundeffect/impact/crossimpact/stab-2.mp3',
    lowlifeHeartbeat: 'soundeffect/lowlife/single-heatbeat.mp3'
  };
  // Ganhos calibrados pelo RMS ativo de cada arquivo para equalizar gore e impacto
  const SAMPLE_GAIN = {
    gore0: 0.88,
    gore1: 0.48,
    hitGeneral: 1.00,
    hitCut: 0.88,
    hitCross: 0.70,
    lowlifeHeartbeat: 0.90
  };
  const sampleBufs = {};
  const sampleEls = {};
  for (const k in SAMPLE_URLS) {
    const a = new Audio(SAMPLE_URLS[k]);
    a.preload = 'auto';
    sampleEls[k] = a;
  }

  function loadSample(k, url) {
    fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(b => {
      if (b && ctx) ctx.decodeAudioData(b, buf => { sampleBufs[k] = buf; }, () => {});
    }).catch(() => {});
  }

  function playSample(k, rate, vol, useGoreVol) {
    const applyGore = useGoreVol !== false;
    if (applyGore && goreVol <= 0.001) return true;
    const baseGain = SAMPLE_GAIN[k] == null ? 1 : SAMPLE_GAIN[k];
    const effVol = baseGain * (vol == null ? 1 : vol) * (applyGore ? goreVol : 1);
    const buf = sampleBufs[k];
    if (ctx && buf) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = rate || 1;
      const g = ctx.createGain();
      g.gain.value = effVol;
      s.connect(g); g.connect(master);
      s.start();
      return true;
    }
    const base = sampleEls[k];
    if (base) {
      const a = base.cloneNode();
      a.preservesPitch = false;
      a.mozPreservesPitch = false;
      a.webkitPreservesPitch = false;
      a.playbackRate = rate || 1;
      a.volume = muted ? 0 : Math.min(1, userVol * effVol);
      a.play().catch(() => {});
      return true;
    }
    return false;
  }

  function updateMusicGain() {
    if (musicMaster) musicMaster.gain.value = muted ? 0 : userVol * userMusicVol;
  }

  function getCurrentFadeVal(now) {
    if (fadeMode === 'idle' || fadeDur <= 0) return fadeTarget;
    const t = Math.max(0, Math.min(1, (now - fadeStartT) / fadeDur));
    return fadeStartVal + (fadeTarget - fadeStartVal) * t;
  }

  function startMusicFade(target, dur, mode) {
    if (!musicCtx || !musicFadeGain) return;
    const now = musicCtx.currentTime;
    const cur = getCurrentFadeVal(now);
    fadeStartVal = cur;
    fadeTarget = target;
    fadeStartT = now;
    fadeDur = Math.max(0.01, dur);
    fadeMode = mode;
    const g = musicFadeGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(cur, now);
    g.linearRampToValueAtTime(target, now + fadeDur);
  }

  function stepMusicFade() {
    if (!musicCtx || fadeMode === 'idle') return;
    if (musicCtx.currentTime < fadeStartT + fadeDur) return;
    if (fadeMode === 'out') {
      if (pendingTrack && window.ThrashMusic && window.ThrashMusic.setTrack) {
        window.ThrashMusic.setTrack(pendingTrack);
        pendingTrack = null;
      }
      if (!cutsceneDucked) {
        startMusicFade(1, MUSIC_FADE_IN, 'in');
      } else {
        fadeMode = 'idle';
        fadeTarget = 0;
        fadeStartVal = 0;
      }
    } else if (fadeMode === 'in') {
      fadeMode = 'idle';
      fadeTarget = 1;
      fadeStartVal = 1;
    }
  }

  function startMusicScheduler() {
    if (schedWorker || timer) return;
    try {
      const code = 'setInterval(function(){postMessage(1);},40);';
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      schedWorker = new Worker(url);
      URL.revokeObjectURL(url);
      schedWorker.onmessage = sched;
      sched();
      return;
    } catch (e) {
      schedWorker = null;
    }
    timer = setInterval(sched, 40);
    sched();
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      if (musicCtx && musicCtx.state === 'suspended') musicCtx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : userVol;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const k in SAMPLE_URLS) loadSample(k, SAMPLE_URLS[k]);

    // Contexto dedicado para música com buffer de playback, isolado de picos de SFX e gargalos de render
    try {
      musicCtx = new AC({ latencyHint: 'playback' });
    } catch (e) {
      musicCtx = new AC();
    }
    musicMaster = musicCtx.createGain();
    updateMusicGain();
    musicMaster.connect(musicCtx.destination);
    musicFadeGain = musicCtx.createGain();
    musicFadeGain.gain.value = 0;
    fadeMode = 'idle';
    fadeStartVal = 0;
    fadeTarget = 0;
    fadeDur = 0;
    musicFadeGain.connect(musicMaster);
    const musicNoiseBuf = musicCtx.createBuffer(1, musicCtx.sampleRate, musicCtx.sampleRate);
    const md = musicNoiseBuf.getChannelData(0);
    for (let i = 0; i < md.length; i++) md[i] = Math.random() * 2 - 1;

    if (window.ThrashMusic) window.ThrashMusic.init(musicCtx, musicFadeGain, musicNoiseBuf);
    nextT = musicCtx.currentTime + 0.1;
    startMusicScheduler();
  }

  function tone(f, dur, type, vol, slideTo, delay, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, freq, delay, ftype, slideTo, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype || 'lowpass';
    f.frequency.setValueAtTime(freq || 1000, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || master);
    s.start(t); s.stop(t + dur + 0.03);
  }

  function vocalScream(pitch) {
    if (!ctx || !screamsEnabled) return;
    const p = (pitch || 1) * (0.9 + Math.random() * 0.2);
    const t = ctx.currentTime;
    const dur = (pitch < 0.7 ? 0.65 : 0.45) + Math.random() * 0.16;
    const f0 = 360 * p;

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.setValueAtTime(2.6, t);
    filt.frequency.setValueAtTime(Math.min(2400, 1250 * p), t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(180, 380 * p), t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.36, t + 0.025);
    g.gain.setValueAtTime(0.32, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    filt.connect(g); g.connect(master);

    // LFO para vibrato/aspereza gutural na garganta
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 34 + Math.random() * 14;
    lfoG.gain.value = 26 * p;
    lfo.connect(lfoG);
    lfo.start(t); lfo.stop(t + dur + 0.04);

    [1, 1.028].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0 * det, t);
      o.frequency.linearRampToValueAtTime(f0 * 1.18 * det, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(Math.max(35, f0 * 0.34 * det), t + dur);
      lfoG.connect(o.frequency);
      o.connect(filt);
      o.start(t); o.stop(t + dur + 0.04);
    });

    // Sub-harmônico para peso no peito
    const sub = ctx.createOscillator(), subG = ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(f0 * 0.5, t);
    sub.frequency.exponentialRampToValueAtTime(Math.max(28, f0 * 0.2), t + dur);
    subG.gain.setValueAtTime(0.22, t);
    subG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    sub.connect(subG); subG.connect(master);
    sub.start(t); sub.stop(t + dur + 0.04);

    // Sopro/rasgo vocal com ruído filtrado
    noise(dur * 0.9, 0.28, Math.min(2600, 1100 * p), 0.01, 'bandpass', Math.max(220, 420 * p));
  }

  // ---------- música ----------
  function sched() {
    stepMusicFade();
    if (window.ThrashMusic) {
      const active = window.ThrashMusic.sched(intensity, muted);
      if (active && !initialFadeDone) {
        initialFadeDone = true;
        if (pendingTrack && window.ThrashMusic.setTrack) {
          window.ThrashMusic.setTrack(pendingTrack);
          pendingTrack = null;
        }
        if (!cutsceneDucked && fadeMode === 'idle') {
          startMusicFade(1, MUSIC_INIT_FADE_IN, 'in');
        }
      }
      return;
    }
    if (!ctx || muted) { if (ctx) nextT = ctx.currentTime + 0.1; }
  }

  // ---------- efeitos ----------
  const FX = {
    punch() { noise(0.12, 0.5, 500, 0, 'lowpass', 120); tone(110, 0.1, 'sine', 0.4, 50); },
    swing() { noise(0.18, 0.18, 900, 0, 'bandpass', 300); },
    hammer() { noise(0.25, 0.5, 700, 0, 'lowpass', 90); tone(90, 0.2, 'square', 0.3, 40); tone(1400, 0.05, 'square', 0.1, 600); },
    sling() { tone(500, 0.12, 'triangle', 0.25, 120); noise(0.08, 0.15, 3000, 0, 'highpass'); },
    scythe() { noise(0.28, 0.3, 2400, 0, 'bandpass', 600); },
    boom() { noise(0.9, 0.9, 900, 0, 'lowpass', 40); tone(70, 0.7, 'sawtooth', 0.45, 25); },
    cross() { tone(880, 0.25, 'triangle', 0.2, 1320); noise(0.2, 0.12, 4000, 0, 'highpass'); },
    catchCross() { tone(660, 0.12, 'square', 0.2, 990); },
    blood() { noise(0.1, 0.35, 1800, 0, 'bandpass', 500); tone(180, 0.1, 'sawtooth', 0.2, 60); },
    hit(kind) {
      const k = kind === 'cut' ? 'hitCut' : kind === 'cross' ? 'hitCross' : 'hitGeneral';
      const rate = 0.88 + Math.random() * 0.28;
      if (!playSample(k, rate, 1.0)) noise(0.07, 0.35 * goreVol, 1500, 0, 'bandpass');
    },
    kill(p) {
      vocalScream(p || 1);
      const k = Math.random() < 0.5 ? 'gore0' : 'gore1';
      const rate = 0.85 + Math.random() * 0.4;
      if (!playSample(k, rate, 1.0)) {
        noise(0.28, 0.48 * goreVol, 700, 0, 'lowpass', 90);
        noise(0.18, 0.28 * goreVol, 1900, 0.02, 'bandpass', 450);
      }
    },
    gib(p) {
      vocalScream(p || 0.55);
      const k = Math.random() < 0.7 ? 'gore0' : 'gore1';
      const rate = 0.7 + Math.random() * 0.25;
      if (!playSample(k, rate, 1.0)) {
        noise(0.55, 0.68 * goreVol, 550, 0, 'lowpass', 60);
        noise(0.32, 0.4 * goreVol, 1500, 0.03, 'bandpass', 300);
        tone(75, 0.42, 'square', 0.32 * goreVol, 28);
      }
    },
    gore(kind) {
      const k = kind === 'explode' ? 'gore0' : kind === 'gush' ? 'gore1' : (Math.random() < 0.5 ? 'gore0' : 'gore1');
      const rate = 0.8 + Math.random() * 0.25;
      if (!playSample(k, rate, 1.0)) {
        noise(0.35, 0.55 * goreVol, 650, 0, 'lowpass', 80);
        noise(0.22, 0.32 * goreVol, 1700, 0.02, 'bandpass', 400);
      }
    },
    scream(p) { vocalScream(p); },
    hurt() { tone(220, 0.2, 'sawtooth', 0.4, 80); noise(0.15, 0.35, 700, 0, 'lowpass'); },
    pickup() { tone(660, 0.08, 'square', 0.15); tone(990, 0.12, 'square', 0.15, null, 0.07); },
    weapon() { tone(330, 0.1, 'square', 0.2); tone(495, 0.1, 'square', 0.2, null, 0.1); tone(660, 0.1, 'square', 0.2, null, 0.2); tone(990, 0.3, 'square', 0.2, null, 0.3); },
    dash() { noise(0.2, 0.3, 500, 0, 'bandpass', 2500); },
    jump() { tone(150, 0.12, 'sine', 0.2, 280); },
    fire() { noise(0.2, 0.2, 2000, 0, 'bandpass', 700); tone(300, 0.2, 'sawtooth', 0.1, 120); },
    hex() { tone(200, 0.4, 'sine', 0.2, 500); tone(205, 0.4, 'sine', 0.2, 505); },
    roar() { noise(1.1, 0.6, 400, 0, 'lowpass', 120); tone(90, 1.0, 'sawtooth', 0.4, 45); tone(95, 1.0, 'square', 0.2, 50); },
    thunder() { noise(1.6, 0.7, 300, 0, 'lowpass', 50); },
    door() { noise(1.2, 0.8, 500, 0, 'lowpass', 40); tone(60, 1.0, 'sawtooth', 0.4, 25); },
    gate() { tone(120, 0.7, 'sawtooth', 0.25, 400); noise(0.7, 0.2, 800, 0, 'bandpass', 3000); },
    ui() { tone(520, 0.06, 'square', 0.12); },
    faith() { tone(220, 0.8, 'triangle', 0.3, 880); tone(330, 0.8, 'triangle', 0.25, 1320); noise(0.5, 0.15, 3000, 0, 'highpass'); },
    heart() { tone(60, 0.18, 'sine', 0.6, 40); tone(60, 0.18, 'sine', 0.5, 40, 0.22); },
    lowlifeHeartbeat(vol) {
      if (!playSample('lowlifeHeartbeat', 1, vol == null ? 1 : vol, false)) {
        tone(58, 0.16, 'sine', 0.55 * (vol == null ? 1 : vol), 36);
      }
    },
    portal() { tone(200, 1.6, 'sine', 0.3, 900); tone(300, 1.6, 'triangle', 0.2, 1200); },
    shock() { tone(100, 0.5, 'sawtooth', 0.4, 30); noise(0.5, 0.5, 500, 0, 'lowpass', 60); },
    ghost() { tone(300, 1.2, 'sine', 0.2, 200); tone(450, 1.2, 'sine', 0.15, 300); },
    clang() { tone(1200, 0.14, 'square', 0.28, 420); tone(1850, 0.09, 'triangle', 0.22, 900); noise(0.08, 0.2, 3500, 0, 'highpass'); },
    parry() { tone(520, 0.08, 'square', 0.35, 1040); tone(1040, 0.22, 'triangle', 0.35, 1560, 0.05); noise(0.15, 0.3, 2500, 0, 'bandpass'); },
    slam() { noise(0.55, 0.8, 650, 0, 'lowpass', 45); tone(85, 0.45, 'sawtooth', 0.45, 28); },
    brick() { tone(260, 0.14, 'square', 0.25, 95); noise(0.1, 0.22, 1200, 0, 'bandpass', 400); },
    step() {
      const p = 0.92 + Math.random() * 0.16;
      tone(68 * p, 0.17, 'sine', 0.7, 24);
      tone(118 * p, 0.09, 'triangle', 0.42, 42);
      noise(0.11, 0.52, 540 * p, 0, 'lowpass', 95);
      noise(0.05, 0.22, 1500 * p, 0.01, 'bandpass', 550);
    }
  };

  function play(name, arg) { if (ctx && !muted && FX[name]) FX[name](arg); }
  function setIntensity(v) { intensity = v; }
  function setTrack(id) {
    if (!window.ThrashMusic || !window.ThrashMusic.setTrack) return;
    const cur = getTrack();
    if (pendingTrack === id || (!pendingTrack && cur === id)) return;
    if (!musicCtx || !initialFadeDone) {
      window.ThrashMusic.setTrack(id);
      return;
    }
    pendingTrack = id;
    if (fadeMode !== 'out') {
      startMusicFade(0, MUSIC_FADE_OUT, 'out');
    }
  }
  function setCutscene(active) {
    const next = !!active;
    if (next === cutsceneDucked) return;
    cutsceneDucked = next;
    if (!musicCtx || !musicFadeGain) return;
    if (cutsceneDucked) {
      startMusicFade(0, MUSIC_FADE_OUT, 'out');
    } else {
      if (pendingTrack && window.ThrashMusic && window.ThrashMusic.setTrack) {
        window.ThrashMusic.setTrack(pendingTrack);
        pendingTrack = null;
      }
      if (initialFadeDone) {
        startMusicFade(1, MUSIC_FADE_IN, 'in');
      }
    }
  }
  function getTrack() { return (window.ThrashMusic && window.ThrashMusic.getTrack) ? window.ThrashMusic.getTrack() : null; }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : userVol; updateMusicGain(); return muted; }
  function setMuted(on) { muted = !!on; if (master) master.gain.value = muted ? 0 : userVol; updateMusicGain(); return muted; }
  function isMuted() { return muted; }
  function setVolume(v) { userVol = Math.max(0, Math.min(1, v)); if (master && !muted) master.gain.value = userVol; updateMusicGain(); }
  function getVolume() { return userVol; }
  function setMusicVolume(v) { userMusicVol = Math.max(0, Math.min(1, v)); updateMusicGain(); }
  function getMusicVolume() { return userMusicVol; }
  function setGoreVolume(v) { goreVol = Math.max(0, Math.min(1, v)); }
  function getGoreVolume() { return goreVol; }
  function setScreams(on) { screamsEnabled = !!on; }
  function getScreams() { return screamsEnabled; }

  return { init, play, setIntensity, setTrack, setCutscene, getTrack, toggleMute, setMuted, isMuted, setVolume, getVolume, setMusicVolume, getMusicVolume, setGoreVolume, getGoreVolume, setScreams, getScreams };
})();
