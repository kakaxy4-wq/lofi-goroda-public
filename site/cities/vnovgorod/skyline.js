// Великий Новгород: вид с набережной Александра Невского на Торговой стороне, от причала
// «Ярославово Дворище» чуть южнее пешеходного моста, на северо-запад — через Волхов на Детинец.
// Слева направо: Кремлёвский парк, стена Детинца над Кремлёвским пляжем, башня Кокуй,
// верхушка памятника «Тысячелетие России», Софийский собор с золотой главой, Горбатый
// (пешеходный) мост, за ним мост Александра Невского, справа — Ярославово дворище.
// Художественное сжатие: в жизни ориентиры раскинуты примерно на 70° (Кокуй ~297°, София ~324°,
// мост ~322°, Ярославово дворище ~35°), в кадре они сдвинуты к центру окна — чтобы их было видно
// и на телефоне. Ярославово дворище на самом деле стоит на нашем берегу, справа за спиной;
// в кадре оно отодвинуто к линии воды. Пешеходный мост тоже приходит к нашему берегу —
// в кадре он нарисован целиком у дальней линии воды.

import { mixHex, rng } from '../../engine/util.js';
import { W, HORIZON } from '../../engine/const.js';
import { azToX } from '../../engine/scene.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks, drawPerson, crowd, KINDS } from '../../engine/street.js';

const DAY = {
  far: '#a8aebe', farDark: '#969db0', farRoof: '#828a9e',
  tree: '#3e6b3d', treeDark: '#2f5531', grass: '#7aa05a', grassDark: '#628a48', sand: '#e2d2a4', sandDark: '#c8b688',
  brick: '#b0503e', brickDark: '#8a3a2e', brickHi: '#c4644e', roofW: '#6a5444', roofWDark: '#52402f',
  wall: '#f2eee4', wallShade: '#d2cbbc', pink: '#e8c4b0', pinkShade: '#c8a08c',
  gold: '#e8bc48', goldDark: '#b88c2a', silver: '#b8c0c8', silverDark: '#8a949e',
  win: '#5a5260', bronze: '#4a4a3e', bronzeHi: '#6a6a54',
  granite: '#8c8278', graniteDark: '#6f665e', road: '#9a968e',
  bridge: '#8a96a4', bridgeDark: '#66707e', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a',
  tree: '#151d1f', treeDark: '#101719', grass: '#18221c', grassDark: '#141c18', sand: '#3a3830', sandDark: '#2e2c26',
  brick: '#6e3226', brickDark: '#54261e', brickHi: '#7e3c2e', roofW: '#241c18', roofWDark: '#1a1412',
  wall: '#8a8678', wallShade: '#6a665c', pink: '#7a6660', pinkShade: '#5e4e4a',
  gold: '#c89a3a', goldDark: '#9a7428', silver: '#5a606a', silverDark: '#444a54',
  win: '#1a1420', bronze: '#1e1e18', bronzeHi: '#2a2a22',
  granite: '#27252d', graniteDark: '#1e1c23', road: '#2a2830',
  bridge: '#4a5262', bridgeDark: '#343a48', snow: '#6a7488',
};
const AUTUMN = {
  day: { tree: '#c08a34', treeDark: '#935f27', grass: '#9a9a50', grassDark: '#7e7e40' },
  night: { tree: '#221c16', treeDark: '#1a1511' },
};
const WINTER = {
  day: { tree: '#5d5853', treeDark: '#48443f', grass: '#e8eef2', grassDark: '#d4dce4', sand: '#e4eaf0', sandDark: '#ccd4de' },
  night: { tree: '#1a1a1e', treeDark: '#141418', grass: '#303648', grassDark: '#2a3040', sand: '#2e3446', sandDark: '#283040' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Опорные координаты рисунка (по ним же HOTSPOTS в index.js)
export const X = { kokui: 226, monument: 244, sofia: 266, bridge0: 300, bridge1: 372, nikola: 425 };
const WALL_TOP = 144, WALL_BASE = 158;
// Профиль Горбатого моста: горб посередине
export const deckY = (x) => 156 - 10 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - X.bridge0) / (X.bridge1 - X.bridge0))));

// Шлемовидная глава: ряды ширин сверху вниз
function helmet(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 1, top + i, 1, 1); });
}
function cross(R, x, top, h = 5, c = 'gold') { R(c, x, top, 1, h); R(c, x - 1, top + 1, 3, 1); }
function tentRoof(R, cx, top, rows, grow, c, cDark) {
  for (let i = 0; i < rows; i++) { const w = Math.max(1, Math.round(1 + i * grow)); R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 1, top + i, 1, 1); }
}
// Башня Детинца: кирпичный четверик и деревянный шатёр
function dTower(R, winter, cx, w, h) {
  const x = cx - (w >> 1), top = WALL_BASE - h;
  R('brick', x, top, w, h); R('brickDark', x + w - 2, top, 2, h); R('brickHi', x, top, 1, h);
  R('win', cx - 1, top + 4, 1, 2); R('win', cx - 1, top + 10, 1, 2);
  const rows = Math.round(w * 0.9);
  tentRoof(R, cx, top - rows, rows, 1.1, 'roofW', 'roofWDark');
  if (winter) R('snow', cx - 1, top - Math.round(rows * 0.5), 3, 1);
}

export function drawFar({ winter, L, R }) {
  const q = rng(1136); // свой генератор — раскладка одинакова в дневном и ночном проходах

  // дальний город по обоим берегам
  for (let x = 0; x < W;) {
    const w = 6 + ((q() * 12) | 0), h = 4 + ((q() * 10) | 0), base = 158, top = base - h;
    R(q() < 0.5 ? 'far' : 'farDark', x, top, w, h); R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < base - 2; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (q() < 0.3) L(xx, yy, 'win');
    x += w;
  }

  // Софийская сторона: берег, Кремлёвский парк слева
  R('grass', 0, 156, 300, 6); R('grassDark', 0, 160, 300, 2);
  for (let x = 0; x < 64; x += 3) { const h = 6 + ((q() * 9) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 157 - h, 4, h); }
  // Кремлёвский пляж под стеной
  R('sand', 60, 162, 236, 4); R('sandDark', 60, 165, 236, 2);
  R('graniteDark', 0, 162, 60, 4);

  // мост Александра Невского — ниже по течению, за Горбатым мостом и между постройками дворища
  R('bridge', 296, 153, W - 296, 2); R('bridgeDark', 296, 155, W - 296, 1);
  for (let x = 306; x < W; x += 34) R('bridgeDark', x, 156, 3, 10);
  for (let x = 300; x < W; x += 10) L(x, 152, 'lamp', '#ffe2a0', 0);

  // деревья за стеной Детинца
  for (let x = 62; x < 300; x += 3) { const h = 3 + ((q() * 6) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, WALL_TOP - h + 1, 4, h); }

  // Софийский собор: пять глав и шестая на лестничной башне, центральная — золотая
  const sx = X.sofia;
  R('wall', sx - 15, 114, 30, 30); R('wallShade', sx + 10, 114, 5, 30);
  for (const zx of [sx - 15, sx - 5, sx + 5]) { R('wall', zx + 1, 112, 8, 2); R('wall', zx + 3, 111, 4, 1); } // закомары
  R('roofW', sx - 15, 114, 30, 1);
  for (const wx of [sx - 11, sx - 6, sx + 1, sx + 6]) { R('win', wx, 120, 1, 4); R('win', wx, 130, 1, 4); }
  R('wall', sx - 22, 120, 8, 24); R('wallShade', sx - 16, 120, 2, 24); // лестничная башня
  R('wall', sx - 19, 112, 3, 8); helmet(R, sx - 18, 107, [1, 3, 3, 3, 2], 'silver', 'silverDark'); cross(R, sx - 18, 103, 4, 'silver');
  for (const dx of [-9, 9]) { // боковые главы
    R('wall', sx + dx - 2, 104, 4, 8); R('wallShade', sx + dx + 1, 104, 1, 8);
    helmet(R, sx + dx, 98, [1, 3, 5, 5, 5, 4], 'silver', 'silverDark'); cross(R, sx + dx, 93, 5, 'silver');
  }
  R('wall', sx - 3, 98, 6, 14); R('wallShade', sx + 2, 98, 1, 14); for (const wx of [sx - 2, sx]) R('win', wx, 102, 1, 4);
  helmet(R, sx, 89, [1, 3, 5, 7, 7, 7, 6, 6, 7], 'gold', 'goldDark');
  cross(R, sx, 82, 7); R('bronze', sx + 1, 81, 1, 1); // свинцовый голубь на кресте
  if (winter) { R('snow', sx - 15, 113, 30, 1); R('snow', sx - 22, 119, 8, 1); }
  L(sx, 140, 'flood', '#fff0d0', 0); L(sx - 12, 142, 'flood', '#fff0d0', 0); L(sx + 12, 142, 'flood', '#fff0d0', 0);

  // Часозвоня Владычного двора — за собором правее
  R('wall', 290, 116, 6, 28); R('wallShade', 294, 116, 2, 28); R('win', 292, 122, 1, 3);
  tentRoof(R, 293, 106, 10, 0.6, 'roofW', 'roofWDark'); R('gold', 293, 103, 1, 3);

  // верхушка памятника «Тысячелетие России» над стеной: держава-колокол и крест
  const mx = X.monument;
  helmet(R, mx, 135, [3, 5, 7, 7, 9], 'bronze', 'bronzeHi'); R('bronze', mx - 1, 133, 3, 2); cross(R, mx, 129, 4, 'bronzeHi');

  // Кокуй: четверик, два восьмерика, гульбище смотровой площадки и шлем белого железа
  const kx = X.kokui;
  R('brick', kx - 6, 118, 12, 40); R('brickDark', kx + 4, 118, 2, 40); R('brickHi', kx - 6, 118, 1, 40);
  for (const y of [124, 132, 140]) R('win', kx - 1, y, 2, 2);
  R('brick', kx - 5, 109, 10, 9); R('brickDark', kx + 3, 109, 2, 9); R('win', kx - 1, 112, 2, 3);
  R('roofWDark', kx - 6, 108, 12, 1); // гульбище
  R('brick', kx - 4, 101, 8, 7); R('brickDark', kx + 2, 101, 2, 7); R('win', kx - 1, 103, 2, 2);
  helmet(R, kx, 90, [1, 1, 3, 5, 5, 7, 7, 7, 8, 8, 9], 'silver', 'silverDark');
  R('silverDark', kx, 85, 1, 5); R('gold', kx, 84, 1, 1);
  if (winter) R('snow', kx - 2, 93, 5, 1);
  L(kx, 150, 'flood', '#ffd8a0', 0);

  // стена Детинца над пляжем: кирпич, деревянная кровля над боевым ходом
  for (let x = 60; x < 300; x++) {
    R('brick', x, WALL_TOP, 1, WALL_BASE - WALL_TOP); R('brickDark', x, WALL_BASE - 2, 1, 2);
    if (x % 5 === 0) R('brickDark', x, WALL_TOP + 3, 1, 2);
    R('roofW', x, WALL_TOP - 1, 1, 1);
    if (winter && x % 2) R('snow', x, WALL_TOP - 1, 1, 1);
  }
  for (const [cx, w, h] of [[66, 10, 22], [104, 10, 20], [142, 11, 22], [182, 10, 20], [300, 10, 21]]) dTower(R, winter, cx, w, h);
  for (const x of [84, 124, 162, 200, 280]) L(x, WALL_BASE, 'flood', '#ffc890', 0);

  // Ярославово дворище (справа): берег, аркада Гостиного двора, Воротная башня, Никольский собор
  R('grass', 372, 156, W - 372, 6); R('grassDark', 372, 160, W - 372, 2);
  R('granite', 372, 162, W - 372, 3); R('graniteDark', 372, 165, W - 372, 2);
  R('wall', 374, 146, 26, 12); R('wallShade', 374, 156, 26, 2); R('roofW', 374, 145, 26, 1); // аркада
  for (let x = 376; x < 398; x += 4) { R('win', x, 149, 2, 7); R('win', x, 148, 1, 1); }
  if (winter) R('snow', 374, 145, 26, 1);
  R('pink', 402, 124, 9, 34); R('pinkShade', 408, 124, 3, 34); // Воротная башня
  R('win', 405, 148, 3, 10); R('win', 405, 130, 2, 4);
  tentRoof(R, 406, 114, 10, 0.8, 'roofW', 'roofWDark'); helmet(R, 406, 110, [1, 3, 3], 'silver', 'silverDark'); cross(R, 406, 106, 4, 'silver');
  const nx = X.nikola; // Николо-Дворищенский собор
  R('wall', nx - 12, 126, 24, 32); R('wallShade', nx + 8, 126, 4, 32);
  for (const zx of [nx - 12, nx - 4, nx + 4]) { R('wall', zx + 1, 124, 6, 2); R('wall', zx + 2, 123, 4, 1); }
  for (const wx of [nx - 8, nx - 1, nx + 5]) { R('win', wx, 132, 1, 5); R('win', wx, 144, 1, 5); }
  R('wall', nx - 3, 113, 6, 11); R('wallShade', nx + 2, 113, 1, 11);
  helmet(R, nx, 105, [1, 3, 5, 7, 7, 7, 6, 7], 'silver', 'silverDark'); cross(R, nx, 99, 6, 'gold');
  if (winter) { R('snow', nx - 12, 123, 24, 1); R('snow', nx - 1, 105, 3, 1); }
  // церковь Параскевы Пятницы — правее
  R('wall', 446, 134, 18, 24); R('wallShade', 461, 134, 3, 24);
  R('wall', 448, 131, 14, 3); R('wall', 451, 129, 8, 2);
  R('wall', 453, 121, 4, 8); helmet(R, 455, 115, [1, 3, 5, 5, 5, 4], 'silver', 'silverDark'); cross(R, 455, 110, 5, 'silver');
  for (const x of [380, 392, 406, nx]) L(x, 156, 'flood', '#fff0d0', 0);
  for (let x = 376; x < W; x += 12) L(x, 160, 'lamp', '#ffe2a0', 0);
}

// ---------- ночная подсветка: стены Детинца, золотая глава Софии, Кокуй, дворище ----------
export function drawNight(g, env, nightF) {
  if (nightF < 0.05) return;
  const glow = (x, y, rad, rgbStr, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(${rgbStr},${a * nightF})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  glow(X.sofia, 104, 30, '255,225,170', 0.24);
  glow(X.kokui, 110, 22, '255,210,160', 0.18);
  glow(180, 150, 70, '255,180,120', 0.12);
  glow(X.nikola, 130, 30, '255,230,190', 0.16);
  const Rg = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.globalAlpha = nightF * 0.8;
  helmet(Rg, X.sofia, 89, [1, 3, 5, 7, 7, 7, 6, 6, 7], '#ffd878', '#e0a848'); // золотая глава в подсветке
  g.globalAlpha = nightF * 0.35; g.fillStyle = '#ffb070';
  for (let x = 60; x < 300; x += 2) g.fillRect(x, WALL_TOP + 1, 1, 1); // подсвеченная кромка стены
  g.globalAlpha = 1;
}

// ---------- Горбатый мост (поверх машин) и люди на нём ----------
function drawPedBridge(b, env, dayF, t) {
  const nightF = 1 - dayF;
  const deck = mixHex('#4a5262', '#9aa4b0', dayF), dark = mixHex('#2e3440', '#6a7482', dayF), rail = mixHex('#3a4050', '#c8ccd2', dayF);
  for (let x = X.bridge0; x <= X.bridge1; x++) {
    const y = Math.round(deckY(x));
    b.fillStyle = deck; b.fillRect(x, y, 1, 2); b.fillStyle = dark; b.fillRect(x, y + 2, 1, 1);
    b.fillStyle = rail; if (x % 2 === 0) b.fillRect(x, y - 2, 1, 2); b.fillRect(x, y - 2, 1, 1);
    if (env.winter) { b.fillStyle = mixHex('#4a5268', '#eef2f6', dayF); b.fillRect(x, y - 1, 1, 1); }
  }
  for (const x of [324, 348]) { b.fillStyle = dark; b.fillRect(x - 1, Math.round(deckY(x)) + 3, 3, 167 - Math.round(deckY(x)) - 3); }
  // прохожие: крохотные фигурки, идут в обе стороны
  const n = Math.min(10, Math.max(2, Math.round(crowd(env) * 0.7)));
  const coats = env.winter ? ['#3a3a48', '#5a3a3a', '#2a4a5a'] : ['#c8423a', '#3a6ab0', '#e8c040', '#e8e4dc', '#4a8a5a'];
  for (let i = 0; i < n; i++) {
    const r = rng(i * 313 + 11), dir = r() < 0.5 ? 1 : -1, sp = 1.5 + r() * 2, len = X.bridge1 - X.bridge0 - 4;
    const x = X.bridge0 + 2 + ((((r() * len) + dir * sp * t) % len) + len) % len, y = Math.round(deckY(x));
    b.fillStyle = mixHex('#15151c', coats[(r() * coats.length) | 0], Math.max(0.3, dayF)); b.fillRect(Math.round(x), y - 3, 1, 3);
    b.fillStyle = mixHex('#15151c', '#e0b090', Math.max(0.3, dayF)); b.fillRect(Math.round(x), y - 4, 1, 1);
  }
  if (nightF > 0.1) { // фонари моста
    b.globalAlpha = nightF; b.fillStyle = '#ffe2a0';
    for (let x = X.bridge0 + 4; x < X.bridge1; x += 8) b.fillRect(x, Math.round(deckY(x)) - 3, 1, 1);
    b.globalAlpha = nightF * 0.6; b.fillStyle = '#ffd890';
    for (let x = X.bridge0; x <= X.bridge1; x += 2) b.fillRect(x, Math.round(deckY(x)) + 2, 1, 1);
    b.globalAlpha = 1;
  }
}

// Машины по мосту Александра Невского — в просветах между Горбатым мостом и дворищем
const LANES = [
  { x0: 296, x1: 372, y: 153 },
  { x0: 466, x1: W, y: 153 },
];
export function drawAboveLate(b, env, dayF, t) {
  streetCars(b, env, dayF, t, LANES);
  drawPedBridge(b, env, dayF, t);
}

// ---------- вода: прогулочный кораблик + набережная ----------
export function drawBoats(ctx, env, dayF, t) {
  drawBoat(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
}

// Небольшой прогулочный теплоход днём в навигацию: от причала «Ярославово Дворище» по Волхову
function drawBoat(ctx, env, dayF, t) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 10 || h >= 21) return;
  const s = env.ms / 1000 + 300, cyc = Math.floor(s / 1500), p = (s % 1500) / 420;
  if (p >= 1) return;
  const dir = cyc % 2 ? 1 : -1, x = Math.round(dir > 0 ? -40 + p * 560 : 520 - p * 560), y = 177, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 26, 3);
  ctx.fillStyle = mixHex('#1a1e28', '#2a5a9a', dayF); ctx.fillRect(x + 1, y + 3, 24, 1);
  ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 4, y - 3, 18, 3);
  ctx.fillStyle = mixHex('#1a1e28', '#4a6a8a', dayF); for (let i = 0; i < 5; i++) ctx.fillRect(x + 5 + i * 3, y - 2, 2, 1);
  ctx.fillStyle = mixHex('#30343e', '#c8423a', dayF); ctx.fillRect(dir > 0 ? x + 18 : x + 6, y - 5, 2, 2);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) ctx.fillRect(dir > 0 ? x - 2 - i * 2 : x + 27 + i * 2, y + 3 - (i % 2), 2, 1);
  if (nightF > 0.2) { ctx.globalAlpha = nightF; ctx.fillStyle = '#ffd98a'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 5 + i * 3, y - 2, 2, 1); }
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — берестяной туесок и листок бересты с буквами
export function drawSill(R, SILL) {
  const x = 264, y = SILL;
  R('#3a2a1a', x, y - 1, 13, 1); // тень
  R('#e8dcc0', x, y - 13, 12, 12); R('#cfc2a2', x + 9, y - 13, 3, 12); // берёста
  for (const [dx, dy, w] of [[1, 3, 3], [6, 5, 2], [2, 8, 4], [7, 10, 2], [3, 11, 1]]) R('#5a4a3a', x + dx, y - 13 + dy, w, 1); // чечевички
  R('#a8784a', x - 1, y - 14, 14, 2); R('#c89060', x - 1, y - 14, 14, 1); // крышка
  R('#8a5a34', x + 4, y - 16, 4, 2); R('#a8784a', x + 5, y - 17, 2, 1); // ручка
  R('#a8784a', x, y - 7, 12, 1); // обвязка
  // листок бересты: процарапанные буквы
  R('#d8c49a', x + 14, y - 4, 7, 4); R('#c4ad80', x + 14, y - 1, 7, 1);
  for (const dx of [1, 3, 5]) R('#5a4030', x + 14 + dx, y - 3, 1, 1);
  R('#5a4030', x + 15, y - 2, 4, 1);
}

// ---------- набережная переднего плана: ларьки по сезону ----------
export const KINDS_NV = {
  sbiten: { awning: ['#a8342a', '#f0d890'], counter: '#8a5a34', goods: [[1, '#c87a2a'], [4, '#e0a040'], [8, '#c87a2a']], steam: true },
  pirozhki: { awning: ['#d0862a', '#f4ecd8'], counter: '#8a5a34', goods: [[1, '#d09040'], [4, '#c88038'], [8, '#d09040']], steam: true },
  beresta: { awning: ['#e8dcc0', '#3a2a1a'], counter: '#a8784a', goods: [[1, '#e8dcc0'], [4, '#d8c49a'], [8, '#e8dcc0']], steam: false },
};
export const STALL_X = { a: 150, b: 196, c: 232, d: 260 };
// Какой ларёк в какой будке: летом касса прогулок и мороженое, в холода — сбитень и чай; пирожки и береста круглый год
export function stallKinds(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  const warm = mo >= 5 && mo <= 9 && !env.winter;
  if (!(h >= 10 && h < (warm ? 21 : env.winter ? 19 : 20))) return {};
  const k = { b: 'pirozhki', d: 'beresta' };
  if (warm) { if (env.navigation) k.a = 'boats'; k.c = 'icecream'; }
  else { k.a = 'sbiten'; k.c = 'tea'; }
  return k;
}
export function stalls(env) { return Object.values(stallKinds(env)); }
function drawPromenade(ctx, env, dayF, t) {
  const k = stallKinds(env);
  streetPromenade(ctx, env, dayF, t, Object.keys(k).map((slot) => ({ kind: KINDS_NV[k[slot]] || k[slot], x: STALL_X[slot] })));
}

// ---------- секреты ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
const isBirchDay = (env) => month(env) === 7 && env.local.getUTCDate() === 26;

export const SECRETS = [
  {
    id: 'onfim', name: 'Мальчик с берестой', layer: 'street',
    hint: 'Летним днём по набережной иногда проходит мальчишка в льняной рубахе и что-то увлечённо царапает на куске коры. А 26 июля его встретить проще всего.',
    found: 'Это Онфим — новгородский мальчик XIII века, лет шести-семи. Учась грамоте, он писал на бересте азбуку и склады, а на полях рисовал всадников, воинов в шлемах и «зверя». Его грамоты нашли на Неревском раскопе в июле 1956 года — это одни из древнейших известных детских рисунков. А самую первую берестяную грамоту нашли здесь же, в Новгороде, 26 июля 1951 года: этот день археологи отмечают как День берестяной грамоты.',
    state(env) {
      const h = env.local.getUTCHours(), mo = month(env);
      if (!env.forced) {
        if (env.winter || env.sun.alt < 3 || h < 10 || h >= 19 || ['rain', 'storm'].includes(env.weather.kind)) return null;
        if (!isBirchDay(env) && !((mo >= 6 && mo <= 8) && inWin(env, 1800, 120, 420))) return null;
      }
      return { x: 286, y: 196, w: 12, h: 15 };
    },
    draw(ctx, env, st, dayF) {
      const dim = (c) => mixHex('#141018', c, 0.3 + dayF * 0.7), { x, y } = st, t = env.ms / 1000;
      const scratch = Math.sin(t * 6) > 0 ? 1 : 0;
      ctx.fillStyle = dim('#c8a060'); ctx.fillRect(x + 2, y + 4, 3, 1); // вихры
      ctx.fillStyle = dim('#e0b090'); ctx.fillRect(x + 2, y + 5, 3, 3); // лицо
      ctx.fillStyle = dim('#ece4d0'); ctx.fillRect(x + 1, y + 8, 5, 4); // льняная рубаха
      ctx.fillStyle = dim('#b0302a'); ctx.fillRect(x + 1, y + 11, 5, 1); // поясок
      ctx.fillStyle = dim('#6a5a48'); ctx.fillRect(x + 2, y + 12, 1, 3); ctx.fillRect(x + 4, y + 12, 1, 3);
      ctx.fillStyle = dim('#d8c49a'); ctx.fillRect(x + 6, y + 7, 5, 4); // береста
      ctx.fillStyle = dim('#5a4030'); ctx.fillRect(x + 7, y + 8, 1, 1); ctx.fillRect(x + 9, y + 8, 1, 1); ctx.fillRect(x + 7, y + 9 + scratch, 3, 1);
      ctx.fillStyle = dim('#8a8e98'); ctx.fillRect(x + 6, y + 6 + scratch, 1, 2); // писало
    },
  },
  {
    id: 'kruiz', name: 'Круиз на закат', layer: 'street',
    hint: 'Летними вечерами, когда солнце клонится к Детинцу, от причала у моста уходит вверх по Волхову светящийся двухпалубный теплоход.',
    found: 'Вечерняя прогулка «Круиз на закат»: двухпалубный теплоход отходит от причала «Ярославово Дворище» и полтора часа идёт по Волхову к озеру Ильмень и обратно — мимо Детинца, Софийского собора и Юрьева монастыря, под живой саксофон.',
    state(env) {
      const mo = month(env), h = env.local.getUTCHours();
      if (!env.forced && (env.frozen || !env.navigation || mo < 5 || mo > 9 || h < 18 || env.sun.alt > 8 || env.sun.alt < -4)) return null;
      if (!inWin(env, 2700, 200, 900)) return null;
      const p = phase(env, 2700, 200, 900);
      return { x: Math.round(470 - p * 520), y: 172, w: 40, h: 12 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, nightF = 1 - dayF;
      ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y + 5, 40, 4); ctx.fillRect(x + 4, y + 2, 32, 3); ctx.fillRect(x + 9, y, 22, 2);
      ctx.fillStyle = mixHex('#1a1e28', '#2a4a8a', dayF); ctx.fillRect(x + 1, y + 9, 38, 2);
      ctx.fillStyle = mixHex('#30343e', '#c8423a', dayF); ctx.fillRect(x + 12, y - 2, 4, 2); // труба
      ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.35 + nightF * 0.65;
      for (let i = 0; i < 11; i++) ctx.fillRect(x + 4 + i * 3, y + 6, 2, 1);
      for (let i = 0; i < 9; i++) ctx.fillRect(x + 6 + i * 3, y + 3, 2, 1);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 41 + i * 2, y + 9 - (i % 2), 2, 1);
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'zakat', name: 'Закат за Детинцем', layer: 'street',
    hint: 'В июне и в начале июля солнце садится не за рекой где-то сбоку, а прямо за стенами кремля.',
    found: 'На широте Новгорода летом солнце уходит далеко на северо-запад. С Торговой стороны в июньские вечера оно садится прямо за Детинцем, за золотой главой Софии, и по Волхову к нам тянется дорожка. Зимой оно садится на юго-западе — за Кремлёвским парком, левее кадра.',
    state(env) {
      const s = env.sun;
      if (!env.forced && (s.alt > 3 || s.alt < -1 || env.weather.cloud > 70)) return null;
      const sx = env.forced ? X.sofia : Math.round(azToX(s.az));
      if (!env.forced && (sx < 200 || sx > 310)) return null;
      return { x: sx - 8, y: HORIZON + 1, w: 16, h: 30, sx };
    },
    draw(ctx, env, st) {
      const t = env.ms / 1000;
      for (let y = HORIZON + 1; y < HORIZON + 32; y += 2) {
        const d = y - HORIZON, half = 2 + d * 0.3;
        for (let i = 0; i < 3; i++) {
          const x = st.sx + Math.round(Math.sin(t * 2 + y * 0.7 + i * 2.1) * half);
          ctx.globalAlpha = 0.55 - d * 0.012; ctx.fillStyle = i ? '#ffb070' : '#ffe0a0';
          ctx.fillRect(x, y, 2 + (d >> 3), 1);
        }
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'kokui', name: 'Смотровая на Кокуе', layer: 'sky',
    hint: 'В тёплый день на самой высокой башне кремля под серебристым шлемом иногда мелькают крошечные фигурки и что-то блестит.',
    found: 'Кокуй — самая высокая башня Детинца: 38,5 метра вместе с главой, построена в XVII веке и совсем не похожа на приземистые боевые башни. Наверху работает смотровая площадка, в 2012 году там поставили подзорные трубы: видно весь Детинец, Волхов и Торговую сторону.',
    state(env) {
      const mo = month(env), h = env.local.getUTCHours();
      if (!env.forced && (mo < 5 || mo > 9 || h < 10 || h >= 18 || ['rain', 'storm', 'fog'].includes(env.weather.kind))) return null;
      if (!inWin(env, 1500, 180, 260)) return null;
      return { x: X.kokui - 6, y: 104, w: 12, h: 5 };
    },
    draw(b, env, st, dayF) {
      const t = env.ms / 1000, { x, y } = st;
      const people = [['#c8423a', 1], ['#3a6ab0', 5], ['#e8c040', 9]];
      for (const [c, dx] of people) {
        b.fillStyle = mixHex('#15151c', c, Math.max(0.3, dayF)); b.fillRect(x + dx, y + 2, 1, 2);
        b.fillStyle = mixHex('#15151c', '#e0b090', Math.max(0.3, dayF)); b.fillRect(x + dx, y + 1, 1, 1);
      }
      if (Math.sin(t * 1.7) > 0.6) { b.fillStyle = '#ffffff'; b.fillRect(x + 7, y + 2, 1, 1); } // блик подзорной трубы
      b.fillStyle = mixHex('#2a2a30', '#5a5a60', dayF); b.fillRect(x + 6, y + 2, 1, 1);
    },
  },
  {
    id: 'rybaki', name: 'Рыбаки на льду Волхова', layer: 'street',
    hint: 'Зимой в выходные с утра на льду кто-то очень терпеливо сидит над лункой.',
    found: 'Зимой по выходным на льду Волхова сидят рыбаки с удочками над лунками. На тонкий лёд — в начале зимы, в оттепель и весной — выходить нельзя.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), wd = l.getUTCDay(), mo = month(env), d = l.getUTCDate();
      if (!env.forced && !(env.frozen && (wd === 0 || wd === 6) && h >= 8 && h < 14 && (mo === 1 || mo === 2 || (mo === 3 && d <= 15)))) return null;
      return { x: 334, y: 180, w: 12, h: 11 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#1a2a3a', '#3a4a5a', dayF); ctx.fillRect(x + 8, y + 10, 3, 1);
      ctx.fillStyle = mixHex('#2a3a4a', '#3a6a8a', dayF); ctx.fillRect(x, y + 6, 4, 4);
      drawPerson(ctx, x + 2, y + 7, 0.25, dayF, 0, false, true, false);
      ctx.fillStyle = mixHex('#2a2a2a', '#5a4a3a', dayF); for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + i, y + 3 + (i >> 1), 1, 1);
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x + 9, y + 6, 1, 4); ctx.globalAlpha = 1;
    },
  },
];

// События по новостям (fireworks — салют над Детинцем); своего регулярного салюта у города нет
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, X.sofia, 40, dayF); }
