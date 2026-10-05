// Вологда: вид с набережной VI Армии (Заречье, правый берег) на юг, через реку Вологду.
// Точка ~59.2265 N, 39.8840 E, взгляд на азимут ~172°. Слева направо: Октябрьский мост,
// здание бывшего Госбанка (Музей кружева), Воскресенский собор, колокольня Софийского собора,
// Софийский собор, Архиерейский двор (Вологодский кремль). На нашем берегу — деревянный дом
// с резными наличниками. Художественное сжатие по горизонтали, взаимный порядок сохранён.

import { rng, mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawPerson, drawFireworks } from '../../engine/street.js';

const DAY = {
  far: '#9aa2b0', farDark: '#8890a0', farRoof: '#737c8e',
  ground: '#6f8a5a', groundDark: '#5c7549', tree: '#3e6b3d', treeDark: '#2f5531',
  wall: '#f4f1e8', wallShade: '#d6d1c4', trim: '#e2dccd', win: '#5e5a68', roofDark: '#5a5f68',
  silver: '#c9ced6', silverDark: '#98a0ac', gold: '#e2b444', goldDark: '#b08428', dial: '#f4efdc',
  ochre: '#e6d2a0', ochreShade: '#c8b27e', ivory: '#efe6d2', ivoryShade: '#d0c6b0',
  domeG: '#4f6e62', domeGDark: '#3c574d',
  bridge: '#c4c0b6', bridgeDark: '#8e8a82', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a',
  ground: '#141c1c', groundDark: '#101616', tree: '#151d1f', treeDark: '#101719',
  wall: '#a09a8c', wallShade: '#7c776c', trim: '#8a8476', win: '#1a1420', roofDark: '#1e2230',
  silver: '#8c94a4', silverDark: '#646c7c', gold: '#c89a3a', goldDark: '#8a6a28', dial: '#d8cfa8',
  ochre: '#8a7c5c', ochreShade: '#6a5e46', ivory: '#948a76', ivoryShade: '#746c5c',
  domeG: '#243a34', domeGDark: '#1a2a26',
  bridge: '#6a6e78', bridgeDark: '#44485a', snow: '#6a7488',
};
const AUTUMN = { day: { tree: '#c8963a', treeDark: '#9a6a2a', ground: '#86884a', groundDark: '#6e703a' }, night: { tree: '#221c16', treeDark: '#1a1511' } };
const WINTER = { day: { tree: '#5d5853', treeDark: '#48443f', ground: '#e4eaf0', groundDark: '#c8d0da' }, night: { tree: '#1a1a1e', treeDark: '#141418', ground: '#2c3244', groundDark: '#242a3a' } };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Купол: строки ширины от вершины вниз, тёмная кромка справа
function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}
const cross = (R, cx, top) => { R('gold', cx, top, 1, 7); R('gold', cx - 2, top + 2, 5, 1); R('gold', cx - 1, top + 5, 3, 1); };

// Координаты ориентиров (их же используют HOTSPOTS в index.js)
const BRIDGE = { x0: 58, x1: 192, deck: 150 };
const BELFRY_X = 329, CLOCK = { x: 329, y: 92 };
const SOFIA = { x: 344, w: 60, c: 374 };

export function drawFar({ g, P, winter, r, L, R }) {
  // дальний город на левом берегу
  for (let x = 0; x < W;) {
    const w = 6 + ((r() * 12) | 0), h = 4 + ((r() * 12) | 0), top = 152 - h;
    R(r() < 0.5 ? 'far' : 'farDark', x, top, w, h); R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < 150; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.3) L(xx, yy, 'win');
    x += w;
  }
  R('ground', 0, 150, W, 18);

  // бывшее здание Госбанка на Кремлёвской площади — Музей кружева
  R('ochre', 214, 128, 36, 24); R('ochreShade', 244, 128, 6, 24);
  R('roofDark', 212, 125, 40, 3); R('trim', 214, 138, 36, 1);
  if (winter) R('snow', 212, 124, 40, 1);
  for (let x = 217; x < 244; x += 5) { R('win', x, 131, 2, 4); R('win', x, 142, 2, 5); L(x, 131, 'win'); }
  L(232, 150, 'flood', '#ffe0b0', 0);

  // Воскресенский собор (1772–1776): барочный объём, барабан, купол с фонариком
  R('ivory', 268, 116, 38, 36); R('ivoryShade', 298, 116, 8, 36);
  R('roofDark', 266, 112, 42, 4); if (winter) R('snow', 266, 111, 42, 1);
  for (const x of [276, 287, 298]) R('ivoryShade', x, 116, 1, 36);
  for (const x of [271, 281, 292, 301]) { R('win', x, 122, 2, 6); R('win', x, 137, 2, 6); }
  R('ivory', 281, 98, 12, 14); R('ivoryShade', 289, 98, 4, 14);
  for (let x = 283; x < 291; x += 3) R('win', x, 101, 1, 7);
  dome(R, 287, 86, [4, 8, 10, 12, 14, 14, 14, 14, 16, 16, 16, 16], 'domeG', 'domeGDark');
  R('ivory', 285, 80, 4, 6); dome(R, 287, 76, [2, 4, 4, 4], 'domeG', 'domeGDark');
  R('gold', 287, 69, 1, 7); R('gold', 285, 71, 5, 1);
  L(287, 150, 'flood', '#ffe6c0', 0);

  // Архиерейский двор (Вологодский кремль): Симоновский корпус за стеной, стена, угловая башня
  R('ivory', 414, 116, 62, 22); R('ivoryShade', 468, 116, 8, 22);
  for (let i = 0; i < 6; i++) R('roofDark', 418 - i, 110 + i, 54 + i * 2, 1);
  if (winter) R('snow', 418, 110, 54, 1);
  for (let x = 418; x < 466; x += 5) { R('win', x, 121, 2, 4); R('win', x, 129, 2, 4); L(x, 121, 'win'); }
  R('wall', 404, 136, 76, 16); R('wallShade', 404, 136, 76, 1); R('wallShade', 404, 150, 76, 2);
  R('wall', 402, 122, 12, 30); R('wallShade', 411, 122, 3, 30); R('win', 406, 128, 2, 3); R('win', 406, 140, 2, 3);
  for (let i = 0; i < 12; i++) { const w = Math.max(1, Math.round(14 - i * 1.2)); R(winter && i > 8 ? 'snow' : 'roofDark', 408 - (w >> 1), 121 - i, w, 1); }
  R('gold', 408, 106, 1, 4);
  L(440, 150, 'flood', '#ffe0b0', 0);

  // колокольня Софийского собора: нижний ярус XVII века, надстройка 1869–1870, 78,5 м
  const B = BELFRY_X;
  R('wall', 318, 124, 22, 28); R('wallShade', 336, 124, 4, 28); R('trim', 317, 123, 24, 1);
  R('win', 322, 132, 3, 6); R('win', 333, 132, 3, 6); R('win', 327, 142, 4, 10);
  R('wall', 320, 100, 18, 23); R('wallShade', 334, 100, 4, 23); R('trim', 319, 99, 20, 1);
  for (const x of [323, 330]) { R('win', x, 105, 4, 13); R('win', x + 1, 104, 2, 1); }  // ярус звона
  R('wall', 321, 86, 16, 13); R('wallShade', 333, 86, 4, 13); R('trim', 320, 85, 18, 1);
  R('dial', 327, 89, 5, 1); R('dial', 326, 90, 7, 5); R('dial', 327, 95, 5, 1);          // циферблат курантов
  R('wall', 323, 66, 12, 19); R('wallShade', 332, 66, 3, 19); R('trim', 322, 65, 14, 1);
  for (const x of [325, 330]) { R('win', x, 72, 3, 11); R('win', x + 1, 70, 1, 2); }     // стрельчатые проёмы
  for (const x of [322, 335]) { R('wall', x, 59, 1, 7); R('gold', x, 57, 1, 2); }       // пинакли
  R('wall', 325, 54, 8, 12); R('wallShade', 331, 54, 2, 12);                             // восьмерик
  dome(R, B, 42, [3, 5, 7, 8, 9, 10, 10, 10, 9, 8, 8, 9], 'gold', 'goldDark');          // золочёный купол
  for (let i = 0; i < 10; i++) R('gold', B - (i > 6 ? 1 : 0), 32 + i, i > 6 ? 3 : 1, 1); // шпиль
  R('gold', B, 24, 1, 8); R('gold', B - 2, 26, 5, 1); R('gold', B - 1, 29, 3, 1);        // крест
  if (winter) { R('snow', 317, 123, 24, 1); R('snow', 319, 99, 20, 1); R('snow', 320, 85, 18, 1); }
  L(B, 150, 'flood', '#fff0d0', 0);

  // Софийский собор (1568–1570): белый куб, закомары, пять лужёных глав-луковиц
  const { x: SX, w: SW, c: SC } = SOFIA;
  R('roofDark', SX + 2, 96, SW - 4, 6);
  for (let i = 0; i < 4; i++) { const x0 = SX + i * 15; [7, 11, 13, 15, 15, 15].forEach((w, k) => R(i === 3 ? 'wallShade' : 'wall', x0 + ((15 - w) >> 1), 96 + k, w, 1)); }
  if (winter) for (let i = 0; i < 4; i++) R('snow', SX + i * 15 + 4, 96, 7, 1);
  R('wall', SX, 102, SW, 50); R('wallShade', SX + SW - 7, 102, 7, 50);
  for (const x of [SX + 15, SX + 30, SX + 45]) R('wallShade', x, 100, 1, 52);             // лопатки
  for (let i = 0; i < 4; i++) { const cx = SX + 7 + i * 15; R('win', cx, 112, 1, 7); R('win', cx, 130, 1, 7); }
  const drum = (cx, top, w, h) => { R('wall', cx - (w >> 1), top, w, h); R('wallShade', cx + (w >> 1) - 2, top, 2, h); for (let x = cx - (w >> 1) + 1; x < cx + (w >> 1) - 1; x += 3) R('win', x, top + 3, 1, h - 6); };
  const ONION_S = [1, 3, 5, 7, 8, 9, 9, 9, 8, 7, 6, 7];
  const ONION_L = [1, 3, 5, 8, 10, 12, 13, 14, 14, 14, 13, 12, 11, 10, 9, 10, 11];
  for (const cx of [362, 386]) { drum(cx, 82, 7, 14); dome(R, cx, 70, ONION_S, 'silver', 'silverDark'); cross(R, cx, 63); }
  drum(SC, 78, 11, 18); dome(R, SC, 61, ONION_L, 'silver', 'silverDark'); cross(R, SC, 54);
  for (const cx of [352, 396]) { drum(cx, 86, 7, 10); dome(R, cx, 74, ONION_S, 'silver', 'silverDark'); cross(R, cx, 67); }
  L(SC, 150, 'flood', '#fff4dc', 0);

  // деревья Кремлёвского сада и левого берега
  for (let x = 196; x < W; x += 3) { const h = 5 + ((r() * 7) | 0), top = 153 - h; const c = r() < 0.5 ? 'tree' : 'treeDark'; R(c, x, top + 1, 5, h + 1); R(c, x + 1, top, 3, 1); }
  for (let x = 0; x < 70; x += 3) { const h = 4 + ((r() * 6) | 0), top = 153 - h; const c = r() < 0.5 ? 'tree' : 'treeDark'; R(c, x, top + 1, 5, h + 1); R(c, x + 1, top, 3, 1); }
  // береговой откос и фонари дорожки вдоль реки
  R('ground', 0, 155, W, 3); R('groundDark', 0, 158, W, 10);
  for (let x = 204; x < 476; x += 22) { R('bridgeDark', x, 151, 1, 5); L(x, 150, 'lamp', '#ffd88a', 0); }

  // Октябрьский мост (1928–1931): три пролёта, средний — судоходная арка
  const { x0: BX0, x1: BX1, deck: DY } = BRIDGE;
  R('bridge', BX0, DY - 3, BX1 - BX0, 1);
  for (let x = BX0; x < BX1; x += 2) R('bridgeDark', x, DY - 2, 1, 2);                   // перила
  if (winter) R('snow', BX0, DY - 4, BX1 - BX0, 1);
  R('bridge', BX0, DY, BX1 - BX0, 3); R('bridgeDark', BX0, DY + 3, BX1 - BX0, 1);
  R('bridgeDark', BX0, DY + 4, 49, 2); R('bridgeDark', 146, DY + 4, BX1 - 146, 2);        // балки боковых пролётов
  R('bridge', BX0, DY + 4, 5, 14); R('bridge', BX1 - 5, DY + 4, 5, 14);                   // устои
  for (const px of [102, 146]) { R('bridge', px, DY + 4, 5, 14); R('bridgeDark', px + 3, DY + 4, 2, 14); } // быки
  for (let x = 107; x < 146; x++) {
    const top = Math.round(166 - 11 * Math.sin(Math.PI * (x - 107) / 39));
    R('bridge', x, top, 1, 2);
    if (x % 4 === 0 && top > DY + 4) R('bridgeDark', x, DY + 4, 1, top - DY - 4);          // стойки над аркой
  }
  for (let x = BX0 + 8; x < BX1; x += 24) { R('bridgeDark', x, DY - 6, 1, 3); L(x, DY - 7, 'lamp', '#ffe2a0', 0); }
}

// ---------- стрелки курантов (показывают настоящее время) и ночная подсветка ----------
function drawClock(b, env, dayF) {
  const l = env.local, m = l.getUTCMinutes(), hh = (l.getUTCHours() % 12) + m / 60;
  b.fillStyle = mixHex('#e0b448', '#2a2a30', dayF);
  const hand = (a, len) => { for (let i = 0; i <= len; i++) b.fillRect(Math.round(CLOCK.x + Math.sin(a) * i), Math.round(CLOCK.y - Math.cos(a) * i), 1, 1); };
  hand((m / 60) * Math.PI * 2, 3); hand((hh / 12) * Math.PI * 2, 2);
}

export function drawNight(g, env, nightF) {
  if (nightF < 0.05) return;
  // тёплая подсветка белых стен собора и колокольни
  const s = g.createRadialGradient(SOFIA.c, 118, 4, SOFIA.c, 118, 52);
  s.addColorStop(0, `rgba(255,236,200,${0.2 * nightF})`); s.addColorStop(1, 'rgba(255,236,200,0)');
  g.fillStyle = s; g.fillRect(SOFIA.c - 56, 60, 112, 94);
  const bg = g.createRadialGradient(BELFRY_X, 48, 1, BELFRY_X, 48, 20);
  bg.addColorStop(0, `rgba(255,200,110,${0.28 * nightF})`); bg.addColorStop(1, 'rgba(255,200,110,0)');
  g.fillStyle = bg; g.fillRect(BELFRY_X - 20, 28, 40, 40);
  // светящийся циферблат курантов
  g.globalAlpha = nightF * 0.8; g.fillStyle = '#fff2c4';
  g.fillRect(327, 89, 5, 1); g.fillRect(326, 90, 7, 5); g.fillRect(327, 95, 5, 1);
  // блики на лужёных главах
  g.globalAlpha = nightF * 0.45; g.fillStyle = '#e8f0ff';
  for (const [x, y] of [[372, 65], [360, 73], [384, 73], [350, 77], [394, 77]]) g.fillRect(x, y, 1, 4);
  g.globalAlpha = 1;
}

export function drawAboveLate(b, env, dayF, t) {
  drawClock(b, env, dayF); // после drawNight — стрелки поверх светящегося циферблата
  drawCars(b, env, dayF, t);
}

// ---------- река: прогулочный теплоход, деревянный дом на нашем берегу, набережная ----------
export function drawBoats(ctx, env, dayF, t) {
  drawBoat(ctx, env, dayF);
  drawHouse(ctx, env, dayF);
  drawPromenade(ctx, env, dayF, t);
}

function drawBoat(ctx, env, dayF) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 10 || h > 21) return;
  const p = ((env.ms / 1000 + 60) % 540) / 220;
  if (p >= 1) return;
  const x = Math.round(-40 + p * 540), y = 188, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 30, 4);
  ctx.fillStyle = mixHex('#1a1e28', '#2a4a7a', dayF); ctx.fillRect(x + 1, y + 4, 28, 2);
  ctx.fillStyle = mixHex('#30343e', '#e0e0dc', dayF); ctx.fillRect(x + 5, y - 4, 18, 4);
  ctx.fillStyle = mixHex('#1a1e28', '#c8423a', dayF); ctx.fillRect(x + 4, y - 5, 20, 1);
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7;
  for (let i = 0; i < 5; i++) ctx.fillRect(x + 7 + i * 3, y - 3, 2, 1);
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x - 6, y + 6, 8, 1);
  ctx.globalAlpha = 1;
}

// Деревянный дом Заречья: обшивка тёсом, фронтон с причелинами и полотенцем,
// окна в резных наличниках с кокошниками и подзорами — вологодское «деревянное кружево».
export const HOUSE = { x0: 38, x1: 86, cx: 62, top: 160, lace: { x: 59, y: 164 } };
function drawHouse(ctx, env, dayF) {
  const nightF = 1 - dayF, dim = (c) => mixHex('#101218', c, 0.3 + dayF * 0.7);
  const F = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const { x0: X0, x1: X1, cx: CX, top: TOP } = HOUSE;
  const wall = dim('#5f8270'), board = dim('#4e6d5d'), lace = dim('#f2eee4'), laceD = dim('#bdb6a6');
  const roof = env.winter ? dim('#e8eef4') : dim('#5a5e66');
  const hr = env.local.getUTCHours(), evening = nightF > 0.3 && (hr >= 16 || hr < 1 || (hr >= 6 && hr < 9));
  const glass = (lit) => (lit ? mixHex('#3a4452', '#ffcf7a', Math.min(1, nightF * 1.4)) : dim('#2a3442'));

  F(dim(env.winter ? '#e6ecf2' : '#5a7a48'), X0 - 12, 196, X1 - X0 + 28, 4);                   // берег
  F(wall, X0, TOP, X1 - X0, 34);
  for (let y = TOP + 2; y < 194; y += 3) F(board, X0, y, X1 - X0, 1);           // тёс
  F(dim('#3e3026'), X0 - 1, 193, X1 - X0 + 2, 4);                               // цоколь
  F(lace, X0, TOP, 2, 34); F(lace, X1 - 2, TOP, 2, 34);                          // угловые доски
  F(lace, X0 - 1, 178, X1 - X0 + 2, 1); for (let x = X0; x < X1; x += 2) F(laceD, x, 179, 1, 1); // пояс
  // фронтон
  for (let i = 0; i <= 20; i++) { const hw = Math.round(i * 1.25); F(i % 3 === 2 ? board : wall, CX - hw, 140 + i, hw * 2, 1); }
  // кровля и резные причелины с «капельками»
  for (let i = 0; i <= 22; i++) {
    const e = Math.round(i * 1.25);
    F(roof, CX - e - 2, 138 + i, 3, 1); F(roof, CX + e - 1, 138 + i, 3, 1);
    if (i >= 2 && i <= 21) { F(lace, CX - e + 1, 139 + i, 1, 1); F(lace, CX + e - 2, 139 + i, 1, 1); }
    if (i >= 3 && i <= 20 && i % 3 === 0) { F(lace, CX - e + 2, 140 + i, 1, 2); F(lace, CX + e - 3, 140 + i, 1, 2); }
  }
  F(lace, CX - 1, 140, 3, 7); F(laceD, CX, 142, 1, 3); F(lace, CX - 1, 147, 1, 1); F(lace, CX + 1, 147, 1, 1); // полотенце
  // светёлка во фронтоне: полукруглое окно
  F(glass(false), CX - 3, 150, 6, 6);
  F(lace, CX - 2, 147, 4, 1); F(lace, CX - 3, 148, 6, 1); F(lace, CX - 4, 149, 1, 7); F(lace, CX + 3, 149, 1, 7);
  F(lace, CX, 150, 1, 6); F(lace, CX - 5, 156, 10, 1);
  // окна в наличниках
  const win = (x, y, lit) => {
    F(glass(lit), x, y, 6, 8);
    F(lace, x + 3, y, 1, 8); F(lace, x, y + 3, 6, 1);                              // переплёт
    F(lace, x - 1, y - 1, 1, 10); F(lace, x + 6, y - 1, 1, 10);                    // боковые доски
    F(lace, x - 2, y - 2, 10, 1);                                                  // карниз
    for (let i = 1; i < 4; i++) F(lace, x - 2 + i, y - 2 - i, 10 - i * 2, 1);      // кокошник
    F(laceD, x + 2, y - 4, 2, 1);                                                  // прорезь
    F(lace, x - 2, y + 8, 10, 1);                                                  // подоконная доска
    for (let i = 0; i < 5; i++) F(lace, x - 2 + i * 2, y + 9, 1, 1 + (i % 2));     // подзор
    if (lit && nightF > 0.3) {
      const gr = ctx.createRadialGradient(x + 3, y + 4, 0, x + 3, y + 4, 12);
      gr.addColorStop(0, `rgba(255,200,120,${0.22 * nightF})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 9, y - 8, 24, 24);
    }
  };
  win(X0 + 4, 164, false); win(HOUSE.lace.x, HOUSE.lace.y, false); win(X0 + 38, 164, evening && hr >= 18);
  win(X0 + 4, 184, evening); win(X0 + 21, 184, evening && hr < 23); win(X0 + 38, 184, false);
}

// Сувенир на подоконнике — кружевная салфетка и брусок вологодского масла
export function drawSill(R, SILL) {
  const x = 426;
  R('#f4f2ec', x + 2, SILL - 1, 20, 2); R('#e2ded4', x + 4, SILL + 1, 16, 1);
  for (let i = 0; i < 11; i++) R('#f4f2ec', x + 1 + i * 2, SILL + (i % 2), 1, 1);     // зубчики кромки
  for (let i = 0; i < 6; i++) R('#cfc9bc', x + 4 + i * 3, SILL - 1, 1, 1);            // узор-«решётка»
  R('#f2e6b8', x + 8, SILL - 5, 9, 4); R('#e8d690', x + 8, SILL - 2, 9, 1);           // брусок в обёртке
  R('#2a5aa8', x + 8, SILL - 4, 9, 1); R('#ffffff', x + 11, SILL - 4, 3, 1);           // синяя полоса этикетки
}

// ---------- улица: машины на мосту, набережная с ларьками (движок — engine/street.js) ----------
export const STALL_KINDS = {
  plombir: { awning: ['#f0c838', '#f8f4e8'], counter: '#e8eef4', goods: [[1, '#f8f0d0'], [4, '#f4e8b0'], [8, '#f8f0d0']], steam: false },
  teastall: { awning: ['#a83a32', '#f0e0c0'], counter: '#8a5a34', goods: [[1, '#b07a3a'], [4, '#c8ccd4'], [8, '#b07a3a']], steam: true },
  lace: { awning: ['#2a4a8a', '#f4f4f4'], counter: '#f0ece0', goods: [[1, '#ffffff'], [5, '#ffffff'], [9, '#ffffff']], steam: false },
};
export const STALL_X = { plombir: 150, teastall: 236, lace: 322 };
// Какие ларьки работают сейчас
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1, out = [];
  if (mo >= 5 && mo <= 9 && h >= 10 && h < 21) out.push('plombir');
  if ((mo >= 10 || mo <= 4) && h >= 10 && h < 19) out.push('teastall');
  if (h >= 10 && h < 18) out.push('lace');
  return out;
}
const LANES = [{ x0: BRIDGE.x0, x1: BRIDGE.x1, y: BRIDGE.deck }]; // Октябрьский мост
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: STALL_KINDS[k], x: STALL_X[k] }))); }

// ---------- секреты Вологды ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
export const SECRETS = [
  {
    id: 'lacemaker', name: 'Кружевница у окна', layer: 'street',
    hint: 'Долгими вечерами в окне деревянного дома кто-то тихо перебирает коклюшки.',
    found: 'Вологодское кружево плетут на коклюшках из можжевельника или берёзы — по сколку, на валике.',
    state(env) {
      const mo = month(env), h = env.local.getUTCHours();
      if (!env.forced && !((mo >= 10 || mo <= 3) && h >= 17 && h < 23)) return null;
      if (!inWin(env, 2400, 420, 1500)) return null;
      return { x: HOUSE.lace.x, y: HOUSE.lace.y, w: 6, h: 8 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, t = env.ms / 1000;
      const gr = ctx.createRadialGradient(x + 3, y + 4, 0, x + 3, y + 4, 12);
      gr.addColorStop(0, `rgba(255,200,120,${0.1 + 0.2 * (1 - dayF)})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 9, y - 8, 24, 24);
      ctx.fillStyle = '#ffd68a'; ctx.fillRect(x, y, 6, 8);                                  // тёплое окно
      ctx.fillStyle = '#3a2a24'; ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x, y + 3, 3, 5); // кружевница
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x + 3, y + 5, 3, 2);                          // валик с кружевом
      ctx.fillStyle = '#8a5a34'; const k = Math.floor(t * 4) % 3;
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i, y + 3 + (i === k ? 0 : 1), 1, 1);   // коклюшки
    },
  },
  {
    id: 'troika', name: 'Тройка Деда Мороза', layer: 'street',
    hint: 'В декабре по льду реки иногда проносится кто-то с бубенцами.',
    found: 'Вотчина Деда Мороза — в Великом Устюге, в нашей же Вологодской области, в 450 км отсюда. Перед Новым годом он путешествует по стране и заезжает в Вологду.',
    state(env) {
      const l = env.local, mo = month(env), d = l.getUTCDate(), h = l.getUTCHours();
      if (!env.forced && !((mo === 12 || (mo === 1 && d <= 13)) && env.frozen && h >= 15 && h < 23)) return null;
      if (!inWin(env, 1800, 40, 700)) return null;
      const p = phase(env, 1800, 40, 700); return { x: Math.round(490 - p * 540), y: 178, w: 30, h: 10 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, t = env.ms / 1000, gal = Math.floor(t * 8) % 2;
      const horse = mixHex('#1a1410', '#4a3222', dayF), coat = mixHex('#5a1a1a', '#d83a3a', dayF);
      for (const [dx, dy] of [[4, 2], [0, 3], [2, 4]]) {                                     // три коня
        ctx.fillStyle = horse; ctx.fillRect(x + dx + 1, y + dy, 7, 3); ctx.fillRect(x + dx, y + dy - 2, 2, 3);
        ctx.fillRect(x + dx + 1 + gal, y + dy + 3, 1, 2); ctx.fillRect(x + dx + 6 - gal, y + dy + 3, 1, 2);
      }
      ctx.fillStyle = mixHex('#5a1a1a', '#c8423a', dayF); ctx.fillRect(x + 5, y - 1, 5, 1); ctx.fillRect(x + 5, y, 1, 2); ctx.fillRect(x + 9, y, 1, 2); // дуга
      ctx.fillStyle = '#f0c040'; ctx.fillRect(x + 7, y + 1, 1, 1);                           // бубенец
      ctx.fillStyle = mixHex('#2a2a2a', '#6a4a2a', dayF); ctx.fillRect(x + 10, y + 4, 5, 1); // вожжи
      ctx.fillStyle = mixHex('#4a1410', '#b8302a', dayF); ctx.fillRect(x + 14, y + 3, 11, 4); ctx.fillRect(x + 23, y, 2, 3); // сани
      ctx.fillStyle = '#e0b040'; ctx.fillRect(x + 13, y + 7, 13, 1); ctx.fillRect(x + 13, y + 6, 1, 1); // полозья
      ctx.fillStyle = coat; ctx.fillRect(x + 16, y - 2, 4, 5); ctx.fillRect(x + 16, y - 5, 3, 2); // Дед Мороз
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x + 16, y - 3, 3, 1); ctx.fillRect(x + 16, y - 1, 2, 2); // опушка и борода
      ctx.fillStyle = '#e8c0a0'; ctx.fillRect(x + 16, y - 2, 2, 1);
      ctx.fillStyle = mixHex('#4a1410', '#c8423a', dayF); ctx.fillRect(x + 20, y - 1, 3, 4); ctx.fillStyle = '#e0b040'; ctx.fillRect(x + 21, y - 2, 1, 1); // мешок
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.5 - i * 0.07; ctx.fillRect(x + 27 + i * 3, y + 6 - (i + gal) % 2, 2, 1); } // снежная пыль
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'aurora', name: 'Северное сияние', layer: 'sky',
    hint: 'Очень редко, ясной ночью с осени до весны, небо над колокольней зеленеет.',
    found: 'На широте Вологды сияние видно только в сильные магнитные бури — в области его наблюдали, например, 7 октября 2024 года и в ночь на 21 марта 2026-го.',
    state(env) {
      if (!env.forced) {
        const mo = month(env);
        if (!(mo >= 9 || mo <= 3) || env.sun.alt > -12 || env.weather.cloud > 50) return null;
        const night = Math.floor((env.ms / 1000 - 9 * 3600) / 86400); // «ночь» от местного полудня
        if (rng(night * 7919 + 31)() > 0.03) return null;
      }
      return { x: 40, y: 6, w: 400, h: 40 };
    },
    draw(b, env, st, dayF) {
      const t = env.ms / 1000, k = 1 - dayF * 0.9;
      for (let x = st.x; x < st.x + st.w; x++) {
        const wave = Math.sin(x * 0.045 + t * 0.35) * 5 + Math.sin(x * 0.11 - t * 0.6) * 2;
        const top = Math.round(st.y + 8 + wave), len = 16 + Math.round(8 * Math.sin(x * 0.07 + t * 0.2));
        const edge = Math.min(1, (x - st.x) / 60, (st.x + st.w - x) / 60);
        const a = (0.12 + 0.08 * Math.sin(x * 0.2 + t * 1.3)) * k * edge;
        b.globalAlpha = a * 0.7; b.fillStyle = '#b48aff'; b.fillRect(x, top - 3, 1, 3);
        b.fillStyle = '#6affb0';
        for (let s = 0; s < len; s += 2) { b.globalAlpha = a * (1 - s / len); b.fillRect(x, top + s, 1, 2); }
      }
      b.globalAlpha = 1;
    },
  },
  {
    id: 'fisher', name: 'Рыбак у лунки', layer: 'street',
    hint: 'Зимой днём посреди замёрзшей реки кто-то сидит очень терпеливо.',
    found: 'Зимой река Вологда стоит подо льдом месяцами, и на лёд выходят рыбаки-подлёдники.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(env.frozen && h >= 8 && h < 16)) return null;
      if (!inWin(env, 2700, 900, 400)) return null;
      return { x: 296, y: 176, w: 12, h: 10 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, bob = Math.sin(env.ms / 700) > 0.8 ? 1 : 0;
      ctx.fillStyle = mixHex('#0a0e16', '#2a3a4a', dayF); ctx.fillRect(x + 8, y + 9, 3, 1);          // лунка
      ctx.fillStyle = mixHex('#2a1a10', '#8a5a34', dayF); ctx.fillRect(x + 1, y + 7, 5, 3);          // ящик
      drawPerson(ctx, x + 2, y + 6, 0.1, dayF, 0, false, true, false);
      ctx.fillStyle = mixHex('#2a2a2a', '#5a4a3a', dayF); for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + i, y + 3 - (i >> 1), 1, 1); // удочка
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x + 9, y + 1, 1, 7 + bob); ctx.globalAlpha = 1; // леска
    },
  },
  {
    id: 'newyear', name: 'Новогодний салют', layer: 'sky',
    hint: 'Раз в году, ровно после полуночи, небо над кремлём расцветает.',
    found: 'В новогоднюю ночь над Вологдой запускают салюты, а куранты на колокольне только что отбили двенадцать.',
    state(env) {
      const l = env.local;
      if (!env.forced && !(month(env) === 1 && l.getUTCDate() === 1 && l.getUTCHours() === 0 && l.getUTCMinutes() < 30)) return null;
      return { x: 150, y: 20, w: 200, h: 70 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 250, 40, dayF); },
  },
];

// События по новостям (data/events.json): fireworks — салют над кремлём
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 300, 50, dayF); }
