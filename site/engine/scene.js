// Движок сцены: окно 480×270, всё рисуется кодом. Город подключается модулем skyline:
// палитры, дальний план, свои динамические слои. Движок: небо, облака, светила,
// огни окон, вода с отражениями, погода, интерьер, кот, гирлянда.

import { rng, clamp, smooth, mix, hex, mixHex, rgb, canvas, sprite, tinted } from './util.js';
import { W, H, HORIZON, SILL } from './const.js';
import { lightning, fogK } from './weather.js';
import { drawGuitar } from './guitar.js';
import { drawShelf } from './souvenirs.js';
import { drawGuest, seasonalItem, seasonalSprite } from './guests.js';
import { drawFrost } from './frost.js';
import { drawSecrets } from './street.js';
import { drawVan } from './marsokhod.js';
import { drawStars } from './stars.js';
import { corgiState, drawCorgi, yarnState, drawYarn } from './corgi.js';
export { W, H, HORIZON, SILL };

const ah = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'); // альфа в hex ('aa', '66'…)
let VIEW = { viewAzimuth: 0, fov: 110 }; // направление окна задаёт город
const CURTAIN_FAB = 60; // ширина полосы ткани штор, px

// ---------- кот Елисей: рисуется кодом, живёт по своему расписанию ----------
// Размер «буханки» ~46×22 px — в 3,5 раза длиннее стакана, как в жизни.
const CAT_COL = { fur: '#8a8490', furHi: '#a6a0ac', stripe: '#5e5866', belly: '#c4bec8', ear: '#d49a9a', nose: '#d88a8a', eyeL: '#c8d85a', pupil: '#16141a', line: '#2a2630', shadow: 'rgba(0,0,0,0.28)' };
function mulHex(a, b) { const A = rgb(a), B = rgb(b); return hex([A[0] * B[0] / 255, A[1] * B[1] / 255, A[2] * B[2] / 255]); }

// Что кот делает в момент t: сон по умолчанию, раз в ~30 с — случайное событие
export function catState(t, petAt, wakeAt = -99) {
  if (t - petAt < 5) return { mode: 'pet', k: (t - petAt) / 5 };
  if (t - wakeAt < 6) { const rel = t - wakeAt; return { mode: 'awake', look: 1, blink: (rel % 2.7) < 0.15, lift: Math.min(1, rel * 3, (6 - rel) * 3) }; } // полили герань — кот смотрит
  const slot = Math.floor(t / 30), r = rng(slot * 7919 + 13), ph = t - slot * 30;
  const roll = r(), at = 4 + r() * 18;
  const rel = ph - at;
  if (roll < 0.22 && rel >= 0 && rel < 0.5) return { mode: 'sleep', ear: true };
  if (roll >= 0.22 && roll < 0.45 && rel >= 0 && rel < 2.2) return { mode: 'sleep', tail: rel / 2.2 };
  if (roll >= 0.45 && roll < 0.62 && rel >= 0 && rel < 8) {
    const look = rel < 2 ? 0 : rel < 4 ? -1 : rel < 6 ? 1 : 0;
    return { mode: 'awake', look, blink: (rel % 2.7) < 0.15, lift: Math.min(1, rel * 3, (8 - rel) * 3) };
  }
  if (roll >= 0.62 && roll < 0.7 && rel >= 0 && rel < 3) return { mode: 'yawn', k: rel / 3, lift: Math.min(1, rel * 3, (3 - rel) * 3) };
  return { mode: 'sleep' };
}

function drawCat(g, x0, yBase, st, t, tint) {
  const C = {}; for (const k in CAT_COL) C[k] = k === 'shadow' ? CAT_COL[k] : mulHex(CAT_COL[k], tint);
  const P = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x0 + x, yBase + y, w, h); };
  const breath = Math.sin(t * 1.35) > 0 ? 1 : 0;
  const lift = Math.round((st.lift || (st.mode === 'pet' ? 1 : 0)) * 2);
  // тень
  P(C.shadow, 4, 0, 42, 1);
  // хвост: огибает лапы спереди, кончик шевелится
  const tailUp = st.mode === 'pet' ? 3 : st.tail != null ? Math.round(Math.sin(st.tail * Math.PI * 3) * 2) : 0;
  // тело-«буханка»: дышит
  const rows = [[20, 38], [16, 42], [14, 44], [13, 45], [13, 45], [13, 45], [13, 45], [13, 45], [13, 45], [14, 44], [14, 44], [15, 43], [16, 42]];
  rows.forEach(([a, b], i) => { const y = -16 + i - (i < 3 ? breath : 0); P(i < 2 ? C.furHi : C.fur, a, y, b - a, 1); });
  if (breath) P(C.furHi, 22, -17, 14, 1);
  for (const sx of [22, 27, 32, 37, 41]) P(C.stripe, sx, -15 - breath, 2, 5);
  P(C.belly, 14, -5, 8, 3); // грудка
  // пушистый полосатый хвост: лежит на столе за спиной, кончик загибается вверх и подрагивает
  P(C.shadow, 44, 0, 17, 1);
  // пушистый хвост лежит на столе: одинаково толстый, полосатый, с круглым тёмным концом; кончик чуть подрагивает
  const L = 18, tl = Math.max(0, tailUp);
  for (let i = 0; i < L; i++) {
    const x = 43 + i, end = L - 1 - i; // end: 0 — самый край
    const th = end === 0 ? 3 : end === 1 ? 5 : end === 2 ? 6 : 7, up = i > L - 6 ? Math.min(tl, 2) : 0;
    const y = -7 + Math.floor((7 - th) / 2) - up + (i < 2 ? -1 : 0);
    const dark = end < 4, band = !dark && i > 2 && i % 4 < 2;
    P(dark ? C.stripe : band ? C.stripe : C.fur, x, y, 1, th + (i < 2 ? 1 : 0));
    P(dark ? C.fur : band ? C.fur : C.furHi, x, y, 1, 1); // светлый верх — объём
    if (!dark) P(C.stripe, x, y + th - 1 + (i < 2 ? 1 : 0), 1, 1);
    if (i % 2 === 1 && end > 1) P(dark ? C.stripe : C.furHi, x, y - 1, 1, 1); // шерстинки сверху
    if (i % 3 === 0 && end > 1) P(dark ? C.line : C.stripe, x, y + th, 1, 1); // и снизу
  }
  // голова
  const hx = 2, hy = -13 - lift;
  const head = [[4, 10], [2, 12], [1, 13], [1, 13], [1, 13], [1, 13], [1, 13], [2, 12], [3, 11], [5, 9]];
  head.forEach(([a, b], i) => P(i < 2 ? C.furHi : C.fur, hx + a, hy + i, b - a, 1));
  P(C.stripe, hx + 5, hy, 1, 3); P(C.stripe, hx + 8, hy, 1, 3); // полоски на лбу
  // уши (одно подёргивается)
  const earShift = st.ear ? -1 : 0;
  P(C.fur, hx + 1, hy - 3, 3, 3); P(C.fur, hx + 2, hy - 4, 1, 1); P(C.ear, hx + 2, hy - 2, 1, 2);
  P(C.fur, hx + 10 + earShift, hy - 3 + earShift, 3, 3); P(C.fur, hx + 11 + earShift, hy - 4 + earShift, 1, 1); P(C.ear, hx + 11 + earShift, hy - 2 + earShift, 1, 2);
  // морда
  const ey = hy + 5, lx = hx + 3, rx = hx + 9;
  if (st.mode === 'awake' && !st.blink) {
    const look = st.look || 0;
    P(C.eyeL, lx, ey - 1, 2, 2); P(C.eyeL, rx, ey - 1, 2, 2);
    P(C.pupil, lx + (look > 0 ? 1 : 0), ey - 1, 1, 2); P(C.pupil, rx + (look > 0 ? 1 : 0), ey - 1, 1, 2);
  } else if (st.mode === 'pet') { // довольный «^^»
    P(C.line, lx, ey, 1, 1); P(C.line, lx + 1, ey - 1, 1, 1); P(C.line, lx + 2, ey, 1, 1);
    P(C.line, rx, ey, 1, 1); P(C.line, rx + 1, ey - 1, 1, 1); P(C.line, rx + 2, ey, 1, 1);
  } else { P(C.line, lx, ey, 3, 1); P(C.line, rx, ey, 3, 1); } // спит
  P(C.nose, hx + 6, ey + 2, 2, 1);
  if (st.mode === 'yawn') { const o = Math.round(Math.sin(st.k * Math.PI) * 2); if (o > 0) { P(C.line, hx + 5, ey + 3, 4, o + 1); P(C.ear, hx + 6, ey + 3 + o, 2, 1); } }
  // лапки
  P(C.belly, 3, -2, 5, 2); P(C.belly, 9, -2, 5, 2);
  P(C.stripe, 5, -1, 1, 1); P(C.stripe, 11, -1, 1, 1);
}

// ---------- небо ----------
// [высота Солнца, цвет зенита, цвет горизонта]
const SKY = [
  [-90, '#04060f', '#0a0f24'],
  [-18, '#060a1c', '#121a3a'],
  [-12, '#0d1536', '#282c58'],
  [-8, '#18245a', '#5e4c7e'],
  [-4, '#2b3e7a', '#c9787a'],
  [0, '#40609c', '#f0a06e'],
  [5, '#4d7bbf', '#f3c48e'],
  [15, '#4886d0', '#a9d0ee'],
  [90, '#3c7ccf', '#9cc6ef'],
];
function skyColors(alt) {
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const [a0, z0, h0] = SKY[i - 1], [a1, z1, h1] = SKY[i];
      const t = (alt - a0) / (a1 - a0);
      return [mix(z0, z1, t), mix(h0, h1, t)];
    }
  }
  return [rgb(SKY[SKY.length - 1][1]), rgb(SKY[SKY.length - 1][2])];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.5);

export function azToX(az) {
  const d = ((az - VIEW.viewAzimuth + 540) % 360) - 180;
  return W / 2 + (d / (VIEW.fov / 2)) * (W / 2);
}
const altToY = (alt) => HORIZON - (alt / 48) * HORIZON;

export function createScene(el, city) {
  const S = city.skyline; VIEW = city.config;
  const frostSeed = [...(city.config.id || 'x')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0; // у каждого окна свой узор
  el.width = W; el.height = H;
  const ctx = el.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const [bg, b] = canvas(W, HORIZON);
  const [skyC, skyCtx] = canvas(W, HORIZON);
  let skyKey = '', farKey = '', far = null, clouds = [], cloudKey = '', skyAt = 0, cloudAt = 0;
  let flashSeen = -1; // последняя показанная вспышка молнии (slot*4+i): на медленном кадре не пропускаем её
  let skyHorizon = [40, 50, 80], skyZenith = [10, 15, 30];
  const lights = [];
  const interior = S.drawDesk ? null : buildInterior(); // город с S.drawDesk рисует низ окна сам (салон машины)

  // ---------- небо ----------
  function buildSky(env) {
    const { sun, weather } = env;
    const [zen, hor] = skyColors(sun.alt);
    const over = clamp((weather.cloud - 40) / 60) * 0.85 + (weather.kind === 'fog' ? 0.3 : 0);
    const gray = mix('#171a22', '#a3a9b2', smooth(-6, 10, sun.alt));
    const Z = mix(zen, gray, clamp(over)), Hc = mix(hor, mix(gray, hor, 0.35), clamp(over));
    skyZenith = Z; skyHorizon = Hc;
    const sx = azToX(sun.az);
    const glow = sun.alt > -14 && sun.alt < 10 ? (1 - Math.abs(sun.alt + 2) / 12) * (1 - over * 0.8) : 0;
    const img = skyCtx.createImageData(W, HORIZON);
    const warm = rgb('#ff9a5c');
    for (let y = 0; y < HORIZON; y++) {
      const t = Math.pow(y / (HORIZON - 1), 1.4);
      const base = mix(Z, Hc, t);
      for (let x = 0; x < W; x++) {
        let c = base;
        if (glow > 0) {
          const g = glow * Math.exp(-(((x - sx) / 170) ** 2)) * Math.exp(-(HORIZON - y) / 55);
          if (g > 0.01) c = mix(c, warm, clamp(g));
        }
        const d = BAYER[(y & 3) * 4 + (x & 3)];
        const i = (y * W + x) * 4;
        img.data[i] = Math.round(c[0] / 6 + d) * 6;
        img.data[i + 1] = Math.round(c[1] / 6 + d) * 6;
        img.data[i + 2] = Math.round(c[2] / 6 + d) * 6;
        img.data[i + 3] = 255;
      }
    }
    skyCtx.putImageData(img, 0, 0);
  }

  function buildClouds(env) {
    const { sun, weather } = env;
    const dayF = smooth(-7, 4, sun.alt);
    const tw = sun.alt > -10 && sun.alt < 6 ? 0.3 : 0;
    const base = mix(mix('#262b40', '#eef1f6', dayF), skyHorizon, tw);
    const heavy = weather.cloud > 75 || ['rain', 'storm', 'snow'].includes(weather.kind);
    const light = heavy ? mix(base, mix('#1c1f28', '#8a909a', dayF), 0.7) : base;
    const shade = mix(light, skyZenith, 0.35);
    const hi = mix(light, '#ffffff', 0.25 * dayF);
    const n = Math.round(clamp(weather.cloud / 100) * 11);
    const r = rng(42);
    clouds = [];
    for (let i = 0; i < 11; i++) {
      const w = 40 + ((r() * 70) | 0), h = 10 + ((r() * 10) | 0);
      const [c, g] = canvas(w, h + 2);
      const puffs = 4 + ((r() * 4) | 0);
      for (let pass = 0; pass < 3; pass++) {
        g.fillStyle = hex([shade, light, hi][pass]);
        for (let p = 0; p < puffs; p++) {
          const pr = rng(i * 100 + p);
          const cx = 6 + pr() * (w - 12), rad = 3 + pr() * (h / 2);
          const cy = h - rad + 1 - pass * 1.2;
          for (let yy = -rad; yy <= rad; yy++) {
            const hw = Math.sqrt(rad * rad - yy * yy);
            const y0 = Math.round(cy + yy);
            if (y0 > h - pass) continue;
            g.fillRect(Math.round(cx - hw), y0, Math.round(hw * 2), 1);
          }
        }
      }
      clouds.push({ c, w, y: 14 + r() * 92, x0: r() * 600, sp: 0.6 + r() * 0.8, on: i < n });
    }
  }

  // ---------- дальний план: силуэт рисует город ----------
  function drawFar(g, P, winter, collect) {
    const r = rng(1703);
    const L = (x, y, kind, color, thr) => collect && lights.push({ x, y, kind, color, thr: thr ?? r(), ph: r() * 6.28 });
    const R = (c, x, y, w, h) => { g.fillStyle = P[c] || c; g.fillRect(x, y, w, h); };
    S.drawFar({ g, P, winter, r, L, R });
  }

  function buildFar(winter, autumn) {
    lights.length = 0;
    const { DAY, NIGHT, AUTUMN, WINTER } = S.PALETTE;
    const variants = [DAY, NIGHT].map((P, i) => {
      const extra = winter ? (i ? WINTER.night : WINTER.day) : autumn ? (i ? AUTUMN.night : AUTUMN.day) : {};
      const [c, g] = canvas(W, HORIZON);
      drawFar(g, { ...P, ...extra }, winter, i === 0);
      return c;
    });
    far = { day: variants[0], night: variants[1] };
  }

  // ---------- динамические элементы над горизонтом ----------

  function drawLights(g, env, dayF, t) {
    const nightF = 1 - dayF;
    if (nightF < 0.05) return;
    const h = env.local.getUTCHours() + env.local.getUTCMinutes() / 60;
    // доля горящих окон: вечером много, к 4 утра мало
    const occ = h >= 17 ? 0.75 : h < 1 ? 0.55 : h < 5 ? 0.18 + (5 - h) * 0.05 : h < 9 ? 0.35 : 0.3;
    for (const l of lights) {
      if (l.kind === 'win') {
        if (l.thr > occ) continue;
        g.globalAlpha = nightF * (0.75 + 0.25 * Math.sin(t * 0.3 + l.ph));
        g.fillStyle = l.thr < 0.15 ? '#9fc4ff' : '#ffcf7a';
        g.fillRect(l.x, l.y, 1, 1);
      } else if (l.kind === 'lamp') {
        g.globalAlpha = nightF; g.fillStyle = l.color; g.fillRect(l.x, l.y, 1, 1);
        g.globalAlpha = nightF * 0.25; g.fillRect(l.x - 1, l.y - 1, 3, 3);
        const fk = fogK(env.weather.kind, env.weather.vis);
        if (fk > 0.3) { // нимб в тумане — как у прожекторов
          const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, 7);
          grad.addColorStop(0, l.color); grad.addColorStop(1, l.color + '00');
          g.globalAlpha = 0.35 * fk * nightF; g.fillStyle = grad; g.fillRect(l.x - 8, l.y - 8, 17, 17);
        }
      } else if (l.kind === 'flood') {
        const grad = g.createRadialGradient(l.x, l.y, 1, l.x, l.y - 10, 26);
        grad.addColorStop(0, l.color + '55'); grad.addColorStop(1, l.color + '00');
        g.globalAlpha = nightF; g.fillStyle = grad; g.fillRect(l.x - 30, l.y - 40, 60, 46);
      } else if (l.kind === 'red') {
        g.globalAlpha = (Math.sin(t * 2.4) > 0 ? 1 : 0.25) * Math.max(nightF, 0.3);
        g.fillStyle = l.color; g.fillRect(l.x, l.y, 1, 1);
      }
    }
    g.globalAlpha = 1;
    S.drawNight?.(g, env, nightF, t); // городская подсветка (у Питера — Лахта и телебашня)
  }

  function drawGulls(g, t, dayF) {
    if (dayF < 0.5) return;
    g.fillStyle = '#3a3e48';
    for (let i = 0; i < 3; i++) {
      const x = Math.round(((t * (9 + i * 3) + i * 170) % 560) - 40), y = Math.round(70 + i * 16 + Math.sin(t * 0.6 + i) * 6);
      const up = Math.sin(t * 8 + i * 2) > 0;
      g.fillRect(x, y + (up ? 0 : 1), 1, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + 2, y + 2, 1, 1);
      g.fillRect(x + 3, y + 1, 1, 1); g.fillRect(x + 4, y + (up ? 0 : 1), 1, 1);
    }
  }

  // ---------- вода ----------
  function drawWater(env, dayF, t) {
    const frozen = env.frozen;
    const waterCol = mix(skyHorizon, '#081020', 0.62);
    if (frozen) {
      const ice = mix('#26304a', '#cdd9e4', dayF);
      ctx.fillStyle = hex(ice); ctx.fillRect(0, HORIZON, W, SILL - HORIZON);
      const r = rng(99);
      ctx.fillStyle = hex(mix(ice, '#ffffff', 0.35));
      for (let i = 0; i < 60; i++) ctx.fillRect((r() * W) | 0, HORIZON + ((r() * 64) | 0), 4 + ((r() * 20) | 0), 1);
      ctx.fillStyle = hex(mix(ice, '#5a6a80', 0.45));
      for (let i = 0; i < 18; i++) { let x = r() * W, y = HORIZON + r() * 60; for (let k = 0; k < 14; k++) { ctx.fillRect(x | 0, y | 0, 1, 1); x += 1; y += r() < 0.5 ? 0 : r() < 0.5 ? 1 : -1; } }
      return;
    }
    const calm = clamp(1.4 - env.weather.wind / 8, 0.4, 1.2);
    for (let y = HORIZON; y < SILL; y++) {
      const d = y - HORIZON;
      const src = Math.max(0, Math.round(HORIZON - 1 - d * 1.55));
      const dx = Math.round(Math.sin(t * 1.4 + y * 0.8) * (0.6 + d * 0.035) / calm);
      ctx.drawImage(bg, 0, src, W, 1, dx, y, W, 1);
    }
    ctx.globalAlpha = 0.5; ctx.fillStyle = hex(waterCol); ctx.fillRect(0, HORIZON, W, SILL - HORIZON);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#05070d'; ctx.fillRect(0, HORIZON, W, 2);
    // рябь
    const r = rng(5);
    const rip = hex(mix(skyHorizon, '#ffffff', 0.25));
    for (let i = 0; i < 70; i++) {
      const y = HORIZON + 3 + ((r() * 60) | 0), len = 2 + ((r() * 8) | 0) + ((y - HORIZON) >> 3);
      const x = ((r() * W + t * (4 + r() * 6)) % (W + 20)) - 10;
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 2 + i);
      ctx.fillStyle = rip; ctx.fillRect(Math.round(x), y, len, 1);
    }
    // капли дождя по воде
    if (env.weather.kind === 'rain' || env.weather.kind === 'storm') {
      ctx.fillStyle = rip;
      for (let i = 0; i < 30; i++) {
        const rr = rng(Math.floor(t * 3) * 31 + i);
        ctx.globalAlpha = 0.4; ctx.fillRect((rr() * W) | 0, HORIZON + 4 + ((rr() * 58) | 0), 2, 1);
      }
    }
    // утренняя дымка у воды: видимость упала, но до тумана не дотянула
    { const h = env.local.getUTCHours();
      if (env.weather.kind !== 'fog' && env.weather.vis < 7000 && h >= 4 && h < 10) {
        const kf = clamp((7000 - env.weather.vis) / 6000, 0, 1), mcol = hex(mix(skyHorizon, '#c8ccd4', 0.5));
        ctx.fillStyle = mcol;
        for (let i = 0; i < 3; i++) {
          const x = ((t * 3 + i * 160) % (W + 120)) - 60;
          ctx.globalAlpha = 0.25 * kf * (1 - i * 0.25);
          ctx.fillRect(Math.round(x), HORIZON + 3 + i * 6, 100 + i * 30, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- суда ----------

  // ---------- погода за окном ----------
  function drawPrecip(env, t) {
    const k = env.weather.kind;
    if (k === 'rain' || k === 'storm') {
      const n = Math.round(clamp(env.weather.precip * 70, 60, 240));
      const slant = clamp(env.weather.wind * 0.06, 0.05, 0.5);
      ctx.fillStyle = '#b4c2da';
      for (let i = 0; i < n; i++) {
        const r = rng(i * 13 + 1), sp = 240 + r() * 90;
        const y = (r() * 260 + t * sp) % 260 - 20, x = (r() * (W + 60) - y * slant) ;
        ctx.globalAlpha = 0.18 + r() * 0.22;
        for (let s = 0; s < 6; s++) ctx.fillRect(Math.round(x + s * slant), Math.round(y + s), 1, 1);
      }
      ctx.globalAlpha = 1;
    } else if (k === 'snow') {
      const wt = env.weather, gust = wt.gust ?? wt.wind * 1.5;
      const bliz = gust >= 10 || wt.wind >= 8; // метель
      const drift = !bliz && gust >= 6; // позёмка
      const wet = wt.temp > 0 && wt.temp < 3; // мокрый снег
      ctx.fillStyle = '#f2f4fa';
      for (let i = 0; i < (bliz ? 230 : 180); i++) {
        const r = rng(i * 7 + 3), sp = (wet ? 30 : 14) + r() * 22;
        const y = (r() * 250 + t * sp) % 250 - 10, x = (r() * W + Math.sin(t * 0.8 + i) * 6 + t * (wt.wind + gust * 0.35)) % W;
        ctx.globalAlpha = 0.5 + r() * 0.5;
        if (bliz) ctx.fillRect(Math.round(x), Math.round(y), 3 + ((r() * 2) | 0), 1); // штрихи почти горизонт
        else { const big = r() < (wet ? 0.5 : 0.2); ctx.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1); }
      }
      if (drift || bliz) { // позёмка: белые змейки у самой земли, над подоконником
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 10; i++) {
          const r = rng(i * 31 + 7), y = 209 + ((r() * 5) | 0), len = 30 + ((r() * 31) | 0), amp = 1 + r();
          const x = (t * (18 + gust) + i * 500) % (W + 60) - 30;
          ctx.globalAlpha = 0.5;
          for (let s = 0; s < len; s++) ctx.fillRect(Math.round(x + s), Math.round(y + Math.sin(t * 3 + s * 0.3 + i) * amp), 1, 1);
        }
      }
      if (wet) { // каша на внешнем крае подоконника
        ctx.globalAlpha = 0.6; ctx.fillStyle = hex(mix('#f2f4fa', skyHorizon, 0.4)); ctx.fillRect(0, 212, W, 2);
        const r = rng((t * 2 | 0) * 13 + 1); ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) if (r() < 0.7) { ctx.globalAlpha = 0.4 + r() * 0.5; ctx.fillRect((r() * W) | 0, 212 + ((r() * 2) | 0), 1, 1); }
      }
      if (bliz) { // серая завеса метели — как у тумана, но ниже и слабее
        const va = clamp((8000 - wt.vis) / 8000, 0, 0.35);
        if (va > 0) { ctx.globalAlpha = va; ctx.fillStyle = hex(mix(skyHorizon, '#9aa0a8', 0.4)); ctx.fillRect(0, 0, W, SILL); }
      }
      ctx.globalAlpha = 1;
    }
    if (k === 'fog') {
      const fk = fogK(k, env.weather.vis);
      if (fk >= 0.15) { // лёгкая дымка — только полосы у воды (их рисует drawWater)
        const gcol = hex(mix(skyHorizon, '#9aa0a8', 0.4));
        const grad = ctx.createLinearGradient(0, 60, 0, SILL);
        grad.addColorStop(0, gcol + '00'); grad.addColorStop(0.45, gcol + ah(170 * fk)); grad.addColorStop(1, gcol + ah(102 * fk));
        ctx.fillStyle = grad; ctx.fillRect(0, 60, W, SILL - 60);
      }
    }
    if (k === 'storm') {
      const L = lightning(t);
      if (L.has) for (let i = 0; i < L.flashes; i++) {
        const f0 = i * 0.12, id = L.slot * 4 + i;
        // вспышка 0,08 с; если кадр её перепрыгнул (медленный телефон, фоновая вкладка) — показать хотя бы одним кадром до 0,5 с
        const late = L.ph >= f0 + 0.08 && L.ph < f0 + 0.5 && flashSeen < id;
        if (L.ph < f0 || (L.ph >= f0 + 0.08 && !late)) continue;
        flashSeen = Math.max(flashSeen, id);
        ctx.globalAlpha = late ? 0.3 : 0.45 * (1 - (L.ph - f0) / 0.08); ctx.fillStyle = '#e8ecff'; ctx.fillRect(0, 0, W, SILL);
        if (i === 0) { // зигзаг из L.x: основной канал и ветка — второй проход короче и светлее
          const r = rng(L.slot * 17 + 3);
          for (const [end, col, al] of [[150, '#ffffff', 1], [80, '#dfe6ff', 0.65]]) {
            ctx.globalAlpha = al; ctx.fillStyle = col;
            let x = L.x, y = 10;
            while (y < end) { ctx.fillRect(Math.round(x), y, 1, 3); y += 3; x += (r() - 0.5) * 5; }
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- интерьер: стол у окна, лампа, проигрыватель, кресло-качалка ----------
  function buildInterior() {
    const [c, gBase] = canvas(W, H), [cf, gFront] = canvas(W, H);
    let g = gBase; // задний слой (стена, подоконник, рама) → шторы рисуются вживую → передний (герань, стол, предметы)
    const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // стена и пол слева, под окном
    R('#3e302e', 0, SILL + 8, W, 40);
    for (let x = 2; x < W; x += 6) for (let y = SILL + 12; y < 262; y += 6) R('#473735', x + ((y / 6) % 2) * 3, y, 1, 1);
    R('#2c1e16', 0, 256, 96, 14);
    for (let x = 0; x < 96; x += 16) R('#241812', x, 256, 1, 14);
    // подоконник
    R('#dcd6ca', 0, SILL, W, 6); R('#f0ebe0', 0, SILL, W, 1); R('#b4aea2', 0, SILL + 6, W, 2);
    // рама и карниз
    R('#d9d4c8', 0, 0, W, 5); R('#b5b0a4', 0, 4, W, 1);
    R('#a08050', 0, 2, W, 2); R('#c8a060', 0, 2, W, 1);
    // Ткань штор — полоса со складками; в кадре её растягивают по ширине строки (подхвачена — узко, задёрнута — широко)
    const [fab, gf] = canvas(CURTAIN_FAB, 1);
    const pal = ['#7a3e46', '#8e4a52', '#a35c62', '#6a343c'];
    for (let i = 0; i < CURTAIN_FAB; i++) { const fold = Math.floor(i / 3) % 4; gf.fillStyle = i === CURTAIN_FAB - 1 ? pal[3] : pal[fold === 3 ? 1 : fold]; gf.fillRect(i, 0, 1, 1); }
    const [fabR, gr] = canvas(CURTAIN_FAB, 1); gr.translate(CURTAIN_FAB, 0); gr.scale(-1, 1); gr.drawImage(fab, 0, 0);
    g = gFront;

    // на подоконнике: герань и сувенир города
    if (!S.NO_GERANIUM) {
      const gx = 404, gy = SILL + 2;
      R('#c0643a', gx - 1, gy - 12, 15, 2); R('#e08050', gx - 1, gy - 12, 15, 1);
      for (let i = 0; i < 10; i++) { R('#a8522e', gx + (i >> 2), gy - 10 + i, 13 - (i >> 1), 1); R('#8a4226', gx + 10 - (i >> 2), gy - 10 + i, 2, 1); }
      for (const [x, y, r] of [[gx - 3, gy - 20, 5], [gx + 5, gy - 24, 6], [gx + 13, gy - 20, 5], [gx + 1, gy - 28, 4], [gx + 11, gy - 29, 4]]) for (let yy = -r; yy <= r; yy++) { const hw = Math.round(Math.sqrt(r * r - yy * yy)); R(yy < 0 ? '#5a8a42' : '#3f6630', x - hw, y + yy, hw * 2, 1); }
    }
    // цветы герани рисуются вживую (drawGeranium): их число — сколько раз за день герань поливали все в этом городе

    S.drawSill?.(R, SILL);

    // стол
    const DT = 226;
    R('#5e3620', 92, DT, W - 92, 16);
    for (let y = DT + 2; y < DT + 16; y += 3) for (let x = 94; x < W; x += 23) R('#6a3e26', x + (y % 7), y, 12, 1);
    R('#7a4a2c', 92, DT, W - 92, 1);
    R('#44261a', 92, DT + 16, W - 92, 5); R('#5a3420', 92, DT + 16, W - 92, 1);
    R('#3a2014', 92, DT + 21, W - 92, 270 - DT - 21);
    for (const [x, w] of [[104, 120], [236, 110], [358, 110]]) { R('#452818', x, DT + 25, w, 17); R('#2e1a10', x, DT + 41, w, 1); R('#c8a050', x + (w >> 1) - 5, DT + 32, 10, 2); R('#e8c878', x + (w >> 1) - 5, DT + 32, 10, 1); }

    // лампа с зелёным абажуром
    const lx = 122;
    R('#8a6a30', lx - 13, DT + 7, 26, 5); R('#c8a050', lx - 13, DT + 7, 26, 1); R('#6a4e20', lx - 13, DT + 11, 26, 1);
    R('#b08a40', lx - 1, 212, 3, 22); R('#d8b060', lx - 1, 212, 1, 22);
    [[24, 0], [28, 1], [30, 2], [32, 3], [32, 4], [32, 5], [32, 6], [30, 7]].forEach(([w, i]) => { R(i < 2 ? '#3fa072' : '#1f6a4a', lx - (w >> 1), 202 + i, w, 1); R('#15503a', lx + (w >> 1) - 3, 202 + i, 3, 1); });
    R('#e8c060', lx - 1, 200, 3, 2);
    R('#c8a050', lx - 16, 210, 32, 1);

    // проигрыватель: светлый деревянный корпус, верхняя панель и лицевая с ручками
    const px = 168;
    R('#3a2416', px + 1, DT + 14, 52, 1); // тень на столе
    R('#b07a48', px, DT - 3, 52, 11); R('#c89060', px, DT - 3, 52, 1); R('#9a6a3e', px + 51, DT - 3, 1, 11);
    R('#2e2a2c', px + 2, DT - 1, 34, 8); // тёмная деку под диском
    R('#7a4a2a', px, DT + 8, 52, 6); R('#8a5a34', px, DT + 8, 52, 1);
    R('#d8ccb0', px + 38, DT + 10, 3, 2); R('#d8ccb0', px + 44, DT + 10, 3, 2); // ручки
    R('#2a1a10', px + 3, DT + 14, 3, 1); R('#2a1a10', px + 46, DT + 14, 3, 1); // ножки
    R('#8a8e98', px + 44, DT - 2, 4, 4); R('#c8ccd4', px + 44, DT - 2, 4, 1); // стойка тонарма
    R('#6a6e78', px + 40, DT + 3, 3, 3); // переключатель скорости
    // конверт от пластинки
    R('#2f5a8a', 242, DT + 6, 24, 5); R('#e8d8a8', 250, DT + 7, 8, 3); R('#3f6a9a', 242, DT + 6, 24, 1);

    // тетрадь с ручкой
    R('#e8e0cc', 268, DT + 5, 32, 7); R('#d0c8b4', 283, DT + 5, 2, 7);
    for (let y = DT + 7; y < DT + 12; y += 2) { R('#b8c4d8', 270, y, 11, 1); R('#b8c4d8', 287, y, 11, 1); }
    R('#2a3a6a', 272, DT + 3, 16, 1); R('#c8a050', 287, DT + 3, 2, 1);

    // стакан в подстаканнике
    const tx = 306, tb = DT + 10;
    R('#d8e4ec', tx + 1, tb - 23, 11, 1); R('#9ab0bc', tx + 1, tb - 22, 1, 10); R('#9ab0bc', tx + 11, tb - 22, 1, 10);
    R('#a8501a', tx + 2, tb - 20, 9, 8); R('#d0782a', tx + 2, tb - 20, 2, 8); R('#c86a24', tx + 2, tb - 20, 9, 1);
    R('#c8ccd4', tx, tb - 13, 13, 2); R('#e8ecf2', tx, tb - 13, 13, 1);
    for (let y = tb - 11; y < tb - 3; y++) for (let x = tx + 1; x < tx + 12; x++) R(((x + y) % 3 === 0) ? '#8a8e98' : '#bcc0c8', x, y, 1, 1);
    R('#aeb2ba', tx - 1, tb - 3, 15, 3); R('#d8dce2', tx - 1, tb - 3, 15, 1);
    R('#bcc0c8', tx + 13, tb - 11, 3, 1); R('#bcc0c8', tx + 15, tb - 10, 1, 6); R('#bcc0c8', tx + 13, tb - 5, 3, 1);
    R('#c8ccd4', tx + 8, tb - 28, 1, 8); R('#e0e4ea', tx + 7, tb - 29, 2, 2);

    // книги
    R('#2f4a6a', 324, DT + 6, 28, 5); R('#e8e0cc', 350, DT + 7, 2, 3); R('#3f5a7a', 324, DT + 6, 28, 1);
    R('#7a2f2f', 326, DT + 2, 24, 4); R('#e8e0cc', 348, DT + 3, 2, 2); R('#8f3f3f', 326, DT + 2, 24, 1);
    R('#3f6a4a', 328, DT - 2, 20, 4); R('#e8e0cc', 346, DT - 1, 2, 2); R('#c8a050', 332, DT - 1, 8, 1);

    const chair = buildChair();
    return {
      day: tinted(c, '#a4a2b4'), night: tinted(c, '#9a7866'),
      frontDay: tinted(cf, '#a4a2b4'), frontNight: tinted(cf, '#9a7866'),
      fabL: [tinted(fab, '#9a7866'), tinted(fab, '#a4a2b4')], fabR: [tinted(fabR, '#9a7866'), tinted(fabR, '#a4a2b4')],
      chairDay: tinted(chair, '#a4a2b4'), chairNight: tinted(chair, '#9a7866'),
    };
  }

  // Кресло-качалка сбоку, с клетчатым пледом и вязаной подушкой. 100×130, опора — низ по центру.
  function buildChair() {
    const [c, g] = canvas(100, 130);
    const P = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
    const line = (x0, y0, x1, y1, th, col, hi) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; P(col, x, y, th, th); if (hi) P(hi, x, y, 1, 1); }
    };
    const wood = '#4e2e1c', woodHi = '#7a4a2a';
    for (let x = 2; x < 98; x++) { const k = (x - 50) / 48, y = 118 + k * k * 8; P(wood, x, y, 1, 4); P(woodHi, x, y); }
    line(24, 118, 12, 14, 4, wood, woodHi); // задняя стойка
    line(70, 84, 74, 118, 4, wood, woodHi); // передняя ножка
    line(26, 118, 30, 88, 3, wood); // задняя ножка
    line(20, 86, 78, 82, 5, wood, woodHi); // сиденье
    line(16, 54, 82, 58, 3, wood, woodHi); // подлокотник
    line(76, 60, 74, 84, 3, wood);
    // вязаная подушка
    for (let y = 70; y < 83; y++) for (let x = 30; x < 72; x++) { if ((x - 30) * (x - 72) / 441 + (y - 70) * (y - 83) / 42 > 0) continue; P(((x + y) % 4 < 2) ? '#d8b878' : '#c4a060', x, y); }
    // плед: переброшен через спинку
    const plaid = (x, y) => {
      let col = '#a8382e';
      if (x % 10 < 4) col = '#7a2a28';
      if (y % 10 < 4) col = x % 10 < 4 ? '#2e4a3a' : '#8a2e2a';
      if (x % 10 === 7 || y % 10 === 7) col = '#e8d8b0';
      return col;
    };
    for (let y = 8; y < 97; y++) {
      const left = y < 30 ? 6 - (y - 8) * 0.1 : 4, right = y < 20 ? 22 + (y - 8) : y < 70 ? 34 - (y - 20) * 0.1 : 30 + (y - 70) * 0.5;
      for (let x = Math.round(left); x < Math.round(right); x++) P(plaid(x, y), x, y);
      if (y > 30) P('#5a1c1a', Math.round(right) - 1, y);
    }
    for (let x = 6; x < 50; x += 3) P('#e8d8b0', x, 96 + (x % 2), 1, 3); // бахрома
    return c;
  }

  function drawGarland(env, t) {
    if (!env.garland || S.NO_GARLAND) return;
    const nightF = 1 - smooth(-7, 4, env.sun.alt);
    const cols = ['#ffb347', '#ff7a5e', '#ffd86b', '#9ee0a8', '#ffe8b0'];
    const y = (x) => 7 + Math.sin(Math.PI * (((x - 30) % 140) / 140)) * 7;
    ctx.fillStyle = '#3a3026';
    for (let x = 30; x < 452; x++) ctx.fillRect(x, Math.round(y(x)), 1, 1);
    for (let i = 0, x = 36; x < 450; x += 12, i++) {
      const yy = Math.round(y(x)) + 1, tw = 0.6 + 0.4 * Math.sin(t * 1.7 + i * 1.3);
      const col = cols[i % cols.length];
      if (nightF > 0.1) {
        const grad = ctx.createRadialGradient(x, yy + 2, 0, x, yy + 2, 9);
        grad.addColorStop(0, col + '66'); grad.addColorStop(1, col + '00');
        ctx.globalAlpha = nightF * tw; ctx.fillStyle = grad; ctx.fillRect(x - 9, yy - 7, 18, 18);
      }
      ctx.globalAlpha = 0.55 + 0.45 * tw * Math.max(nightF, 0.35);
      ctx.fillStyle = col; ctx.fillRect(x, yy, 2, 3);
      ctx.globalAlpha = 1; ctx.fillStyle = '#2a241c'; ctx.fillRect(x, yy - 1, 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Герань: соцветий тем больше, чем чаще её сегодня поливали (bloom 0..1); при поливе — капли
  const GER = [[405, 182], [415, 179], [421, 187], [409, 175], [399, 186], [418, 172]];
  function drawGeranium(env, dayF, t) {
    if (S.NO_GERANIUM) return;
    const tint = mixHex('#9a7866', '#a4a2b4', dayF), n = 1 + Math.round((env.bloom ?? 0.4) * (GER.length - 1));
    const col = (c) => mulHex(c, tint);
    for (let i = 0; i < n; i++) {
      const [x, y] = GER[i], sway = Math.sin(t * 0.8 + i) > 0.92 ? 1 : 0;
      ctx.fillStyle = col('#3f6630'); ctx.fillRect(x, y + 3, 1, 5);
      for (const [dx, dy] of [[0, 0], [-2, 1], [2, 1], [-1, -1], [1, -1], [0, 2], [-1, 1], [1, 1]]) { ctx.fillStyle = col((dx + dy) % 2 ? '#d8343a' : '#f06060'); ctx.fillRect(x + dx + sway, y + dy, 1, 1); }
    }
    const since = t - (env.waterAt ?? -99);
    if (since >= 0 && since < 2.5) { // струйка из лейки и капли на листьях
      ctx.fillStyle = '#9ccfee';
      for (let i = 0; i < 14; i++) { const ph = (since * 2 + i / 14) % 1; ctx.globalAlpha = 1 - ph * 0.6; ctx.fillRect(400 + ((i * 7) % 22), 160 + ph * 34, 1, 2); }
      ctx.globalAlpha = 1;
    }
  }

  // Шторы: k = 0 — подхвачены у краёв, 1 — задёрнуты, между ними щель в центре окна
  function drawCurtains(k, dayF, closed = 205) { // closed — ширина задёрнутой шторы; «Окно дня» задёргивает внахлёст (242) или оставляет щёлочку
    const ease = k * k * (3 - 2 * k);
    for (let y = 4; y < SILL + 8; y++) {
      const tied = y < 130 ? 38 - (y - 4) / 126 * 20 : 18 + (y - 130) / 92 * 10;
      const w = Math.round(tied + (closed - tied) * ease);
      for (const [fab, x] of [[interior.fabL, 0], [interior.fabR, W - w]]) {
        ctx.drawImage(fab[0], 0, 0, CURTAIN_FAB, 1, x, y, w, 1);
        if (dayF > 0.01) { ctx.globalAlpha = dayF; ctx.drawImage(fab[1], 0, 0, CURTAIN_FAB, 1, x, y, w, 1); ctx.globalAlpha = 1; }
      }
    }
    if (ease < 0.6) { // подхваты видны, пока шторы не задёрнуты
      ctx.globalAlpha = 1 - ease / 0.6;
      ctx.fillStyle = mixHex('#8a6a40', '#c8a050', dayF); ctx.fillRect(0, 128, 22, 3); ctx.fillRect(W - 22, 128, 22, 3);
      ctx.fillStyle = mixHex('#a08050', '#e0bc6a', dayF); ctx.fillRect(0, 128, 22, 1); ctx.fillRect(W - 22, 128, 22, 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawInterior(env, dayF, t) {
    const nightF = 1 - dayF;
    if (S.drawDesk) S.drawDesk(ctx, env, dayF, t); // свой интерьер вместо стены, подоконника, штор и стола
    else {
      ctx.drawImage(interior.night, 0, 0);
      ctx.globalAlpha = dayF; ctx.drawImage(interior.day, 0, 0); ctx.globalAlpha = 1;
      if (!S.NO_CURTAINS) drawCurtains(env.curtain || 0, dayF, env.curtainClosed || 205);
      ctx.drawImage(interior.frontNight, 0, 0);
      ctx.globalAlpha = dayF; ctx.drawImage(interior.frontDay, 0, 0); ctx.globalAlpha = 1;
      drawGeranium(env, dayF, t);
    }
    const DT = 226;
    // кот дышит
    const tint = mixHex('#9a7866', '#a4a2b4', dayF), mul = (c) => mulHex(c, tint);
    const ys = yarnState(t, env.yarnAt ?? -99);
    let cs = catState(t, env.catPetAt ?? -99, env.waterAt ?? -99);
    const ca = env.corgi && t - env.corgi.arrive >= 0 && t - env.corgi.arrive < 5 ? t - env.corgi.arrive : -1;
    if (cs.mode !== 'pet' && ys.cat) cs = ys.cat; // клубок покатился — кот следит и бьёт хвостом
    else if (cs.mode !== 'pet' && ca >= 0) cs = { mode: 'awake', look: -1, blink: ca % 2.5 < 0.15, lift: Math.min(1, ca * 3, (5 - ca) * 3) }; // корги пришла — кот косится
    // города со своим интерьером (машина) могут сдвинуть кота, клубок, пар и свет лампы: S.CAT_AT, S.YARN_AT, S.STEAM_AT, S.LAMP_AT
    const [catX, catY] = S.CAT_AT || [356, DT + 12], [yarnX, yarnY] = S.YARN_AT || [426, DT + 12];
    drawCat(ctx, catX, catY, cs, t, tint); // кот Елисей
    drawYarn(ctx, yarnX, yarnY, ys, mul);

    if (!S.drawDesk) { // проигрыватель с пластинкой — у города со своим интерьером его заменяет S.drawDesk
      // пластинка на серебристом диске: круг в перспективе, вращается, пока играет эфир
      const cx = 187, cy = DT + 3, on = env.playing, RX = 15, RY = 5;
      const ell = (rx, ry, col) => { ctx.fillStyle = col; for (let yy = -ry; yy <= ry; yy++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - (yy / (ry + 0.5)) ** 2)) * rx); ctx.fillRect(cx - hw, cy + yy, hw * 2 + 1, 1); } };
      ell(RX + 1, RY + 1, '#9a9ea8');
      ell(RX, RY, '#161214');
      ctx.fillStyle = '#2e282c';
      for (const k of [0.45, 0.7, 0.9]) { const rx = Math.round(RX * k), ry = RY * k; for (let a = 0; a < 6.28; a += 0.35) ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
      ell(4, 1, '#b83a2a'); ctx.fillStyle = '#e8d8a8'; ctx.fillRect(cx, cy, 1, 1);
      const ang = on ? t * 3.49 : 0.6; // 33⅓ об/мин
      ctx.fillStyle = '#8a8490';
      for (const k of [0.6, 0.85]) ctx.fillRect(Math.round(cx + Math.cos(ang) * RX * k), Math.round(cy + Math.sin(ang) * RY * k), 2, 1);
      // тонарм: со стойки справа на край пластинки или на подставку
      const ax = 214, ay = DT - 1, nx = on ? 198 : 216, ny = on ? DT + 1 : DT + 5;
      ctx.fillStyle = '#d8dce2';
      for (let i = 0; i <= 16; i++) ctx.fillRect(Math.round(ax + (nx - ax) * i / 16), Math.round(ay + (ny - ay) * i / 16), 1, 1);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(nx - 1, ny, 3, 2); // головка
      ctx.fillStyle = on ? '#ffb347' : '#3a2616'; ctx.fillRect(172, DT + 10, 2, 2); // лампочка «вкл»
    }

    // пар над чаем; только что подлили кипятка — несколько секунд пар гуще и выше
    const [steamX, steamY] = S.STEAM_AT || [308, DT - 16];
    const fresh = Math.max(0, 1 - (t - (env.teaAt ?? -99)) / 8), steamK = 1 + fresh * 2.5;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3 + Math.round(fresh * 2); i++) for (let s = 0; s < 10; s++) {
      const ph = (t * (0.8 + fresh * 0.4) + i * 0.33) % 1;
      const y = steamY - ph * (22 + fresh * 14) - s * 0.6, x = steamX + i * 2.5 + Math.sin(t * 2 + s * 0.6 + i) * 1.5;
      ctx.globalAlpha = Math.min(0.5, 0.12 * steamK) * (1 - ph) * (1 - s / 10); ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;

    // свет лампы
    const k = 0.35 + nightF * 0.65;
    if (env.lampOn) {
      const [lampX, lampY] = S.LAMP_AT || [122, 222];
      ctx.save(); ctx.translate(lampX - 122, lampY - 222);
      ctx.fillStyle = '#fff0b8'; ctx.fillRect(108, 210, 28, 1);
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(122, 222, 4, 122, 226, 110);
      grad.addColorStop(0, `rgba(255,190,110,${0.34 * k})`); grad.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = grad; ctx.fillRect(10, 150, 240, 120);
      ctx.fillStyle = `rgba(255,210,140,${0.08 * k})`;
      ctx.beginPath(); ctx.moveTo(107, 211); ctx.lineTo(137, 211); ctx.lineTo(176, DT + 16); ctx.lineTo(68, DT + 16); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    if (S.drawSeat) { S.drawSeat(ctx, env, dayF, t, k); return; }
    // кресло-качалка слева, покачивается
    const a = Math.sin(t * 1.7) * 0.05 * env.rock;
    ctx.save(); ctx.translate(46, 270); ctx.rotate(a);
    ctx.drawImage(interior.chairNight, -50, -128);
    ctx.globalAlpha = dayF; ctx.drawImage(interior.chairDay, -50, -128); ctx.globalAlpha = 1;
    if (env.lampOn) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 * k; ctx.drawImage(interior.chairNight, -50, -128); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    const gs = corgiState(t, env.corgi, env.corgiPetAt ?? -99); // корги в гостях — на подушке, качается вместе с креслом
    if (gs) drawCorgi(ctx, -20, -45, gs, t, (c) => mulHex(c, mixHex('#9a7866', '#a4a2b4', dayF)));
    ctx.restore();
  }

  function drawGlassRain(env, t, drops = 46) {
    const k = env.weather.kind;
    const wetSnow = k === 'snow' && env.weather.temp > 0 && env.weather.temp < 3; // мокрый снег тает на стёклах
    if (k !== 'rain' && k !== 'storm' && !wetSnow) return;
    for (let i = 0; i < drops; i++) {
      const r = rng(i * 101 + 9), v = 2 + r() * 10, len = 3 + ((r() * 6) | 0);
      const x = 40 + ((r() * 400) | 0), y = (r() * 210 + t * v) % (SILL + 4) - 6;
      for (let s = 0; s < len; s++) { ctx.globalAlpha = 0.07 + s * 0.02; ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x, Math.round(y - len + s), 1, 1); }
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#f4f8ff'; ctx.fillRect(x, Math.round(y), 2, 2);
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#0a1020'; ctx.fillRect(x, Math.round(y) + 2, 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- кадр ----------
  function render(env) {
    const { sun, moon, weather } = env;
    const t = env.ms / 1000;
    const dayF = smooth(-7, 4, sun.alt);

    const sk = [Math.round(sun.alt * 2), Math.round(azToX(sun.az) / 10), Math.round(weather.cloud / 10), weather.kind].join();
    const nowP = performance.now(); // при таймлапсе небо пересобираем не чаще 3 раз в секунду
    if (sk !== skyKey && (!skyKey || nowP - skyAt > 330)) { buildSky(env); skyKey = sk; skyAt = nowP; }
    const ck = sk + dayF.toFixed(1);
    if (ck !== cloudKey && (!cloudKey || nowP - cloudAt > 330)) { buildClouds(env); cloudKey = ck; cloudAt = nowP; }
    const fk = `${env.winter}${env.autumn}`;
    if (fk !== farKey) { buildFar(env.winter, env.autumn); farKey = fk; }

    // --- над горизонтом, в буфер bg (из него же берётся отражение) ---
    b.drawImage(skyC, 0, 0);
    const clear = 1 - clamp(weather.cloud / 100);
    const starF = (1 - smooth(-13, -6, sun.alt)) * clear;
    if (starF > 0.02) drawStars(b, starF, env, t, azToX, altToY); // настоящее небо: stars.js
    const mx = azToX(moon.az), my = altToY(moon.alt);
    if (moon.alt > 0 && mx > -8 && mx < W + 8) drawMoon(b, Math.round(mx), Math.round(my), env.phase, dayF, clear);
    const sx = azToX(sun.az), sy = altToY(sun.alt);
    if (sun.alt > -1.5 && sx > -10 && sx < W + 10) {
      b.globalAlpha = clear * 0.9 + 0.1;
      b.fillStyle = sun.alt < 6 ? '#ffb070' : '#fff2d0';
      b.beginPath(); b.arc(Math.round(sx), Math.round(sy), 6, 0, 6.28); b.fill();
      b.globalAlpha = 1;
    }
    for (const c of S.NO_CLOUDS ? [] : clouds) { // S.NO_CLOUDS — окно выше облаков (самолёт): облака рисует сам город, под крылом
      if (!c.on) continue;
      const x = ((c.x0 + t * c.sp * (0.4 + weather.wind * 0.12)) % (W + c.w + 80)) - c.w - 40;
      b.drawImage(c.c, Math.round(x), Math.round(c.y));
    }
    if ((env.rainbow ?? 0) > 0.01) { // радуга после дождя: дуга в антисолярной точке, над горизонтом
      const cx = azToX(sun.az + 180), cy = HORIZON + 20, RC = ['#ff8a70', '#ffd86b', '#9ee0a8', '#8ab8ff'];
      b.globalAlpha = 0.5 * env.rainbow;
      for (let i = 0; i < 4; i++) {
        const R = 58 - i * 2;
        b.fillStyle = RC[i];
        for (let x = Math.max(0, Math.ceil(cx - R)); x <= Math.min(W - 1, cx + R); x++) {
          const y = Math.round(cy - Math.sqrt(R * R - (x - cx) * (x - cx)));
          if (y < HORIZON - 2) b.fillRect(x, y, 1, 1);
        }
      }
      b.globalAlpha = 1;
    }
    b.drawImage(far.night, 0, 0);
    b.globalAlpha = dayF; b.drawImage(far.day, 0, 0); b.globalAlpha = 1;
    S.drawAbove?.(b, env, dayF, t);
    drawLights(b, env, dayF, t);
    S.drawAboveLate?.(b, env, dayF, t);
    if (env.van) drawVan(b, env, dayF, t); // Марсоход проезжает мимо окна (engine/marsokhod.js); в буфере — значит, отражается в воде
    S.drawEvents?.(b, env, dayF, t); // события по новостям
    drawSecrets(b, env, dayF, S.SECRETS, 'sky');
    if (!S.NO_GULLS) drawGulls(b, t, dayF);

    // --- на экран ---
    // Город без воды (поезд) рисует свою землю; sway — покачивание вида за окном на стыках
    const sway = S.sway?.(env, t) || 0;
    if (sway) { ctx.save(); ctx.translate(0, sway); }
    ctx.drawImage(bg, 0, 0);
    if (S.drawGround) S.drawGround(ctx, env, dayF, t); else drawWater(env, dayF, t);
    S.drawBoats?.(ctx, env, dayF, t);
    drawSecrets(ctx, env, dayF, S.SECRETS, 'street');
    if (sway) ctx.restore();
    S.drawCover?.(ctx, env, dayF, t); // тоннель: темнота поверх всего вида
    if (!env.covered) { // мокрый снег: крупные хлопья тают на стёклах — редкие капли
      const wet = weather.kind === 'snow' && weather.temp > 0 && weather.temp < 3;
      drawPrecip(env, t); drawGlassRain(env, t, wet ? 16 : 46);
    }
    if (!S.drawDesk) drawFrost(ctx, weather.temp, frostSeed, 32, 6, 416, 208); // морозные узоры на стекле (engine/frost.js), под шторами
    drawInterior(env, dayF, t);
    S.drawRoom?.(ctx, env, dayF, t);
    drawGuitar(ctx, env, dayF, t, S); // гитара у окна (engine/guitar.js): перед шторами и столом
    if (!S.drawDesk) { // полка сувениров (engine/souvenirs.js) с сезонной вещицей в начале и гость на карнизе (engine/guests.js)
      const sid = seasonalItem(env);
      drawShelf(ctx, env, dayF, sid ? seasonalSprite(sid, t) : null);
      if (!S.drawSeat) drawGuest(ctx, env, dayF, city.config.id);
    }
    drawGarland(env, t);
    S.drawFrame?.(ctx, env, dayF, t); // рамка города поверх всего (дверь машины вокруг стекла)
  }

  return { render };
}

function drawMoon(g, cx, cy, phase, dayF, clear) {
  const R = 5;
  if (dayF < 0.9) {
    const grad = g.createRadialGradient(cx, cy, 2, cx, cy, 22);
    grad.addColorStop(0, `rgba(230,230,255,${0.18 * (1 - dayF) * clear})`); grad.addColorStop(1, 'rgba(230,230,255,0)');
    g.fillStyle = grad; g.fillRect(cx - 22, cy - 22, 44, 44);
  }
  g.globalAlpha = (1 - dayF * 0.6) * (0.3 + clear * 0.7);
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    if (x * x + y * y > R * R + 1) continue;
    const yn = y / R, xn = x / R, edge = Math.sqrt(Math.max(0, 1 - yn * yn));
    const tx = Math.cos(phase * 2 * Math.PI) * edge;
    const lit = phase < 0.5 ? xn > tx : xn < -tx;
    if (!lit) continue;
    g.fillStyle = (x + 2 * y) % 5 === 0 && Math.abs(x) < 3 ? '#d8d2c0' : '#f4efdc';
    g.fillRect(cx + x, cy + y, 1, 1);
  }
  g.globalAlpha = 1;
}
