// Екатеринбург: вид с мыса у спорткомплекса «Динамо» (северо-восточный берег Городского пруда)
// на юго-юго-запад, через пруд. Слева направо: Вознесенская горка с Храмом на Крови, Дом Севастьянова,
// «Высоцкий» за Плотинкой, Плотинка (Историческая плотина, по ней идёт проспект Ленина),
// Театр драмы, башня «Исеть» в Екатеринбург-Сити, низкие здания Сити, деревья Заречного берега.
// Художественное сжатие: в жизни с «Динамо» башня «Исеть» ~225°, Театр драмы ~220°, а Плотинка ~164°,
// Дом Севастьянова ~156°, «Высоцкий» ~144° и Храм на Крови ~121° (последний — за левым краем обзора).
// Восточная группа в кадре придвинута к центру. Башня «Исеть», театр и Сити стоят почти по реальным
// азимутам — поэтому солнце в конце декабря садится в кадре за башню, как и в жизни.

import { mixHex, rng } from '../../engine/util.js';
import { W, HORIZON } from '../../engine/const.js';
import { azToX } from '../../engine/scene.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks, drawPerson, KINDS } from '../../engine/street.js';

const DAY = {
  far: '#a8b0c0', farDark: '#98a0b2', farRoof: '#848ca0', farTall: '#b4bccc',
  hill: '#6e8a5a', hillDark: '#5a7448', tree: '#3e6a3e', treeDark: '#2f5532', grass: '#7a9e5a',
  granite: '#8e8478', graniteDark: '#6e665c', graniteHi: '#b0a698', road: '#9a968e',
  wall: '#f2eee6', wallShade: '#d2ccc0', win: '#5e6474',
  gold: '#e8b848', goldDark: '#b88a2a',
  mint: '#9ed0c8', mintShade: '#7cb0a8', trim: '#f6f4ee', mintRoof: '#4e7a72',
  vys: '#6c8aa8', vysDark: '#526e8a', vysHi: '#9ab4cc', vysCrown: '#c8d4e0',
  glass: '#4a6e96', glassDark: '#3a5a7e', glassHi: '#86aacc', glassFrame: '#c8d6e4',
  drama: '#eceae4', dramaShade: '#c8c4bc', dramaGlass: '#7a96b0',
  city: '#dcdedc', cityShade: '#b8bcbc', cityGlass: '#8eacc4',
  house1: '#e6d29a', house2: '#e4c4b2', house3: '#d6dacc', houseShade: '#b6ae9e', roof: '#7a6a60',
  snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a', farTall: '#222a44',
  hill: '#141c1c', hillDark: '#101616', tree: '#131b1d', treeDark: '#0f1618', grass: '#18221c',
  granite: '#2a2830', graniteDark: '#201e26', graniteHi: '#3a3842', road: '#2a2830',
  wall: '#8e8a80', wallShade: '#6e6a62', win: '#1a1420',
  gold: '#c89a3a', goldDark: '#9a7428',
  mint: '#4a6a68', mintShade: '#3a5654', trim: '#7e7c76', mintRoof: '#1e2e2c',
  vys: '#1e2a3c', vysDark: '#182232', vysHi: '#2a3a50', vysCrown: '#3a4a62',
  glass: '#1a2a44', glassDark: '#142238', glassHi: '#24385a', glassFrame: '#34465e',
  drama: '#5e6068', dramaShade: '#46484e', dramaGlass: '#283a52',
  city: '#4a4e58', cityShade: '#383c44', cityGlass: '#22344a',
  house1: '#3a3440', house2: '#3a3038', house3: '#30343c', houseShade: '#26242c', roof: '#1e1c24',
  snow: '#5e6880',
};
// Урал: осень приходит в сентябре — берёзы и тополя желтеют
const AUTUMN = {
  day: { tree: '#c8962e', treeDark: '#9a6a26', grass: '#9a9650', hill: '#8a8a4c', hillDark: '#72703c' },
  night: { tree: '#221c16', treeDark: '#1a1511' },
};
const WINTER = {
  day: { tree: '#5c5852', treeDark: '#46433e', hill: '#dfe6ec', hillDark: '#c6ced8', grass: '#e8eef2' },
  night: { tree: '#1a1a1e', treeDark: '#141418', hill: '#2c3244', hillDark: '#242a3a', grass: '#303648' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Нарисованные ориентиры (x — центр или границы); те же числа в HOTSPOTS
export const X = { hram: 66, sev: [164, 200], vys: 228, dam: [200, 286], drama: [288, 320], iset: 334, city: [348, 396] };

// Вознесенская горка: левый берег поднимается к храму и спускается к Плотинке
const hillTop = (x) => (x < 30 ? 134 : x < 100 ? 131 : x < 166 ? 131 + (x - 100) * 0.42 : 158);

function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}
function cross(R, x, top, h = 4) { R('gold', x, top, 1, h); R('gold', x - 1, top + 1, 3, 1); }

function house(R, L, q, winter, x, w, h, key, base) {
  const top = base - h;
  R(key, x, top, w, h); R('houseShade', x + w - 2, top, 2, h);
  R('roof', x - 1, top - 2, w + 2, 2);
  if (winter) R('snow', x - 1, top - 2, w + 2, 1);
  for (let yy = top + 2; yy < base - 2; yy += 4) for (let xx = x + 1; xx < x + w - 2; xx += 3) { R('win', xx, yy, 1, 2); if (q() < 0.6) L(xx, yy, 'win'); }
}

export function drawFar({ winter, L, R }) {
  const q = rng(6610); // свой генератор — раскладка одинакова в дневном и ночном проходе

  // дальний город за прудом
  for (let x = 0; x < W;) {
    const w = 6 + ((q() * 12) | 0), tall = q() < 0.22, h = tall ? 14 + ((q() * 14) | 0) : 5 + ((q() * 9) | 0);
    const base = 154, top = base - h;
    R(tall ? 'farTall' : q() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < base - 2; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (q() < 0.3) L(xx, yy, 'win');
    if (tall && h > 22) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w;
  }

  // «Высоцкий» (188 м) за Плотинкой: ступенчатый объём с «короной»
  {
    const cx = X.vys;
    for (const [w, top] of [[18, 62], [14, 52], [10, 44], [6, 38]]) { R('vys', cx - (w >> 1), top, w, 152 - top); R('vysDark', cx + (w >> 1) - 3, top, 3, 152 - top); R('vysHi', cx - (w >> 1), top, 1, 152 - top); }
    R('vysCrown', cx - 3, 36, 6, 2); R('vysCrown', cx - 1, 30, 2, 6); R('vysCrown', cx, 24, 1, 6); // корона и шпиль
    for (let yy = 66; yy < 150; yy += 3) for (let xx = cx - 7; xx < cx + 7; xx += 2) { R('vysDark', xx, yy, 1, 1); if (q() < 0.35) L(xx, yy, 'win'); }
    for (let yy = 54; yy < 62; yy += 3) for (let xx = cx - 5; xx < cx + 5; xx += 2) if (q() < 0.3) L(xx, yy, 'win');
    L(cx, 24, 'red', '#ff3a3a', 0);
  }

  // Вознесенская горка
  for (let x = 0; x < 168; x++) { const y = Math.round(hillTop(x)); R('hill', x, y, 1, 164 - y); R('hillDark', x, y + 10, 1, Math.max(0, 164 - y - 10)); }
  for (let x = 0; x < 166; x += 3) { if (x > 40 && x < 94) continue; const y = Math.round(hillTop(x)) + 4 + ((q() * 18) | 0), h = 3 + ((q() * 5) | 0); if (y + h < 163) R(q() < 0.5 ? 'tree' : 'treeDark', x, y, 4, h); }
  for (const [x, w, h, k] of [[2, 12, 10, 'house2'], [16, 10, 8, 'house1'], [100, 12, 9, 'house3'], [114, 10, 11, 'house1'], [128, 12, 8, 'house2'], [144, 10, 9, 'house3']]) house(R, L, q, winter, x, w, h, k, Math.round(hillTop(x + (w >> 1))) + 2);

  // Храм на Крови: белый пятиглавый храм на горке
  {
    const cx = X.hram, base = 132;
    R('wall', cx - 20, base - 20, 40, 20); R('wallShade', cx + 15, base - 20, 5, 20);
    R('wall', cx - 24, base - 10, 48, 10); R('wallShade', cx + 20, base - 10, 4, 10); // нижний ярус
    for (let x = cx - 16; x < cx + 14; x += 5) { R('win', x, base - 17, 2, 5); L(x, base - 16, 'win', null, 0.4); }
    for (let x = cx - 21; x < cx + 22; x += 4) R('win', x, base - 7, 1, 3);
    R('wall', cx - 6, base - 34, 12, 14); R('wallShade', cx + 3, base - 34, 3, 14); // центральный барабан
    for (let x = cx - 4; x < cx + 4; x += 3) R('win', x, base - 31, 1, 4);
    dome(R, cx, base - 43, [2, 4, 6, 8, 10, 10, 8], 'gold', 'goldDark'); cross(R, cx, base - 48, 5);
    for (const dx of [-14, 14]) {
      R('wall', cx + dx - 3, base - 27, 6, 7); R('wallShade', cx + dx + 1, base - 27, 2, 7);
      dome(R, cx + dx, base - 33, [2, 4, 6, 6, 4], 'gold', 'goldDark'); cross(R, cx + dx, base - 37, 4);
    }
    if (winter) { R('snow', cx - 20, base - 20, 40, 1); R('snow', cx - 24, base - 10, 4, 1); R('snow', cx + 20, base - 10, 4, 1); }
    L(cx - 10, base - 2, 'flood', '#fff0d0', 0); L(cx + 10, base - 2, 'flood', '#fff0d0', 0);
  }

  // Дом Севастьянова на берегу пруда: мятные стены, белый декор, золочёные главки
  {
    const [x0, x1] = X.sev, base = 164, top = 146;
    R('mint', x0, top, x1 - x0, base - top); R('mintShade', x1 - 3, top, 3, base - top);
    R('trim', x0, top, x1 - x0, 1); R('trim', x0, base - 9, x1 - x0, 1);
    R('mintRoof', x0, top - 2, x1 - x0, 2);
    for (let x = x0 + 2; x < x1 - 2; x += 4) { R('trim', x - 1, top + 3, 3, 5); R('win', x, top + 4, 1, 4); R('trim', x - 1, base - 7, 3, 5); R('win', x, base - 6, 1, 4); L(x, top + 5, 'win', null, 0.5); }
    const mid = (x0 + x1) >> 1;
    R('mint', mid - 5, top - 8, 10, 8); R('trim', mid - 5, top - 8, 10, 1); R('win', mid - 1, top - 6, 2, 4); // центральный ризалит
    dome(R, mid, top - 13, [1, 2, 4, 4, 6], 'gold', 'goldDark'); R('gold', mid, top - 15, 1, 2);
    for (const tx of [x0 + 2, x1 - 3]) { R('mint', tx - 2, top - 5, 5, 5); R('trim', tx - 2, top - 5, 5, 1); dome(R, tx, top - 9, [1, 3, 3, 3], 'gold', 'goldDark'); }
    if (winter) { R('snow', x0, top - 2, x1 - x0, 1); R('snow', mid - 5, top - 8, 10, 1); }
    L(mid - 8, base - 1, 'flood', '#fff0d8', 0); L(mid + 8, base - 1, 'flood', '#fff0d8', 0);
  }

  // Плотинка: деревья Исторического сквера, проспект Ленина, гранитная стенка к пруду
  {
    const [x0, x1] = X.dam;
    for (let x = x0; x < x1; x += 3) { const h = 4 + ((q() * 6) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 156 - h, 4, h); }
    R('road', x0, 156, x1 - x0, 3);
    R('graniteHi', x0, 159, x1 - x0, 1);
    R('granite', x0, 160, x1 - x0, 8);
    for (let x = x0; x < x1; x += 2) R('graniteDark', x, 160 + ((x >> 1) % 2) * 3, 1, 1);
    for (let y = 161; y < 168; y += 2) R('graniteDark', x0, y, x1 - x0, 1); // ступени к воде
    if (winter) { R('snow', x0, 159, x1 - x0, 1); R('snow', x0, 162, x1 - x0, 1); }
    for (let x = x0 + 4; x < x1; x += 10) { R('graniteDark', x, 150, 1, 6); L(x, 149, 'lamp', '#ffd88a', 0); }
  }

  // Театр драмы: белый объём со световой «башней»
  {
    const [x0, x1] = X.drama, base = 164;
    R('drama', x0, 150, x1 - x0, base - 150); R('dramaShade', x1 - 3, 150, 3, base - 150);
    R('dramaGlass', x0 + 2, 154, x1 - x0 - 6, 3);
    R('drama', x0 + 10, 136, 14, 14); R('dramaShade', x0 + 21, 136, 3, 14); R('dramaGlass', x0 + 12, 139, 8, 6);
    if (winter) { R('snow', x0, 150, x1 - x0, 1); R('snow', x0 + 10, 136, 14, 1); }
    for (let x = x0 + 3; x < x1 - 4; x += 4) L(x, 155, 'win', null, 0.3);
    L(x0 + 16, 142, 'flood', '#fff0d8', 0);
  }

  // Башня «Исеть» (209 м): стеклянная, с подсвеченной «короной»
  {
    const cx = X.iset, x0 = cx - 7, base = 164;
    R('glass', x0, 40, 14, base - 40); R('glassDark', x0 + 10, 40, 4, base - 40); R('glassHi', x0 + 2, 40, 2, base - 40);
    for (let yy = 44; yy < base - 2; yy += 3) R('glassDark', x0, yy, 14, 1);
    for (let i = 0; i < 8; i++) R('glassFrame', x0 + i, 40 - Math.round(i * 0.9), 1, 1 + Math.round(i * 0.9)); // скошенный верх
    for (let i = 8; i < 14; i++) R('glassFrame', x0 + i, 33, 1, 8);
    R('glassFrame', x0, 40, 14, 1);
    for (let yy = 46; yy < base - 4; yy += 3) for (let xx = x0 + 1; xx < x0 + 13; xx += 2) if (q() < 0.28) L(xx, yy, 'win');
    L(x0 + 12, 32, 'red', '#ff3a3a', 0);
  }

  // Екатеринбург-Сити у воды: низкие светлые здания (без подписей)
  {
    const [x0, x1] = X.city;
    R('city', x0, 152, x1 - x0, 12); R('cityShade', x1 - 3, 152, 3, 12);
    R('cityGlass', x0 + 4, 155, 18, 6); R('city', x0 + 24, 144, 14, 8); R('cityShade', x0 + 35, 144, 3, 8);
    for (let x = x0 + 26; x < x0 + 36; x += 3) L(x, 147, 'win', null, 0.3);
    for (let x = x0 + 5; x < x0 + 22; x += 3) L(x, 157, 'win', null, 0.25);
    if (winter) { R('snow', x0, 152, x1 - x0, 1); R('snow', x0 + 24, 144, 14, 1); }
  }

  // Заречный берег справа: дома и деревья
  for (const [x, w, h, k] of [[398, 12, 12, 'house3'], [412, 14, 9, 'house2'], [440, 12, 14, 'house1'], [456, 14, 10, 'house3']]) house(R, L, q, winter, x, w, h, k, 162);
  for (let x = 396; x < W; x += 3) { const h = 3 + ((q() * 5) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 163 - h, 4, h); }
  for (let x = 286; x < 398; x += 4) { if (x > 324 && x < 344) continue; const h = 2 + ((q() * 3) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 164 - h, 3, h); }

  // гранитная набережная по всему дальнему берегу
  for (const [a, b] of [[0, X.dam[0]], [X.dam[1], W]]) {
    R('granite', a, 164, b - a, 2); R('graniteDark', a, 166, b - a, 2);
    for (let x = a + 6; x < b; x += 14) L(x, 163, 'lamp', '#ffe2a0', 0);
  }
}

// ---------- ночная подсветка ----------
export function drawNight(g, env, nightF) {
  if (nightF < 0.05) return;
  const glow = (x, y, rad, rgbStr, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(${rgbStr},${a * nightF})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  glow(X.hram, 108, 26, '255,225,170', 0.22);
  glow(182, 150, 22, '255,230,190', 0.18);
  glow(243, 154, 30, '255,200,130', 0.14);
  glow(X.iset, 60, 26, '150,200,255', 0.16);
  glow(X.vys, 40, 18, '170,210,255', 0.16);
  const Rg = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.globalAlpha = nightF * 0.75;
  dome(Rg, X.hram, 89, [2, 4, 6, 8, 10, 10, 8], '#ffd878', '#e0a848');
  for (const dx of [-14, 14]) dome(Rg, X.hram + dx, 99, [2, 4, 6, 6, 4], '#ffd878', '#e0a848');
  // контур «Исети» и корона «Высоцкого»
  g.globalAlpha = nightF * 0.6; g.fillStyle = '#9ad0ff';
  for (let i = 0; i < 8; i++) g.fillRect(X.iset - 7 + i, 40 - Math.round(i * 0.9), 1, 1);
  g.fillRect(X.iset - 7, 41, 1, 123); g.fillRect(X.iset + 6, 33, 1, 131);
  g.fillStyle = '#d8ecff'; g.fillRect(X.vys - 3, 36, 6, 2); g.fillRect(X.vys - 1, 30, 2, 6);
  g.globalAlpha = 1;
}

const LANES = [
  { x0: X.dam[0], x1: X.dam[1], y: 157 }, // проспект Ленина по Плотинке
  { x0: 0, x1: 160, y: 163 },             // набережная под горкой
];
export function drawAboveLate(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }

// ---------- набережная переднего плана: ларьки по сезону ----------
const SHANGI = { awning: ['#d8782a', '#f4e6c8'], counter: '#8a5a34', goods: [[1, '#e0a840'], [4, '#d89838'], [8, '#e0a840']], steam: true };
const GEMS = { awning: ['#1f7a5a', '#0e3a2c'], counter: '#2a2420', goods: [[1, '#2fae7a'], [4, '#b03a5a'], [7, '#7a5ac8'], [9, '#2fae7a']], steam: false };
const STALL_KIND = { shangi: SHANGI, gems: GEMS, tea: KINDS.tea, icecream: 'icecream' };
export const STALL_X = { a: 150, b: 236, c: 430 };
const summer = (env) => { const mo = env.local.getUTCMonth() + 1; return mo >= 5 && mo <= 9 && !env.winter; };
export function stallKinds(env) {
  const h = env.local.getUTCHours();
  if (summer(env)) return h >= 10 && h < 22 ? { a: 'icecream', b: 'shangi', c: 'gems' } : {};
  return h >= 10 && h < (env.winter ? 19 : 20) ? { a: 'tea', b: 'shangi', c: 'gems' } : {};
}
export function stalls(env) { return Object.values(stallKinds(env)); }
function drawPromenade(ctx, env, dayF, t) {
  const k = stallKinds(env);
  streetPromenade(ctx, env, dayF, t, Object.keys(k).map((s) => ({ kind: STALL_KIND[k[s]], x: STALL_X[s] })));
}
export function drawBoats(ctx, env, dayF, t) { drawPromenade(ctx, env, dayF, t); }

// Сувенир на подоконнике — малахитовая шкатулка
export function drawSill(R, SILL) {
  const x = 257, y = SILL - 11;
  R('#14261e', x + 1, SILL - 1, 26, 1); // тень
  R('#1f7a5a', x, y + 3, 26, 8); R('#2fae7a', x, y + 3, 26, 1); R('#145a42', x + 22, y + 3, 4, 8);
  for (const [dx, dy, w] of [[2, 5, 6], [10, 6, 8], [4, 8, 9], [16, 8, 5]]) R('#0e4a36', x + dx, y + dy, w, 1); // разводы малахита
  for (const [dx, dy, w] of [[3, 6, 4], [12, 7, 5], [6, 9, 6]]) R('#5ad0a0', x + dx, y + dy, w, 1);
  R('#c8a050', x, y + 3, 26, 1); R('#c8a050', x, y + 10, 26, 1); R('#e8c878', x + 11, y + 6, 4, 2); // латунь, замочек
  R('#1f7a5a', x - 1, y, 28, 3); R('#2fae7a', x - 1, y, 28, 1); R('#0e4a36', x + 6, y + 1, 9, 1); R('#c8a050', x - 1, y + 2, 28, 1); // крышка
}

// ---------- секреты ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
const altToY = (alt) => HORIZON - (alt / 48) * HORIZON;

export const SECRETS = [
  {
    id: 'gorodok', name: 'Ледовый городок на Плотинке', layer: 'sky',
    hint: 'В новогодние каникулы над Плотинкой поднимается что-то высокое и разноцветное.',
    found: 'Зимой 2024/25 и 2025/26 главный ледовый городок Екатеринбурга впервые за много лет строили не на площади 1905 года, а на Плотинке, в Историческом сквере: высокая ёлка, горки и ледяные фигуры у самого пруда.',
    state(env) {
      const mo = month(env), d = env.local.getUTCDate(), h = env.local.getUTCHours();
      if (!env.forced && !(((mo === 12 && d >= 29) || (mo === 1 && d <= 18)) && h >= 10)) return null;
      return { x: 236, y: 120, w: 46, h: 38 };
    },
    draw(b, env, st, dayF) {
      const t = env.ms / 1000, cx = 252, nightF = 1 - dayF;
      for (let i = 0; i < 30; i++) { const w = 1 + Math.round(i * 0.55); b.fillStyle = mixHex('#0e2418', i % 6 < 3 ? '#2e6a3e' : '#24583a', Math.max(0.3, dayF)); b.fillRect(cx - (w >> 1), 125 + i, w, 1); }
      b.fillStyle = '#ffd84a'; b.fillRect(cx - 1, 122, 3, 3); b.fillRect(cx, 121, 1, 5);
      const cols = ['#ff5a4a', '#ffd84a', '#6ae0ff', '#b88aff', '#ffffff'];
      for (let i = 0; i < 22; i++) {
        const r = rng(i * 37 + 11), yy = 128 + ((r() * 26) | 0), half = Math.round((yy - 125) * 0.27);
        b.globalAlpha = (0.45 + 0.55 * Math.max(nightF, 0.35)) * (0.5 + 0.5 * Math.sin(t * 2 + i));
        b.fillStyle = cols[i % cols.length]; b.fillRect(cx - half + ((r() * (half * 2 + 1)) | 0), yy, 1, 1);
      }
      b.globalAlpha = 1;
      b.fillStyle = mixHex('#3a4a5e', '#bfe2f2', dayF); // ледяная горка
      for (let i = 0; i < 14; i++) b.fillRect(266 + i, 146 + Math.round(i * 0.6), 1, 10 - Math.round(i * 0.6));
      b.fillStyle = mixHex('#4a5a6e', '#e6f6ff', dayF); b.fillRect(264, 144, 4, 12);
      if (nightF > 0.1) { b.globalAlpha = nightF * 0.6; b.fillStyle = '#9adfff'; b.fillRect(266, 145, 14, 1); b.globalAlpha = 1; }
    },
  },
  {
    id: 'konki', name: 'Коньки на пруду', layer: 'street',
    hint: 'Зимой по выходным на льду пруда кто-то выписывает круги.',
    found: 'Городской пруд зимой встаёт подо лёд, и в морозные выходные по нему катаются на коньках — в некоторые зимы город расчищал на пруду бесплатный каток. На тонкий лёд в начале зимы и весной выходить нельзя.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), wd = l.getUTCDay(), mo = month(env);
      if (!env.forced && !(env.frozen && (mo === 1 || mo === 2) && (wd === 0 || wd === 6) && h >= 11 && h < 17)) return null;
      return { x: 248, y: 176, w: 76, h: 14 };
    },
    draw(ctx, env, st, dayF) {
      const t = env.ms / 1000;
      ctx.globalAlpha = 0.5; ctx.fillStyle = mixHex('#3a4660', '#eef6fc', dayF); ctx.fillRect(st.x, st.y + 8, st.w, 5); ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        const x = Math.round(st.x + 38 + Math.sin(t * 0.45 + i * 2.1) * 32), y = st.y + 10 + (i % 2) * 2;
        drawPerson(ctx, x, y, [0.1, 0.4, 0.8][i], dayF, t, false, true, true);
        ctx.fillStyle = mixHex('#2a2a30', '#c8ccd4', dayF); ctx.fillRect(x - 1, y + 1, 4, 1); // коньки
      }
    },
  },
  {
    id: 'katerok', name: 'Катер по пруду', layer: 'street',
    hint: 'Летом по Городскому пруду иногда неторопливо проходит что-то белое.',
    found: 'Летом по Городскому пруду ходят прогулочные катера. Пруд устроили в 1723 году вместе с заводом; он вытянут на 3,3 км вдоль Исети, а в ширину — всего 300–400 метров. Ещё на пруду катаются на лодках и катамаранах.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (env.frozen || !env.navigation || h < 11 || h >= 21)) return null;
      if (!inWin(env, 1500, 90, 200)) return null;
      const p = phase(env, 1500, 90, 200), dir = env.forced ? 1 : Math.floor((secT(env) + 200) / 1500) % 2 ? 1 : -1;
      const x = dir > 0 ? 100 + p * 320 : 420 - p * 320;
      return { x: Math.round(x), y: 176, w: 20, h: 8, dir };
    },
    draw(ctx, env, st, dayF) {
      const { x, y, dir } = st;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f0', dayF); ctx.fillRect(x, y + 3, 20, 3); ctx.fillRect(dir > 0 ? x + 4 : x + 6, y, 10, 3);
      ctx.fillStyle = mixHex('#1a2030', '#2a5a9a', dayF); ctx.fillRect(x + 1, y + 6, 18, 1); ctx.fillRect(dir > 0 ? x + 5 : x + 7, y + 1, 8, 1);
      ctx.fillStyle = mixHex('#2a2e38', '#c8423a', dayF); ctx.fillRect(dir > 0 ? x + 12 : x + 6, y - 2, 1, 2); // флажок
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) ctx.fillRect(dir > 0 ? x - 2 - i * 3 : x + 21 + i * 3, y + 6 + (i % 2), 2, 1);
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'zakat', name: 'Закат за «Исетью»', layer: 'sky',
    hint: 'В самые короткие дни года солнце садится за самую высокую башню города.',
    found: 'С мыса у «Динамо» башня «Исеть» стоит примерно на азимуте 225° — почти точно там, где садится солнце в дни зимнего солнцестояния. С конца ноября до середины января оно уходит прямо за 209-метровую башню.',
    state(env) {
      const s = env.sun;
      if (!env.forced && (s.alt > 10 || s.alt < -1 || s.az < 219 || s.az > 230 || env.weather.cloud > 70)) return null;
      const sx = env.forced ? 334 : Math.round(azToX(s.az)), sy = env.forced ? 150 : Math.round(altToY(Math.max(0, s.alt)));
      return { x: 322, y: 30, w: 24, h: 134, sx, sy };
    },
    draw(b, env, st) {
      const t = env.ms / 1000, a = 0.55 + 0.25 * Math.sin(t * 1.5);
      const g = b.createRadialGradient(st.sx, st.sy, 2, st.sx, st.sy, 40);
      g.addColorStop(0, `rgba(255,190,110,${0.5 * a})`); g.addColorStop(1, 'rgba(255,190,110,0)');
      b.fillStyle = g; b.fillRect(st.sx - 40, st.sy - 40, 80, 80);
      b.globalAlpha = a; b.fillStyle = '#ffd08a';
      const top = Math.max(34, st.sy - 40);
      b.fillRect(326, top, 1, 164 - top); b.fillRect(341, Math.max(33, top), 1, 164 - Math.max(33, top)); // золотая кромка башни
      b.globalAlpha = 1;
    },
  },
  {
    id: 'klaviatura', name: 'Клавиатура у Исети', layer: 'sky',
    hint: 'Днём у Плотинки кто-то прыгает по огромным серым кнопкам. А 5 октября — весь день.',
    found: 'Памятник клавиатуре открыт 5 октября 2005 года: 104 бетонные клавиши в масштабе 30:1, поле 16 на 4 метра, автор — Анатолий Вяткин. По клавишам можно ходить и «набирать» слова. В жизни он ниже Плотинки по течению Исети, у улицы Горького, и с пруда не виден — в кадре придвинут к плотине.',
    state(env) {
      const h = env.local.getUTCHours(), oct5 = month(env) === 10 && env.local.getUTCDate() === 5;
      if (!env.forced) {
        if (env.winter || h < 10 || h >= 19) return null;
        if (!oct5 && !inWin(env, 3600, 120, 1300)) return null;
      }
      return { x: 200, y: 150, w: 20, h: 10 };
    },
    draw(b, env, st, dayF) {
      const t = env.ms / 1000, key = Math.floor(t * 2) % 15;
      b.fillStyle = mixHex('#2a2830', '#6e6a64', dayF); b.fillRect(st.x, st.y + 5, 20, 5);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
        b.fillStyle = mixHex('#3a3842', (row * 9 + i) % 15 === key ? '#f0e6c8' : '#c8c4bc', dayF);
        b.fillRect(st.x + 1 + i * 2 + row, st.y + 6 + row * 2, 1, 1);
      }
      const px = st.x + 3 + (key % 8) * 2;
      drawPerson(b, px, st.y + 6 - (Math.sin(t * 6) > 0 ? 1 : 0), 0.3, dayF, t, false, false, false);
    },
  },
];

// События по новостям: салют над прудом (на День города его дают над акваторией Городского пруда)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 270, 36, dayF); }
