// Москва: вид с Софийской набережной (Замоскворечье) на север, через Москву-реку на Кремль.
// Слева направо: башни Москва-Сити вдали, Храм Христа Спасителя, Большой Каменный мост,
// Кремлёвская стена с башнями (Водовзводная … Беклемишевская), за ней Большой Кремлёвский дворец,
// соборы и колокольня Ивана Великого; справа на Красной площади — Спасская башня и собор
// Василия Блаженного, Большой Москворецкий мост и высотка на Котельнической набережной.

import { rng, mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  far: '#9aa4b6', farDark: '#8690a6', glass: '#7f9cc0', glassHi: '#a9c2de',
  hill: '#6f8a5a', hillDark: '#5a7348', tree: '#3e6b3d', treeDark: '#2f5531',
  brick: '#b5412f', brickDark: '#8c3022', brickHi: '#cc5a44', merlon: '#a83a2a',
  tent: '#3f6e55', tentDark: '#2f5544', star: '#e0303a', starHi: '#ff6a6a',
  white: '#f2eee6', whiteShade: '#d4cec2', cream: '#ecdcb4', creamShade: '#ccbb90', roofG: '#5f7a66',
  gold: '#e2b23e', goldDark: '#b8862a', silver: '#c8ccd2', silverDark: '#9aa0a8', win: '#6a6070',
  red2: '#c84a3a', green2: '#3f8a5a', yellow2: '#e6c048', blue2: '#3a6fb8', beige: '#e4c79a',
  road: '#8a8680', granite: '#8c8278', graniteDark: '#6f665e',
  bridge: '#b4aea4', bridgeDark: '#8c867c', snow: '#eef2f6', clock: '#f4efe0',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', glass: '#1a2238', glassHi: '#25304c',
  hill: '#141c1c', hillDark: '#101616', tree: '#151d1f', treeDark: '#101719',
  brick: '#6e3026', brickDark: '#55251e', brickHi: '#8a3c30', merlon: '#65291f',
  tent: '#1e3328', tentDark: '#17281f', star: '#c8202a', starHi: '#ff4a4a',
  white: '#a69c88', whiteShade: '#837a6a', cream: '#a0906a', creamShade: '#7e7052', roofG: '#22302a',
  gold: '#c89a3a', goldDark: '#9a722a', silver: '#7c8088', silverDark: '#5c6068', win: '#1a1420',
  red2: '#7a3028', green2: '#244a34', yellow2: '#8a7430', blue2: '#243e6a', beige: '#8a7860',
  road: '#26242a', granite: '#27252d', graniteDark: '#1e1c23',
  bridge: '#4a4650', bridgeDark: '#35323a', snow: '#6a7488', clock: '#e8dcb0',
};
const AUTUMN = { day: { tree: '#bb8c32', treeDark: '#915f27', hill: '#8a8a4a', hillDark: '#6e6e3a' }, night: { tree: '#221c16', treeDark: '#1a1511' } };
const WINTER = { day: { tree: '#5d5853', treeDark: '#48443f', hill: '#dfe6ec', hillDark: '#c4ccd6' }, night: { tree: '#1a1a1e', treeDark: '#141418', hill: '#2c3244', hillDark: '#242a3a' } };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Купол-«луковица» или шлем: ширины строк сверху вниз
function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 1, top + i, 1, 1); });
}
// Шатёр башни: от ширины w у основания до острия
function tent(R, cx, base, w, h, c, cDark) {
  for (let i = 0; i < h; i++) { const ww = Math.max(1, Math.round(w * (1 - i / h))); R(c, cx - (ww >> 1), base - 1 - i, ww, 1); if (ww > 2) R(cDark, cx + (ww >> 1) - 1, base - 1 - i, 1, 1); }
}
// Рубиновая звезда на шпиле (Водовзводная, Спасская)
function star(R, cx, y) { R('star', cx - 1, y, 3, 3); R('star', cx, y - 1, 1, 5); R('star', cx - 2, y + 1, 5, 1); R('starHi', cx, y + 1, 1, 1); }
// Кремлёвская башня: тело, белый пояс, верхний ярус, шатёр
function tower(R, x, w, top, base, tentH, { upper = 0, round = false } = {}) {
  R('brick', x, top, w, base - top); R('brickDark', x + w - 2, top, 2, base - top);
  if (round) for (let y = top + 3; y < base; y += 6) R('brickHi', x + 1, y, 1, 3);
  R('white', x - 1, top, w + 2, 1); // пояс машикулей
  for (let xx = x; xx < x + w; xx += 2) R('merlon', xx, top - 2, 1, 2);
  let t = top - 2;
  if (upper) { const uw = w - 4; R('brick', x + 2, t - upper, uw, upper); R('brickDark', x + w - 3, t - upper, 1, upper); R('win', x + (w >> 1) - 1, t - upper + 2, 2, 3); t -= upper; }
  tent(R, x + (w >> 1), t, w - 2, tentH, 'tent', 'tentDark');
  return t - tentH; // верх шатра
}

export function drawFar({ g, P, winter, r, L, R }) {
  // ---- Москва-Сити вдали, за Большим Каменным мостом: стеклянные башни, к ночи — окна и красные огни на крышах
  for (const [x, w, top] of [[84, 6, 52], [90, 5, 66], [95, 7, 40], [102, 4, 70]]) {
    R('glass', x, top, w, 150 - top); R('glassHi', x, top, 1, 150 - top);
    for (let yy = top + 3; yy < 146; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.45) L(xx, yy, 'win');
    L(x + (w >> 1), top - 1, 'red', '#ff3a3a', 0);
  }
  // город на дальнем берегу: невысокие крыши
  for (let x = 0; x < W;) {
    const w = 6 + ((r() * 12) | 0), h = 4 + ((r() * 9) | 0), top = 150 - h;
    R(r() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < 148; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.25) L(xx, yy, 'win');
    x += w;
  }
  // ---- высотка на Котельнической справа: ступени и шпиль
  // (за собором Василия Блаженного: правее её закрывает штора)
  R('far', 434, 98, 22, 52); R('farDark', 450, 98, 6, 52);
  R('far', 437, 82, 16, 16); R('far', 440, 70, 10, 12); R('far', 442, 62, 6, 8);
  R('farDark', 444, 50, 2, 12); R('gold', 444, 47, 2, 3);
  for (let yy = 86; yy < 148; yy += 4) for (let xx = 436; xx < 454; xx += 3) if (r() < 0.35) L(xx, yy, 'win');
  L(445, 46, 'flood', '#ffe2a8', 0);

  // ---- Храм Христа Спасителя: белый куб, большой золотой шлем и четыре малых
  R('white', 40, 116, 40, 36); R('whiteShade', 72, 116, 8, 36);
  for (let x = 44; x < 76; x += 8) { R('whiteShade', x, 124, 4, 1); R('win', x + 1, 128, 2, 6); }
  R('white', 50, 104, 20, 12); R('whiteShade', 66, 104, 4, 12); // барабан
  dome(R, 60, 88, [4, 8, 12, 14, 16, 18, 18, 20, 20, 20, 20, 20, 20, 20, 20, 20], 'gold', 'goldDark');
  R('gold', 60, 80, 1, 8); R('gold', 58, 82, 5, 1);
  for (const cx of [44, 76]) { R('white', cx - 3, 108, 6, 8); dome(R, cx, 100, [2, 4, 6, 6, 6, 6, 6, 6], 'gold', 'goldDark'); R('gold', cx, 96, 1, 4); }
  L(60, 148, 'flood', '#ffe6b0', 0);

  // ---- холм Кремля: зелёный склон Тайницкого сада под стеной
  for (let x = 100; x < 400; x++) { R('hill', x, 148, 1, 6); R('hillDark', x, 151, 1, 3); }
  for (let x = 102; x < 396; x += 4) R(r() < 0.5 ? 'tree' : 'treeDark', x, 146 - ((r() * 3) | 0), 3, 5);

  // ---- за стеной: Большой Кремлёвский дворец, соборы, Иван Великий
  // дворец — длинный, кремовый, с рядами окон и зелёной крышей
  R('cream', 126, 114, 76, 24); R('creamShade', 196, 114, 6, 24); R('roofG', 124, 111, 80, 3);
  for (let x = 129; x < 198; x += 4) { R('win', x, 118, 2, 4); R('win', x, 127, 2, 5); }
  R('cream', 158, 104, 12, 7); dome(R, 164, 100, [4, 6, 8], 'roofG', 'roofG');
  // Благовещенский собор — золотые главки
  R('white', 204, 116, 16, 22); R('whiteShade', 216, 116, 4, 22);
  for (const [cx, top] of [[208, 104], [216, 104], [212, 98]]) { R('white', cx - 2, top + 8, 4, 6); dome(R, cx, top, [2, 4, 5, 5, 4, 3, 4, 5], 'gold', 'goldDark'); R('gold', cx, top - 3, 1, 3); }
  // Архангельский собор — серебристые главы, центральная золотая
  R('white', 222, 112, 20, 26); R('whiteShade', 238, 112, 4, 26);
  for (let x = 224; x < 240; x += 5) R('whiteShade', x, 116, 3, 6);
  for (const [cx, top, c, cd] of [[226, 102, 'silver', 'silverDark'], [238, 102, 'silver', 'silverDark'], [232, 96, 'gold', 'goldDark']]) { R('white', cx - 2, top + 8, 4, 6); dome(R, cx, top, [2, 4, 5, 6, 6, 5, 4, 5], c, cd); R('gold', cx, top - 3, 1, 3); }
  // колокольня Ивана Великого — самая высокая: белые ярусы, золотая глава
  R('white', 244, 106, 14, 32); R('whiteShade', 254, 106, 4, 32);
  R('white', 246, 88, 10, 18); R('whiteShade', 253, 88, 3, 18); for (const y of [92, 98]) R('win', 249, y, 3, 4);
  R('white', 247, 74, 8, 14); R('whiteShade', 252, 74, 3, 14); R('win', 249, 78, 3, 4);
  R('gold', 247, 72, 8, 1); R('white', 248, 64, 6, 8); R('whiteShade', 252, 64, 2, 8); // барабан
  dome(R, 251, 54, [2, 4, 6, 6, 6, 6, 6, 6, 6, 4], 'gold', 'goldDark');
  R('gold', 251, 48, 1, 6); R('gold', 249, 50, 5, 1);
  R('white', 238, 98, 6, 40); R('whiteShade', 242, 98, 2, 40); dome(R, 241, 92, [2, 4, 6, 6, 6, 4], 'gold', 'goldDark'); // звонница
  L(251, 136, 'flood', '#ffe6b0', 0);
  // Успенский собор — пять золотых шлемов
  R('white', 262, 112, 30, 26); R('whiteShade', 286, 112, 6, 26);
  for (let x = 265; x < 288; x += 6) R('whiteShade', x, 115, 3, 8);
  for (const [cx, top] of [[267, 102], [287, 102], [272, 98], [282, 98], [277, 92]]) { R('white', cx - 2, top + 7, 4, 6); dome(R, cx, top, [2, 4, 5, 6, 6, 6, 5], 'gold', 'goldDark'); R('gold', cx, top - 3, 1, 3); }
  L(277, 134, 'flood', '#ffe6b0', 0);
  // Сенатский дворец за стеной справа — зелёный купол
  R('cream', 312, 120, 30, 18); R('creamShade', 336, 120, 6, 18);
  dome(R, 327, 108, [6, 10, 12, 14, 14, 14], 'roofG', 'roofG'); R('cream', 320, 114, 14, 6);
  for (let x = 314; x < 340; x += 4) R('win', x, 126, 2, 4);

  // ---- Кремлёвская стена вдоль реки: кирпич и зубцы «ласточкин хвост»
  R('brick', 112, 138, 280, 12); R('brickDark', 112, 147, 280, 3);
  for (let x = 112; x < 392; x += 5) { R('merlon', x, 134, 3, 4); R('merlon', x, 133, 1, 1); R('merlon', x + 2, 133, 1, 1); }
  if (winter) for (let x = 112; x < 392; x += 5) R('snow', x, 134, 3, 1);
  for (let x = 124; x < 388; x += 24) L(x, 146, 'flood', '#ffd9a0', 0);
  // башни стены
  const vTop = tower(R, 106, 14, 104, 150, 18, { upper: 10, round: true }); star(R, 113, vTop - 4); // Водовзводная
  tower(R, 170, 8, 126, 150, 9);                       // Благовещенская
  tower(R, 224, 10, 122, 150, 12, { upper: 6 });       // Тайницкая
  tower(R, 268, 6, 130, 150, 8);                       // Первая Безымянная
  tower(R, 300, 6, 130, 150, 8);                       // Вторая Безымянная
  tower(R, 340, 8, 126, 150, 10, { upper: 4 });        // Петровская
  tower(R, 380, 12, 108, 150, 20, { upper: 6, round: true }); // Беклемишевская

  // ---- Спасская башня на Красной площади: ярусы, часы-куранты, шатёр, звезда
  R('brick', 398, 112, 14, 40); R('brickDark', 409, 112, 3, 40);
  R('white', 397, 112, 16, 1); for (let xx = 398; xx < 412; xx += 2) R('merlon', xx, 110, 1, 2);
  R('brick', 400, 94, 10, 16); R('brickDark', 408, 94, 2, 16);
  R('clock', 402, 98, 6, 6); R('gold', 402, 98, 6, 1); R('gold', 402, 103, 6, 1); R('win', 404, 100, 1, 2); R('win', 405, 101, 2, 1); // циферблат
  R('white', 399, 93, 12, 1); R('brick', 401, 86, 8, 7); R('white', 401, 86, 8, 1);
  tent(R, 405, 86, 8, 18, 'tent', 'tentDark');
  R('gold', 405, 64, 1, 4); star(R, 405, 59);
  L(405, 146, 'flood', '#ffd9a0', 0);

  // ---- собор Василия Блаженного: шатёр и пёстрые главы
  R('brick', 414, 128, 40, 22); R('brickDark', 448, 128, 6, 22); R('white', 414, 128, 40, 1);
  for (let x = 417; x < 450; x += 6) R('white', x, 132, 2, 6);
  R('beige', 429, 104, 10, 24); R('creamShade', 436, 104, 3, 24); tent(R, 434, 104, 10, 16, 'beige', 'creamShade');
  dome(R, 434, 84, [2, 3, 3], 'gold', 'goldDark'); R('gold', 434, 80, 1, 4);
  const BASIL = [[419, 108, ['red2', 'white']], [426, 104, ['green2', 'yellow2']], [443, 104, ['blue2', 'white']], [450, 110, ['green2', 'red2']], [434, 112, ['yellow2', 'green2']]];
  for (const [cx, top, [c1, c2]] of BASIL) {
    R('brick', cx - 2, top + 8, 5, 128 - top - 8); R('white', cx - 2, top + 8, 5, 1);
    [2, 4, 6, 7, 7, 6, 4, 3].forEach((w, i) => { for (let j = 0; j < w; j++) R((j + i) % 3 === 0 ? c2 : c1, cx - (w >> 1) + j, top + i, 1, 1); }); // полосатая «луковица»
    R('gold', cx, top - 3, 1, 3);
  }
  L(434, 144, 'flood', '#ffd0a0', 0);

  // ---- Кремлёвская набережная: дорога и фонари, гранит у воды
  R('road', 0, 154, W, 4); R('graniteDark', 0, 158, W, 2);
  for (let x = 6; x < W; x += 16) { R('graniteDark', x, 148, 1, 6); L(x, 147, 'lamp', '#ffd88a', 0); }
  R('granite', 0, 160, W, 3); R('graniteDark', 0, 163, W, 5);
  if (winter) R('snow', 0, 160, W, 1);

  // ---- мосты по краям: Большой Каменный слева, Большой Москворецкий справа (арки над водой)
  const bridge = (x0, x1) => {
    R('bridge', x0, 152, x1 - x0, 4); R('bridgeDark', x0, 156, x1 - x0, 2);
    for (let x = x0 + 4; x < x1 - 4; x += 18) { R('bridgeDark', x, 158, 3, 10); }
    for (let x = x0 + 2; x < x1; x += 8) L(x, 151, 'lamp', '#ffe2a0', 0);
  };
  bridge(84, 112); bridge(392, 480);
}

// ---------- ночная подсветка: звёзды на башнях, Иван Великий, ХХС, Сити ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const glow = (x, y, r, rgb, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a * nightF})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  glow(113, 82, 7, '255,60,60', 0.55); glow(405, 60, 7, '255,60,60', 0.55); // рубиновые звёзды
  glow(251, 70, 18, '255,220,150', 0.22); glow(60, 98, 20, '255,226,160', 0.22); glow(277, 104, 16, '255,220,150', 0.16);
  g.globalAlpha = nightF * 0.85; g.fillStyle = '#ff4a4a';
  g.fillRect(113, 81, 1, 3); g.fillRect(405, 60, 1, 3);
  // Москва-Сити: медиафасад медленно меняет цвет
  const hue = (t * 4) % 360;
  g.globalAlpha = nightF * 0.5; g.fillStyle = `hsl(${hue},60%,60%)`;
  g.fillRect(98, 44, 1, 100); g.fillRect(86, 56, 1, 90);
  g.globalAlpha = 1;
}

// ---------- речные трамвайчики (ходят круглый год: зимой — ледокольные) и набережная ----------
export function drawBoats(ctx, env, dayF, t) {
  for (const [shift, dir] of [[0, 1], [260, -1]]) drawBoat(ctx, env, dayF, shift, dir);
  drawPromenade(ctx, env, dayF, t);
}
export function drawAboveLate(b, env, dayF, t) { drawCars(b, env, dayF, t); }

function drawBoat(ctx, env, dayF, shift, dir) {
  const h = env.local.getUTCHours();
  if (h < 10 || h > 23) return;
  const p = ((env.ms / 1000 + shift) % 520) / 220;
  if (p >= 1) return;
  const x = Math.round(dir > 0 ? -44 + p * 568 : 524 - p * 568), y = 184, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 40, 4);
  ctx.fillStyle = mixHex('#1a1e28', '#2a3a6a', dayF); ctx.fillRect(x + 1, y + 4, 38, 2);
  ctx.fillStyle = mixHex('#30343e', '#d8dce4', dayF); ctx.fillRect(x + 5, y - 5, 28, 5); // застеклённая палуба
  ctx.fillStyle = mixHex('#24283a', '#8ab0d0', dayF); ctx.fillRect(x + 6, y - 4, 26, 2);
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.25 + nightF * 0.75;
  for (let i = 0; i < 8; i++) ctx.fillRect(x + 7 + i * 3, y - 4, 2, 1);
  ctx.globalAlpha = 1;
  if (env.frozen || env.winter) { ctx.fillStyle = mixHex('#4a5268', '#e8eef4', dayF); for (let i = 0; i < 6; i++) ctx.fillRect(x + (dir > 0 ? 40 + i * 2 : -2 - i * 2), y + 4 + (i % 2), 2, 1); } // ледяная крошка у носа
}

// Сувенир на подоконнике — матрёшка
export function drawSill(R, SILL) {
  const x = 362;
  R('#c8423a', x, SILL - 9, 7, 9); R('#a83228', x + 5, SILL - 9, 2, 9);
  R('#c8423a', x + 1, SILL - 13, 5, 4); R('#f0d0b0', x + 2, SILL - 12, 3, 2); // голова и лицо
  R('#f4e8c8', x + 1, SILL - 7, 5, 4); R('#e8b030', x + 2, SILL - 6, 3, 2);  // фартук с цветком
  R('#2a2a34', x + 2, SILL - 12, 1, 1); R('#2a2a34', x + 4, SILL - 12, 1, 1);
  R('#3a7a4a', x + 9, SILL - 5, 4, 5); R('#f0d0b0', x + 10, SILL - 4, 2, 1); // маленькая рядом
}

// ---------- улица: машины на набережной, ларьки на Софийской набережной (движок — engine/street.js) ----------
const KINDS = {
  coffee: { counter: '#6a4a34', awning: ['#2a5a4a', '#f2eee6'], goods: [[2, '#f4f4f4'], [6, '#8a5a3a'], [9, '#f4f4f4']], steam: true },
  icecream: { counter: '#f4f4f4', awning: ['#3a6fb8', '#f4f4f4'], goods: [[2, '#f8e8c0'], [6, '#f8e8c0'], [9, '#e8a0b0']] },
  blini: { counter: '#c8862a', awning: ['#c8423a', '#f2e8c8'], goods: [[2, '#e8b860'], [6, '#e8b860'], [9, '#c83a3a']], steam: true },
  sbiten: { counter: '#8a4a2a', awning: ['#b5412f', '#e8c040'], goods: [[2, '#d8a050'], [6, '#d8a050'], [9, '#f4f4f4']], steam: true },
};
// Какие ларьки работают сейчас
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (h < 9 || h >= 23) return [];
  if (mo >= 5 && mo <= 9) return ['coffee', 'icecream', 'blini'];
  if (mo >= 11 || mo <= 3) return ['coffee', 'sbiten', 'blini'];
  return ['coffee', 'blini'];
}
export const STALL_X = { coffee: 150, icecream: 236, sbiten: 236, blini: 322 };
const LANES = [{ x0: -6, x1: 486, y: 157 }, { x0: 84, x1: 112, y: 155 }, { x0: 392, x1: 486, y: 155 }]; // Кремлёвская набережная, мосты
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: KINDS[k], x: STALL_X[k] }))); }

// ---------- секреты Москвы ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
export const SECRETS = [
  {
    id: 'margarita', name: 'Маргарита на метле', layer: 'sky',
    hint: 'В полнолуние над крышами Замоскворечья иногда кто-то пролетает — невидимый для всех, кроме вас.',
    found: '«Невидима и свободна!» — Маргарита из романа Булгакова «Мастер и Маргарита» летела над ночной Москвой на половой щётке.',
    state(env) {
      if (!env.forced && (env.sun.alt > -8 || Math.abs(env.phase - 0.5) > 0.08)) return null;
      if (!inWin(env, 1500, 14, 300)) return null;
      const p = phase(env, 1500, 14, 300); return { x: Math.round(-20 + p * 520), y: 46 - Math.round(Math.sin(p * 3.1) * 14), w: 14, h: 8 };
    },
    draw(b, env, st) {
      const { x, y } = st, flap = Math.sin(env.ms / 140) > 0 ? 1 : 0;
      b.fillStyle = '#8a6a3a'; b.fillRect(x, y + 5, 12, 1); // щётка
      b.fillStyle = '#c8a050'; b.fillRect(x - 3, y + 4, 3, 3);
      b.fillStyle = '#f0d0b0'; b.fillRect(x + 7, y, 2, 2); // голова
      b.fillStyle = '#2a1a14'; b.fillRect(x + 6, y - 1 + flap, 2, 2); b.fillRect(x + 4, y + flap, 2, 1); // волосы по ветру
      b.fillStyle = '#e8e4ec'; b.fillRect(x + 6, y + 2, 3, 3); // платье
    },
  },
  {
    id: 'hedgehog', name: 'Ёжик в тумане', layer: 'street',
    hint: 'В густой туман по дальней набережной кто-то бредёт с узелком.',
    found: '«Ёжик в тумане» (1975) Юрия Норштейна сняли на студии «Союзмультфильм» в Москве; его называют одним из лучших мультфильмов в истории.',
    state(env) {
      if (!env.forced && env.weather.kind !== 'fog') return null;
      if (!inWin(env, 900, 60, 120)) return null;
      const p = phase(env, 900, 60, 120); return { x: Math.round(470 - p * 480), y: 150, w: 8, h: 6 };
    },
    draw(b, env, st, dayF) {
      const { x, y } = st, step = Math.sin(env.ms / 250) > 0 ? 1 : 0;
      b.fillStyle = mixHex('#2a2420', '#6a5a4a', dayF); b.fillRect(x + 1, y + 1, 5, 3); for (const dx of [1, 3, 5]) b.fillRect(x + dx, y, 1, 1); // иголки
      b.fillStyle = mixHex('#3a3028', '#c8a882', dayF); b.fillRect(x, y + 2, 2, 2); // мордочка
      b.fillStyle = mixHex('#e8e0d0', '#f4f0e8', dayF); b.fillRect(x + 6, y - 1, 2, 2); // узелок с вареньем
      b.fillStyle = '#1a1614'; b.fillRect(x + 1 + step, y + 4, 1, 1); b.fillRect(x + 4 - step, y + 4, 1, 1);
    },
  },
  {
    id: 'icebreaker', name: 'Трамвайчик во льдах', layer: 'street',
    hint: 'Зимой по реке, даже когда всё в ледяной крошке, что-то продолжает ходить.',
    found: 'Речные трамвайчики в центре Москвы ходят и зимой: у части флотилии корпус ледового класса, и они идут сквозь шугу.',
    state(env) {
      if (!env.forced && !env.winter) return null;
      const h = env.local.getUTCHours();
      if (!env.forced && (h < 10 || h > 23)) return null;
      const p = ((env.ms / 1000) % 520) / 220;
      if (!env.forced && p >= 1) return null;
      const x = Math.round(env.forced ? 220 : -44 + p * 568); return { x, y: 178, w: 40, h: 12 };
    },
    draw() {}, // сам трамвайчик рисует drawBoats — секрет только находится кликом
  },
  {
    id: 'citysalute', name: 'Салют в День города', layer: 'sky',
    hint: 'В начале сентября вечером небо над Кремлём расцветает.',
    found: 'День города Москва отмечает в первые выходные сентября — вечером салют.',
    state(env) {
      const l = env.local, d = l.getUTCDate(), h = l.getUTCHours(), dow = l.getUTCDay();
      if (!env.forced && !(month(env) === 9 && d <= 7 && dow === 6 && h === 21)) return null;
      return { x: 150, y: 18, w: 220, h: 70 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 260, 46, dayF); },
  },
];

// События по новостям (fireworks — салют над Кремлём)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 260, 46, dayF); }
