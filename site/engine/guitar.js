// Гитара у окна: клик — аккорд в тональности эфира, провести по струнам — перебор.
// Удар подтягивается к ближайшей восьмой эфира (сетка долей — playlist.json → beat, у вставок — свой темп),
// поэтому в такт попадает всегда. Ночью вместо боя — тихий перебор. Аккорд уходит по live-каналу
// слушателям этого же окна: у них звучит тот же аккорд (тональность у всех одна — эфир синхронный).
// В поезде гитара висит на крючке и чуть расстроена; город может поставить свою (skyline: GUITAR = 'uke' — укулеле).
// Пасхалка: на грифе тоника → субдоминанта → доминанта → тоника («три аккорда», Am–Dm–E–Am во дворе).

import { clamp, mixHex, rgb, hex } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const mulHex = (a, b) => { const A = rgb(a), B = rgb(b); return hex([A[0] * B[0] / 255, A[1] * B[1] / 255, A[2] * B[2] / 255]); };

// где и какая: у города со своим интерьером (машина) — нет; у поезда (полка вместо кресла) — на крючке
export function guitarKind(S) {
  if (S.NO_GUITAR || S.drawDesk) return null;
  if (S.drawSeat) return 'train';
  return GEO[S.GUITAR] ? S.GUITAR : 'room';
}
// опорная точка — низ корпуса; lean — наклон грифа (прислонена к стене справа), k — масштаб (укулеле меньше)
const GEO = {
  room: { bx: 461, by: 266, lean: 0.1, k: 1 },
  uke: { bx: 462, by: 266, lean: 0.08, k: 0.68 },
  train: { bx: 52, by: 204, lean: 0, k: 1 },
};
const H = 91; // высота от низа корпуса до верха головки при k = 1
export function guitarRect(kind) {
  const g = GEO[kind], h = Math.round(H * g.k), top = g.lean * h;
  return [Math.round(g.bx - 14 * g.k), g.by - h - 1, Math.round(28 * g.k + top + 2), h + 1];
}

const state = { vib: [0, 0, 0, 0, 0, 0] }; // когда щипнули каждую струну (для дрожи на рисунке)

// ---------- рисунок ----------
const COL = {
  room: { body: '#c27838', top: '#d9984e', edge: '#6a3818', neck: '#5c3418', board: '#2e1c12', fret: '#a89a84', head: '#3c2414' },
  uke: { body: '#d4a462', top: '#e6bf80', edge: '#7a5226', neck: '#8a5a2c', board: '#3a2616', fret: '#b4a68c', head: '#5a3a1c' },
};
COL.train = COL.room;

export function drawGuitar(ctx, env, dayF, t, S) {
  const kind = guitarKind(S);
  if (!kind) return;
  const g = GEO[kind], k = g.k, C = COL[kind];
  // свет комнаты: как у кота — тёплый вечером под лампой, холодный днём
  const tint = mixHex(env.lampOn ? '#a07a62' : '#6e6470', '#a4a2b4', dayF), mul = (c) => mulHex(c, tint);
  const sway = kind === 'train' ? Math.round(Math.sin(t * 0.9) * 0.6) : 0;
  const px = (x, y, w, h, col) => { // y вверх отрицательный; наклон — сдвиг по строкам
    ctx.fillStyle = mul(col);
    for (let r = 0; r < h; r++) {
      const yy = y + r;
      ctx.fillRect(Math.round(g.bx + x - yy * g.lean) + sway, g.by + yy, w, 1);
    }
  };
  const ell = (cy, rx, ry, col) => { for (let yy = -ry; yy <= ry; yy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / (ry + 0.4)) ** 2))); px(-hw, cy + yy, hw * 2 + 1, 1, col); } };
  const R = (v) => Math.max(1, Math.round(v * k));
  // корпус «восьмёркой»: нижняя дека шире верхней
  ell(-R(12), R(12) + 1, R(11) + 1, C.edge); ell(-R(29), R(9) + 1, R(8) + 1, C.edge);
  ell(-R(12), R(12), R(11), C.body); ell(-R(29), R(9), R(8), C.body);
  ell(-R(14), R(8), R(6), C.top); // блик деки
  ell(-R(24), R(3), R(3), '#1a100a'); // розетка
  px(-R(4), -R(9), R(8) + 1, 2, C.edge); // подставка
  // гриф, лады и головка с колками
  const n0 = -R(36), n1 = -R(82);
  px(-1, n1, 3, n0 - n1, C.board);
  for (let y = n1 + 4; y < n0; y += R(6)) px(-1, y, 3, 1, C.fret);
  px(-2, -Math.round(H * k), 5, Math.round(H * k) + n1, C.head);
  for (let y = -Math.round(H * k) + 1; y < n1; y += 3) { px(-3, y, 1, 1, '#c8c0b0'); px(3, y, 1, 1, '#c8c0b0'); }
  if (kind === 'train') { px(0, -Math.round(H * k) - 3, 1, 3, '#2a2020'); px(-1, -Math.round(H * k) - 4, 3, 1, '#8a8490'); } // шнурок на крючке под верхней полкой
  // струны: от подставки до головки; дрожат после щипка
  const now = performance.now() / 1000;
  for (let i = 0; i < 3; i++) { // на рисунке три линии — больше в 5 пикселей не влезает
    const v = Math.max(...state.vib.slice(i * 2, i * 2 + 2).map((s) => (s && now - s < 1.3 ? 1 - (now - s) / 1.3 : 0)));
    const off = v > 0.15 && ((t * 30) | 0) % 2 ? (i === 1 ? 0 : i === 0 ? -1 : 1) : 0;
    ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, v * 2);
    px(i - 1 + off, n1, 1, -R(9) - n1, '#e8e0cc');
    ctx.globalAlpha = 1;
  }
}

// ---------- звук: щипковая струна (Карплус — Стронг) ----------
const bufs = new Map();
function pluckBuf(actx, midi, cents, bright, dur) {
  const key = `${midi}:${cents | 0}:${bright}:${dur}`;
  if (bufs.has(key)) return bufs.get(key);
  const sr = actx.sampleRate, f = mtof(midi) * Math.pow(2, cents / 1200), N = sr / f - 0.5;
  const len = Math.round(sr * dur), b = actx.createBuffer(1, len, sr), d = b.getChannelData(0);
  const n0 = Math.floor(N), fr = N - n0, decay = Math.pow(0.0015, 1 / (dur * f)); // затухание ~60 дБ к концу буфера
  let lp = 0;
  for (let i = 0; i <= n0 + 1 && i < len; i++) { lp += bright * ((Math.random() * 2 - 1) - lp); d[i] = lp; } // щипок: шум, приглушённый у мягкой струны
  for (let i = n0 + 2; i < len; i++) {
    const a = d[i - n0 - 1], c = d[i - n0 - 2];
    const y = a + (c - a) * fr; // дробная задержка — строй без «плавания» на высоких струнах
    d[i] = decay * 0.5 * (y + d[i - n0 - 1]);
  }
  for (let i = 0; i < 64; i++) d[i] *= i / 64; // без щелчка в начале
  if (bufs.size > 24) bufs.delete(bufs.keys().next().value); // буфер струны ~0,5 МБ: держим только недавние аккорды
  bufs.set(key, b);
  return b;
}

// аккорд по ступени: 0 — тоника, 3 — субдоминанта, 4 — доминанта (в миноре мажорная, как во дворе: Am–Dm–E), 5 — VI
const DEG = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
function chord(tone, deg) {
  const scale = tone.minor ? DEG.minor : DEG.major;
  const root = (tone.pc + scale[deg]) % 12;
  const third = deg === 4 ? 4 : (scale[(deg + 2) % 7] - scale[deg] + 12) % 12, fifth = (scale[(deg + 4) % 7] - scale[deg] + 12) % 12;
  return { root, third, fifth };
}
function voicing(kind, ch) {
  if (kind === 'uke') { // четыре струны в одной октаве над до первой: укулеле звенит высоко
    const tones = [ch.root, ch.root + ch.third, ch.root + ch.fifth, ch.root + 12].map((m) => 60 + (m % 12));
    return tones.sort((a, b) => a - b);
  }
  const r = 40 + ((ch.root - 4 + 12) % 12); // бас от ми большой октавы
  return [r, r + ch.fifth, r + 12, r + 12 + ch.third, r + 12 + ch.fifth, r + 24];
}

export function createGuitar({ getAudio, kind, onJam, onEgg }) {
  const detune = Array.from({ length: 6 }, () => (kind === 'train' ? (Math.random() * 2 - 1) * 14 : (Math.random() * 2 - 1) * 2));
  const PROG = { major: [0, 4, 5, 3], minor: [0, 5, 2, 6] }; // бой по кругу: I–V–vi–IV и i–VI–III–VII
  let step = 0, last = { deg: 0 }, seq = [], filt = null, lastJam = 0;
  const dur = kind === 'uke' ? 1.3 : 2.4;
  function out(a) {
    if (filt && filt.context === a.ctx) return filt;
    const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'uke' ? 6000 : 4200;
    const body = a.ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = kind === 'uke' ? 380 : 190; body.Q.value = 1.2; body.gain.value = 4;
    lp.connect(body).connect(a.guitarBus);
    filt = lp;
    return lp;
  }
  function tone() { return getAudio()?.pulse?.().tone || { pc: 9, minor: true }; } // эфир молчит — ля минор
  // ближайшая восьмая эфира не раньше чем через 25 мс; если до неё дольше 0,22 с — ближайшая шестнадцатая (она всегда ближе)
  function when(a) {
    const g = a.pulse?.().grid, nowW = Date.now() / 1000, base = a.ctx.currentTime + 0.02;
    if (!g || !(g.P > 0.2)) return base;
    const nextOn = (sub) => g.t0 + Math.ceil((nowW + 0.025 - g.t0) / sub) * sub;
    let next = nextOn(g.P / 2);
    if (next - nowW > 0.22) next = nextOn(g.P / 4);
    return a.ctx.currentTime + (next - nowW);
  }
  function note(a, at, midi, i, vel) {
    const s = a.ctx.createBufferSource(), gn = a.ctx.createGain();
    s.buffer = pluckBuf(a.ctx, midi, detune[i] || 0, kind === 'uke' ? 0.7 : 0.5, dur);
    gn.gain.value = vel;
    s.connect(gn).connect(out(a));
    s.start(at); s.stop(at + dur);
    const ms = Math.max(0, (at - a.ctx.currentTime) * 1000);
    setTimeout(() => { state.vib[kind === 'uke' ? Math.min(5, i + 1) : i] = performance.now() / 1000; }, ms);
  }
  function play(deg, { soft = false, night = false } = {}) {
    const a = getAudio(); if (!a?.guitarBus) return;
    a.ctx.resume();
    const v = voicing(kind, chord(tone(), deg)), at = when(a), vol = (soft ? 0.45 : 1) * (night ? 0.5 : 1);
    if (night) { // ночью — перебор: бас, потом струны вверх-вниз по восьмым
      const g = a.pulse?.().grid, sub = g && g.P > 0.2 ? g.P / 2 : 0.3;
      const order = kind === 'uke' ? [0, 2, 1, 3, 2, 1] : [0, 3, 4, 5, 4, 3];
      order.forEach((i, j) => note(a, at + j * sub, v[i], i, (j ? 0.32 : 0.45) * vol));
    } else { // бой вниз: струны с разносом 14 мс, басовая громче
      v.forEach((m, i) => note(a, at + i * 0.014, m, i, (i ? 0.26 : 0.34) * vol));
    }
    last = { deg };
  }
  const isNight = (env) => { const h = env.local?.getUTCHours?.() ?? 12; return h >= 23 || h < 7; };
  let dragX = null, dragS = -1, dragged = false;
  const body = () => { const g = GEO[kind]; return { y: g.by - Math.round(36 * g.k), x0: g.bx - 12 * g.k, w: 24 * g.k, g }; };
  return {
    kind,
    // клик: по грифу — аккорд ступени по месту (у головки тоника, дальше IV, V, VI), по корпусу — следующий аккорд круга
    click(x, y, env) {
      const g = GEO[kind], n0 = g.by - Math.round(36 * g.k), n1 = g.by - Math.round(82 * g.k), night = isNight(env);
      let deg;
      if (y < n0) {
        const z = clamp(Math.floor((y - n1) / ((n0 - n1) / 4)), 0, 3);
        deg = [0, 3, 4, 5][z];
        seq = [...seq, deg].slice(-4);
        if (seq.join() === '0,3,4,0') { seq = []; onEgg?.(); }
      } else {
        const t = tone(); deg = PROG[t.minor ? 'minor' : 'major'][step++ % 4];
      }
      play(deg, { night });
      if (Date.now() - lastJam > 1500) { lastJam = Date.now(); onJam?.(deg); }
      return deg;
    },
    // провести по струнам: пересекли струну — щипок этой струны в аккорде, который звучал последним
    down(x) { dragX = x; dragS = -1; dragged = false; },
    move(x, y, env) {
      if (dragX == null) return false;
      const { x0, w, y: by } = body();
      if (y < by - 4) return dragged;
      const nStr = kind === 'uke' ? 4 : 6, s = clamp(Math.floor((x - x0) / (w / nStr)), 0, nStr - 1);
      if (s !== dragS && Math.abs(x - dragX) > 1.5) {
        dragS = s; dragX = x; dragged = true;
        const a = getAudio(); if (a?.guitarBus) {
          a.ctx.resume();
          const v = voicing(kind, chord(tone(), last.deg));
          note(a, a.ctx.currentTime + 0.01, v[s], s, (isNight(env) ? 0.18 : 0.3));
        }
      }
      return dragged;
    },
    up() { const d = dragged; dragX = null; dragged = false; return d; },
    // соседний слушатель подыграл: тот же аккорд, тише
    jam(deg, env) { play(clamp(deg | 0, 0, 6), { soft: true, night: isNight(env) }); },
  };
}
