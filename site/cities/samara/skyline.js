// Самара: окно в доме на Волжском проспекте над Октябрьской набережной (≈53,216° с. ш., 50,136° в. д.),
// смотрим на запад (азимут 260°) — через Волгу на Рождествено и Жигули.
// Слева направо: речной вокзал, завод фон Вакано, Иверский монастырь, монумент Славы на высоком берегу,
// под окном на террасе набережной — «Ладья»; за Волгой — Жигулёвские горы и село Рождествено.
// Художественное сжатие: в жизни ориентиры нашего берега (стела, монастырь, завод, вокзал) стоят почти
// на одной линии к юго-западу (азимуты 227–234°, в кадре это x ≈ 96–127), Рождествено — на 295°,
// Жигули — на 296–341° (правый край кадра и дальше). В кадре берег развёрнут: ориентиры разведены
// по ширине окна, Жигули придвинуты влево, к Рождествено.

import { mixHex, rng } from '../../engine/util.js';
import { W, H, HORIZON } from '../../engine/const.js';
import { azToX } from '../../engine/scene.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks, drawPerson, KINDS } from '../../engine/street.js';

const DAY = {
  far: '#a9b0c0', farDark: '#959db0', farRoof: '#818a9e', tower: '#b4bccb',
  hill: '#6f8c58', hillDark: '#5a7546', tree: '#3f6c3e', treeDark: '#305632', grass: '#7aa05a',
  mount: '#8a9cb4', mountDark: '#7a8ea6', mountTree: '#6f849c',
  bankFar: '#6a8a5a', forestFar: '#55764a', sandFar: '#d8c8a0',
  sand: '#e0cc9c', sandDark: '#c8b484',
  brick: '#b04a36', brickDark: '#8a3828', brickHi: '#c45c46', roofB: '#5a4440',
  wall: '#f2eee6', wallShade: '#d6d0c4', dome: '#4a8a6a', domeDark: '#3a6e54', gold: '#e6b845', goldDark: '#b88a2a',
  steelL: '#d4d8de', steelD: '#a8aeb8', figure: '#c8ccd2',
  station: '#eceef0', stationShade: '#c4c8d0', glassW: '#6a8aa8',
  house1: '#e8d49a', house2: '#e8c8b8', house3: '#d8dcd0', houseShade: '#b8b0a0', roof: '#7a6a60',
  win: '#6a6070', granite: '#9a9288', graniteDark: '#7a7268', road: '#8e8a84',
  steel: '#7a828e', steelDark: '#5a626e', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a', tower: '#222a44',
  hill: '#141c1c', hillDark: '#101616', tree: '#151d1f', treeDark: '#101719', grass: '#18221c',
  mount: '#1e2640', mountDark: '#1a2138', mountTree: '#171d32',
  bankFar: '#141a1e', forestFar: '#10161a', sandFar: '#2a2a30',
  sand: '#2e2c32', sandDark: '#26242a',
  brick: '#5a2a24', brickDark: '#46201c', brickHi: '#6a322a', roofB: '#1e1a1c',
  wall: '#8a8678', wallShade: '#6a665c', dome: '#1e3a30', domeDark: '#162c24', gold: '#c89a3a', goldDark: '#9a7428',
  steelL: '#6a7080', steelD: '#4e5462', figure: '#5a6070',
  station: '#5a606e', stationShade: '#464c58', glassW: '#24344a',
  house1: '#3a3440', house2: '#3a3038', house3: '#30343c', houseShade: '#26242c', roof: '#1e1c24',
  win: '#1a1420', granite: '#27252d', graniteDark: '#1e1c23', road: '#2a2830',
  steel: '#3a4050', steelDark: '#2a3040', snow: '#6a7488',
};
const AUTUMN = {
  day: { tree: '#c08a34', treeDark: '#935f27', grass: '#9a9a50', hill: '#8a8a4a', hillDark: '#6e6e3a', forestFar: '#a07a3a', bankFar: '#8a7a4a', mountTree: '#8a8a7a', mountDark: '#8a8e94' },
  night: { tree: '#221c16', treeDark: '#1a1511' },
};
const WINTER = {
  day: { tree: '#5d5853', treeDark: '#48443f', hill: '#dfe6ec', hillDark: '#c4ccd6', grass: '#e8eef2', sand: '#e8eef2', sandDark: '#d0d8e2', sandFar: '#e4eaf0', bankFar: '#d4dce4', forestFar: '#6a6a70', mount: '#b8c4d4', mountDark: '#a6b2c4', mountTree: '#8a96a8' },
  night: { tree: '#1a1a1e', treeDark: '#141418', hill: '#2c3244', hillDark: '#242a3a', grass: '#303648', sand: '#303648', sandDark: '#2a3040', sandFar: '#2c3244', bankFar: '#262c3c', mount: '#262e46', mountDark: '#222a40' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Кромка нашего (левого) высокого берега: ровная бровка, холм под стелой, у x≈246 обрыв к воде
const bankTop = (x) => (x < 214 ? 120 + x * 0.04 : x < 246 ? 130 : 130 + (x - 246) * 2.3);
// Гребень Жигулей за Волгой: поднимается вправо, к Ширяеву
const ridgeY = (x) => Math.round(158 - 22 * Math.min(1, Math.max(0, (x - 236) / 190)) - 3 * Math.sin(x * 0.09) - 2 * Math.sin(x * 0.23 + 1));

function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}
function cross(R, x, top, h = 4) { R('gold', x, top, 1, h); R('gold', x - 1, top + 1, 3, 1); }

export function drawFar({ winter, L, R }) {
  const q = rng(6311); // свой генератор — раскладка одинакова в дневном и ночном проходе

  // Жигулёвские горы за Волгой — синеватые, в дымке
  for (let x = 236; x < W; x++) { const y = ridgeY(x); R('mount', x, y, 1, 162 - y); R('mountDark', x, y + 6, 1, Math.max(0, 162 - y - 6)); }
  for (let x = 238; x < W; x += 2) { const y = ridgeY(x) + 3 + ((q() * 14) | 0); if (y < 160) R('mountTree', x, y, 2, 1); }
  if (winter) for (let x = 236; x < W; x++) R('snow', x, ridgeY(x), 1, 1);

  // низкий правый берег: лес, песок у воды
  R('bankFar', 236, 161, W - 236, 6);
  for (let x = 236; x < W; x += 3) { const h = 1 + ((q() * 3) | 0); R(q() < 0.5 ? 'forestFar' : 'bankFar', x, 161 - h, 3, h); }
  R('sandFar', 236, 166, W - 236, 2);

  // Рождествено: домики у воложки и церковь Рождества Христова (1843)
  for (let x = 330; x < 392; x += 5) {
    if (x > 362 && x < 372) continue;
    const h = 2 + ((q() * 2) | 0);
    R(q() < 0.5 ? 'house1' : 'house3', x, 161 - h, 4, h); R('roof', x, 160 - h, 4, 1);
    if (winter) R('snow', x, 160 - h, 4, 1);
    if (q() < 0.7) L(x + 1, 160, 'win');
  }
  R('wall', 364, 155, 6, 6); R('wallShade', 368, 155, 2, 6); // храм
  R('wall', 365, 149, 3, 6); R('dome', 365, 147, 3, 2); R('gold', 366, 144, 1, 3); // колокольня со шпилем
  R('dome', 371, 153, 3, 2); R('wall', 370, 155, 5, 6);
  L(367, 158, 'flood', '#fff0d0', 0);
  R('steelDark', 338, 166, 10, 1); L(338, 165, 'lamp', '#ffe2a0', 0); // пристань

  // наш берег: город на бровке
  for (let x = 0; x < 204;) {
    const w = 6 + ((q() * 10) | 0), tall = q() < 0.28, h = tall ? 14 + ((q() * 12) | 0) : 5 + ((q() * 8) | 0);
    const base = Math.round(bankTop(x)) + 2, top = base - h;
    R(tall ? 'tower' : q() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < base - 2; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (q() < 0.3) L(xx, yy, 'win');
    if (tall && h > 22) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w;
  }
  // склон высокого берега
  for (let x = 0; x < 262; x++) { const y = Math.round(bankTop(x)); R('hill', x, y, 1, 168 - y); R('hillDark', x, y + 10, 1, Math.max(0, 168 - y - 10)); }
  for (let x = 0; x < 248; x += 3) {
    const y = Math.round(bankTop(x)) + 4 + ((q() * 22) | 0), h = 3 + ((q() * 5) | 0);
    if (y + h < 154) R(q() < 0.5 ? 'tree' : 'treeDark', x, y, 4, h);
  }

  // набережная внизу: дорога, фонари, гранит, пляж
  R('road', 0, 155, 246, 3); R('graniteDark', 0, 158, 246, 1);
  R('granite', 0, 159, 246, 2);
  R('sand', 0, 161, 244, 5); R('sandDark', 0, 166, 244, 2);
  for (let x = 6; x < 240; x += 14) { R('graniteDark', x, 150, 1, 5); L(x, 149, 'lamp', '#ffd88a', 0); }

  // Речной вокзал: длинное низкое здание 1970-х, смотровая площадка на крыше
  R('station', 14, 146, 58, 12); R('stationShade', 66, 146, 6, 12);
  R('glassW', 16, 149, 48, 3); R('glassW', 16, 154, 48, 2);
  R('steelDark', 14, 145, 58, 1); for (let x = 15; x < 72; x += 3) R('steelDark', x, 144, 1, 1); // ограждение площадки
  R('station', 54, 134, 7, 12); R('stationShade', 59, 134, 2, 12); R('glassW', 55, 137, 3, 6);
  R('steelDark', 57, 126, 1, 8); R('#c8423a', 58, 126, 3, 2); // флаг
  R('steelDark', 10, 162, 66, 2); R('steel', 10, 161, 66, 1); // причальная стенка
  if (winter) { R('snow', 14, 145, 58, 1); R('snow', 54, 133, 7, 1); }
  for (let x = 18; x < 64; x += 4) L(x, 150, 'win', null, 0.2);
  L(42, 156, 'flood', '#fff0d0', 0);

  // Завод фон Вакано (1881): красный кирпич, башня, труба
  R('brick', 82, 132, 50, 20); R('brickDark', 126, 132, 6, 20); R('brickHi', 82, 132, 50, 1);
  for (let x = 82; x < 132; x += 3) R('brick', x, 131, 2, 1); // парапет
  for (let x = 85; x < 124; x += 5) { R('win', x, 136, 2, 4); R('win', x, 144, 2, 4); R('brickHi', x, 135, 2, 1); }
  R('brick', 100, 114, 12, 18); R('brickDark', 109, 114, 3, 18); R('brickHi', 100, 114, 1, 18);
  for (let x = 100; x < 112; x += 2) R('brick', x, 113, 1, 1);
  R('win', 104, 118, 4, 5); R('brickHi', 104, 117, 4, 1);
  R('roofB', 101, 109, 10, 4); R('roofB', 103, 106, 6, 3); R('roofB', 105, 103, 2, 3);
  R('brickDark', 126, 108, 4, 24); R('brick', 126, 108, 2, 24); // труба
  if (winter) { R('snow', 82, 131, 50, 1); R('snow', 101, 109, 10, 1); }
  L(106, 150, 'flood', '#ffc890', 0);

  // Иверский монастырь: белые стены с угловыми башенками, храм с главами, колокольня со шпилем
  R('wall', 140, 142, 56, 8); R('wallShade', 140, 149, 56, 1);
  for (const x of [140, 192]) { R('wall', x, 136, 5, 14); R('dome', x, 133, 5, 3); R('gold', x + 2, 130, 1, 3); }
  R('wall', 150, 124, 24, 18); R('wallShade', 169, 124, 5, 18);
  for (let x = 153; x < 168; x += 4) R('win', x, 129, 2, 5);
  R('wall', 158, 116, 8, 8); dome(R, 162, 110, [2, 4, 6, 6, 6, 4], 'dome', 'domeDark'); cross(R, 162, 105, 5);
  for (const cx of [152, 172]) { dome(R, cx, 119, [2, 4, 4, 2], 'dome', 'domeDark'); cross(R, cx, 115, 4); }
  R('wall', 180, 112, 10, 30); R('wallShade', 187, 112, 3, 30); // колокольня ярусами
  R('wall', 181, 100, 8, 12); R('wallShade', 186, 100, 3, 12); R('win', 183, 103, 2, 5); R('win', 183, 118, 2, 5);
  R('wall', 182, 92, 6, 8); R('win', 184, 94, 2, 4);
  for (let i = 0; i < 9; i++) R(i < 3 ? 'goldDark' : 'gold', 185 - (i > 4 ? 1 : 0), 83 + i, i > 4 ? 2 : 1, 1); // шпиль
  cross(R, 185, 79, 4);
  if (winter) { R('snow', 140, 142, 56, 1); R('snow', 150, 124, 24, 1); R('snow', 180, 112, 10, 1); R('snow', 181, 100, 8, 1); }
  L(162, 140, 'flood', '#fff0d0', 0); L(185, 140, 'flood', '#fff0d0', 0);

  // Монумент Славы: светлый постамент-«луч» и рабочий с крыльями над головой
  R('granite', 222, 128, 24, 4); R('graniteDark', 222, 131, 24, 1);
  for (let y = 66; y < 128; y++) { const k = (y - 66) / 62, w = Math.round(3 + k * 4), x = 234 - (w >> 1); R('steelL', x, y, w, 1); R('steelD', x + w - 1, y, 1, 1); }
  R('figure', 233, 58, 3, 8); R('figure', 233, 55, 2, 2); // рабочий
  R('figure', 231, 52, 1, 6); R('figure', 236, 52, 1, 6); // руки вверх
  for (let i = 0; i < 13; i++) { R('steelL', 233 - i, 51 + (i >> 2), 1, 1); R('steelL', 235 + i, 51 + (i >> 2), 1, 1); } // крылья
  R('steelD', 221, 54, 3, 1); R('steelD', 245, 54, 3, 1);
  if (winter) R('snow', 222, 128, 24, 1);
  L(234, 127, 'flood', '#ffd8a0', 0); L(229, 129, 'lamp', '#ff9a3a', 0); // Вечный огонь
}

// ---------- ночная подсветка ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const glow = (x, y, rad, rgbStr, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(${rgbStr},${a * nightF})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  glow(234, 80, 32, '200,220,255', 0.2); // стела
  glow(170, 118, 30, '255,225,170', 0.18); // монастырь
  glow(106, 128, 24, '255,180,120', 0.14); // завод
  glow(42, 150, 26, '255,235,190', 0.16); // речной вокзал
  glow(367, 156, 10, '255,225,170', 0.18); // Рождествено
  g.globalAlpha = nightF * 0.85; g.fillStyle = '#e8f0ff';
  for (let y = 66; y < 128; y += 2) g.fillRect(234, y, 1, 1); // грань «луча»
  for (let i = 0; i < 13; i++) { g.fillRect(233 - i, 51 + (i >> 2), 1, 1); g.fillRect(235 + i, 51 + (i >> 2), 1, 1); }
  g.globalAlpha = nightF * 0.7; g.fillStyle = '#ffd878';
  g.fillRect(185, 83, 1, 6); g.fillRect(162, 105, 1, 5);
  g.globalAlpha = (0.6 + 0.4 * Math.sin(t * 9)) * nightF; g.fillStyle = '#ffb040'; g.fillRect(229, 128, 1, 1); // огонь
  g.globalAlpha = 1;
}

export function drawAboveLate(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }

// ---------- «Ладья» на террасе набережной под окном ----------
// Строки силуэта (y → [x0, x1)) — по ним и рисуем, и прячем суда «за» монумент
const LADYA = (() => {
  const rows = new Map();
  for (let y = 128; y < 184; y++) {
    const k = (y - 128) / 56;
    rows.set(y, [Math.round(283 - 13 * k - 3 * Math.sin(Math.PI * k)), Math.round(285 + 9 * k + 5 * Math.sin(Math.PI * k))]);
  }
  for (let y = 178; y < 184; y++) { const [a, b] = rows.get(y); rows.set(y, [Math.min(a, 262 + (y - 178)), b]); } // поднятый нос
  for (let y = 184; y < 194; y++) rows.set(y, [264 + Math.round((y - 184) * 0.6), 300 - Math.round((y - 184) * 0.6)]); // корпус
  for (let y = 194; y < 200; y++) rows.set(y, [260, 304]); // постамент
  return rows;
})();
const LADYA_PATH = (() => {
  const p = new Path2D(); p.rect(0, 0, W, H);
  for (const [y, [a, b]] of LADYA) p.rect(a, y, b - a, 1);
  return p;
})();
// Рисовать «за Ладьёй»: всё, что на воде, не залезает на монумент
function behind(ctx, fn) { ctx.save(); ctx.clip(LADYA_PATH, 'evenodd'); fn(); ctx.restore(); }

function drawLadya(ctx, env, dayF) {
  const nightF = 1 - dayF;
  const lit = (c) => mixHex('#2a2c38', c, 0.3 + dayF * 0.7);
  const white = lit('#f2f0ea'), shade = lit('#cfcac0'), stone = lit(env.winter ? '#e8eef2' : '#9a9288'), stoneD = lit('#7a7268');
  for (const [y, [a, b]] of LADYA) {
    if (y >= 194) { ctx.fillStyle = y === 194 ? stone : stoneD; ctx.fillRect(a, y, b - a, 1); continue; }
    ctx.fillStyle = white; ctx.fillRect(a, y, b - a, 1);
    const sh = Math.max(1, Math.round((b - a) * 0.3));
    ctx.fillStyle = shade; ctx.fillRect(b - sh, y, sh, 1);
  }
  ctx.fillStyle = shade; ctx.fillRect(266, 188, 32, 1); // борт
  for (let x = 268; x < 296; x += 4) ctx.fillRect(x, 190, 2, 1); // щиты по борту
  // герб Самары на «парусе»: белая коза в голубом поле
  ctx.fillStyle = lit('#3a6ab0'); ctx.fillRect(279, 158, 8, 9); ctx.fillRect(280, 167, 6, 1); ctx.fillRect(282, 168, 2, 1);
  ctx.fillStyle = lit('#f4f4f4'); ctx.fillRect(281, 162, 4, 2); ctx.fillRect(284, 160, 1, 2); ctx.fillRect(281, 164, 1, 1); ctx.fillRect(284, 164, 1, 1);
  ctx.fillStyle = lit('#c8423a'); ctx.fillRect(284, 124, 1, 4); ctx.fillRect(285, 124, 3, 2); // вымпел
  if (env.winter) { ctx.fillStyle = lit('#ffffff'); ctx.fillRect(266, 184, 32, 1); }
  if (nightF > 0.1) { // подсветка снизу
    const g = ctx.createRadialGradient(282, 196, 2, 282, 160, 46);
    g.addColorStop(0, `rgba(255,226,170,${0.32 * nightF})`); g.addColorStop(1, 'rgba(255,226,170,0)');
    ctx.fillStyle = g; ctx.fillRect(236, 114, 92, 86);
  }
}

// ---------- теплоход по Волге + наша набережная ----------
export function drawBoats(ctx, env, dayF, t) {
  drawShip(ctx, env, dayF);
  drawLadya(ctx, env, dayF);
  drawPromenade(ctx, env, dayF, t);
}

function drawShip(ctx, env, dayF) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 7 || h > 22) return;
  const s = env.ms / 1000 + 400, cyc = Math.floor(s / 1900), p = (s % 1900) / 520;
  if (p >= 1) return;
  const dir = cyc % 2 ? 1 : -1, x = Math.round(dir > 0 ? -60 + p * 600 : 540 - p * 600), y = 177, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 50, 4);
  ctx.fillStyle = mixHex('#1a1e28', '#2a4a8a', dayF); ctx.fillRect(x + 1, y + 4, 48, 2);
  ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 4, y - 3, 42, 3); ctx.fillRect(x + 9, y - 6, 32, 3); ctx.fillRect(x + 14, y - 9, 22, 3);
  ctx.fillStyle = mixHex('#30343e', '#dcdcd8', dayF); ctx.fillRect(dir > 0 ? x + 32 : x + 12, y - 11, 6, 2);
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.25 + nightF * 0.75;
  for (let i = 0; i < 13; i++) ctx.fillRect(x + 6 + i * 3, y - 2, 2, 1);
  for (let i = 0; i < 10; i++) ctx.fillRect(x + 11 + i * 3, y - 5, 2, 1);
  for (let i = 0; i < 7; i++) ctx.fillRect(x + 16 + i * 3, y - 8, 2, 1);
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — модель ракеты «Союз» (носители «Союз» делают в Самаре, на заводе «Прогресс»)
export function drawSill(R, SILL) {
  R('#3a3a44', 274, SILL - 3, 18, 3); R('#5a5a66', 274, SILL - 3, 18, 1); // подставка
  R('#d8dce2', 281, SILL - 30, 4, 27); R('#f4f4f2', 281, SILL - 30, 2, 27); // центральный блок
  R('#d8dce2', 282, SILL - 34, 2, 4); R('#f4f4f2', 282, SILL - 34, 1, 4); R('#8a8e98', 282, SILL - 36, 1, 2); // головной обтекатель
  for (const x of [277, 285]) { R('#c8ccd4', x, SILL - 14, 4, 11); R('#e8eaee', x + (x < 281 ? 0 : 2), SILL - 14, 2, 11); R('#c8ccd4', x + 1, SILL - 17, 2, 3); } // боковые блоки
  R('#c8423a', 281, SILL - 22, 4, 1); R('#2a4a8a', 281, SILL - 21, 4, 1); // полоска
  R('#6a6e78', 278, SILL - 4, 10, 1);
}

// ---------- набережная переднего плана: ларьки по сезону ----------
const BLINI = { awning: ['#d8a030', '#f4ecd8'], counter: '#8a5a34', goods: [[1, '#e8b860'], [4, '#d8a048'], [8, '#e8b860']], steam: true };
const SOUVENIR = { awning: ['#2a5aa0', '#f4f4f4'], counter: '#e8eef4', goods: [[1, '#f4f4f4'], [4, '#3a6ab0'], [8, '#d8dce2']], steam: false };
const STALL_KIND = { blini: BLINI, souvenir: SOUVENIR, tea: KINDS.tea };
export const STALL_X = { icecream: 150, tea: 150, corn: 236, blini: 236, souvenir: 430 };
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (mo >= 5 && mo <= 9 && !env.winter) { if (h >= 10 && h < 22) return ['icecream', 'corn', 'souvenir']; return []; }
  if (h >= 10 && h < (env.winter ? 19 : 20)) return ['tea', 'blini', 'souvenir'];
  return [];
}
const LANES = [{ x0: 0, x1: 246, y: 156 }]; // дорога по набережной
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: STALL_KIND[k] || k, x: STALL_X[k] }))); }

// ---------- секреты ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
const minOfDay = (env) => env.local.getUTCHours() * 60 + env.local.getUTCMinutes() + env.local.getUTCSeconds() / 60;

// Проходы «Валдая» мимо Ладьи (расписание навигации 2025: из Самары в 7:30, из Ширяева в 10:15 и 18:00, 45 минут в пути)
const VALDAY = [[7 * 60 + 33, 1], [10 * 60 + 52, -1], [18 * 60 + 37, -1]];
// Рейсы речного трамвая в Рождествено с речного вокзала (расписание 2025)
const TRAM_DEP = [8, 9, 10, 12, 14, 16, 18, 19, 20].map((h) => h * 60);

export const SECRETS = [
  {
    id: 'valday', name: '«Валдай» в Ширяево', layer: 'street',
    hint: 'Летом утром и вечером по Волге мимо Ладьи проносится что-то длинное и быстрое, почти не касаясь воды.',
    found: 'Это «Валдай» на подводных крыльях: в навигацию он ходит с речного вокзала в Ширяево — село в Жигулях, где Репин работал над «Бурлаками на Волге». Дорога занимает около 45 минут.',
    state(env) {
      const mo = month(env), m = minOfDay(env);
      let p = 0.5, dir = 1;
      if (!env.forced) {
        if (env.frozen || !env.navigation || mo < 5 || mo > 9) return null;
        const run = VALDAY.find(([a]) => m >= a && m < a + 8);
        if (!run) return null;
        p = (m - run[0]) / 8; dir = run[1];
      }
      const x = dir > 0 ? -30 + p * 540 : 510 - p * 540;
      return { x: Math.round(x), y: 174, w: 22, h: 8, dir };
    },
    draw(ctx, env, st, dayF) {
      behind(ctx, () => {
        const { x, y } = st;
        ctx.fillStyle = mixHex('#2a2e38', '#f4f4f2', dayF); ctx.fillRect(x + 1, y + 2, 20, 3); ctx.fillRect(st.dir > 0 ? x + 6 : x + 4, y, 12, 2);
        ctx.fillStyle = mixHex('#1a1e28', '#3a6ab0', dayF); ctx.fillRect(st.dir > 0 ? x + 7 : x + 5, y + 1, 10, 1);
        ctx.fillStyle = mixHex('#2a2a34', '#6a6a72', dayF); ctx.fillRect(x + 4, y + 5, 1, 2); ctx.fillRect(x + 17, y + 5, 1, 2);
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) ctx.fillRect(st.dir > 0 ? x - 2 - i * 2 : x + 22 + i * 2, y + 6 - (i % 2), 2, 1);
        ctx.globalAlpha = 1;
      });
    },
  },
  {
    id: 'rechtram', name: 'Речной трамвай в Рождествено', layer: 'street',
    hint: 'В навигацию от речного вокзала через Волгу отходит маленький теплоход — смотрите в начале часа.',
    found: 'Теплоходы ходят с речного вокзала на тот берег, в Рождествено: летом рейсы почти каждый час-два. Зимой, по льду, туда же добираются на судах на воздушной подушке.',
    state(env) {
      const m = minOfDay(env);
      let p = 0.9;
      if (!env.forced) {
        if (env.frozen || !env.navigation) return null;
        const dep = TRAM_DEP.find((a) => m >= a && m < a + 16);
        if (dep == null) return null;
        p = (m - dep) / 16;
      }
      const x = 50 + p * 290, y = 171 - Math.round(p * 2);
      return { x: Math.round(x), y, w: 12, h: 6, p };
    },
    draw(ctx, env, st, dayF) {
      behind(ctx, () => {
        const { x, y } = st;
        ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y + 2, 12, 2); ctx.fillRect(x + 2, y, 8, 2);
        ctx.fillStyle = mixHex('#1a1e28', '#c8423a', dayF); ctx.fillRect(x + 1, y + 4, 10, 1);
        ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + (1 - dayF) * 0.7;
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * 2, y + 1, 1, 1);
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y + 4, 3, 1);
        ctx.globalAlpha = 1;
      });
    },
  },
  {
    id: 'hover', name: 'По льду — на воздушной подушке', layer: 'street',
    hint: 'Зимой, пока светло, по льду Волги к тому берегу иногда скользит маленький катер — и лёд ему не помеха.',
    found: 'Когда Волга встаёт, в Рождествено ходят суда на воздушной подушке — «Нептун» (23 места) и «Хивус» (9 мест). Работают только в светлое время, при плохом льде рейсы отменяют.',
    state(env) {
      if (!env.forced && !(env.frozen && env.sun.alt > 2)) return null;
      if (!inWin(env, 1500, 150, 200)) return null;
      const p = phase(env, 1500, 150, 200);
      return { x: Math.round(240 + p * 150), y: 172 - Math.round(p * 2), w: 10, h: 6, p };
    },
    draw(ctx, env, st, dayF) {
      behind(ctx, () => {
        const { x, y } = st, t = env.ms / 1000;
        ctx.fillStyle = mixHex('#2a2e38', '#2a2a30', dayF); ctx.fillRect(x, y + 4, 10, 1); // юбка
        ctx.fillStyle = mixHex('#3a3e48', '#e8b830', dayF); ctx.fillRect(x, y + 2, 10, 2); ctx.fillRect(x + 1, y + 1, 6, 1);
        ctx.fillStyle = mixHex('#1a1e28', '#3a5a7a', dayF); ctx.fillRect(x + 2, y + 2, 4, 1);
        ctx.fillStyle = mixHex('#2a2e38', '#5a5e68', dayF); ctx.fillRect(x + 8, y, 2, 2); // винт
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.5 - i * 0.07; ctx.fillRect(x - 2 - i * 2, y + 4 - ((i + Math.floor(t * 6)) % 2), 2, 1); } // снежная пыль
        ctx.globalAlpha = 1;
      });
    },
  },
  {
    id: 'rybak', name: 'Рыбаки на льду', layer: 'street',
    hint: 'Зимой по выходным с утра на льду Волги кто-то очень терпеливо сидит над лункой.',
    found: 'В морозы на льду Волги у Самары сидят рыбаки с удочками над лунками. На тонкий лёд — в начале зимы и весной — выходить нельзя.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), wd = l.getUTCDay(), mo = month(env);
      if (!env.forced && !(env.frozen && (wd === 0 || wd === 6) && h >= 7 && h < 14 && mo !== 4 && mo !== 12)) return null;
      return { x: 318, y: 178, w: 12, h: 11 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#1a2a3a', '#3a4a5a', dayF); ctx.fillRect(x + 8, y + 10, 3, 1);
      ctx.fillStyle = mixHex('#2a3a4a', '#3a6ab0', dayF); ctx.fillRect(x, y + 6, 4, 4);
      drawPerson(ctx, x + 2, y + 7, 0.6, dayF, 0, false, true, false);
      ctx.fillStyle = mixHex('#2a2a2a', '#5a4a3a', dayF); for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + i, y + 3 + (i >> 1), 1, 1);
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x + 9, y + 6, 1, 4); ctx.globalAlpha = 1;
    },
  },
  {
    id: 'zakat', name: 'Закат за Жигулями', layer: 'street',
    hint: 'С мая по начало августа солнце уходит не за Волгу, а за горы на том берегу — и тянет к нам дорожку.',
    found: 'Летом солнце в Самаре садится на северо-западе — за Жигулёвские горы на Самарской Луке, и по Волге от них к набережной тянется золотая дорожка. Весной и осенью оно садится левее, за Рождествено.',
    state(env) {
      const s = env.sun;
      if (!env.forced && (s.alt > 3 || s.alt < -1 || s.az < 296 || s.az > 314 || env.weather.cloud > 70 || env.frozen)) return null;
      const sx = env.forced ? 420 : Math.round(azToX(s.az));
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
];

// События по новостям (fireworks — салют над Волгой)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 300, 40, dayF); }
