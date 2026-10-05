// Ярославль: вид с левого берега Волги (Тверицы) на запад-юго-запад — на Стрелку и Волжскую набережную.
// Слева направо: Юбилейный мост, Коровники с «Ярославской свечой», устье Которосли с Московским мостом,
// Стрелка (колонна 1000-летия, фонтаны), Успенский собор, Спасо-Преображенский монастырь,
// беседка-ротонда, церковь Ильи Пророка, Митрополичьи палаты, Волжская башня, Медведицкий овраг.

import { mixHex, rng } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks, drawPerson } from '../../engine/street.js';

const DAY = {
  far: '#a0a8b8', farDark: '#8c94a8', farRoof: '#7a8298', tower: '#aab4c4',
  hill: '#6f8a5a', hillDark: '#5a7348', tree: '#3e6b3d', treeDark: '#2f5531', grass: '#79a05a',
  river: '#8aa2b8', riverHi: '#a8bccc',
  wall: '#f4f1e8', wallShade: '#d8d2c4', gold: '#e6b845', goldDark: '#b88a2a',
  green: '#4f8a64', greenDark: '#3a6a4c', roofG: '#4a6e58',
  brick: '#b25a40', brickDark: '#8c4230', trim: '#f0e6d4',
  cream: '#efe4c8', creamShade: '#d4c8a8',
  mon: '#dcdcd8', monShade: '#c0c2c4',
  house1: '#e8d49a', house2: '#e8c8b8', house3: '#d8dcd0', houseShade: '#b8b0a0', roof: '#7a6a60',
  win: '#6a6070', granite: '#8c8278', graniteDark: '#6f665e', road: '#9a968e',
  bridge: '#d8dade', bridgeDark: '#a8acb4', bronze: '#6a5a3a', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a', tower: '#222a44',
  hill: '#141c1c', hillDark: '#101616', tree: '#151d1f', treeDark: '#101719', grass: '#18221c',
  river: '#1a2238', riverHi: '#2a3450',
  wall: '#a09a88', wallShade: '#7c7668', gold: '#c89a3a', goldDark: '#9a7428',
  green: '#1e3a2e', greenDark: '#162c22', roofG: '#1e2e2a',
  brick: '#8a4030', brickDark: '#6a3024', trim: '#b8a88a',
  cream: '#9a8e72', creamShade: '#786e58',
  mon: '#6a6e7a', monShade: '#555a66',
  house1: '#3a3440', house2: '#3a3038', house3: '#30343c', houseShade: '#26242c', roof: '#1e1c24',
  win: '#1a1420', granite: '#27252d', graniteDark: '#1e1c23', road: '#2a2830',
  bridge: '#8a8e9a', bridgeDark: '#5a5e6a', bronze: '#2a2418', snow: '#6a7488',
};
const AUTUMN = {
  day: { tree: '#c08a34', treeDark: '#935f27', grass: '#9a9a50', hill: '#8a8a4a', hillDark: '#6e6e3a' },
  night: { tree: '#221c16', treeDark: '#1a1511' },
};
const WINTER = {
  day: { tree: '#5d5853', treeDark: '#48443f', hill: '#dfe6ec', hillDark: '#c4ccd6', grass: '#e8eef2', river: '#d0dae4', riverHi: '#e8eef4' },
  night: { tree: '#1a1a1e', treeDark: '#141418', hill: '#2c3244', hillDark: '#242a3a', grass: '#303648', river: '#283044', riverHi: '#343c52' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Верхняя кромка правого берега: Коровники, устье Которосли, нижний и верхний ярус Стрелки,
// Волжская набережная и провал Медведицкого оврага у Волжской башни
const bankTop = (x) => (x < 56 ? 152 : x < 86 ? 160 : x < 128 ? 158 : x < 138 ? 158 - (x - 128) * 1.2 : x < 392 ? 146 : x < 404 ? 146 + (x - 392) * 0.7 : x < 416 ? 154 - (x - 404) * 0.67 : 146);

// Купол по строкам: ширины сверху вниз, справа — тень
function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}
// Шатёр: от острия вниз, ширина растёт
function tent(R, cx, top, rows, grow, c, cDark) {
  for (let i = 0; i < rows; i++) { const w = Math.max(1, Math.round(1 + i * grow)); R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 1, top + i, 1, 1); }
}
function cross(R, x, top, h = 5) { R('gold', x, top, 1, h); R('gold', x - 1, top + 1, 3, 1); }

const USP_MAIN = [2, 4, 6, 10, 12, 14, 14, 14, 14, 12, 10, 8, 10, 12];
const USP_SIDE = [2, 4, 6, 8, 8, 8, 6, 6];

function house(R, L, q, winter, x, w, h, key, base = 147) {
  const top = base - h;
  R(key, x, top, w, h); R('houseShade', x + w - 2, top, 2, h);
  R('roof', x - 1, top - 2, w + 2, 2);
  if (winter) R('snow', x - 1, top - 2, w + 2, 1);
  for (let yy = top + 2; yy < base - 2; yy += 4) for (let xx = x + 1; xx < x + w - 2; xx += 3) { R('win', xx, yy, 1, 2); if (q() < 0.6) L(xx, yy, 'win'); }
}

export function drawFar({ winter, L, R }) {
  const q = rng(760); // свой генератор: L() в дневном проходе тратит числа движка, раскладка не должна от этого зависеть
  // город за береговой линией: невысокие дома, кое-где девятиэтажки
  for (let x = 0; x < W;) {
    const w = 6 + ((q() * 12) | 0), tall = (x < 20 || x > 420) && q() < 0.35, h = tall ? 14 + ((q() * 10) | 0) : 4 + ((q() * 10) | 0), top = 148 - h;
    R(tall ? 'tower' : q() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < 146; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (q() < 0.3) L(xx, yy, 'win');
    if (tall) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w;
  }

  // берег
  for (let x = 0; x < W; x++) { const y = Math.round(bankTop(x)); R('hill', x, y, 1, 168 - y); R('hillDark', x, y + 5, 1, Math.max(0, 168 - y - 5)); }

  // устье Которосли и Московский мост через неё
  R('river', 56, 159, 30, 9);
  for (let i = 0; i < 6; i++) R('riverHi', 58 + ((i * 7) % 24), 161 + (i % 3) * 2, 4, 1);
  R('bridge', 54, 155, 34, 2); R('bridgeDark', 54, 157, 34, 1);
  for (const x of [60, 70, 80]) R('bridgeDark', x, 158, 2, 8);
  for (let x = 56; x < 88; x += 8) L(x, 153, 'lamp', '#ffd88a', 0);

  // Юбилейный мост через Волгу — у самого левого края, вдали
  R('bridge', 0, 146, 26, 2); R('bridgeDark', 0, 148, 26, 1);
  for (const x of [4, 14, 24]) R('bridgeDark', x, 149, 2, 3);
  for (let x = 2; x < 26; x += 8) L(x, 145, 'lamp', '#ffe2a0', 0);

  // Коровники: церковь Иоанна Златоуста и шатровая колокольня — «Ярославская свеча»
  R('brick', 20, 132, 24, 20); R('brickDark', 40, 132, 4, 20);
  for (const cx of [23, 29, 35, 41]) dome(R, cx, 129, [3, 5, 6], 'brick', 'brickDark');
  for (let i = 0; i < 4; i++) R('win', 23 + i * 5, 138, 2, 4);
  if (winter) R('snow', 20, 132, 24, 1);
  R('brick', 29, 118, 6, 14); R('brickDark', 33, 118, 2, 14);
  dome(R, 32, 110, [2, 4, 6, 8, 8, 8, 6, 4], 'green', 'greenDark'); cross(R, 32, 105);
  for (const cx of [24, 40]) { R('brick', cx - 2, 125, 4, 7); dome(R, cx, 120, [2, 4, 6, 6, 4], 'green', 'greenDark'); cross(R, cx, 116, 4); }
  R('brick', 48, 110, 6, 42); R('brickDark', 52, 110, 2, 42);
  R('trim', 47, 110, 8, 1); R('trim', 47, 126, 8, 1); R('trim', 47, 138, 8, 1);
  R('win', 50, 113, 2, 5); R('win', 50, 129, 2, 3);
  tent(R, 51, 96, 14, 0.42, 'green', 'greenDark'); cross(R, 51, 91);
  L(51, 150, 'flood', '#ffd9a0', 0);

  // Спасо-Преображенский монастырь — дальше, за Стрелкой, поэтому бледнее
  R('mon', 194, 138, 44, 8); R('monShade', 194, 145, 44, 1);
  for (const x of [194, 234]) { R('mon', x, 134, 4, 12); R('roofG', x, 132, 4, 2); }
  R('mon', 206, 124, 16, 14); R('monShade', 219, 124, 3, 14);
  R('mon', 212, 116, 4, 8); dome(R, 214, 110, [2, 4, 6, 6, 6, 4], 'gold', 'goldDark'); cross(R, 214, 106, 4);
  for (const cx of [208, 220]) { R('mon', cx - 1, 121, 3, 3); dome(R, cx, 117, [2, 4, 4, 2], 'green', 'greenDark'); }
  R('mon', 226, 118, 8, 20); R('monShade', 232, 118, 2, 20); // звонница
  R('win', 228, 121, 1, 3); R('win', 231, 121, 1, 3); R('win', 228, 128, 1, 3); R('win', 231, 128, 1, 3);
  R('mon', 229, 116, 3, 2); dome(R, 230, 111, [2, 4, 4, 4, 2], 'gold', 'goldDark'); cross(R, 230, 107, 4);
  if (winter) { R('snow', 206, 124, 16, 1); R('snow', 194, 138, 44, 1); }
  L(216, 138, 'flood', '#ffe0a8', 0);

  // деревья верхнего яруса Стрелки
  for (let x = 132; x < 240; x += 3) {
    if (x > 140 && x < 184) continue;
    const h = 3 + ((q() * 5) | 0);
    R(q() < 0.5 ? 'tree' : 'treeDark', x, 147 - h, 4, h);
  }

  // Успенский собор: белый куб, закомары, пять золотых глав
  R('wall', 144, 112, 36, 34); R('wallShade', 174, 112, 6, 34);
  for (const cx of [148, 157, 166, 175]) dome(R, cx, 108, [3, 7, 9, 9], 'wall', 'wallShade');
  for (let x = 148; x < 178; x += 6) { R('win', x, 118, 2, 6); R('win', x, 130, 2, 6); }
  R('wallShade', 159, 138, 6, 8);
  if (winter) for (const cx of [148, 157, 166, 175]) R('snow', cx - 1, 108, 3, 1);
  R('wall', 157, 88, 10, 2); R('wall', 156, 90, 12, 18); R('wallShade', 165, 90, 3, 18);
  R('win', 159, 94, 1, 6); R('win', 162, 94, 1, 6);
  dome(R, 162, 74, USP_MAIN, 'gold', 'goldDark');
  R('gold', 162, 66, 1, 8); R('gold', 160, 68, 5, 1); R('gold', 161, 71, 3, 1);
  for (const cx of [149, 175]) {
    R('wall', cx - 3, 100, 6, 8); R('wall', cx - 2, 99, 4, 1);
    dome(R, cx, 91, USP_SIDE, 'gold', 'goldDark'); cross(R, cx, 86);
  }
  L(162, 144, 'flood', '#ffe8b8', 0); L(148, 142, 'flood', '#ffe8b8', 0); L(176, 142, 'flood', '#ffe8b8', 0);

  // нижний ярус Стрелки: газон, дорожки, чаша фонтана, колонна 1000-летия с орлом
  R('grass', 86, 158, 42, 6); R('granite', 86, 162, 42, 1);
  for (let x = 128; x < 138; x++) { const y = Math.round(bankTop(x)); R('hill', x, y, 1, 164 - y); }
  R('granite', 100, 157, 24, 1); R('graniteDark', 100, 158, 24, 1);
  R('granite', 88, 154, 7, 4); R('graniteDark', 93, 154, 2, 4);
  R('granite', 90, 136, 3, 18); R('graniteDark', 92, 136, 1, 18); R('granite', 89, 135, 5, 1);
  R('bronze', 90, 132, 3, 3); R('bronze', 88, 131, 2, 1); R('bronze', 93, 131, 2, 1); R('bronze', 91, 130, 1, 2);
  L(91, 156, 'flood', '#fff0c8', 0);
  for (let x = 88; x < 128; x += 10) L(x, 157, 'lamp', '#ffe2a0', 0);

  // дома Волжской набережной (за дорогой)
  for (const [x, w, h, k] of [[238, 12, 12, 'house1'], [266, 14, 14, 'house3'], [316, 10, 12, 'house2'], [327, 12, 10, 'house1'], [418, 14, 14, 'house2'], [433, 12, 12, 'house1'], [446, 16, 16, 'house3'], [463, 17, 12, 'house2']]) house(R, L, q, winter, x, w, h, k);

  // церковь Ильи Пророка: пять зелёных глав и шатровая колокольня
  R('cream', 284, 122, 22, 24); R('creamShade', 300, 122, 6, 24);
  for (let x = 287; x < 302; x += 5) { R('win', x, 127, 2, 4); R('win', x, 136, 2, 4); }
  if (winter) R('snow', 284, 122, 22, 1);
  R('cream', 292, 108, 6, 14); R('creamShade', 296, 108, 2, 14);
  dome(R, 295, 100, [2, 4, 6, 8, 8, 8, 6, 4], 'green', 'greenDark'); cross(R, 295, 95);
  for (const cx of [287, 303]) { R('cream', cx - 2, 116, 4, 6); dome(R, cx, 111, [2, 4, 6, 6, 4], 'green', 'greenDark'); cross(R, cx, 107, 4); }
  R('cream', 308, 110, 6, 36); R('creamShade', 312, 110, 2, 36); R('win', 310, 115, 2, 4);
  tent(R, 311, 98, 12, 0.45, 'green', 'greenDark'); cross(R, 311, 93);
  L(296, 144, 'flood', '#ffe8c0', 0);

  // Митрополичьи палаты: белые, под высокой кровлей
  R('wall', 340, 134, 24, 13); R('wallShade', 360, 134, 4, 13);
  for (let i = 0; i < 6; i++) { const w = 14 + i * 2; R('roof', 352 - (w >> 1), 128 + i, w, 1); }
  if (winter) R('snow', 345, 128, 14, 1);
  for (let x = 343; x < 360; x += 4) { R('win', x, 136, 2, 3); R('win', x, 142, 2, 3); L(x, 137, 'win'); }

  // Волжская (Арсенальная) башня
  R('brick', 372, 120, 16, 26); R('brickDark', 384, 120, 4, 26);
  R('trim', 371, 120, 18, 1); R('trim', 371, 132, 18, 1);
  R('win', 377, 136, 6, 10); R('win', 378, 135, 4, 1);
  R('win', 375, 124, 2, 4); R('win', 381, 124, 2, 4);
  tent(R, 380, 104, 16, 1.0, 'roofG', 'greenDark');
  if (winter) R('snow', 377, 112, 6, 1);
  R('gold', 380, 98, 1, 6); R('gold', 381, 99, 2, 2);
  L(380, 144, 'flood', '#ffc890', 0);

  // дорога по верху набережной (в овраге — спуск, дороги нет)
  R('road', 238, 147, 154, 3); R('road', 416, 147, 64, 3);
  R('graniteDark', 238, 150, 154, 1); R('graniteDark', 416, 150, 64, 1);
  for (let x = 242; x < W; x += 12) { if ((x > 388 && x < 418) || (x > 246 && x < 268)) continue; R('graniteDark', x, 142, 1, 5); L(x, 141, 'lamp', '#ffd88a', 0); }

  // беседка-ротонда у Мякушкина спуска
  R('wallShade', 250, 141, 16, 9);
  for (let x = 250; x < 267; x += 3) R('wall', x, 141, 1, 9);
  R('wall', 249, 150, 18, 2); R('wall', 249, 139, 18, 2);
  R('green', 251, 137, 14, 2); R('green', 253, 136, 10, 1); R('greenDark', 261, 137, 4, 2);
  if (winter) R('snow', 253, 136, 10, 1);
  R('gold', 257, 134, 1, 2);
  L(258, 150, 'flood', '#fff0d0', 0);

  // склон к воде: кусты и деревья, в овраге — гуще
  for (let x = 238; x < W; x += 4) {
    if (x > 246 && x < 268) continue;
    const y = 152 + ((q() * 3) | 0), h = 3 + ((q() * 4) | 0);
    R(q() < 0.5 ? 'tree' : 'treeDark', x, y, 4, h);
  }
  for (let x = 390; x < 418; x += 3) { const y = Math.round(bankTop(x)), h = 4 + ((q() * 6) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, y - h + 3, 4, h); }
  for (let x = 0; x < 18; x += 3) { const h = 3 + ((q() * 4) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 153 - h, 4, h); }

  // нижняя набережная у воды (в устье Которосли — вода)
  R('granite', 0, 164, 56, 2); R('graniteDark', 0, 166, 56, 2);
  R('granite', 86, 164, W - 86, 2); R('graniteDark', 86, 166, W - 86, 2);
}

// ---------- фонтаны на нижнем ярусе Стрелки (тёплый сезон, вечером — цветомузыка) ----------
const month = (env) => env.local.getUTCMonth() + 1;
export function fountainsOn(env) {
  const mo = month(env), h = env.local.getUTCHours();
  return !env.winter && mo >= 5 && mo <= 9 && h >= 9 && h < 23;
}
export function drawAbove(b, env, dayF, t) {
  if (!fountainsOn(env)) return;
  const night = 1 - dayF;
  for (let i = 0; i < 6; i++) {
    const x = 102 + i * 4, hgt = 3 + Math.round((Math.sin(t * 1.6 + i * 0.9) + 1) * 2.5);
    b.fillStyle = night > 0.4 ? `hsl(${Math.round(t * 40 + i * 60) % 360},80%,70%)` : '#e6f2ff';
    b.globalAlpha = 0.55 + 0.35 * night;
    b.fillRect(x, 157 - hgt, 1, hgt);
    b.fillRect(x - 1, 157 - hgt, 3, 1);
  }
  b.globalAlpha = 1;
}

// ---------- ночная подсветка: золото Успенского собора, «свеча» Коровников, Волжская башня ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const glow = (x, y, rad, rgbStr, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(${rgbStr},${a * nightF})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  glow(162, 84, 26, '255,210,120', 0.26);
  glow(51, 104, 14, '255,190,130', 0.18);
  glow(296, 112, 16, '255,220,160', 0.14);
  glow(380, 118, 16, '255,180,120', 0.18);
  // купола Успенского горят золотом
  const Rg = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.globalAlpha = nightF * 0.75;
  dome(Rg, 162, 74, USP_MAIN, '#ffd878', '#e0a848');
  for (const cx of [149, 175]) dome(Rg, cx, 91, USP_SIDE, '#ffd878', '#e0a848');
  g.globalAlpha = 1;
  // цветной отсвет фонтанов на Стрелке
  if (fountainsOn(env)) glow(112, 152, 16, `${Math.round(160 + 90 * Math.sin(t))},${Math.round(160 + 90 * Math.sin(t + 2))},${Math.round(160 + 90 * Math.sin(t + 4))}`, 0.25);
}

// ---------- теплоход по Волге в навигацию + набережная на нашем берегу ----------
export function drawBoats(ctx, env, dayF, t) {
  drawShip(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
}
export function drawAboveLate(b, env, dayF, t) { drawCars(b, env, dayF, t); }

function drawShip(ctx, env, dayF, t) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 7 || h > 22) return;
  const s = env.ms / 1000 + 300, cyc = Math.floor(s / 1500), p = (s % 1500) / 420;
  if (p >= 1) return;
  const dir = cyc % 2 ? 1 : -1, x = Math.round(dir > 0 ? -60 + p * 600 : 540 - p * 600), y = 178, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 46, 4);
  ctx.fillStyle = mixHex('#1a1e28', '#2a4a8a', dayF); ctx.fillRect(x + 1, y + 4, 44, 2);
  ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 4, y - 3, 38, 3); ctx.fillRect(x + 9, y - 6, 28, 3);
  ctx.fillStyle = mixHex('#30343e', '#dcdcd8', dayF); ctx.fillRect(dir > 0 ? x + 30 : x + 10, y - 8, 6, 2); // рубка
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.25 + nightF * 0.75;
  for (let i = 0; i < 12; i++) ctx.fillRect(x + 6 + i * 3, y - 2, 2, 1);
  for (let i = 0; i < 8; i++) ctx.fillRect(x + 11 + i * 3, y - 5, 2, 1);
  for (let i = 0; i < 14; i++) ctx.fillRect(x + 3 + i * 3, y + 1, 1, 1);
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — медвежонок с золотой секирой, как на гербе
export function drawSill(R, SILL) {
  const fur = '#6a4428', furHi = '#8a6038', dark = '#1a1210';
  R('#8a6a3a', 274, SILL - 2, 16, 2); R('#a8844a', 274, SILL - 2, 16, 1);
  R(fur, 278, SILL - 5, 2, 3); R(fur, 283, SILL - 5, 2, 3);
  R(fur, 277, SILL - 11, 9, 6); R(furHi, 278, SILL - 10, 3, 4);
  R(fur, 276, SILL - 15, 6, 4); R(fur, 276, SILL - 16, 1, 1); R(fur, 280, SILL - 16, 1, 1);
  R(furHi, 274, SILL - 13, 2, 2); R(dark, 274, SILL - 13, 1, 1); R(dark, 278, SILL - 14, 1, 1);
  R(fur, 285, SILL - 13, 2, 4);
  R('#c89040', 287, SILL - 19, 1, 11);
  R('#e8c048', 288, SILL - 20, 3, 4); R('#b8902a', 290, SILL - 20, 1, 4);
}

// ---------- улица: машины на мостах и набережной, наша набережная с ларьками ----------
const KVAS = { awning: ['#d8a020', '#f4ecd0'], counter: '#e8c030', goods: [[1, '#8a4a1a'], [4, '#8a4a1a'], [8, '#f4e8c8']], steam: false };
const SYR = { awning: ['#3a6a4a', '#f0e8c8'], counter: '#8a5a34', goods: [[1, '#f0c850'], [4, '#e8b840'], [8, '#f0c850']], steam: false };
const STALL_KIND = { kvas: KVAS, syr: SYR };
// Какие ларьки работают сейчас
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (mo >= 5 && mo <= 9 && h >= 10 && h < 22) return ['icecream', 'kvas', 'corn'];
  if (h >= 10 && h < ((mo >= 11 || mo <= 3) ? 20 : 21)) return ['tea', 'syr'];
  return [];
}
export const STALL_X = { icecream: 150, kvas: 236, corn: 322, tea: 236, syr: 322 };
const LANES = [
  { x0: -6, x1: 26, y: 146 },   // Юбилейный мост
  { x0: 54, x1: 88, y: 155 },   // Московский мост через Которосль
  { x0: 236, x1: 392, y: 148 }, // Волжская набережная
  { x0: 416, x1: 484, y: 148 },
];
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: STALL_KIND[k] || k, x: STALL_X[k] }))); }

// ---------- расписания: Тверицкий катер, «Метеоры», День города ----------
const minOfDay = (env) => env.local.getUTCHours() * 60 + env.local.getUTCMinutes() + env.local.getUTCSeconds() / 60;
// День города — последняя суббота мая
export function isCityDay(local) { return local.getUTCMonth() === 4 && local.getUTCDay() === 6 && local.getUTCDate() >= 25; }
// Катер Тверицы — Речной вокзал (навигация 2026): от Тверицкой пристани в 7:30, 9:10, 13:05, 17:20,
// с 9 мая по 18 августа ещё в 20:05; обратно — через 5 минут. Возвращает минуты с отхода (0…10) или -1.
const KATER = [7 * 60 + 30, 9 * 60 + 10, 13 * 60 + 5, 17 * 60 + 20];
export function katerRun(env) {
  if (!env.navigation || env.frozen) return -1;
  const l = env.local, mo = l.getUTCMonth() + 1, d = l.getUTCDate(), m = minOfDay(env);
  const deps = KATER.slice();
  if ((mo === 5 && d >= 9) || mo === 6 || mo === 7 || (mo === 8 && d <= 18)) deps.push(20 * 60 + 5);
  for (const dep of deps) if (m >= dep && m < dep + 10) return m - dep;
  return -1;
}
// «Метеоры» от Речного вокзала вверх по Волге (9 мая — 31 августа): в Углич 8:50, в Рыбинск 14:10; возвращение к 19:30
export function meteorRun(env) {
  const l = env.local, mo = l.getUTCMonth() + 1, d = l.getUTCDate();
  if (env.frozen || !((mo === 5 && d >= 9) || mo === 6 || mo === 7 || mo === 8)) return null;
  const m = minOfDay(env);
  for (const dep of [8 * 60 + 50, 14 * 60 + 10]) if (m >= dep && m < dep + 4) return { p: (m - dep) / 4, dir: 1 };
  const arr = 19 * 60 + 30;
  if (m >= arr - 4 && m < arr) return { p: (m - arr + 4) / 4, dir: -1 };
  return null;
}

// ---------- секреты Ярославля ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
export const SECRETS = [
  {
    id: 'medved', name: 'Медведь у Медведицкого оврага', layer: 'sky',
    hint: 'В сумерках у старой башни на обрыве кто-то косолапый выглядывает из кустов.',
    found: 'По легенде, у Медведицкого оврага, рядом с нынешней Волжской башней, князь Ярослав Мудрый одолел медведя секирой — так появились город и его герб.',
    state(env) {
      if (!env.forced && (env.winter || env.sun.alt > -3)) return null; // зимой медведи спят
      if (!inWin(env, 2700, 25, 1300)) return null;
      return { x: 397, y: 142, w: 9, h: 7 };
    },
    draw(b, env, st, dayF) {
      const { x, y } = st, fur = mixHex('#3a2a20', '#6a4a30', Math.max(dayF, 0.35)), peek = Math.sin(env.ms / 700) > 0 ? 0 : 1;
      b.fillStyle = fur; b.fillRect(x + 1, y + 2 + peek, 7, 5); b.fillRect(x, y + 3 + peek, 3, 3); // туловище и голова
      b.fillRect(x + 1, y + 1 + peek, 1, 1); b.fillRect(x + 4, y + 1 + peek, 1, 1);           // уши
      b.fillStyle = '#ffe8a0'; b.fillRect(x + 1, y + 4 + peek, 1, 1);                           // глаз блестит в свете фонаря
      b.fillStyle = mixHex('#2f5531', '#3e6b3d', dayF); b.fillRect(x - 1, y + 6, 11, 2);        // куст
    },
  },
  {
    id: 'kater', name: 'Тверицкий катер', layer: 'street',
    hint: 'В навигацию прямо от нашего берега несколько раз в день отходит маленький кораблик.',
    found: 'Катер ходит по расписанию между Тверицами и Речным вокзалом на Волжской набережной — самая короткая дорога в центр.',
    state(env) {
      let u = katerRun(env);
      if (u < 0) { if (!env.forced) return null; u = 2.5; }
      const k = u < 5 ? u / 5 : (10 - u) / 5; // 0 — у нашего берега, 1 — у Речного вокзала
      return { x: Math.round(250 + k * 110), y: Math.round(192 - k * 20), w: 14, h: 7, back: u >= 5 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, nightF = 1 - dayF;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f0', dayF); ctx.fillRect(x, y + 3, 14, 3);
      ctx.fillStyle = mixHex('#1a1e28', '#c8423a', dayF); ctx.fillRect(x + 1, y + 6, 12, 1);
      ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(st.back ? x + 2 : x + 4, y, 8, 3);
      ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7;
      for (let i = 0; i < 3; i++) ctx.fillRect((st.back ? x + 3 : x + 5) + i * 2, y + 1, 1, 1);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(st.back ? x + 14 : x - 4, y + 6, 4, 1); ctx.globalAlpha = 1; // след
    },
  },
  {
    id: 'meteor', name: '«Метеор» на подводных крыльях', layer: 'street',
    hint: 'Летом по утрам и после обеда от Речного вокзала вверх по Волге уносится что-то очень быстрое.',
    found: '«Метеоры» летом ходят из Ярославля вверх по Волге — в Рыбинск и Углич.',
    state(env) {
      let run = meteorRun(env);
      if (!run) { if (!env.forced) return null; run = { p: 0.5, dir: 1 }; }
      const x = run.dir > 0 ? 350 + run.p * 150 : 500 - run.p * 150;
      return { x: Math.round(x), y: 172, w: 20, h: 8, dir: run.dir };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f2', dayF); ctx.fillRect(x + 1, y + 2, 18, 3); ctx.fillRect(st.dir > 0 ? x + 6 : x + 4, y, 10, 2);
      ctx.fillStyle = mixHex('#1a1e28', '#3a6ab0', dayF); ctx.fillRect(st.dir > 0 ? x + 7 : x + 5, y + 1, 8, 1);
      ctx.fillStyle = mixHex('#2a2a34', '#6a6a72', dayF); ctx.fillRect(x + 4, y + 5, 1, 2); ctx.fillRect(x + 15, y + 5, 1, 2); // крылья
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) ctx.fillRect(st.dir > 0 ? x - 2 - i * 2 : x + 20 + i * 2, y + 6 - (i % 2), 2, 1); // бурун
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'salute', name: 'Салют в День города', layer: 'sky',
    hint: 'В последнюю субботу мая, ближе к полуночи, небо над Стрелкой расцветает.',
    found: 'День города Ярославль отмечает в последнюю субботу мая; праздник завершает салют с нижнего яруса Стрелки.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), m = l.getUTCMinutes();
      if (!env.forced && !(isCityDay(l) && h === 23 && m < 15)) return null;
      return { x: 20, y: 10, w: 190, h: 90 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 112, 40, dayF); },
  },
  {
    id: 'chaika', name: '«Чайка» среди звёзд', layer: 'sky',
    hint: 'Ясной ночью среди звёзд иногда медленно ползёт одна, которая не мигает.',
    found: '«Чайка» — позывной Валентины Терешковой, первой женщины в космосе (16 июня 1963). До полёта она работала на Ярославском шинном заводе и прыгала с парашютом в ярославском аэроклубе.',
    state(env) {
      if (!env.forced && (env.sun.alt > -10 || env.weather.cloud > 60)) return null;
      if (!inWin(env, 3000, 60, 400)) return null;
      const p = phase(env, 3000, 60, 400);
      return { x: Math.round(20 + p * 440) - 2, y: Math.round(26 + p * 22) - 2, w: 6, h: 6 };
    },
    draw(b, env, st) {
      b.globalAlpha = 0.35; b.fillStyle = '#e8f0ff'; b.fillRect(st.x + 1, st.y + 2, 3, 1); b.fillRect(st.x + 2, st.y + 1, 1, 3);
      b.globalAlpha = 1; b.fillStyle = '#ffffff'; b.fillRect(st.x + 2, st.y + 2, 1, 1);
    },
  },
  {
    id: 'rybak', name: 'Рыбак на льду', layer: 'street',
    hint: 'Зимой по выходным на льду Волги кто-то очень терпеливо сидит с утра.',
    found: 'Зимой на льду Волги у Ярославля сидят рыбаки с удочками над лунками. Но на тонкий весенний лёд выходить нельзя.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), wd = l.getUTCDay();
      if (!env.forced && !(env.frozen && (wd === 0 || wd === 6) && h >= 7 && h < 14)) return null;
      return { x: 120, y: 180, w: 12, h: 11 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#1a2a3a', '#3a4a5a', dayF); ctx.fillRect(x + 8, y + 10, 3, 1); // лунка
      ctx.fillStyle = mixHex('#2a3a4a', '#4a7aa8', dayF); ctx.fillRect(x, y + 6, 4, 4);      // ящик
      drawPerson(ctx, x + 2, y + 7, 0.25, dayF, 0, false, true, false);
      ctx.fillStyle = mixHex('#2a2a2a', '#5a4a3a', dayF); for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + i, y + 3 + (i >> 1), 1, 1); // удочка
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x + 9, y + 6, 1, 4); ctx.globalAlpha = 1;               // леска
    },
  },
];

// События по новостям для Ярославля (fireworks — салют над Стрелкой)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 112, 40, dayF); }
