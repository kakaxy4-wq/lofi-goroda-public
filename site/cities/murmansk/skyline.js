// Мурманск: вид со смотровой площадки Абрам-Мыс (западный берег Кольского залива, ~68.975 N, 33.017 E)
// на восток-юго-восток, через залив на город. Точно напротив — Морской вокзал и атомный ледокол «Ленин»
// (азимут ~91°), правее — краны и угольные причалы порта (~115–135°), слева на Зелёном мысу — «Алёша»
// (на деле ~48°, чуть левее окна), справа вдали — мост через Кольский залив (на деле ~173°, чуть правее окна).
// «Алёша» и мост придвинуты к центру — художественное сжатие, взаимный порядок сохранён.
// Залив не замерзает (Нордкапское течение), зато снег на сопках и крышах лежит полгода.

import { rng, mixHex } from '../../engine/util.js';
import { W, HORIZON } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  far: '#8f9bab', farDark: '#7d899a', hill: '#6d7a5e', hillDark: '#5a6650', scrub: '#4c6040',
  city1: '#dcd8d0', city2: '#c6ccd6', city3: '#e2d2b8', city4: '#b8c8c0', cityShade: '#a4a6ac', roof: '#6a6e78', win: '#5a6070',
  road: '#5a5a60', quay: '#8a8680', quayDark: '#5e5a56', coal: '#26262a', coalHi: '#3a3a40',
  crane: '#e0b030', craneDark: '#9a7418', hull: '#1c1e24', hullRed: '#b0302a', white: '#f0f0ec', whiteShade: '#c4c8ce', mast: '#3a3a40',
  station: '#e8e2d4', stationShade: '#c4bca8', concrete: '#c8c4ba', concreteDark: '#98948c',
  bridge: '#c4c8d0', bridgeDark: '#8a8e98', bayFar: '#8aa0b4', bayFarHi: '#a8bccc', bulk: '#7a3a2a', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1a2036', farDark: '#161b2f', hill: '#141a22', hillDark: '#10151c', scrub: '#10161a',
  city1: '#3a3844', city2: '#343844', city3: '#3c3640', city4: '#303a3c', cityShade: '#26262e', roof: '#1c1e26', win: '#16141c',
  road: '#1e1e24', quay: '#2a2830', quayDark: '#1c1a20', coal: '#0e0e12', coalHi: '#16161c',
  crane: '#6a5a2a', craneDark: '#40361a', hull: '#0c0e12', hullRed: '#4a1814', white: '#8c8e96', whiteShade: '#6a6c74', mast: '#1a1a20',
  station: '#8a8478', stationShade: '#6a655a', concrete: '#7a7a84', concreteDark: '#5a5a64',
  bridge: '#6a6e78', bridgeDark: '#44485a', bayFar: '#1a2236', bayFarHi: '#26304a', bulk: '#2a1612', snow: '#6a7488',
};
const AUTUMN = { day: { hill: '#9a6e3a', hillDark: '#7e5430', scrub: '#c09a3a' }, night: { hill: '#1a1612', hillDark: '#141010' } };
const WINTER = {
  day: { hill: '#e2e8ee', hillDark: '#c6ced8', far: '#d2dae4', farDark: '#bcc6d2', scrub: '#8a8c90' },
  night: { hill: '#2c3244', hillDark: '#242a3a', far: '#262c40', farDark: '#20263a', scrub: '#1c2030' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Кромка сопок за городом и дальняя гряда — общие для рисунка и для сияния (оно не залезает на сопки)
export function ridge(x) {
  let y = 100 + 5 * Math.sin(x * 0.018 + 0.6) + 3 * Math.sin(x * 0.047 + 2) + 2 * Math.sin(x * 0.11);
  const d = (x - 70) / 38; // Зелёный мыс с «Алёшей»
  if (Math.abs(d) < 1.6) y = Math.min(y, 84 + d * d * 9);
  if (x > 380) y += (x - 380) * 0.18; // к югу сопки ниже и дальше
  return Math.round(y);
}
const farRidge = (x) => Math.round(90 + 6 * Math.sin(x * 0.021 + 1.3) + 3 * Math.sin(x * 0.06) + (x > 380 ? (x - 380) * 0.1 : 0));
const skyFloor = (x) => Math.min(ridge(x), farRidge(x)) - 1;

// Ориентиры (их же используют HOTSPOTS в index.js)
export const ALYOSHA = { x: 70, base: 84 };
export const LENIN = { x0: 148, x1: 202, water: 167 };
export const STATION = { x0: 206, x1: 232 };
export const PORT = { x0: 238, x1: 392 };
export const BRIDGE = { x0: 396, x1: 458, deck: 151 };

export function drawFar({ winter, L, R }) {
  const q = rng(1916); // свой генератор: раскладка не зависит от чисел движка

  // дальняя гряда
  for (let x = 0; x < W; x++) { const y = farRidge(x); if (y < ridge(x)) R('far', x, y, 1, ridge(x) - y); }
  // сопки над городом
  for (let x = 0; x < W; x++) {
    const y = ridge(x); R('hill', x, y, 1, HORIZON - y); R('hillDark', x, y + 10, 1, Math.max(0, HORIZON - y - 10));
    if (!winter && q() < 0.35) R('scrub', x, y + 3 + ((q() * 14) | 0), 1, 2); // березняк-криволесье
    if (winter && q() < 0.2) R('farDark', x, y + 4 + ((q() * 10) | 0), 1, 1); // камни из-под снега
  }

  // «Алёша» на Зелёном мысу: постамент и фигура солдата в плащ-палатке
  const A = ALYOSHA.x, B = ALYOSHA.base;
  R('concreteDark', A - 4, B - 2, 9, 2); R('concrete', A - 3, B - 5, 7, 3);
  for (let i = 0; i < 16; i++) { const w = i < 10 ? 5 - (i >> 2) : 4; R('concrete', A - 2, B - 6 - i, w, 1); R('concreteDark', A - 2 + w - 1, B - 6 - i, 1, 1); } // шинель
  R('concrete', A - 1, B - 24, 3, 3); R('concreteDark', A + 1, B - 24, 1, 3);  // голова в каске
  R('concrete', A - 2, B - 25, 5, 1);
  for (let i = 0; i < 7; i++) R('concreteDark', A + 3, B - 20 + i, 1, 1);      // автомат за плечом
  R('concreteDark', A + 2, B - 20, 1, 1);
  L(A, B + 2, 'flood', '#dde6ff', 0);

  // город на склоне: ряды панельных домов ступенями вверх по сопке
  const cols = ['city1', 'city2', 'city3', 'city4'];
  for (const base of [158, 150, 142, 134, 126, 118, 110]) {
    for (let x = 88; x < 446;) {
      const w = 7 + ((q() * 8) | 0), h = 5 + ((q() * 6) | 0), top = base - h;
      const inPort = x > PORT.x0 - 4 && x < PORT.x1 && base > 138, far = x > BRIDGE.x0 - 6 && base > 126;
      if (inPort || far || top < ridge(x) + 2 || top < ridge(x + w) + 2 || q() < 0.12) { x += w; continue; }
      R(cols[(q() * 4) | 0], x, top, w, h); R('cityShade', x + w - 1, top, 1, h);
      R(winter ? 'snow' : 'roof', x, top - 1, w, 1);
      for (let yy = top + 1; yy < base - 1; yy += 2) for (let xx = x + 1; xx < x + w - 1; xx += 2) { R('win', xx, yy, 1, 1); if (q() < 0.55) L(xx, yy, 'win'); }
      x += w + ((q() * 3) | 0);
    }
  }
  // гостиница-высотка у вокзалов
  R('city2', 124, 118, 10, 40); R('cityShade', 132, 118, 2, 40); R(winter ? 'snow' : 'roof', 124, 117, 10, 1);
  for (let yy = 120; yy < 156; yy += 2) for (let xx = 125; xx < 132; xx += 2) { R('win', xx, yy, 1, 1); if (q() < 0.6) L(xx, yy, 'win'); }
  L(129, 116, 'red', '#ff3a3a', 0);

  // набережная дорога и причальная стенка
  R('road', 88, 157, PORT.x0 - 88, 3);
  for (let x = 92; x < PORT.x0; x += 14) { R('mast', x, 152, 1, 5); L(x, 152, 'lamp', '#ffc870', 0); }
  R('quay', 88, 160, BRIDGE.x0 - 88, 6); R('quayDark', 88, 166, BRIDGE.x0 - 88, 2);
  if (winter) R('snow', 88, 160, BRIDGE.x0 - 88, 1);

  // юг залива уходит вдаль: полоса дальней воды, за ней мост и дальний берег
  R('bayFar', BRIDGE.x0 - 4, 148, W - BRIDGE.x0 + 4, HORIZON - 148);
  for (let i = 0; i < 10; i++) R('bayFarHi', BRIDGE.x0 + ((q() * 70) | 0), 156 + ((q() * 10) | 0), 3 + ((q() * 5) | 0), 1);
  for (let x = BRIDGE.x0 - 4; x < W; x++) { const y = Math.round(148 - (x - BRIDGE.x0) * 0.02 + Math.sin(x * 0.2) * 0.6); R('far', x, Math.min(y, 147), 1, 1); }
  // мост через Кольский залив: длинная балка на частых опорах
  const { x0: BX0, x1: BX1, deck: DY } = BRIDGE;
  R('bridge', BX0, DY, BX1 - BX0, 2); R('bridgeDark', BX0, DY + 2, BX1 - BX0, 1);
  if (winter) R('snow', BX0, DY - 1, BX1 - BX0, 1);
  for (let x = BX0 + 2; x < BX1; x += 6) R('bridgeDark', x, DY + 3, 1, 5);
  for (let x = BX0 + 3; x < BX1; x += 8) L(x, DY - 1, 'lamp', '#ffe2a0', 0);

  // порт: склады, угольные штабели, балкер у причала, портальные краны
  for (let x = PORT.x0; x < PORT.x1 - 10; x += 22) { R('city2', x, 150, 16, 10); R('cityShade', x + 14, 150, 2, 10); R(winter ? 'snow' : 'roof', x, 149, 16, 1); }
  for (const [cx, hw, hh] of [[322, 16, 8], [352, 14, 7], [378, 10, 6]]) {
    for (let i = 0; i < hh; i++) { const w = Math.round(hw * 2 * (i + 1) / hh); R('coal', cx - (w >> 1), 160 - hh + i, w, 1); }
    R('coalHi', cx - 2, 160 - hh, 3, 1); if (winter) R('snow', cx - 3, 160 - hh + 1, 2, 1);
  }
  // балкер у причала: тёмно-красный корпус, надстройка на корме
  R('bulk', 244, 158, 58, 6); R('hull', 244, 164, 58, 2); R('white', 290, 150, 9, 8); R('whiteShade', 297, 150, 2, 8);
  R('win', 291, 152, 6, 1); R('mast', 294, 146, 1, 4);
  for (let x = 252; x < 288; x += 9) R('bulk', x, 156, 6, 2); // люки трюмов
  L(294, 146, 'red', '#ff3a3a', 0);
  // портальные краны: ноги-портал, кабина, стрела
  for (const [cx, dir, len] of [[254, 1, 18], [270, -1, 20], [286, 1, 17], [336, -1, 19], [362, 1, 16], [384, -1, 18]]) {
    R('craneDark', cx - 3, 150, 1, 10); R('craneDark', cx + 3, 150, 1, 10); R('crane', cx - 3, 149, 7, 2);
    R('crane', cx - 1, 142, 4, 7); R('win', cx + (dir > 0 ? 1 : -0), 144, 1, 2);
    R('crane', cx, 136, 1, 6);
    let tx = cx, ty = 136;
    for (let i = 0; i < len; i++) { tx = cx + dir * i; ty = 136 - Math.round(i * 0.55); R('crane', tx, ty, 1, 1); }
    for (let i = 0; i < 6; i++) R('craneDark', cx - dir * i, 137 + (i >> 2), 1, 1); // противовес
    R('mast', tx, ty + 1, 1, 8 + ((len * 3) % 7)); // трос с грузом
    L(tx, ty, 'red', '#ff4030', 0);
  }
  for (const x of [262, 318, 360, 390]) L(x, 160, 'flood', '#ffb060', 0);

  // Морской вокзал
  const { x0: S0, x1: S1 } = STATION;
  R('station', S0, 146, S1 - S0, 14); R('stationShade', S1 - 3, 146, 3, 14);
  R('station', S0 + 8, 140, 10, 6); R('stationShade', S0 + 16, 140, 2, 6);
  R(winter ? 'snow' : 'roof', S0 - 1, 145, S1 - S0 + 2, 1); R(winter ? 'snow' : 'roof', S0 + 7, 139, 12, 1);
  for (let x = S0 + 2; x < S1 - 3; x += 3) { R('win', x, 149, 2, 3); R('win', x, 154, 2, 3); L(x, 149, 'win'); }
  R('mast', S0 + 13, 132, 1, 7); R('hullRed', S0 + 14, 132, 3, 2); // флагшток
  L(S0 + 13, 160, 'flood', '#ffe6c0', 0);

  // атомный ледокол «Ленин» у причала Морского вокзала
  const { x0: X0, x1: X1, water: WY } = LENIN;
  for (let i = 0; i < 7; i++) { const inset = i > 4 ? i - 4 : 0; R('hull', X0 + inset + (i < 2 ? 2 - i : 0), WY - 7 + i, X1 - X0 - inset * 2 - (i < 2 ? 2 - i : 0), 1); }
  R('hullRed', X0 + 2, WY - 1, X1 - X0 - 4, 1);
  R('white', X0 + 2, WY - 8, X1 - X0 - 4, 1); // фальшборт
  R('white', X0 + 12, WY - 15, 30, 7); R('whiteShade', X0 + 40, WY - 15, 2, 7);
  R('white', X0 + 17, WY - 20, 18, 5); R('whiteShade', X0 + 33, WY - 20, 2, 5);
  R('white', X0 + 21, WY - 23, 10, 3);
  for (let x = X0 + 14; x < X0 + 40; x += 3) R('win', x, WY - 12, 2, 1);
  R('win', X0 + 22, WY - 22, 8, 1);
  R('mast', X0 + 8, WY - 30, 1, 22); R('mast', X0 + 6, WY - 26, 5, 1);
  R('mast', X0 + 46, WY - 27, 1, 19); R('mast', X0 + 44, WY - 23, 5, 1);
  R('mast', X0 + 26, WY - 29, 1, 6);
  L(X0 + 26, WY - 2, 'flood', '#fff0d0', 0);
}

// ---------- ночная подсветка: гирлянда ледокола, натриевое марево порта, «Алёша» ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const { x0: X0, water: WY } = LENIN;
  // огни расцвечивания ледокола: от носа к мачтам и между мачтами
  const string = (ax, ay, bx, by, n) => { for (let i = 0; i <= n; i++) { g.globalAlpha = nightF * (0.7 + 0.3 * Math.sin(t * 2 + i)); g.fillRect(Math.round(ax + (bx - ax) * i / n), Math.round(ay + (by - ay) * i / n), 1, 1); } };
  g.fillStyle = '#ffe8a0';
  string(X0 + 1, WY - 8, X0 + 8, WY - 30, 8); string(X0 + 8, WY - 30, X0 + 26, WY - 29, 9);
  string(X0 + 26, WY - 29, X0 + 46, WY - 27, 9); string(X0 + 46, WY - 27, X0 + 53, WY - 8, 8);
  // натриевое марево над портом
  const p = g.createLinearGradient(0, 120, 0, 166);
  p.addColorStop(0, 'rgba(255,170,90,0)'); p.addColorStop(1, `rgba(255,170,90,${0.18 * nightF})`);
  g.globalAlpha = 1; g.fillStyle = p; g.fillRect(PORT.x0, 120, PORT.x1 - PORT.x0, 46);
  // «Алёша» в подсветке
  const a = g.createRadialGradient(ALYOSHA.x, ALYOSHA.base - 14, 1, ALYOSHA.x, ALYOSHA.base - 14, 18);
  a.addColorStop(0, `rgba(220,230,255,${0.22 * nightF})`); a.addColorStop(1, 'rgba(220,230,255,0)');
  g.fillStyle = a; g.fillRect(ALYOSHA.x - 18, ALYOSHA.base - 32, 36, 36);
  g.globalAlpha = nightF * 0.5; g.fillStyle = '#e8eeff'; g.fillRect(ALYOSHA.x - 2, ALYOSHA.base - 20, 1, 12);
  g.globalAlpha = 1;
}

export function drawAboveLate(b, env, dayF, t) { drawCars(b, env, dayF, t); }

// ---------- залив: буксир, проходящее судно, набережная Абрам-Мыса ----------
export function drawBoats(ctx, env, dayF, t) {
  drawShip(ctx, env, dayF);
  drawTug(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
}

function drawTug(ctx, env, dayF, t) {
  const p = ((env.ms / 1000) % 420) / 260; // порт работает круглый год и круглые сутки
  if (p >= 1) return;
  const dir = Math.floor((env.ms / 1000) / 420) % 2 ? 1 : -1;
  const x = Math.round(dir > 0 ? -30 + p * 540 : 510 - p * 540), y = 182, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#0c0e12', '#1c1e24', dayF); ctx.fillRect(x, y, 18, 3); ctx.fillRect(x + 1, y + 3, 16, 1);
  ctx.fillStyle = mixHex('#2a1210', '#b0302a', dayF); ctx.fillRect(x, y + 2, 18, 1);
  ctx.fillStyle = mixHex('#3a3c44', '#f0f0ec', dayF); ctx.fillRect(x + 6, y - 4, 7, 4);
  ctx.fillStyle = mixHex('#1a1a20', '#e0b030', dayF); ctx.fillRect(x + 8, y - 7, 3, 3);
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7; ctx.fillRect(x + 7, y - 3, 5, 1);
  ctx.fillStyle = dir > 0 ? '#40ff70' : '#ff4040'; ctx.globalAlpha = nightF; ctx.fillRect(x + 9, y - 8, 1, 1);
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#e8f0ff'; ctx.fillRect(dir > 0 ? x - 8 : x + 18, y + 3, 8, 1);
  ctx.globalAlpha = 1;
}

function drawShip(ctx, env, dayF) {
  const p = ((env.ms / 1000 + 300) % 1500) / 900;
  if (p >= 1) return;
  const x = Math.round(500 - p * 580), y = 173, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#1a0e0c', '#6a2e22', dayF); ctx.fillRect(x, y, 60, 4);
  ctx.fillStyle = mixHex('#0c0e12', '#1c1e24', dayF); ctx.fillRect(x + 2, y + 4, 56, 1);
  ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 48, y - 7, 9, 7);
  ctx.fillStyle = mixHex('#20222a', '#3a3a40', dayF); for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 10, y - 2, 7, 2);
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.25 + nightF * 0.75; ctx.fillRect(x + 49, y - 5, 7, 1); ctx.fillRect(x + 1, y - 3, 1, 1);
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — баночка морошкового варенья под клетчатой крышкой
export function drawSill(R, SILL) {
  const x = 430;
  R('#8a5a2a', x - 1, SILL - 1, 14, 1);
  R('#d8e4ec', x, SILL - 13, 12, 12); R('#e88a28', x + 1, SILL - 11, 10, 10); R('#f4b050', x + 2, SILL - 10, 2, 7);
  R('#f4f0e0', x + 3, SILL - 8, 6, 4); R('#e88a28', x + 5, SILL - 7, 2, 2);                 // этикетка с ягодой
  R('#c8423a', x - 1, SILL - 15, 14, 3);
  for (let i = 0; i < 7; i++) R('#f4f0e0', x - 1 + i * 2, SILL - 15 + (i % 2), 1, 1);        // клетка на ткани
  R('#7a4a2a', x - 1, SILL - 13, 14, 1);                                                     // бечёвка
}

// ---------- улица: машины, ларьки на набережной ----------
export const STALL_KINDS = {
  treska: { awning: ['#2a5a8a', '#f4f4f4'], counter: '#c8ccd4', goods: [[1, '#c8b89a'], [4, '#d8c8a8'], [8, '#c8b89a']], steam: false },
  teastall: { awning: ['#a83a32', '#f0e0c0'], counter: '#8a5a34', goods: [[1, '#c8ccd4'], [4, '#d09040'], [8, '#c8ccd4']], steam: true },
  icecream: { awning: ['#3a7ad0', '#f4f4f4'], counter: '#e8eef4', goods: [[1, '#f4c8d8'], [4, '#f4f0e0'], [7, '#8a5a3a']], steam: false },
  moroshka: { awning: ['#e8a030', '#f8f0dc'], counter: '#8a5a34', goods: [[1, '#f0a040'], [4, '#e89030'], [8, '#f0a040']], steam: false },
};
export const STALL_X = { treska: 150, teastall: 196, icecream: 236, moroshka: 276 };
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1, d = env.local.getUTCDate(), out = [];
  if (h >= 9 && h < 19) out.push('treska');
  if ((mo >= 10 || mo <= 4) && h >= 10 && h < 19) out.push('teastall');
  if (((mo === 6 && d >= 15) || mo === 7 || (mo === 8 && d <= 15)) && h >= 11 && h < 21) out.push('icecream');
  if (((mo === 7 && d >= 25) || mo === 8 || (mo === 9 && d <= 10)) && h >= 10 && h < 20) out.push('moroshka');
  return out;
}
const LANES = [{ x0: 90, x1: PORT.x0, y: 158 }, { x0: BRIDGE.x0, x1: BRIDGE.x1, y: BRIDGE.deck }];
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: STALL_KINDS[k], x: STALL_X[k] }))); }

// ---------- секреты Мурманска ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
const clearSky = (env, maxCloud) => env.weather.cloud <= maxCloud && !['rain', 'storm', 'snow', 'fog'].includes(env.weather.kind);
const nightIdx = (env) => Math.floor((env.ms / 1000 - 9 * 3600) / 86400); // «ночь» считается от местного полудня

function drawAurora(b, env, st, dayF) {
  const t = env.ms / 1000, k = (1 - dayF * 0.85) * st.p;
  // общее зеленоватое свечение неба
  const glow = b.createLinearGradient(0, 0, 0, 110);
  glow.addColorStop(0, 'rgba(90,255,160,0)'); glow.addColorStop(0.6, `rgba(90,255,160,${0.07 * k})`); glow.addColorStop(1, 'rgba(90,255,160,0)');
  b.fillStyle = glow; b.fillRect(0, 0, W, 110);
  const band = (x0, x1, yMid, amp, len0, speed, gain) => {
    for (let x = x0; x < x1; x++) {
      const low = Math.round(yMid + amp * Math.sin(x * 0.012 + t * 0.05 * speed) + amp * 0.6 * Math.sin(x * 0.031 - t * 0.09 * speed));
      const len = Math.round(len0 + 12 * Math.sin(x * 0.02 + t * 0.07));
      const ray = 0.45 + 0.55 * Math.max(0, Math.sin(x * 0.33 + t * 0.9 * speed + Math.sin(x * 0.05 + t * 0.2) * 3));
      const edge = Math.min(1, (x - x0) / 50, (x1 - x) / 50);
      const a = k * gain * edge * (0.55 + 0.45 * ray);
      if (a < 0.01) continue;
      const floor = skyFloor(x);
      for (let s = 0; s < len; s += 2) {
        const y = low - s; if (y < 0) break; if (y >= floor) continue;
        b.globalAlpha = Math.min(1, a * (1 - s / len) * (0.5 + 0.5 * ray)); b.fillStyle = s < 6 ? '#8affc0' : '#5aff9a'; b.fillRect(x, y, 1, 2);
      }
      if (low + 1 < floor) { b.globalAlpha = Math.min(1, a * 0.9); b.fillStyle = '#ff6ab4'; b.fillRect(x, low + 1, 1, 2); } // розовая кромка
      const top = low - len;
      if (top > 0) { b.globalAlpha = a * 0.35; b.fillStyle = '#a07aff'; b.fillRect(x, top - 4, 1, 4); }
    }
  };
  band(10, 470, 62, 9, 34, 1, 0.55);  // главный занавес
  band(60, 400, 34, 6, 20, 1.6, 0.3);  // вторая дуга выше
  b.globalAlpha = 1;
}

export const SECRETS = [
  {
    id: 'aurora', name: 'Северное сияние', layer: 'sky',
    hint: 'Ясными тёмными ночями с сентября по апрель небо над заливом иногда начинает переливаться.',
    found: 'Мурманск лежит под авроральным овалом — сияние здесь видно часто, но не каждую ночь: нужна тёмная ночь, ясное небо и активное Солнце.',
    state(env) {
      if (!env.forced) {
        const mo = month(env);
        if (!(mo >= 9 || mo <= 4) || env.sun.alt > -12 || !clearSky(env, 40)) return null;
        const n = nightIdx(env);
        if (rng(n * 7919 + 57)() > 0.3) return null;            // активная ночь — примерно каждая третья
        if (!inWin(env, 2700, 1700, (n * 613) % 2700)) return null; // вспышки идут волнами
      }
      const p = env.forced ? 1 : Math.min(1, phase(env, 2700, 1700, (nightIdx(env) * 613) % 2700) * 6, (1 - phase(env, 2700, 1700, (nightIdx(env) * 613) % 2700)) * 6);
      return { x: 20, y: 6, w: 440, h: 44, p };
    },
    draw: drawAurora,
  },
  {
    id: 'midnightsun', name: 'Солнце в полночь', layer: 'sky',
    hint: 'Летом около полуночи сопки над городом вдруг светятся золотом.',
    found: 'Полярный день: примерно с 22 мая по 22 июля солнце в Мурманске не заходит. В полночь оно стоит низко на севере, левее окна, и подсвечивает сопки и «Алёшу».',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(env.sun.alt > 0 && (h >= 23 || h < 2) && clearSky(env, 70))) return null;
      return { x: 30, y: 14, w: 70, h: 40 };
    },
    draw(b) {
      const gr = b.createRadialGradient(0, 80, 4, 0, 80, 200);
      gr.addColorStop(0, 'rgba(255,200,110,0.45)'); gr.addColorStop(0.5, 'rgba(255,180,100,0.15)'); gr.addColorStop(1, 'rgba(255,180,100,0)');
      b.fillStyle = gr; b.fillRect(0, 0, 260, HORIZON);
      b.fillStyle = '#ffd27a';
      for (let x = 0; x < 300; x++) { b.globalAlpha = Math.max(0, 0.85 - x / 320); b.fillRect(x, ridge(x), 1, 1); }
      b.globalAlpha = 0.8; b.fillRect(ALYOSHA.x - 2, ALYOSHA.base - 22, 1, 17); b.fillRect(ALYOSHA.x - 1, ALYOSHA.base - 25, 1, 3);
      b.globalAlpha = 1;
    },
  },
  {
    id: 'firstsun', name: 'Первый луч после полярной ночи', layer: 'sky',
    hint: 'В середине января, в полдень, на юге над сопками впервые за полтора месяца что-то вспыхивает.',
    found: 'Полярная ночь в Мурманске длится со 2 декабря по 11 января. Первое солнце встречают всем городом, а в последнее воскресенье января празднуют «Здравствуй, Солнце!».',
    state(env) {
      const l = env.local, d = l.getUTCDate(), h = l.getUTCHours();
      if (!env.forced && !(month(env) === 1 && d >= 11 && d <= 20 && h >= 11 && h < 14 && env.sun.alt > -1.5 && clearSky(env, 80))) return null;
      return { x: 410, y: 60, w: 60, h: 40 };
    },
    draw(b, env) {
      const t = env.ms / 1000;
      const gr = b.createRadialGradient(W + 20, 116, 4, W + 20, 116, 150);
      gr.addColorStop(0, 'rgba(255,200,120,0.9)'); gr.addColorStop(0.45, 'rgba(255,170,130,0.35)'); gr.addColorStop(1, 'rgba(255,150,150,0)');
      b.fillStyle = gr; b.fillRect(300, 20, 180, HORIZON - 20);
      b.fillStyle = '#ffe0a0';
      for (let i = 0; i < 6; i++) { // лучи веером из-за правого края
        const a = Math.PI + 0.12 + i * 0.1, len = 90 + 20 * Math.sin(t * 0.7 + i);
        b.globalAlpha = 0.3;
        for (let s = 20; s < len; s += 2) b.fillRect(Math.round(W + 20 + Math.cos(a) * s), Math.round(116 - Math.sin(a) * s * 0.9), 2, 1);
      }
      for (let x = 300; x < W; x++) { b.globalAlpha = Math.max(0, (x - 300) / 180); b.fillRect(x, ridge(x), 1, 2); }
      b.globalAlpha = 1;
    },
  },
  {
    id: 'seal', name: 'Тюлень в заливе', layer: 'street',
    hint: 'Днём в заливе иногда появляется круглая голова — и тут же исчезает.',
    found: 'В Кольский залив заходят тюлени: их замечали у причалов прямо в городе. Чаще всего это пятнистый тюлень, кольчатая нерпа здесь редкость.',
    state(env) {
      if (!env.forced && env.sun.alt < -6) return null;
      if (!inWin(env, 2100, 70, 900)) return null;
      const p = phase(env, 2100, 70, 900);
      return { x: Math.round(300 + Math.sin(p * 3) * 20), y: 184, w: 6, h: 5, up: env.forced || Math.sin(secT(env) * 0.9) > -0.3 };
    },
    draw(ctx, env, st, dayF) {
      const t = env.ms / 1000, { x, y, up } = st;
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#e8f0ff';
      const r = 4 + ((t * 3) % 4);
      ctx.fillRect(Math.round(x + 2 - r), y + 4, Math.round(r * 2 + 2), 1);
      ctx.globalAlpha = 1;
      if (!up) return;
      ctx.fillStyle = mixHex('#141418', '#4a4640', dayF); ctx.fillRect(x + 1, y + 1, 4, 3); ctx.fillRect(x + 2, y, 2, 1);
      ctx.fillStyle = mixHex('#1c1c20', '#6a645c', dayF); ctx.fillRect(x + 4, y + 2, 2, 1); // морда
      ctx.fillStyle = '#0a0a0c'; ctx.fillRect(x + 3, y + 1, 1, 1);
    },
  },
  {
    id: 'newyear', name: 'Новогодний салют над заливом', layer: 'sky',
    hint: 'Раз в году, ровно после полуночи, над городом на сопках расцветает небо.',
    found: 'В новогоднюю ночь над Мурманском запускают салют — а на дворе полярная ночь, так что небо тёмное и днём.',
    state(env) {
      const l = env.local;
      if (!env.forced && !(month(env) === 1 && l.getUTCDate() === 1 && l.getUTCHours() === 0 && l.getUTCMinutes() < 30)) return null;
      return { x: 140, y: 20, w: 200, h: 60 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 240, 36, dayF); },
  },
];

// События по новостям (data/events.json): fireworks — салют над городом
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 240, 40, dayF); }
