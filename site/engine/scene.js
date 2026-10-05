// Движок сцены: окно 480×270, всё рисуется кодом. Город подключается модулем skyline:
// палитры, дальний план, свои динамические слои. Движок: небо, облака, светила,
// огни окон, вода с отражениями, погода, интерьер, кот, гирлянда.

import { rng, clamp, smooth, mix, hex, mixHex, rgb, canvas, sprite, tinted } from './util.js';
import { W, H, HORIZON, SILL } from './const.js';
import { drawSecrets } from './street.js';
export { W, H, HORIZON, SILL };

let VIEW = { viewAzimuth: 0, fov: 110 }; // направление окна задаёт город

// ---------- кот Елисей: рисуется кодом, живёт по своему расписанию ----------
// Размер «буханки» ~46×22 px — в 3,5 раза длиннее стакана, как в жизни.
const CAT_COL = { fur: '#8a8490', furHi: '#a6a0ac', stripe: '#5e5866', belly: '#c4bec8', ear: '#d49a9a', nose: '#d88a8a', eyeL: '#c8d85a', pupil: '#16141a', line: '#2a2630', shadow: 'rgba(0,0,0,0.28)' };
function mulHex(a, b) { const A = rgb(a), B = rgb(b); return hex([A[0] * B[0] / 255, A[1] * B[1] / 255, A[2] * B[2] / 255]); }

// Что кот делает в момент t: сон по умолчанию, раз в ~30 с — случайное событие
export function catState(t, petAt) {
  if (t - petAt < 5) return { mode: 'pet', k: (t - petAt) / 5 };
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
  for (let x = 16; x < 44; x++) P(x < 20 ? C.stripe : C.fur, x, -2, 1, 2);
  P(C.fur, 14, -3 - Math.max(0, tailUp), 3, 2); P(C.stripe, 12, -4 - tailUp, 3, 2);
  // тело-«буханка»: дышит
  const rows = [[20, 38], [16, 42], [14, 44], [13, 45], [13, 45], [13, 45], [13, 45], [13, 45], [13, 45], [14, 44], [14, 44], [15, 43], [16, 42]];
  rows.forEach(([a, b], i) => { const y = -16 + i - (i < 3 ? breath : 0); P(i < 2 ? C.furHi : C.fur, a, y, b - a, 1); });
  if (breath) P(C.furHi, 22, -17, 14, 1);
  for (const sx of [22, 27, 32, 37, 41]) P(C.stripe, sx, -15 - breath, 2, 5);
  P(C.belly, 14, -5, 8, 3); // грудка
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
  el.width = W; el.height = H;
  const ctx = el.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const [bg, b] = canvas(W, HORIZON);
  const [skyC, skyCtx] = canvas(W, HORIZON);
  let skyKey = '', farKey = '', far = null, clouds = [], cloudKey = '', skyAt = 0, cloudAt = 0;
  let skyHorizon = [40, 50, 80], skyZenith = [10, 15, 30];
  const lights = [];
  const stars = [];
  { const r = rng(7); for (let i = 0; i < 150; i++) stars.push({ x: (r() * W) | 0, y: (r() * 140) | 0, p: r() * 6.28, big: r() < 0.08 }); }
  const interior = buildInterior();

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
      ctx.fillStyle = '#f2f4fa';
      for (let i = 0; i < 180; i++) {
        const r = rng(i * 7 + 3), sp = 14 + r() * 22;
        const y = (r() * 250 + t * sp) % 250 - 10, x = (r() * W + Math.sin(t * 0.8 + i) * 6 + t * env.weather.wind) % W;
        ctx.globalAlpha = 0.5 + r() * 0.5;
        ctx.fillRect(Math.round(x), Math.round(y), r() < 0.2 ? 2 : 1, r() < 0.2 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
    if (k === 'fog') {
      const gcol = hex(mix(skyHorizon, '#9aa0a8', 0.4));
      const grad = ctx.createLinearGradient(0, 60, 0, SILL);
      grad.addColorStop(0, gcol + '00'); grad.addColorStop(0.45, gcol + 'aa'); grad.addColorStop(1, gcol + '66');
      ctx.fillStyle = grad; ctx.fillRect(0, 60, W, SILL - 60);
    }
    if (k === 'storm') {
      const slot = Math.floor(t / 6), r = rng(slot * 17);
      const ph = t - slot * 6;
      if (r() < 0.35 && ph < 0.25) {
        ctx.globalAlpha = 0.45 * (1 - ph * 4); ctx.fillStyle = '#e8ecff'; ctx.fillRect(0, 0, W, SILL);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff';
        let x = 60 + r() * 360, y = 10;
        while (y < 150) { ctx.fillRect(Math.round(x), y, 1, 3); y += 3; x += (r() - 0.5) * 5; }
      }
    }
  }

  // ---------- интерьер: стол у окна, лампа, проигрыватель, кресло-качалка ----------
  function buildInterior() {
    const [c, g] = canvas(W, H);
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
    const curtain = (left) => {
      const pal = ['#7a3e46', '#8e4a52', '#a35c62', '#6a343c'];
      for (let y = 4; y < SILL + 8; y++) {
        const w = y < 130 ? Math.round(38 - (y - 4) / 126 * 20) : Math.round(18 + (y - 130) / 92 * 10);
        for (let i = 0; i < w; i++) {
          const fold = Math.floor((i + (y < 130 ? 0 : 1)) / 3) % 4;
          R(i === w - 1 ? pal[3] : pal[fold === 3 ? 1 : fold], left ? i : W - 1 - i, y, 1, 1);
        }
      }
      R('#c8a050', left ? 0 : W - 22, 128, 22, 3); R('#e0bc6a', left ? 0 : W - 22, 128, 22, 1);
    };
    curtain(true); curtain(false);

    // на подоконнике: герань и сувенир города
    const gx = 404, gy = SILL + 2;
    R('#c0643a', gx - 1, gy - 12, 15, 2); R('#e08050', gx - 1, gy - 12, 15, 1);
    for (let i = 0; i < 10; i++) { R('#a8522e', gx + (i >> 2), gy - 10 + i, 13 - (i >> 1), 1); R('#8a4226', gx + 10 - (i >> 2), gy - 10 + i, 2, 1); }
    for (const [x, y, r] of [[gx - 3, gy - 20, 5], [gx + 5, gy - 24, 6], [gx + 13, gy - 20, 5], [gx + 1, gy - 28, 4], [gx + 11, gy - 29, 4]]) for (let yy = -r; yy <= r; yy++) { const hw = Math.round(Math.sqrt(r * r - yy * yy)); R(yy < 0 ? '#5a8a42' : '#3f6630', x - hw, y + yy, hw * 2, 1); }
    for (const [x, y] of [[gx + 1, gy - 34], [gx + 11, gy - 37], [gx + 17, gy - 29]]) {
      R('#3f6630', x, y + 3, 1, 5);
      for (const [dx, dy] of [[0, 0], [-2, 1], [2, 1], [-1, -1], [1, -1], [0, 2], [-1, 1], [1, 1]]) R((dx + dy) % 2 ? '#d8343a' : '#f06060', x + dx, y + dy, 1, 1);
    }

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
    if (!env.garland) return;
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

  function drawInterior(env, dayF, t) {
    const nightF = 1 - dayF;
    ctx.drawImage(interior.night, 0, 0);
    ctx.globalAlpha = dayF; ctx.drawImage(interior.day, 0, 0); ctx.globalAlpha = 1;
    const DT = 226;
    // кот дышит
    drawCat(ctx, 356, DT + 12, catState(t, env.catPetAt ?? -99), t, mixHex('#9a7866', '#a4a2b4', dayF)); // кот Елисей

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

    // пар над чаем
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) for (let s = 0; s < 10; s++) {
      const ph = (t * 0.8 + i * 0.33) % 1;
      const y = DT - 16 - ph * 22 - s * 0.6, x = 309 + i * 3 + Math.sin(t * 2 + s * 0.6 + i) * 1.5;
      ctx.globalAlpha = 0.12 * (1 - ph) * (1 - s / 10); ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;

    // свет лампы
    const k = 0.35 + nightF * 0.65;
    if (env.lampOn) {
      ctx.fillStyle = '#fff0b8'; ctx.fillRect(108, 210, 28, 1);
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(122, 222, 4, 122, 226, 110);
      grad.addColorStop(0, `rgba(255,190,110,${0.34 * k})`); grad.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = grad; ctx.fillRect(10, 150, 240, 120);
      ctx.fillStyle = `rgba(255,210,140,${0.08 * k})`;
      ctx.beginPath(); ctx.moveTo(107, 211); ctx.lineTo(137, 211); ctx.lineTo(176, DT + 16); ctx.lineTo(68, DT + 16); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    // кресло-качалка слева, покачивается
    const a = Math.sin(t * 1.7) * 0.05 * env.rock;
    ctx.save(); ctx.translate(46, 270); ctx.rotate(a);
    ctx.drawImage(interior.chairNight, -50, -128);
    ctx.globalAlpha = dayF; ctx.drawImage(interior.chairDay, -50, -128); ctx.globalAlpha = 1;
    if (env.lampOn) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 * k; ctx.drawImage(interior.chairNight, -50, -128); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  }

  function drawGlassRain(env, t) {
    const k = env.weather.kind;
    if (k !== 'rain' && k !== 'storm') return;
    for (let i = 0; i < 46; i++) {
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
    if (starF > 0.02) {
      b.fillStyle = '#ffffff';
      for (const s of stars) { b.globalAlpha = starF * (0.45 + 0.55 * Math.sin(t * 1.3 + s.p)); b.fillRect(s.x, s.y, s.big ? 2 : 1, 1); }
      b.globalAlpha = 1;
    }
    const mx = azToX(moon.az), my = altToY(moon.alt);
    if (moon.alt > 0 && mx > -8 && mx < W + 8) drawMoon(b, Math.round(mx), Math.round(my), env.phase, dayF, clear);
    const sx = azToX(sun.az), sy = altToY(sun.alt);
    if (sun.alt > -1.5 && sx > -10 && sx < W + 10) {
      b.globalAlpha = clear * 0.9 + 0.1;
      b.fillStyle = sun.alt < 6 ? '#ffb070' : '#fff2d0';
      b.beginPath(); b.arc(Math.round(sx), Math.round(sy), 6, 0, 6.28); b.fill();
      b.globalAlpha = 1;
    }
    for (const c of clouds) {
      if (!c.on) continue;
      const x = ((c.x0 + t * c.sp * (0.4 + weather.wind * 0.12)) % (W + c.w + 80)) - c.w - 40;
      b.drawImage(c.c, Math.round(x), Math.round(c.y));
    }
    b.drawImage(far.night, 0, 0);
    b.globalAlpha = dayF; b.drawImage(far.day, 0, 0); b.globalAlpha = 1;
    S.drawAbove?.(b, env, dayF, t);
    drawLights(b, env, dayF, t);
    S.drawAboveLate?.(b, env, dayF, t);
    S.drawEvents?.(b, env, dayF, t); // события по новостям
    drawSecrets(b, env, dayF, S.SECRETS, 'sky');
    drawGulls(b, t, dayF);

    // --- на экран ---
    ctx.drawImage(bg, 0, 0);
    drawWater(env, dayF, t);
    S.drawBoats?.(ctx, env, dayF, t);
    drawSecrets(ctx, env, dayF, S.SECRETS, 'street');
    drawPrecip(env, t);
    drawGlassRain(env, t);
    drawInterior(env, dayF, t);
    S.drawRoom?.(ctx, env, dayF, t);
    drawGarland(env, t);
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
