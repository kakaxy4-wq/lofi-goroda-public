// Казань: вид с северного берега Казанки (от «Чаши») на юго-запад — Кремль на холме.
// Слева направо: Кремлёвская дамба, стена Кремля, Кул-Шариф, Благовещенский собор,
// башня Сююмбике, губернаторский дворец, Спасская башня, мост Миллениум.

import { rng, clamp, mixHex } from '../../engine/util.js';
import { W, HORIZON } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  far: '#98a0b0', farDark: '#848ca0', farRoof: '#6f7890', tower: '#a8b4c4',
  hill: '#6f8a5a', hillDark: '#5a7348', tree: '#3e6b3d', treeDark: '#2f5531',
  wall: '#f2eee4', wallShade: '#d6d0c2', roofG: '#4f7a5e',
  mosque: '#f6f6f2', mosqueShade: '#d8dce0', turq: '#3fb8c8', turqDark: '#2a8fa0', gold: '#e0b040',
  cath: '#f0ece0', cathShade: '#d2ccbe', blue: '#3a6fb8', blueDark: '#2c5690',
  brick: '#b0503a', brickDark: '#8a3a2a', trim: '#f0e8d8', spire: '#4f8a60',
  palace: '#e8d4a0', palaceShade: '#c8b480', win: '#6a6070',
  granite: '#8c8278', graniteDark: '#6f665e', dam: '#a09a90',
  bridge: '#eceef2', bridgeDark: '#b8bcc4', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a', tower: '#222a44',
  hill: '#141c1c', hillDark: '#101616', tree: '#151d1f', treeDark: '#101719',
  wall: '#9a8a70', wallShade: '#786a56', roofG: '#1e2e2a',
  mosque: '#a8b8c8', mosqueShade: '#8494a6', turq: '#2e9aaa', turqDark: '#207482', gold: '#c89a3a',
  cath: '#9a8e78', cathShade: '#786e5e', blue: '#2a4a7a', blueDark: '#203a60',
  brick: '#8a4030', brickDark: '#6a3024', trim: '#b8a88a', spire: '#2a4a36',
  palace: '#9a8660', palaceShade: '#786848', win: '#1a1420',
  granite: '#27252d', graniteDark: '#1e1c23', dam: '#2a2830',
  bridge: '#8a8e9a', bridgeDark: '#5a5e6a', snow: '#6a7488',
};
const AUTUMN = { day: { tree: '#bb8c32', treeDark: '#915f27', hill: '#8a8a4a', hillDark: '#6e6e3a' }, night: { tree: '#221c16', treeDark: '#1a1511' } };
const WINTER = { day: { tree: '#5d5853', treeDark: '#48443f', hill: '#dfe6ec', hillDark: '#c4ccd6' }, night: { tree: '#1a1a1e', treeDark: '#141418', hill: '#2c3244', hillDark: '#242a3a' } };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Холм под Кремлём: высота верхней кромки для каждого x
const hillTop = (x) => (x < 40 ? 162 : x < 100 ? 162 - (x - 40) * 0.33 : x < 372 ? 142 : x < 440 ? 142 + (x - 372) * 0.3 : 162);

// Минарет: белый ствол, два балкона, бирюзовый шатёр и полумесяц
function minaret(R, x, top, base) {
  R('mosque', x, top + 8, 3, base - top - 8); R('mosqueShade', x + 2, top + 8, 1, base - top - 8);
  for (const by of [top + 14, top + Math.round((base - top) * 0.55)]) { R('turq', x - 1, by, 5, 2); R('mosque', x - 1, by + 2, 5, 1); }
  R('turq', x, top + 3, 3, 5); R('turqDark', x + 2, top + 3, 1, 5); R('turq', x + 1, top, 1, 3);
  R('gold', x + 1, top - 3, 1, 3); R('gold', x + 2, top - 3, 1, 1);
}
// Купол-«луковица» или полусфера: строки ширины от вершины вниз
function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}

export function drawFar({ g, P, winter, r, L, R }) {
  // город дальше на холмах и новые высотки справа
  for (let x = 0; x < W;) {
    const w = 6 + ((r() * 12) | 0), tall = x > 330 && r() < 0.35, h = tall ? 18 + ((r() * 16) | 0) : 4 + ((r() * 10) | 0), top = 146 - h;
    R(tall ? 'tower' : r() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < 144; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.3) L(xx, yy, 'win');
    if (tall) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w;
  }
  // холм с деревьями на склонах
  for (let x = 0; x < W; x++) { const y = Math.round(hillTop(x)); R('hill', x, y, 1, 168 - y); R('hillDark', x, y + 6, 1, 168 - y - 6); }
  for (let x = 40; x < 450; x += 3) {
    if (x > 104 && x < 366) continue;
    const y = Math.round(hillTop(x)), h = 3 + ((r() * 5) | 0);
    R(r() < 0.5 ? 'tree' : 'treeDark', x, y - h + 2, 4, h);
  }

  // стена Кремля с зубцами
  R('wall', 100, 132, 270, 10); R('wallShade', 100, 140, 270, 2);
  for (let x = 100; x < 370; x += 4) R('wall', x, 130, 2, 2);
  if (winter) R('snow', 100, 130, 270, 1);
  for (let x = 108; x < 368; x += 22) L(x, 138, 'flood', '#ffd9a0', 0);
  // угловые башни стены
  for (const [x, h] of [[98, 14], [232, 10], [300, 10]]) { R('wall', x, 132 - h, 8, h); R('wallShade', x + 6, 132 - h, 2, h); for (let i = 0; i < 5; i++) R('roofG', x + i, 132 - h - 5 + i, 8 - i * 2 + 1, 1); }

  // мечеть Кул-Шариф
  R('mosque', 166, 114, 54, 18); R('mosqueShade', 212, 114, 8, 18);
  for (let x = 170; x < 214; x += 6) { R('turq', x, 119, 3, 6); R('turqDark', x, 119, 3, 1); }
  dome(R, 193, 94, [4, 8, 12, 16, 18, 20, 22, 22, 24, 24, 24, 24, 24, 24, 24, 24, 26, 26, 26, 26], 'turq', 'turqDark');
  for (let i = 0; i < 5; i++) R('mosque', 180, 112 + i, 26, 1); // барабан
  R('gold', 193, 86, 1, 8); R('gold', 191, 86, 1, 2); R('gold', 195, 86, 1, 2); R('gold', 192, 85, 3, 1);
  dome(R, 176, 106, [2, 4, 6, 8, 8, 8, 8, 8], 'turq', 'turqDark'); dome(R, 210, 106, [2, 4, 6, 8, 8, 8, 8, 8], 'turq', 'turqDark');
  minaret(R, 156, 58, 132); minaret(R, 169, 66, 114); minaret(R, 215, 66, 114); minaret(R, 228, 58, 132);
  L(193, 128, 'flood', '#cfe8ff', 0);

  // Благовещенский собор
  R('cath', 246, 112, 46, 20); R('cathShade', 286, 112, 6, 20); R('cath', 262, 102, 12, 10); R('cathShade', 270, 102, 4, 10);
  for (let x = 250; x < 288; x += 7) R('win', x, 118, 2, 5);
  dome(R, 268, 91, [2, 4, 6, 8, 10, 10, 10, 8, 6, 8, 12], 'blue', 'blueDark');
  R('gold', 268, 84, 1, 7); R('gold', 266, 86, 5, 1);
  for (const cx of [252, 284]) { dome(R, cx, 104, [2, 4, 6, 6, 6, 4, 6, 8], 'blue', 'blueDark'); R('gold', cx, 99, 1, 5); R('gold', cx - 1, 100, 3, 1); }
  L(268, 128, 'flood', '#ffe0a8', 0);

  // башня Сююмбике — ярусы из кирпича, чуть наклонена (верх сдвинут)
  const tiers = [[14, 110, 22, 0], [12, 98, 12, 0], [10, 88, 10, 1], [8, 80, 8, 1], [6, 72, 8, 2]];
  for (const [w, y, h, lean] of tiers) { const x = 316 + ((14 - w) >> 1) + lean; R('brick', x, y, w, h); R('brickDark', x + w - 2, y, 2, h); R('trim', x - 1, y, w + 2, 1); R('win', x + (w >> 1) - 1, y + 3, 2, Math.min(4, h - 4)); }
  for (let i = 0; i < 14; i++) { const w = Math.max(1, Math.round(4 - i * 0.28)); R('spire', 318 + 3 + (i < 7 ? 2 : 3) - (w >> 1) + 1, 58 + i, w, 1); }
  R('gold', 324, 52, 1, 6); R('gold', 322, 52, 2, 1); R('gold', 325, 53, 1, 1);
  L(323, 124, 'flood', '#ffb880', 0);

  // губернаторский дворец
  R('palace', 336, 120, 30, 12); R('palaceShade', 360, 120, 6, 12); R('palace', 334, 118, 34, 2);
  for (let x = 339; x < 364; x += 4) R('win', x, 123, 2, 4);

  // Спасская башня
  R('wall', 372, 110, 14, 30); R('wallShade', 382, 110, 4, 30);
  R('wall', 374, 100, 10, 10); R('wallShade', 380, 100, 4, 10); R('win', 377, 103, 3, 3);
  R('wall', 375, 92, 8, 8); R('wallShade', 380, 92, 3, 8);
  for (let i = 0; i < 12; i++) { const w = Math.max(1, Math.round(8 - i * 0.62)); R('roofG', 379 - (w >> 1), 80 + i, w, 1); }
  R('gold', 379, 74, 1, 6); R('gold', 377, 75, 5, 1); R('gold', 378, 74, 3, 3);
  L(379, 136, 'flood', '#ffd9a0', 0);

  // Кремлёвская дамба слева: дорога, фонари
  R('dam', 0, 154, 110, 4); R('graniteDark', 0, 158, 110, 4);
  for (let x = 4; x < 108; x += 10) { R('graniteDark', x, 147, 1, 7); L(x, 146, 'lamp', '#ffd88a', 0); }

  // мост Миллениум справа: настил, пилон «М», ванты
  R('bridge', 396, 158, 84, 3); R('bridgeDark', 396, 161, 84, 1);
  const line = (x0, y0, x1, y1, c, th = 2) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) R(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), th, 1); };
  line(430, 160, 440, 116, 'bridge'); line(440, 116, 450, 134, 'bridge'); line(450, 134, 460, 116, 'bridge'); line(460, 116, 470, 160, 'bridge');
  for (let k = 0; k < 6; k++) { line(441, 118, 400 + k * 6, 158, 'bridgeDark', 1); line(460, 118, 478 - k * 3, 158, 'bridgeDark', 1); }
  for (let x = 400; x < 480; x += 12) L(x, 156, 'lamp', '#ffe2a0', 0);

  // гранит набережной у воды
  R('granite', 0, 162, W, 2); R('graniteDark', 0, 164, W, 4);
}

// ---------- ночная подсветка: Кул-Шариф и мост Миллениум ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  // бирюзовое свечение куполов и белые минареты
  const grad = g.createRadialGradient(193, 104, 2, 193, 104, 34);
  grad.addColorStop(0, `rgba(120,230,240,${0.22 * nightF})`); grad.addColorStop(1, 'rgba(120,230,240,0)');
  g.fillStyle = grad; g.fillRect(155, 66, 76, 70);
  g.globalAlpha = nightF * 0.7; g.fillStyle = '#e8f6ff';
  for (const [x, top, base] of [[156, 66, 132], [169, 74, 114], [215, 74, 114], [228, 66, 132]]) g.fillRect(x, top, 1, base - top);
  // Сююмбике — тёплым
  const g2 = g.createRadialGradient(323, 90, 1, 323, 90, 22);
  g2.addColorStop(0, `rgba(255,170,110,${0.2 * nightF})`); g2.addColorStop(1, 'rgba(255,170,110,0)');
  g.fillStyle = g2; g.globalAlpha = 1; g.fillRect(300, 60, 46, 70);
  // пилон Миллениума: цвет медленно меняется
  const hue = (t * 6) % 360;
  g.globalAlpha = nightF * 0.9; g.fillStyle = `hsl(${hue},70%,65%)`;
  const pts = [[430, 160], [440, 116], [450, 134], [460, 116], [470, 160]];
  for (let s = 0; s < 4; s++) { const [x0, y0] = pts[s], [x1, y1] = pts[s + 1]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i += 2) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1); }
  g.globalAlpha = 1;
}

// ---------- речной трамвайчик в навигацию + набережная на нашем берегу ----------
export function drawBoats(ctx, env, dayF, t) {
  drawBoat(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
}
export function drawAboveLate(b, env, dayF, t) { drawCars(b, env, dayF, t); }

function drawBoat(ctx, env, dayF, t) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 9 || h > 22) return;
  const p = ((env.ms / 1000 + 120) % 480) / 200;
  if (p >= 1) return;
  const x = Math.round(-40 + p * 540), y = 192, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 30, 4);
  ctx.fillStyle = mixHex('#1a1e28', '#2a6a5a', dayF); ctx.fillRect(x + 1, y + 4, 28, 2);
  ctx.fillStyle = mixHex('#30343e', '#e0e0dc', dayF); ctx.fillRect(x + 4, y - 4, 20, 4);
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7;
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 5 + i * 3, y - 3, 2, 1);
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — тарелка чак-чака
export function drawSill(R, SILL) {
  R('#e8e4dc', 356, SILL - 1, 18, 2); R('#c8c2b6', 358, SILL + 1, 14, 1);
  for (let i = 0; i < 5; i++) R(i % 2 ? '#c8862a' : '#e0a040', 359 + i, SILL - 3 - (i > 1 && i < 4 ? 2 : 0), 12 - i * 2, 2);
  R('#f4c86a', 362, SILL - 6, 2, 1); R('#f4c86a', 366, SILL - 5, 1, 1);
}

// ---------- улица: машины на дамбе и мосту, набережная с ларьками (движок — engine/street.js) ----------
// Какие ларьки работают сейчас
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (mo >= 5 && mo <= 9 && h >= 10 && h < 22) return ['icecream', 'corn', 'echpochmak'];
  if ((mo >= 11 || mo <= 3) && h >= 10 && h < 20) return ['tea'];
  if (h >= 10 && h < 21) return ['echpochmak', 'tea'];
  return [];
}
export const STALL_X = { icecream: 150, corn: 236, echpochmak: 322, tea: 236 };
const LANES = [{ x0: -6, x1: 112, y: 154 }, { x0: 394, x1: 484, y: 156 }]; // дамба, мост Миллениум
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: k, x: STALL_X[k] }))); }

// ---------- секреты Казани ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
export const SECRETS = [
  {
    id: 'zilant', name: 'Зилант над Кремлём', layer: 'sky',
    hint: 'Ночью над Кремлём иногда пролетает кто-то крылатый.',
    found: 'Зилант — крылатый змей с герба Казани, по легенде жил на холме у Казанки.',
    state(env) {
      if (!env.forced && env.sun.alt > -6) return null;
      if (!inWin(env, 2400, 12, 600)) return null;
      const p = phase(env, 2400, 12, 600); return { x: Math.round(480 - p * 520), y: 56 + Math.round(Math.sin(p * 6) * 4), w: 16, h: 8 };
    },
    draw(b, env, st) {
      const { x, y } = st, wing = Math.sin(env.ms / 180) > 0 ? -2 : 1;
      b.fillStyle = '#3a8a5a'; b.fillRect(x + 2, y + 3, 10, 2); b.fillRect(x, y + 2, 3, 2); b.fillRect(x + 12, y + 4, 4, 1); // тело, голова, хвост
      b.fillStyle = '#2a6a44'; b.fillRect(x + 5, y + 3 + wing, 5, 1); b.fillRect(x + 6, y + 2 + wing * 2, 3, 1);           // крыло
      b.fillStyle = '#f0c040'; b.fillRect(x, y + 2, 1, 1);                                                                     // глаз
    },
  },
  {
    id: 'balloon', name: 'Воздушный шар', layer: 'sky',
    hint: 'Летом рано утром над городом что-то медленно плывёт.',
    found: 'Летними утрами над Казанью поднимают воздушные шары.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(month(env) >= 6 && month(env) <= 8 && h >= 6 && h < 10)) return null;
      const p = env.forced ? 0.4 : ((secT(env) % 1800) / 1800); return { x: Math.round(40 + p * 380), y: 40 - Math.round(p * 16), w: 10, h: 16 };
    },
    draw(b, env, st) {
      const { x, y } = st, cols = ['#e8423a', '#f0c040', '#3a7ad0', '#f4f4f4'];
      for (let i = 0; i < 10; i++) { const w = [4, 7, 9, 10, 10, 10, 9, 7, 5, 3][i]; for (let j = 0; j < w; j++) { b.fillStyle = cols[(j >> 1) % 4]; b.fillRect(x + 5 - (w >> 1) + j, y + i, 1, 1); } }
      b.fillStyle = '#8a6a4a'; b.fillRect(x + 3, y + 13, 4, 3); b.fillStyle = '#5a4a3a'; b.fillRect(x + 3, y + 10, 1, 3); b.fillRect(x + 6, y + 10, 1, 3);
    },
  },
  {
    id: 'ducks', name: 'Утка с утятами', layer: 'street',
    hint: 'Весной и летом по Казанке кто-то плывёт гуськом.',
    found: 'На Казанке гнездятся утки — утята плавают за мамой гуськом.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(month(env) >= 5 && month(env) <= 7 && h >= 8 && h < 20 && !env.frozen)) return null;
      if (!inWin(env, 1200, 40, 200)) return null;
      const p = phase(env, 1200, 40, 200); return { x: Math.round(-20 + p * 520), y: 186, w: 18, h: 4 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, bob = Math.sin(env.ms / 300) > 0 ? 1 : 0;
      ctx.fillStyle = mixHex('#2a2418', '#6a5030', dayF); ctx.fillRect(x + 12, y + 1 + bob, 5, 2); ctx.fillStyle = mixHex('#1a2a1a', '#2a6a3a', dayF); ctx.fillRect(x + 16, y + bob, 2, 2);
      ctx.fillStyle = mixHex('#3a3218', '#d8c060', dayF); for (const dx of [1, 5, 9]) ctx.fillRect(x + dx, y + 2 + (bob ^ (dx % 2)), 2, 1);
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x - 4, y + 4, 22, 1); ctx.globalAlpha = 1;
    },
  },
  {
    id: 'salute', name: 'Салют в День города', layer: 'sky',
    hint: 'В конце лета, в день рождения города, небо над Кремлём расцветает.',
    found: '30 августа Казань отмечает День города и День Республики — вечером салют.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), m = l.getUTCMinutes();
      if (!env.forced && !(month(env) === 8 && l.getUTCDate() === 30 && h === 22 && m < 20)) return null;
      return { x: 150, y: 20, w: 200, h: 70 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 250, 50, dayF); },
  },
];

// События по новостям для Казани (fireworks — салют над Кремлём)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 250, 50, dayF); }
