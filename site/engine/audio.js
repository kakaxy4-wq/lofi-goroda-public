// Звук: эфир города (треки + генеративные вставки, синхронно по часам) и звуки города
// со своим микшером. Какие события звучат и когда — решает модуль города (sounds.tick).

import { rng, clamp } from './util.js';
import { lightning, fogK } from './weather.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- эфирная сетка ----------
// Сетка одинакова у всех: позиция = (unix-время) mod длина сетки.
// Сегмент 'file' — mp3-трек из плейлиста города, 'gen' — вставка, которую генерирует браузер.
export function buildSchedule(playlist) {
  const segs = [];
  let t = 0;
  playlist.forEach((tr, i) => {
    segs.push({ type: 'file', src: tr.src, title: tr.title, dur: tr.dur, start: t, idx: i, tone: tr.key, beat: tr.beat });
    t += tr.dur;
    if (i % 3 === 2) { segs.push({ type: 'gen', dur: 120, start: t, seed: 1000 + i }); t += 120; } // живая вставка — раз на три трека, коротко
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

export function createAudio(sounds = {}, opts = {}) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {} // iOS: играть и в беззвучном режиме
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3;
  const limiter = ctx.createDynamicsCompressor(); // страховка от клиппинга
  limiter.threshold.value = -3; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
  master.connect(comp).connect(limiter).connect(ctx.destination);

  const musicBus = ctx.createGain();
  const duck = ctx.createGain(); musicBus.connect(duck).connect(master); // музыка притихает под голос ведущего
  const voiceBus = ctx.createGain(); voiceBus.connect(master);
  const cityBus = ctx.createGain();
  const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5; // «Окно дня»: звуки города через штору
  cityBus.connect(muffle).connect(master);

  // шумы
  const noiseBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const brownBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate); const d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; })();
  const crackleBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 7.2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) { d[i] = (Math.random() * 2 - 1) * 0.02; if (Math.random() < 0.0004) d[i] = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.7); } return b; })();
  const irBuf = (() => { const len = ctx.sampleRate * 2.4, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); } return b; })();
  const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); return s; };
  // Подложки города — длинные стерео-буферы с разным шумом в каналах: короткая петля в 3–4 с слышна ухом, а моно звучит «в голове»
  const stereoNoise = (sec, brown) => {
    const len = ctx.sampleRate * sec | 0, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } }
    return b;
  };
  const bedNoise = stereoNoise(13), bedBrown = stereoNoise(17, true);
  const rainBuf = (() => { // шелест + отдельные капли разной силы
    const len = ctx.sampleRate * 11 | 0, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.55;
      for (let k = 0; k < len / 900; k++) { const at = Math.random() * (len - 400) | 0, a = 0.3 + Math.random() * 0.9, dec = 40 + Math.random() * 160; for (let i = 0; i < 400; i++) d[at + i] += a * Math.exp(-i / dec) * (Math.random() * 2 - 1); }
    }
    return b;
  })();
  // Отзвук: улица (длинный, с поздними отражениями от домов и воды) и комната (короткий)
  const space = (sec, curve, pre) => {
    const len = ctx.sampleRate * sec | 0, p0 = ctx.sampleRate * pre | 0, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = p0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i - p0) / (len - p0), curve); }
    return b;
  };
  const cityVerb = ctx.createConvolver(); cityVerb.buffer = space(3.4, 3.4, 0.03);
  const roomVerb = ctx.createConvolver(); roomVerb.buffer = space(0.7, 4.5, 0.004);
  { const g = ctx.createGain(); g.gain.value = 0.55; cityVerb.connect(g).connect(cityBus); }
  { const g = ctx.createGain(); g.gain.value = 0.5; roomVerb.connect(g).connect(cityBus); }
  // Звук «где-то там»: своя точка в стерео и, для дальних, мягкий спад верхов. Узлы отсоединяются сами
  function place(dest, pan, cut = 0, ttl = 4) {
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(dest);
    let head = p;
    if (cut) { const f = ctx.createBiquadFilter(); f.frequency.value = cut; f.connect(p); head = f; }
    setTimeout(() => { try { head.disconnect(); p.disconnect(); } catch {} }, (ttl + 1) * 1000);
    return head;
  }
  const side = (w = 0.8) => (Math.random() * 2 - 1) * w;

  const reverb = ctx.createConvolver(); reverb.buffer = irBuf;
  const revOut = ctx.createGain(); revOut.gain.value = 0.28; reverb.connect(revOut).connect(musicBus);
  // гитара на стене (engine/guitar.js): мимо музыки и города — играет и при выключенном эфире; немного комнаты
  const guitarBus = ctx.createGain(); guitarBus.connect(master);
  { const g = ctx.createGain(); g.gain.value = 0.35; guitarBus.connect(g).connect(roomVerb); }

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
  let fileFailed = false, stallT = 0, blocked = false; // blocked — браузер запретил play() без жеста (после перехода между городами)
  el.addEventListener('error', () => { fileFailed = true; });
  el.addEventListener('waiting', () => { clearTimeout(stallT); stallT = setTimeout(() => { if (el.readyState < 3) fileFailed = true; }, 8000); }); // сеть «висит» — уходим в живую вставку
  el.addEventListener('playing', () => clearTimeout(stallT));
  // Телефон отдал звук другому приложению (кружочек или голосовое в Telegram, звонок): страница уходит в фон,
  // система ставит <audio> на паузу и глушит AudioContext, а сама обратно не включает. Когда страница снова
  // видна — продолжаем эфир с того места, где он идёт у всех. Не пускает без касания — blocked (app попросит).
  // Пауза от системы при открытой странице (выдернули наушники) — это пауза: не включаем звук в динамик сами.
  let recoverT = 0, onSystemPause = null;
  const wantFile = () => playing && cur && cur.seg.type === 'file' && !cur.fallback && !fileFailed;
  function recover() {
    if (!playing || document.hidden) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (wantFile() && el.paused) {
      if (el.readyState >= 1) el.currentTime = Math.max(0, wallNow() - cur.startWall);
      el.play().then(() => { blocked = false; }).catch((e) => { if (e?.name === 'NotAllowedError') blocked = true; });
    }
  }
  function recoverSoon() { // звук возвращается не сразу: пробуем ещё полминуты, пока не заиграет
    clearInterval(recoverT); recover(); let n = 0;
    recoverT = setInterval(() => {
      if (++n > 15 || !playing || (ctx.state === 'running' && !(wantFile() && el.paused))) { clearInterval(recoverT); return; }
      recover();
    }, 2000);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recoverSoon(); });
  window.addEventListener('pageshow', recoverSoon);
  el.addEventListener('pause', () => { if (!document.hidden && wantFile() && el.src && !el.ended) onSystemPause?.(); }); // пауза не от нас, страница на экране
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
  let sched = buildSchedule([]), schedNight = null;
  // Ночной эфир: с 1:00 до 6:00 по местному времени — свой круг из медленных треков (темп до 74), у всех одновременно
  const isNight = (w) => { const h = opts.localHour?.(w * 1000); return h >= 1 && h < 6; };
  const schedFor = (w) => (schedNight && isNight(w) ? schedNight : sched);
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
    const S = schedFor(nowW), night = S === schedNight;
    const at = segmentAt(S, nowW);
    at.key = (night ? 'n' : 'd') + at.key; // в 1:00 и 6:00 программа меняется, даже если позиция в круге совпала
    if (at.key !== lastKey) {
      const sameSeg = cur && cur.key === at.key;
      lastKey = at.key; cur = at;
      if (!sameSeg) { fileFailed = false; schedUntil = 0; }
      if (at.seg.type === 'file') {
        fade(genIn.gain, 0, 1.5);
        const want = new URL(at.seg.src, document.baseURI).href; // от <base href="/">, а не от адреса страницы /piter/
        if (el.src !== want) { el.src = want; el.addEventListener('loadedmetadata', () => { el.currentTime = Math.max(0, wallNow() - cur.startWall); }, { once: true }); }
        else if (el.readyState >= 1) el.currentTime = Math.max(0, at.offset);
        el.play().then(() => { blocked = false; }).catch((e) => { if (e?.name === 'NotAllowedError') blocked = true; else fileFailed = true; });
        fade(fileGain.gain, 1, 1.5);
        onTrack({ title: at.seg.title, kind: 'file', index: S.segs.indexOf(at.seg), count: S.segs.length, night });
      } else {
        fade(fileGain.gain, 0, 1.5); setTimeout(() => el.pause(), 1600);
        plan = planTrack(at.seed);
        const sd = 60 / plan.bpm / 4;
        cursor = Math.max(0, Math.ceil(at.offset / sd));
        fade(genIn.gain, 1, 2);
        onTrack({ title: genTitle(at.seed, current.weatherKind, sounds.genTitles), kind: 'gen', index: S.segs.indexOf(at.seg), count: S.segs.length, key: plan.root, bpm: plan.bpm, night });
      }
    }
    if (cur.seg.type === 'file' && fileFailed && !cur.fallback) { // нет сети — вместо трека живая вставка
      cur.fallback = true; plan = planTrack(Math.floor(cur.startWall));
      cursor = Math.max(0, Math.ceil((nowW - cur.startWall) / (60 / plan.bpm / 4)));
      fade(fileGain.gain, 0, 0.5); fade(genIn.gain, 1, 1.5);
      onTrack({ title: genTitle(cur.startWall | 0, current.weatherKind, sounds.genTitles), kind: 'gen', index: S.segs.indexOf(cur.seg), count: S.segs.length, night });
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
  bed('rain', rainBuf, (s) => { const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; const lp = ctx.createBiquadFilter(); lp.frequency.value = 5000; s.connect(hp).connect(lp); return lp; });
  bed('water', bedBrown, (s) => { // вода: река, залив, озеро
    const lp = ctx.createBiquadFilter(); lp.frequency.value = 420; const am = ctx.createGain(); am.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18; const lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg).connect(am.gain); lfo.start();
    s.connect(lp).connect(am); return am;
  });
  bed('wind', bedNoise, (s) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.value = 700;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 380; lfo.connect(lg).connect(bp.frequency); lfo.start();
    const g = ctx.createGain(); g.gain.value = 0.35; s.connect(bp).connect(g); return g;
  });
  bed('city', bedBrown, (s) => { const lp = ctx.createBiquadFilter(); lp.frequency.value = 260; const g = ctx.createGain(); g.gain.value = 0.5; s.connect(lp).connect(g); return g; });
  const BEDS = ['rain', 'water', 'wind', 'city'];
  // резкие события (пушка, гудки, колокола, собаки, вороны): в «фокусе» и «сне» звучат тише — calm < 1
  const LOUD = new Set(['cannon', 'ships', 'bells', 'dogs', 'ravens', 'horn', 'thunder']); let calm = 1;
  const EVENTS = [...new Set(['gulls', 'tram', 'bells', 'cannon', 'thunder', 'ships', 'cat', 'tea', ...(sounds.list || []).map((x) => x.id).filter((id) => !BEDS.includes(id))])];
  const ROOM = new Set(['cat', 'tea']); // в комнате — короткий отзвук, всё остальное — на улице
  for (const id of EVENTS) {
    const g = ctx.createGain(); g.gain.value = 1; g.connect(cityBus);
    const send = ctx.createGain(); send.gain.value = ROOM.has(id) ? 0.14 : 0.34; g.connect(send).connect(ROOM.has(id) ? roomVerb : cityVerb);
    city[id] = { gain: g };
  }

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
    swift(t) { // стрижи: пронзительное «сссии» с трелью, стайка проносится в стороне
      const out = place((city.birds || city.gulls).gain, side(0.9), 0, 2);
      const n = 4 + (Math.random() * 5 | 0);
      for (let k = 0; k < n; k++) {
        const st = t + k * (0.08 + Math.random() * 0.05), d = 0.06 + Math.random() * 0.05, f = 6200 + Math.random() * 1500;
        const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, st); o.frequency.exponentialRampToValueAtTime(f * 0.72, st + d);
        const fm = ctx.createOscillator(); fm.frequency.value = 160 + Math.random() * 140; const fg = ctx.createGain(); fg.gain.value = f * 0.06; fm.connect(fg).connect(o.frequency);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.02, st + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, st + d);
        o.connect(g).connect(out); noiseHit(st, 'highpass', 6500, 0.7, 0.005, d, out);
        o.start(st); o.stop(st + d + 0.02); fm.start(st); fm.stop(st + d + 0.02);
      }
    },
    gull(t) { // чайка: хриплое «кьяу-кьяу» — пила через две форманты, дрожь голоса и выдох; вдали и в стороне
      const out = place(city.gulls.gain, side(0.85), 5200, 3);
      const n = 2 + (Math.random() * 3 | 0), base = 1150 + Math.random() * 380;
      for (let k = 0; k < n; k++) {
        const st = t + k * (0.27 + Math.random() * 0.12), d = 0.2 + Math.random() * 0.12;
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 1.2, st); o.frequency.linearRampToValueAtTime(base * 1.42, st + d * 0.25); o.frequency.exponentialRampToValueAtTime(base * 0.78, st + d);
        const vib = ctx.createOscillator(); vib.frequency.value = 26 + Math.random() * 12; const vg = ctx.createGain(); vg.gain.value = base * 0.035; vib.connect(vg).connect(o.frequency);
        const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1500 + Math.random() * 200; f1.Q.value = 3;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 3000 + Math.random() * 300; f2.Q.value = 4;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.05, st + 0.02); g.gain.setValueAtTime(0.042, st + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, st + d);
        o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(out);
        noiseHit(st, 'bandpass', 2600, 2, 0.01, d, out);
        o.start(st); o.stop(st + d + 0.02); vib.start(st); vib.stop(st + d + 0.02);
      }
    },
    tram(t) { // трамвай проезжает слева направо: гул, стук колёс на стыках, звонок
      const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.75, t); p.pan.linearRampToValueAtTime(0.75, t + 7.5); p.connect(city.tram.gain);
      const lp = ctx.createBiquadFilter(); lp.frequency.value = 1600; lp.connect(p);
      setTimeout(() => { try { lp.disconnect(); p.disconnect(); } catch {} }, 10000);
      noiseHit(t, 'lowpass', 170, 0.7, 0.28, 7, lp);
      for (let k = 0; k < 6; k++) { const st = t + 0.9 + k * (0.85 + Math.random() * 0.1); noiseHit(st, 'bandpass', 950, 3, 0.05, 0.07, lp); noiseHit(st + 0.13, 'bandpass', 820, 3, 0.04, 0.07, lp); }
      bell(t + 1.2, 96, 0.5, lp); bell(t + 1.45, 96, 0.4, lp);
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
    thunder(t, near) { // гром за молнией: близкий — резкий треск и тяжёлый раскат, дальний — всё ниже и мягче
      const v = near ? 1 : 0.55;
      noiseHit(t, 'lowpass', near ? 1600 : 700, 0.7, 0.5 * v, near ? 0.6 : 0.9, city.thunder.gain); // треск
      const s = ctx.createBufferSource(); s.buffer = brownBuf; // раскат
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(near ? 220 : 130, t); f.frequency.exponentialRampToValueAtTime(near ? 60 : 45, t + 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8 * v, t + (near ? 0.12 : 0.5)); g.gain.exponentialRampToValueAtTime(0.001, t + (near ? 4 : 6));
      s.connect(f).connect(g).connect(city.thunder.gain); s.start(t); s.stop(t + (near ? 4.1 : 6.2));
      const st = t + 1.6 + Math.random() * 1.4; // перекат — второй короткий раскат следом
      const s2 = ctx.createBufferSource(); s2.buffer = brownBuf;
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 90;
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0, st); g2.gain.linearRampToValueAtTime(0.32 * v, st + 0.3); g2.gain.exponentialRampToValueAtTime(0.001, st + 2.5);
      s2.connect(f2).connect(g2).connect(city.thunder.gain); s2.start(st); s2.stop(st + 2.6);
    },
    horn(t) { // гудок теплохода издалека: плотный аккорд из чуть расстроенных пил, вибрато, тёплый фильтр
      const out = place(city.ships.gain, side(0.5), 900, 9);
      for (const [st, d] of [[0, 1.8], [2.4, 2.6]]) for (const f of [98, 147, 196]) for (const det of [-5, 4]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const vib = ctx.createOscillator(); vib.frequency.value = 4.2 + Math.random(); const vg = ctx.createGain(); vg.gain.value = 1.1; vib.connect(vg).connect(o.frequency);
        const a = f === 196 ? 0.012 : 0.03, g = ctx.createGain();
        g.gain.setValueAtTime(0, t + st); g.gain.linearRampToValueAtTime(a, t + st + 0.35); g.gain.setValueAtTime(a, t + st + d); g.gain.linearRampToValueAtTime(0, t + st + d + 0.6);
        o.connect(g).connect(out); o.start(t + st); o.stop(t + st + d + 0.7); vib.start(t + st); vib.stop(t + st + d + 0.7);
      }
    },
    rails(t, gap = 1.5) { // стук колёс поезда: «та-там… та-там» — тележки соседних вагонов проходят стык, глухо, из-под пола
      const out = place((city.wheels || city.tram).gain, side(0.15), 1300, 4);
      for (const [d, v] of [[0, 1], [0.16, 0.8], [gap, 0.85], [gap + 0.16, 0.7]]) {
        const st = t + d + Math.random() * 0.02;
        noiseHit(st, 'bandpass', 420 + Math.random() * 60, 2.2, 0.09 * v, 0.09, out);
        noiseHit(st, 'lowpass', 140, 0.8, 0.12 * v, 0.14, out);
      }
    },
    pour(t) { // кипяток из крана в стакан: щелчок крана, струя, тон стакана поднимается по мере наполнения
      const out = place((city.tea || city.cat).gain, 0.35, 0, 5);
      noiseHit(t, 'highpass', 2200, 1, 0.05, 0.05, out);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(700, t + 0.1); f.frequency.exponentialRampToValueAtTime(2600, t + 3);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + 0.1); g.gain.linearRampToValueAtTime(0.09, t + 0.3); g.gain.setValueAtTime(0.09, t + 2.8); g.gain.linearRampToValueAtTime(0, t + 3.2);
      s.connect(f).connect(g).connect(out); s.start(t + 0.1, Math.random()); s.stop(t + 3.3);
      for (let i = 0; i < 14; i++) noiseHit(t + 0.2 + Math.random() * 2.8, 'bandpass', 1500 + i * 90, 8, 0.02, 0.04, out); // бульканье
      noiseHit(t + 3.3, 'highpass', 2600, 1, 0.04, 0.04, out);
    },
    raven(t) { // ворон: низкое хриплое «кра-кра», вдали, с отзвуком двора
      const out = place((city.ravens || city.gulls).gain, side(0.8), 3200, 3);
      const n = 2 + (Math.random() * 2 | 0), base = 420 + Math.random() * 120;
      for (let k = 0; k < n; k++) {
        const st = t + k * (0.38 + Math.random() * 0.1), d = 0.16 + Math.random() * 0.05;
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 1.15, st); o.frequency.exponentialRampToValueAtTime(base * 0.8, st + d);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 200; f.Q.value = 2.5;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.06, st + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, st + d);
        o.connect(f).connect(g).connect(out); noiseHit(st, 'bandpass', 1400, 1.5, 0.03, d, out);
        o.start(st); o.stop(st + d + 0.02);
      }
    },
    bark(t) { // собака лает где-то за домами: два-три глухих «гав», без верхов
      const out = place((city.dogs || city.gulls).gain, side(0.9), 1300, 4);
      const n = 2 + (Math.random() * 2 | 0), base = 330 + Math.random() * 140;
      for (let k = 0; k < n; k++) {
        const st = t + k * (0.32 + Math.random() * 0.15), d = 0.12;
        const o = ctx.createOscillator(); o.type = 'square';
        o.frequency.setValueAtTime(base * 1.3, st); o.frequency.exponentialRampToValueAtTime(base * 0.7, st + d);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 1.2;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.05, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, st + d);
        o.connect(f).connect(g).connect(out); noiseHit(st, 'lowpass', 800, 0.8, 0.04, 0.08, out);
        o.start(st); o.stop(st + d + 0.02);
      }
    },
    snowmobile(t) { // снегоход далеко: двухтактное жужжание проходит слева направо, мотор то тянет, то сбрасывает
      const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.8, t); p.pan.linearRampToValueAtTime(0.8, t + 9); p.connect((city.snowmobile || city.gulls).gain);
      const lp = ctx.createBiquadFilter(); lp.frequency.value = 900; lp.connect(p);
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(140, t + 3); o.frequency.linearRampToValueAtTime(120, t + 6); o.frequency.linearRampToValueAtTime(100, t + 9);
      const am = ctx.createOscillator(); am.frequency.value = 23; const ag = ctx.createGain(); ag.gain.value = 0.4; const g = ctx.createGain(); g.gain.value = 0.6;
      am.connect(ag).connect(g.gain);
      const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.03, t + 3); env.gain.linearRampToValueAtTime(0.03, t + 6); env.gain.linearRampToValueAtTime(0, t + 9);
      o.connect(g).connect(env).connect(lp);
      o.start(t); o.stop(t + 9.2); am.start(t); am.stop(t + 9.2);
      setTimeout(() => { try { lp.disconnect(); p.disconnect(); } catch {} }, 11000);
    },
    loco(t) { // тепловоз впереди состава: два тона тифона, вдалеке и с отзвуком сопок
      const out = place((city.wheels || city.ships).gain, side(0.3), 1400, 6);
      for (const [st, d, f] of [[0, 1.1, 311], [1.3, 1.6, 247]]) for (const det of [-6, 5]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t + st); g.gain.linearRampToValueAtTime(0.018, t + st + 0.12); g.gain.setValueAtTime(0.018, t + st + d); g.gain.linearRampToValueAtTime(0, t + st + d + 0.3);
        o.connect(g).connect(out); o.start(t + st); o.stop(t + st + d + 0.4);
      }
    },
    purr(t) {
      // Настоящее мурлыканье — не тон, а поток коротких гортанных щелчков ~25 в секунду. Строим звук
      // по отсчётам: каждый импульс — затухающий всплеск шума; выдох громче и ниже, вдох тише и чаще.
      const sr = ctx.sampleRate, dur = 4.6, b = ctx.createBuffer(1, sr * dur | 0, sr), d = b.getChannelData(0);
      const phases = [[0, 0.32, 44, 0.35], [0.4, 1.55, 25, 1], [1.55, 2.5, 28, 0.55], [2.5, 3.7, 24.5, 1], [3.7, 4.6, 27.5, 0.5]]; // [от, до, имп/с, громкость]; первый — «мрр?»
      let lp = 0, lp2 = 0;
      for (const [a, z, rate, vol] of phases) {
        for (let p = a; p < z; p += 1 / (rate * (1 + (Math.random() - 0.5) * 0.08))) {
          const i0 = p * sr | 0, edge = Math.min(1, (p - a) / 0.12, (z - p) / 0.15), amp = vol * edge * (0.75 + Math.random() * 0.5);
          for (let j = 0; j < sr * 0.03 && i0 + j < d.length; j++) d[i0 + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / (sr * 0.0065));
        }
      }
      for (let i = 0; i < d.length; i++) { lp += 0.09 * (d[i] - lp); lp2 += 0.09 * (lp - lp2); d[i] = lp2 * 2.2; } // мягкий низ: гортань и грудная клетка
      const src = ctx.createBufferSource(); src.buffer = b;
      const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 180; body.gain.value = 6; body.Q.value = 1;
      const g = ctx.createGain(); g.gain.value = 0.9;
      src.connect(body).connect(g).connect(city.cat.gain); src.start(t);
    },
    clink(t) { // ложечкой помешивают чай: несколько неровных касаний гранёного стакана, плеск по кругу
      const out = place(city.tea.gain, 0.15, 0, 3);
      const n = 3 + (Math.random() * 4 | 0), f0 = 2650 + Math.random() * 500;
      let st = t;
      for (let k = 0; k < n; k++) {
        const a = (k === n - 1 ? 1 : 0.35 + Math.random() * 0.45) * 0.06;             // последний «стук» о край — звонче
        metal(st, f0 * (1 + (Math.random() - 0.5) * 0.03), a, 0.45, out, [[1, 1], [2.74, 0.45], [5.3, 0.2]]); // стекло
        noiseHit(st, 'highpass', 6500, 0.8, a * 1.6, 0.012, out);                        // металл ложки — щелчок
        st += 0.17 + Math.random() * 0.12;
      }
      const sw = ctx.createBufferSource(); sw.buffer = noiseBuf;                        // чай кружится
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(1100, st);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.1); g.gain.linearRampToValueAtTime(0, st + 0.2);
      sw.connect(bp).connect(g).connect(out); sw.start(t, Math.random() * 2); sw.stop(st + 0.3);
    },
    rustle(t) { // одеяло на полке поправили: мягкий шорох ткани
      const out = place(city.cat.gain, -0.6, 0, 2);
      for (let k = 0; k < 3; k++) { const s = t + k * 0.22 + Math.random() * 0.05; noiseHit(s, 'bandpass', 1800 + Math.random() * 1500, 0.7, 0.05, 0.18 + Math.random() * 0.1, out); }
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
    rain: (e) => ['rain', 'storm'].includes(e.weather.kind) ? clamp(0.4 + e.weather.precip / 3, 0.4, 1) : (e.weather.kind === 'snow' && e.weather.temp > 0 ? 0.25 : 0), // мокрый снег: тихий шорох талой воды
    water: (e) => (e.frozen ? 0.15 : 0.9),
    wind: (e) => clamp((e.weather.wind + (e.weather.gust ?? e.weather.wind * 1.5) * 0.4) / 9, 0.12, 1.4) * (e.weather.kind === 'snow' ? 1.2 : 1), // порывы поднимают вой
    city: (e) => { const h = e.local.getUTCHours(); return (h >= 7 && h < 23 ? 0.9 : 0.35) * (1 - 0.4 * fogK(e.weather.kind, e.weather.vis)); }, // в тумане город глохнет
  };
  let mix = {}; // id -> 0..2 (ползунок)
  let lastWall = wallNow();

  // ---------- голос ведущего: в начале часа — город, время и погода (site/voice, tools/voice/build_voice.py) ----------
  // 22.10.2026 владелец убрал голос из эфира: громкость голоса и музыки сильно расходилась. Код оставлен — включить VOICE_ON
  const VOICE_ON = false;
  const voiceCache = {};
  let voiceExt = 'm4a'; // формат файлов голоса — из manifest.json (_ext), по умолчанию m4a (Piper)
  const voiceBuf = (id) => (voiceCache[id] ||= fetch(`voice/${id}.${voiceExt}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(id)))).then((b) => ctx.decodeAudioData(b)));
  let lastEnv = null, announcing = false;
  let voiceMan; // voice/manifest.json: грузим один раз, чтобы не ловить 404 на каждый файл (нет файла — null, голос молчит)
  const voiceManifest = () => (voiceMan ||= fetch('voice/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { if (m?._ext) voiceExt = m._ext; return m; }).catch(() => null));
  // Запасной вариант, когда полного набора нет: одна короткая вставка (docs/voice/phrases.json). Префикс ключа — когда звучит:
  // bridge_open — у Петербурга на разводке; дальше по кругу от часа: время суток (night_/morning_/day_/evening_),
  // общие позывные gen_, погода (rain_/snow_/fog_/storm_/clear_); запасные — out_ и всё остальное
  const PART = (h) => (h < 6 ? 'night_' : h < 11 ? 'morning_' : h < 18 ? 'day_' : 'evening_');
  function shortIds(env, man) {
    const n = Math.floor(env.ms / 3600e3), keys = Object.keys(man).filter((k) => !k.startsWith('_')).sort();
    const pick = (pre) => { const l = keys.filter((k) => k.startsWith(pre)); return l.length ? [l[n % l.length]] : []; };
    const wx = { rain: 'rain_', snow: 'snow_', fog: 'fog_', storm: 'storm_', clear: 'clear_' }[env.weather.kind];
    const order = [PART(env.local.getUTCHours()), 'gen_', wx || 'gen_'];
    const ids = [
      ...(env.bridge && env.bridge.season && env.bridge.windowIdx >= 0 ? pick('bridge_open') : []),
      ...[0, 1, 2].flatMap((i) => pick(order[(n + i) % 3])), ...pick('out_'),
    ];
    return [...new Set(ids)];
  }
  // Сыграть буферы подряд поверх приглушённой музыки; announcing держим до конца речи
  function speak(bufs) {
    let t = ctx.currentTime + 0.4;
    duck.gain.setTargetAtTime(0.3, ctx.currentTime, 0.35);
    voiceBus.gain.value = (mix.voice ?? 1) * Math.max(0.25, api.musicVol ?? 0.8);
    for (const b of bufs) { const s = ctx.createBufferSource(); s.buffer = b; s.connect(voiceBus); s.start(t); t += b.duration + 0.15; }
    duck.gain.setTargetAtTime(1, t + 0.2, 0.7);
    setTimeout(() => (announcing = false), (t - ctx.currentTime + 1) * 1000);
  }
  async function announce(env, force) {
    if (announcing || !opts.cityId || (!playing && !force) || (mix.voice ?? 1) <= 0) return;
    announcing = true;
    const temp = Math.max(-50, Math.min(45, Math.round(env.weather.temp)));
    const ids = [`city_${opts.cityId}`, `hour_${env.local.getUTCHours()}`, `wx_${env.weather.kind}`, `t_${temp}`, `out_${Math.floor(env.ms / 3600e3) % 5}`];
    try {
      const man = await voiceManifest();
      if (!man) { announcing = false; return; } // нет манифеста — молча без голоса
      if (ids.every((id) => id in man)) {
        try { speak(await Promise.all(ids.map(voiceBuf))); return; } catch { ids.forEach((id) => delete voiceCache[id]); } // не загрузилось — запасной вариант
      }
      for (const id of shortIds(env, man)) { // полного набора нет — одна короткая вставка (следующая, если эта не загрузилась)
        try { speak([await voiceBuf(id)]); return; } catch { delete voiceCache[id]; }
      }
      announcing = false;
    } catch { announcing = false; } // файлы не загрузились — молча без голоса
  }

  function cityTick(env) {
    const nowW = env.ms / 1000, l = env.local;
    if (Math.abs(nowW - lastWall) > 5) lastWall = nowW; // прыжок машины времени — без залпа событий
    lastEnv = env;
    if (VOICE_ON && Math.floor((lastWall - 25) / 3600) !== Math.floor((nowW - 25) / 3600)) announce(env); // :00:25 — после курантов, у всех одновременно
    for (const id of Object.keys(AUTO)) {
      const target = AUTO[id](env) * (sounds.bedScale?.[id] ?? 1) * (mix[id] ?? 1) * 0.5;
      city[id].gain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
    }
    for (const id of EVENTS) city[id].gain.gain.setTargetAtTime((mix[id] ?? 1) * (LOUD.has(id) ? calm : 1), ctx.currentTime, 0.1);
    const crossed = (sec) => { const a = lastWall, b = nowW; return Math.floor(a / sec) !== Math.floor(b / sec); };
    const t = ctx.currentTime + 0.05, h = l.getUTCHours(), m = l.getUTCMinutes();
    const day = env.sun.alt > -2;
    const dt = Math.min(5, Math.max(0, nowW - lastWall)); // сек сцены с прошлого тика
    const chance = (perMin) => Math.random() < (perMin / 60) * dt;
    if (current.weatherKind === 'storm' && crossed(6)) { // гром по общему со сценой расписанию молний
      const L = lightning(nowW);
      if (L.has) sfx.thunder(t + Math.max(0.1, L.delay - (nowW - L.slot * 6)), L.near);
    }
    sounds.tick?.(env, { t, h, m, day, chance, crossed, sfx, key: current.key }); // события города
    lastWall = nowW;
  }

  const api = {
    ctx, sfx: (name, ...a) => { ctx.resume(); if (name === 'announce') { if (lastEnv) announce(lastEnv, true); return; } sfx[name](ctx.currentTime + 0.05, ...a); },
    setSchedule(playlist) {
      const nightOnly = playlist.filter((t) => t.night);
      sched = buildSchedule(playlist.filter((t) => !t.night)); // ночные треки днём не звучат
      let slow = nightOnly.length >= 5 ? nightOnly : playlist.filter((t) => t.bpm && t.bpm <= 74);
      if (slow.length < 5 && playlist.some((t) => t.bpm)) slow = [...playlist].sort((a, b) => (a.bpm || 99) - (b.bpm || 99)).slice(0, Math.max(4, Math.round(playlist.length * 0.4)));
      schedNight = slow.length ? buildSchedule(slow) : null;
      lastKey = '';
    },
    play() { const r = ctx.resume(); playing = true; lastKey = ''; tick(); fade(musicBus.gain, api.musicVol, 1); return r; }, // без await: el.play() должен успеть внутри жеста
    pause() { playing = false; fade(musicBus.gain, 0, 0.6); setTimeout(() => { if (!playing) el.pause(); }, 700); fade(genIn.gain, 0, 0.6); },
    get playing() { return playing; },
    // звук реально идёт? Для автозапуска после перехода: браузер мог не дать включить его без жеста
    get blocked() { return playing && (ctx.state !== 'running' || blocked); },
    kick() { ctx.resume(); if (!playing) return; blocked = false; fileFailed = false; if (cur) cur.fallback = false; lastKey = ''; tick(); }, // вызывать внутри жеста
    musicVol: 0.8, cityVol: 0.7,
    setMusicVol(v) { api.musicVol = v; if (playing) fade(musicBus.gain, v, 0.2); },
    setCityVol(v) { api.cityVol = v; fade(cityBus.gain, v, 0.2); },
    setCalm(v) { calm = v; },
    setMix(m) { mix = m; },
    set onTrack(fn) { onTrack = fn; },
    set onSystemPause(fn) { onSystemPause = fn; }, // система поставила плеер на паузу при открытой странице
    announce(env) { ctx.resume(); announce(env, true); }, // «попробовать» в панели звуков
    update(env) { current.weatherKind = env.weather.kind; if (plan) current.key = plan.root; tick(); cityTick(env); },
    skip() { const n = segmentAt(schedFor(wallNow()), wallNow()); return n; },
    guitarBus,
    // 0 — звуки города как есть, 1 — глухо, будто через плотную штору (engine/day.js)
    setMuffle(k) { muffle.frequency.setTargetAtTime(20000 * Math.pow(500 / 20000, Math.max(0, Math.min(1, k))), ctx.currentTime, 0.4); },
    // Тональность и сетка долей того, что звучит сейчас: гитаре — аккорды в тон и удар в долю.
    // tone: { pc: 0–11, minor } или null; grid: { t0, P } — стенное время ближайшей опорной доли и период, или null (не подтягивать)
    pulse() {
      if (!playing || !cur) return { tone: null, grid: null };
      if (cur.seg.type === 'gen' || cur.fallback) return plan ? { tone: { pc: plan.root % 12, minor: plan.minor }, grid: { t0: cur.startWall, P: 60 / plan.bpm } } : { tone: null, grid: null };
      const m = /^([A-G])([#b]?)\s+(major|minor)/i.exec(cur.seg.tone || '');
      const tone = m ? { pc: ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12, minor: m[3].toLowerCase() === 'minor' } : null;
      // beat — время каждой 8-й доли (tools/music/add_beat.py): темп в треке плавает, долю считаем по ближайшему отрезку
      const B = cur.seg.beat, pos = Date.now() / 1000 - cur.startWall;
      if (!Array.isArray(B) || B.length < 2) return { tone, grid: null };
      let k = 0; while (k < B.length - 2 && B[k + 1] <= pos) k++;
      return { tone, grid: { t0: cur.startWall + B[k], P: (B[k + 1] - B[k]) / 8 } };
    },
  };
  cityBus.gain.value = api.cityVol;
  musicBus.gain.value = 0;
  return api;
}
