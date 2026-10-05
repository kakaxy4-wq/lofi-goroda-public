// Звук: эфир города (треки + генеративные вставки, синхронно по часам) и звуки города
// со своим микшером. Какие события звучат и когда — решает модуль города (sounds.tick).

import { rng, clamp } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- эфирная сетка ----------
// Сетка одинакова у всех: позиция = (unix-время) mod длина сетки.
// Сегмент 'file' — mp3-трек из плейлиста города, 'gen' — вставка, которую генерирует браузер.
export function buildSchedule(playlist) {
  const segs = [];
  let t = 0;
  playlist.forEach((tr, i) => {
    segs.push({ type: 'file', src: tr.src, title: tr.title, dur: tr.dur, start: t, idx: i });
    t += tr.dur;
    segs.push({ type: 'gen', dur: 190, start: t, seed: 1000 + i });
    t += 190;
  });
  if (!segs.length) segs.push({ type: 'gen', dur: 190, start: 0, seed: 1 });
  return { segs, total: t || 190 };
}

export function segmentAt(sched, nowSec) {
  const cycle = Math.floor(nowSec / sched.total);
  const pos = nowSec - cycle * sched.total;
  const seg = sched.segs.find((s) => pos >= s.start && pos < s.start + s.dur) || sched.segs[0];
  const startWall = cycle * sched.total + seg.start;
  const seed = seg.type === 'gen' ? seg.seed * 7919 + cycle : 0; // новая вставка каждый круг
  return { seg, startWall, offset: nowSec - startWall, seed, key: `${cycle}:${seg.start}` };
}

// ---------- названия генеративных треков ----------
// Запасной набор без привязки к городу; у городов свои — sounds.genTitles = { places: [[имя, «где»]], things }
const DEFAULT_TITLES = { places: [], things: ['жёлтые окна', 'чай у окна', 'кот на подоконнике', 'ночной автобус', 'пустая улица', 'крыши', 'фонари', 'поздний вечер'] };
const WEATHER_THINGS = { rain: ['морось', 'дождь', 'лужи', 'зонт'], snow: ['первый снег', 'сугробы', 'снег'], fog: ['туман', 'сырость'] };
export function genTitle(seed, weatherKind, titles = DEFAULT_TITLES) {
  const r = rng(seed * 31 + 7);
  const places = titles.places || [], p = places[(r() * places.length) | 0];
  const bank = WEATHER_THINGS[weatherKind] && r() < 0.6 ? WEATHER_THINGS[weatherKind] : titles.things || DEFAULT_TITLES.things;
  const th = bank[(r() * bank.length) | 0];
  const form = r();
  if (!p) return th;
  return form < 0.5 || !th.includes(' ') ? `${th} ${p[1]}` : form < 0.8 ? `${p[0]}, ${th}` : th;
}

// ---------- генератор лоуфая ----------
const Q = { maj9: [4, 7, 11, 14], m9: [3, 7, 10, 14], 13: [4, 10, 14, 21], m7b5: [3, 6, 10, 14], m7: [3, 7, 10, 15] };
const MAJ = [
  [[2, 'm9'], [7, '13'], [0, 'maj9'], [0, 'maj9']],
  [[0, 'maj9'], [9, 'm9'], [2, 'm9'], [7, '13']],
  [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, 'maj9']],
  [[5, 'maj9'], [7, '13'], [4, 'm7'], [9, 'm9']],
];
const MIN = [
  [[0, 'm9'], [5, 'm9'], [10, '13'], [3, 'maj9']],
  [[0, 'm9'], [8, 'maj9'], [2, 'm7b5'], [7, '13']],
  [[5, 'm9'], [0, 'm9'], [8, 'maj9'], [7, '13']],
];
const GROOVES = [
  { k: [0, 7, 10], s: [4, 12] }, { k: [0, 10], s: [4, 12] }, { k: [0, 3, 8, 11], s: [4, 12] }, { k: [0, 11], s: [8] },
];

function planTrack(seed) {
  const r = rng(seed);
  const minor = r() < 0.45;
  const progs = minor ? MIN : MAJ;
  const A = progs[(r() * progs.length) | 0], B = progs[(r() * progs.length) | 0];
  const bpm = 70 + ((r() * 14) | 0);
  const root = 57 + ((r() * 7) | 0);
  const scale = minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const motif = Array.from({ length: 4 }, () => [((r() * 16) | 0), (r() * 5) | 0]).sort((a, b) => a[0] - b[0]);
  return { minor, A, B, bpm, root, scale, motif, groove: GROOVES[(r() * GROOVES.length) | 0], swing: 0.12 + r() * 0.12, melody: r() < 0.65, lead: r() < 0.5 ? 'sine' : 'bell' };
}

export function createAudio(sounds = {}) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} // iOS: играть и в беззвучном режиме
  document.addEventListener('visibilitychange', () => { if (!document.hidden && playing && ctx.state !== 'running') ctx.resume(); });
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3;
  const limiter = ctx.createDynamicsCompressor(); // страховка от клиппинга
  limiter.threshold.value = -3; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
  master.connect(comp).connect(limiter).connect(ctx.destination);

  const musicBus = ctx.createGain(); musicBus.connect(master);
  const cityBus = ctx.createGain(); cityBus.connect(master);

  // шумы
  const noiseBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const brownBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate); const d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; })();
  const crackleBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 7.2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) { d[i] = (Math.random() * 2 - 1) * 0.02; if (Math.random() < 0.0004) d[i] = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.7); } return b; })();
  const irBuf = (() => { const len = ctx.sampleRate * 2.4, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); } return b; })();
  const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };

  const reverb = ctx.createConvolver(); reverb.buffer = irBuf;
  const revOut = ctx.createGain(); revOut.gain.value = 0.28; reverb.connect(revOut).connect(musicBus);

  // --- лента для генератора: сатурация → фильтр → «плавание» высоты ---
  const genIn = ctx.createGain(); genIn.gain.value = 0;
  const shaper = ctx.createWaveShaper();
  shaper.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(((i / 1023) * 2 - 1) * 1.6) / Math.tanh(1.6));
  const tapeLP = ctx.createBiquadFilter(); tapeLP.type = 'lowpass'; tapeLP.frequency.value = 5200;
  const wow = ctx.createDelay(0.05); wow.delayTime.value = 0.006;
  const wowLfo = ctx.createOscillator(); wowLfo.frequency.value = 0.35;
  const wowDepth = ctx.createGain(); wowDepth.gain.value = 0.0011;
  wowLfo.connect(wowDepth).connect(wow.delayTime); wowLfo.start();
  genIn.connect(shaper).connect(tapeLP).connect(wow).connect(musicBus);
  const genSend = ctx.createGain(); genSend.gain.value = 0.5; genIn.connect(genSend).connect(reverb);
  const crackle = loop(crackleBuf); const crackleF = ctx.createBiquadFilter(); crackleF.type = 'bandpass'; crackleF.frequency.value = 2600;
  const crackleG = ctx.createGain(); crackleG.gain.value = 0.9; crackle.connect(crackleF).connect(crackleG).connect(genIn);
  const echo = ctx.createDelay(1); const echoFb = ctx.createGain(); echoFb.gain.value = 0.32;
  echo.connect(echoFb).connect(echo); echo.connect(genIn);

  // --- проигрыватель файлов ---
  const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto';
  let fileFailed = false, stallT = 0;
  el.addEventListener('error', () => { fileFailed = true; });
  el.addEventListener('waiting', () => { clearTimeout(stallT); stallT = setTimeout(() => { if (el.readyState < 3) fileFailed = true; }, 8000); }); // сеть «висит» — уходим в живую вставку
  el.addEventListener('playing', () => clearTimeout(stallT));
  const elSrc = ctx.createMediaElementSource(el);
  const fileGain = ctx.createGain(); fileGain.gain.value = 0;
  elSrc.connect(fileGain).connect(musicBus);

  // ---------- инструменты ----------
  function epiano(t, m, vel, dur) {
    const f = mtof(m);
    const o = ctx.createOscillator(); o.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.6);
    mod.connect(mg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(vel * 0.035, t + 0.9); g.gain.setValueAtTime(vel * 0.035, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2300;
    o.connect(lp).connect(g).connect(genIn);
    o.start(t); mod.start(t); o.stop(t + dur + 0.8); mod.stop(t + dur + 0.8);
  }
  function bass(t, m, dur) {
    const o = ctx.createOscillator(); o.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = mtof(m);
    const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.012); g.gain.exponentialRampToValueAtTime(0.12, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.frequency.value = 520;
    o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(genIn);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function kick(t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(125, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    g.gain.setValueAtTime(0.75 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g).connect(genIn); o.start(t); o.stop(t + 0.4);
  }
  function noiseHit(t, type, freq, q, vol, dec, dest = genIn) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dec);
    s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 2); s.stop(t + dec + 0.05);
  }
  function snare(t, v) {
    noiseHit(t, 'bandpass', 1800, 0.8, 0.3 * v, 0.2);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 185;
    g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g).connect(genIn); o.start(t); o.stop(t + 0.1);
  }
  const hat = (t, v, open) => noiseHit(t, 'highpass', 7200, 0.7, 0.09 * v, open ? 0.22 : 0.045);
  function lead(t, m, dur, kind) {
    const o = ctx.createOscillator(); o.frequency.value = mtof(m);
    const g = ctx.createGain();
    if (kind === 'sine') {
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.value = mtof(m) * 0.004;
      vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + dur + 0.3);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.055, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    } else {
      const mod = ctx.createOscillator(), mg = ctx.createGain(); mod.frequency.value = mtof(m) * 3.5; mg.gain.value = mtof(m) * 0.6;
      mod.connect(mg).connect(o.frequency); mod.start(t); mod.stop(t + 2);
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    }
    o.connect(g); g.connect(genIn); g.connect(echo);
    o.start(t); o.stop(t + Math.max(dur + 0.3, 2));
  }

  // ---------- состояние эфира ----------
  let sched = buildSchedule([]);
  let playing = false, cur = null, plan = null, cursor = 0, lastKey = '', schedUntil = 0, lastSeek = 0;
  let onTrack = () => {};

  const wallNow = () => Date.now() / 1000;
  const toCtx = (wall) => ctx.currentTime + (wall - wallNow());

  function voicing(root, q) {
    return Q[q].map((iv) => { let n = root + iv; while (n > 70) n -= 12; while (n < 54) n += 12; return n; }).sort((a, b) => a - b);
  }

  function tickGen(nowW) {
    const { startWall, seg } = cur;
    const sd = 60 / plan.bpm / 4, bars = Math.floor(seg.dur / (sd * 16));
    const endStep = bars * 16;
    const horizon = nowW + 1.6;
    while (cursor < endStep) {
      const i = cursor;
      const tw = startWall + i * sd + (i % 2 ? plan.swing * sd : 0);
      if (tw > horizon) break;
      cursor++;
      if (tw < nowW - 0.05 || tw <= schedUntil) continue; // уже запланировано до паузы — не дублируем
      schedUntil = tw;
      const t = toCtx(tw) + (Math.random() - 0.5) * 0.008;
      const bar = Math.floor(i / 16), st = i % 16;
      const intro = bar < 2, outro = bar >= bars - 2, breakdown = bar % 16 === 14 || bar % 16 === 15;
      const prog = Math.floor(bar / 8) % 2 ? plan.B : plan.A;
      const [deg, q] = prog[bar % 4];
      const chordRoot = plan.root + deg;
      if (st === 0 || (st === 10 && bar % 2)) {
        const notes = voicing(chordRoot, q);
        const dur = st === 0 ? sd * (bar % 2 ? 9.5 : 15.5) : sd * 5.5;
        notes.forEach((n, k) => epiano(t + k * 0.012, n, st === 0 ? 0.9 : 0.6, dur));
      }
      if (!intro && !breakdown) {
        let bn = chordRoot - 24; while (bn < 33) bn += 12;
        if (st === 0) bass(t, bn, sd * 6);
        if (st === 8 && plan.groove.k.includes(8)) bass(t, bn + 7, sd * 3);
        if (st === 14 && bar % 2) bass(t, bn + (Math.random() < 0.5 ? -1 : 2), sd * 2);
      }
      if (!intro && !outro && !breakdown) {
        const v = 0.85 + Math.random() * 0.2;
        if (plan.groove.k.includes(st)) kick(t, v);
        if (plan.groove.s.includes(st)) snare(t + 0.012, v);
        if (st % 2 === 0) hat(t, st % 4 === 0 ? 0.9 : 0.55, st === 14 && bar % 4 === 3);
      }
      if (plan.melody && !intro && bar % 8 >= 2 && bar % 8 < 7) {
        const inv = Math.floor(bar / 8) % 2;
        for (const [ms, deg2] of plan.motif) if (ms === st && Math.random() < 0.8) {
          const d = inv ? 4 - deg2 : deg2;
          lead(t, plan.root + 12 + plan.scale[d] + (d > 2 && inv ? -12 : 0), sd * 3, plan.lead);
        }
      }
    }
  }

  function fade(param, to, sec) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, t + sec);
  }

  function tick() {
    if (!playing) return;
    const nowW = wallNow();
    const at = segmentAt(sched, nowW);
    if (at.key !== lastKey) {
      const sameSeg = cur && cur.key === at.key;
      lastKey = at.key; cur = at;
      if (!sameSeg) { fileFailed = false; schedUntil = 0; }
      if (at.seg.type === 'file') {
        fade(genIn.gain, 0, 1.5);
        const want = new URL(at.seg.src, document.baseURI).href; // от <base href="/">, а не от адреса страницы /piter/
        if (el.src !== want) { el.src = want; el.addEventListener('loadedmetadata', () => { el.currentTime = Math.max(0, wallNow() - cur.startWall); }, { once: true }); }
        else if (el.readyState >= 1) el.currentTime = Math.max(0, at.offset);
        el.play().catch(() => { fileFailed = true; });
        fade(fileGain.gain, 1, 1.5);
        onTrack({ title: at.seg.title, kind: 'file', index: sched.segs.indexOf(at.seg), count: sched.segs.length });
      } else {
        fade(fileGain.gain, 0, 1.5); setTimeout(() => el.pause(), 1600);
        plan = planTrack(at.seed);
        const sd = 60 / plan.bpm / 4;
        cursor = Math.max(0, Math.ceil(at.offset / sd));
        fade(genIn.gain, 1, 2);
        onTrack({ title: genTitle(at.seed, current.weatherKind, sounds.genTitles), kind: 'gen', index: sched.segs.indexOf(at.seg), count: sched.segs.length, key: plan.root, bpm: plan.bpm });
      }
    }
    if (cur.seg.type === 'file' && fileFailed && !cur.fallback) { // нет сети — вместо трека живая вставка
      cur.fallback = true; plan = planTrack(Math.floor(cur.startWall));
      cursor = Math.max(0, Math.ceil((nowW - cur.startWall) / (60 / plan.bpm / 4)));
      fade(fileGain.gain, 0, 0.5); fade(genIn.gain, 1, 1.5);
      onTrack({ title: genTitle(cur.startWall | 0, current.weatherKind, sounds.genTitles), kind: 'gen', index: sched.segs.indexOf(cur.seg), count: sched.segs.length });
    }
    if (cur.seg.type === 'gen' || cur.fallback) tickGen(nowW);
    else if (!el.paused && el.readyState >= 3 && nowW - lastSeek > 5 && Math.abs(el.currentTime - (nowW - cur.startWall)) > 2) { lastSeek = nowW; el.currentTime = nowW - cur.startWall; } // дрейф
  }

  // ---------- звуки города ----------
  const current = { weatherKind: 'clear', key: 60 };
  const city = {};
  function bed(id, buf, setup) {
    const s = loop(buf); const g = ctx.createGain(); g.gain.value = 0;
    const out = setup(s); out.connect(g).connect(cityBus);
    city[id] = { gain: g };
  }
  bed('rain', noiseBuf, (s) => { const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; const lp = ctx.createBiquadFilter(); lp.frequency.value = 5000; s.connect(hp).connect(lp); return lp; });
  bed('water', brownBuf, (s) => { // вода: река, залив, озеро
    const lp = ctx.createBiquadFilter(); lp.frequency.value = 420; const am = ctx.createGain(); am.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18; const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg).connect(am.gain); lfo.start();
    s.connect(lp).connect(am); return am;
  });
  bed('wind', noiseBuf, (s) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.value = 700;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 380; lfo.connect(lg).connect(bp.frequency); lfo.start();
    const g = ctx.createGain(); g.gain.value = 0.35; s.connect(bp).connect(g); return g;
  });
  bed('city', brownBuf, (s) => { const lp = ctx.createBiquadFilter(); lp.frequency.value = 260; const g = ctx.createGain(); g.gain.value = 0.5; s.connect(lp).connect(g); return g; });
  const BEDS = ['rain', 'water', 'wind', 'city'];
  const EVENTS = [...new Set(['gulls', 'tram', 'bells', 'cannon', 'ships', 'cat', 'tea', ...(sounds.list || []).map((x) => x.id).filter((id) => !BEDS.includes(id))])];
  for (const id of EVENTS) { const g = ctx.createGain(); g.gain.value = 1; g.connect(cityBus); city[id] = { gain: g }; }

  function bell(t, m, vel, dest) {
    const f = mtof(m);
    [[0.5, 0.5, 4], [1, 1, 3], [1.19, 0.5, 2], [1.56, 0.4, 1.6], [2, 0.5, 1.4], [2.51, 0.25, 1], [3.01, 0.2, 0.8], [4.1, 0.12, 0.5]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(); o.frequency.value = f * r;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vel * 0.1, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d * 1.6);
      o.connect(g).connect(dest); o.start(t); o.stop(t + d * 1.6 + 0.1);
    });
  }
  // Металл/стекло: набор неровных обертонов с разными затуханиями (монета, ложечка, стакан)
  function metal(t, f, vol, dec, dest, parts = [[1, 1], [1.47, 0.6], [2.09, 0.45], [2.56, 0.3], [3.9, 0.15]]) {
    for (const [r, a] of parts) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.004);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dec / r ** 0.5);
      o.connect(g).connect(dest); o.start(t); o.stop(t + dec + 0.05);
    }
  }
  // Короткая глиссада синуса (пузырьки, «мррр»)
  function blip(t, f0, f1, dur, vol, dest, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  const echoNode = (() => { // эхо над водой для пушки и салюта
    const d = ctx.createDelay(2); d.delayTime.value = 0.62; const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.frequency.value = 700; d.connect(lp).connect(fb).connect(d); lp.connect(cityBus); city.cannon.gain.connect(d); return d;
  })();

  const sfx = {
    swift(t) { // стрижи: быстрые высокие «ссии-ссии»
      const bus = (city.birds || city.gulls).gain;
      for (let k = 0; k < 4 + (Math.random() * 4 | 0); k++) blip(t + k * 0.11 + Math.random() * 0.03, 5200 + Math.random() * 900, 3800, 0.07, 0.03, bus, 'triangle');
    },
    gull(t) {
      for (let k = 0; k < 3; k++) {
        const s = t + k * 0.32, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle';
        o.frequency.setValueAtTime(1700, s); o.frequency.exponentialRampToValueAtTime(1150, s + 0.25);
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.025, s + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.28);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500;
        o.connect(bp).connect(g).connect(city.gulls.gain); o.start(s); o.stop(s + 0.3);
      }
    },
    tram(t) {
      noiseHit(t, 'lowpass', 180, 0.5, 0.25, 7, city.tram.gain);
      bell(t + 1.2, 96, 0.5, city.tram.gain); bell(t + 1.45, 96, 0.4, city.tram.gain);
    },
    chime(t, n, key) {
      const mel = [12, 7, 4, 0, 7, 12, 4, 7];
      for (let i = 0; i < n * 2; i++) bell(t + i * 0.9, key + mel[i % mel.length] + 12, 0.6, city.bells.gain);
    },
    hours(t, n, key) { for (let i = 0; i < n; i++) bell(t + i * 2.2, key - 12, 0.9, city.bells.gain); },
    cannon(t) {
      // низкий удар, хлопок и долгий раскат, эхо от воды и стен крепости
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(26, t + 1.4);
      g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
      o.connect(g); g.connect(city.cannon.gain); o.start(t); o.stop(t + 2.7);
      const s1 = ctx.createBufferSource(); s1.buffer = noiseBuf;
      const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.setValueAtTime(1800, t); f1.frequency.exponentialRampToValueAtTime(180, t + 0.5);
      const g1 = ctx.createGain(); g1.gain.setValueAtTime(0.6, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      s1.connect(f1).connect(g1); g1.connect(city.cannon.gain); s1.start(t); s1.stop(t + 0.8);
      const s2 = ctx.createBufferSource(); s2.buffer = brownBuf;
      const f2 = ctx.createBiquadFilter(); f2.frequency.value = 110;
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.9, t + 0.15); g2.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
      s2.connect(f2).connect(g2).connect(city.cannon.gain); s2.start(t); s2.stop(t + 4.6);
    },
    horn(t) {
      for (const [s, d] of [[0, 1.8], [2.4, 2.6]]) for (const f of [98, 147]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; lp.frequency.value = 500;
        g.gain.setValueAtTime(0, t + s); g.gain.linearRampToValueAtTime(0.06, t + s + 0.25); g.gain.setValueAtTime(0.06, t + s + d); g.gain.linearRampToValueAtTime(0, t + s + d + 0.5);
        o.connect(lp).connect(g).connect(city.ships.gain); o.start(t + s); o.stop(t + s + d + 0.6);
      }
    },
    purr(t) {
      // «мррр?» — короткая трель, потом мурлыканье с выдохом громче и вдохом тише
      const tr = ctx.createGain(); tr.gain.value = 0; const lf = ctx.createOscillator(); lf.frequency.value = 32;
      const lg = ctx.createGain(); lg.gain.value = 0.5; lf.connect(lg).connect(tr.gain);
      const bp0 = ctx.createBiquadFilter(); bp0.type = 'bandpass'; bp0.frequency.value = 700; bp0.Q.value = 1.5;
      const tro = ctx.createOscillator(); tro.type = 'triangle';
      tro.frequency.setValueAtTime(330, t); tro.frequency.linearRampToValueAtTime(560, t + 0.18); tro.frequency.linearRampToValueAtTime(420, t + 0.4);
      const tg = ctx.createGain(); tg.gain.setValueAtTime(0, t); tg.gain.linearRampToValueAtTime(0.35, t + 0.05); tg.gain.linearRampToValueAtTime(0, t + 0.42);
      tro.connect(tg).connect(tr).connect(bp0).connect(city.cat.gain); lf.start(t); tro.start(t); tro.stop(t + 0.45); lf.stop(t + 0.45);
      const t0 = t + 0.5;
      for (let k = 0; k < 4; k++) { // вдох/выдох
        const st = t0 + k * 1.05, out = k % 2 === 0, dur = out ? 1.1 : 0.9;
        const src = ctx.createBufferSource(); src.buffer = brownBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = out ? 170 : 210; bp.Q.value = 1.2;
        const am = ctx.createGain(); am.gain.value = 0;
        const pulse = ctx.createOscillator(); pulse.type = 'square'; pulse.frequency.value = out ? 26 : 23;
        const pg = ctx.createGain(); pg.gain.value = 0.5; pulse.connect(pg).connect(am.gain);
        const env = ctx.createGain(); const peak = out ? 1.5 : 0.8;
        env.gain.setValueAtTime(0, st); env.gain.linearRampToValueAtTime(peak, st + 0.25); env.gain.linearRampToValueAtTime(peak * 0.8, st + dur - 0.2); env.gain.linearRampToValueAtTime(0, st + dur);
        src.connect(bp).connect(am).connect(env).connect(city.cat.gain);
        src.start(st, Math.random() * 2); pulse.start(st); src.stop(st + dur + 0.05); pulse.stop(st + dur + 0.05);
      }
    },
    clink(t) { // ложечка о стакан: тонкое стекло, два касания
      const glass = [[1, 1], [2.32, 0.5], [4.25, 0.25]];
      metal(t, 4400, 0.1, 1.8, city.tea.gain, glass); metal(t + 0.16, 4380, 0.07, 1.4, city.tea.gain, glass);
    },
    coin(t, win) {
      // монета: звон и затухающие отскоки о гранит
      const coinParts = [[1, 1], [1.59, 0.7], [2.14, 0.5], [2.3, 0.4], [3.6, 0.2]];
      [0, 0.24, 0.41, 0.53, 0.61, 0.66].forEach((d, i) => metal(t + d, 1380 + i * 25, 0.2 / (i * 0.6 + 1), 0.5, city.tea.gain, coinParts));
      if (win) [0, 4, 7, 11, 14].forEach((iv, i) => bell(t + 0.8 + i * 0.11, 76 + iv, 0.55, city.bells.gain));
      else {
        const sp = ctx.createBufferSource(); sp.buffer = noiseBuf; // плюх
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(2200, t + 0.75); bp.frequency.exponentialRampToValueAtTime(260, t + 1.05);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t + 0.75); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        sp.connect(bp).connect(g).connect(city.tea.gain); sp.start(t + 0.75); sp.stop(t + 1.15);
        for (let i = 0; i < 5; i++) blip(t + 0.95 + i * 0.07 + Math.random() * 0.04, 500 + Math.random() * 300, 1200 + Math.random() * 500, 0.05, 0.12, city.tea.gain); // пузырьки
      }
    },
    torch(t) { // вспышка газа и потрескивание пламени
      const s1 = ctx.createBufferSource(); s1.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1600, t + 0.6);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.3); g.gain.exponentialRampToValueAtTime(0.05, t + 2.5); g.gain.linearRampToValueAtTime(0, t + 3);
      s1.connect(bp).connect(g).connect(city.cannon.gain); s1.start(t); s1.stop(t + 3);
      for (let i = 0; i < 18; i++) noiseHit(t + 0.4 + Math.random() * 2.6, 'highpass', 3000, 1, 0.12 + Math.random() * 0.12, 0.02, city.cannon.gain);
    },
    click(t) { noiseHit(t, 'highpass', 2500, 1, 0.25, 0.03, city.tea.gain); noiseHit(t + 0.06, 'highpass', 3000, 1, 0.15, 0.02, city.tea.gain); },
    creak(t) {
      for (let k = 0; k < 2; k++) {
        const s = t + k * 1.8, src = ctx.createBufferSource(); src.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 18;
        bp.frequency.setValueAtTime(420, s); bp.frequency.linearRampToValueAtTime(700 + k * 80, s + 0.5);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.5, s + 0.1); g.gain.linearRampToValueAtTime(0, s + 0.55);
        src.connect(bp).connect(g).connect(city.cat.gain); src.start(s, Math.random()); src.stop(s + 0.6);
      }
    },
  };

  // Какие звуки «разрешены» сейчас (множитель к ползунку), по погоде и времени.
  const AUTO = {
    rain: (e) => ['rain', 'storm'].includes(e.weather.kind) ? clamp(0.4 + e.weather.precip / 3, 0.4, 1) : 0,
    water: (e) => (e.frozen ? 0.15 : 0.9),
    wind: (e) => clamp(e.weather.wind / 9, 0.12, 1) * (e.weather.kind === 'snow' ? 1.4 : 1),
    city: (e) => { const h = e.local.getUTCHours(); return h >= 7 && h < 23 ? 0.9 : 0.35; },
  };
  let mix = {}; // id -> 0..2 (ползунок)
  let lastWall = wallNow();

  function cityTick(env) {
    const nowW = env.ms / 1000, l = env.local;
    if (Math.abs(nowW - lastWall) > 5) lastWall = nowW; // прыжок машины времени — без залпа событий
    for (const id of Object.keys(AUTO)) {
      const target = AUTO[id](env) * (mix[id] ?? 1) * 0.5;
      city[id].gain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
    }
    for (const id of EVENTS) city[id].gain.gain.setTargetAtTime(mix[id] ?? 1, ctx.currentTime, 0.1);
    const crossed = (sec) => { const a = lastWall, b = nowW; return Math.floor(a / sec) !== Math.floor(b / sec); };
    const t = ctx.currentTime + 0.05, h = l.getUTCHours(), m = l.getUTCMinutes();
    const day = env.sun.alt > -2;
    const dt = Math.min(5, Math.max(0, nowW - lastWall)); // сек сцены с прошлого тика
    const chance = (perMin) => Math.random() < (perMin / 60) * dt;
    sounds.tick?.(env, { t, h, m, day, chance, crossed, sfx, key: current.key }); // события города
    lastWall = nowW;
  }

  const api = {
    ctx, sfx: (name, ...a) => { ctx.resume(); sfx[name](ctx.currentTime + 0.05, ...a); },
    setSchedule(playlist) { sched = buildSchedule(playlist); lastKey = ''; },
    play() { const r = ctx.resume(); playing = true; lastKey = ''; tick(); fade(musicBus.gain, api.musicVol, 1); return r; }, // без await: el.play() должен успеть внутри жеста
    pause() { playing = false; fade(musicBus.gain, 0, 0.6); setTimeout(() => { if (!playing) el.pause(); }, 700); fade(genIn.gain, 0, 0.6); },
    get playing() { return playing; },
    musicVol: 0.8, cityVol: 0.7,
    setMusicVol(v) { api.musicVol = v; if (playing) fade(musicBus.gain, v, 0.2); },
    setCityVol(v) { api.cityVol = v; fade(cityBus.gain, v, 0.2); },
    setMix(m) { mix = m; },
    set onTrack(fn) { onTrack = fn; },
    update(env) { current.weatherKind = env.weather.kind; if (plan) current.key = plan.root; tick(); cityTick(env); },
    skip() { const n = segmentAt(sched, wallNow()); return n; },
  };
  cityBus.gain.value = api.cityVol;
  musicBus.gain.value = 0;
  return api;
}
