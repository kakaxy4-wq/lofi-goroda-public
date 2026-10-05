// Нижний Новгород: вид с левого берега Волги в Бору, от станции канатной дороги «Борская»,
// на юго-запад — через Волгу на нагорную часть города и Стрелку.
// Слева направо: трос канатной дороги с кабинками и станция «Нижегородская» на откосе,
// Чкаловская лестница, Кремль на откосе, устье Оки с Канавинским мостом,
// Стрелка с Александро-Невским собором и стадионом.
// Художественное сжатие: в жизни все ориентиры укладываются примерно в 40° обзора
// (станция ~209°, Кремль ~230°, собор ~244°, стадион ~250°), в кадре они раздвинуты,
// а трос канатки проведён через левую часть кадра.

import { mixHex, rng } from '../../engine/util.js';
import { W, HORIZON } from '../../engine/const.js';
import { azToX } from '../../engine/scene.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks, drawPerson, KINDS } from '../../engine/street.js';

const DAY = {
  far: '#a6adbd', farDark: '#949cae', farRoof: '#80889c', tower: '#b0b8c8',
  hill: '#6c8a58', hillDark: '#587346', tree: '#3e6b3d', treeDark: '#2f5531', grass: '#7aa05a',
  river: '#8aa2b8', riverHi: '#a8bccc',
  brick: '#a8483a', brickDark: '#84362c', brickHi: '#bc5a48', roofK: '#5a4a44', roofKDark: '#463a36',
  wall: '#f0ece2', wallShade: '#d4cec0', stone: '#e4dccc', stoneDark: '#b8ae9c',
  nev: '#ece2c8', nevShade: '#cfc2a2', tent: '#5c6a70', tentDark: '#48545a', gold: '#e6b845', goldDark: '#b88a2a',
  stad: '#f2f4f6', stadShade: '#c8d0da', stadGlass: '#7fa6c8', stadRoof: '#dfe4ea',
  house1: '#e8d49a', house2: '#e8c8b8', house3: '#d8dcd0', houseShade: '#b8b0a0', roof: '#7a6a60',
  win: '#6a6070', granite: '#8c8278', graniteDark: '#6f665e', road: '#9a968e',
  bridge: '#8a96a4', bridgeDark: '#6a7482', steel: '#7a828e', steelDark: '#5a626e',
  station: '#d8dce2', stationRoof: '#4a6e8a', snow: '#eef2f6', bronze: '#4a4034',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a', tower: '#222a44',
  hill: '#141c1c', hillDark: '#101616', tree: '#151d1f', treeDark: '#101719', grass: '#18221c',
  river: '#1a2238', riverHi: '#2a3450',
  brick: '#6a3028', brickDark: '#52241e', brickHi: '#7a3a30', roofK: '#1e1a1c', roofKDark: '#161214',
  wall: '#8a8678', wallShade: '#6a665c', stone: '#7a7468', stoneDark: '#5a564e',
  nev: '#a09478', nevShade: '#7c7260', tent: '#262c34', tentDark: '#1c2228', gold: '#c89a3a', goldDark: '#9a7428',
  stad: '#6a7288', stadShade: '#4e566a', stadGlass: '#24406a', stadRoof: '#5a6278',
  house1: '#3a3440', house2: '#3a3038', house3: '#30343c', houseShade: '#26242c', roof: '#1e1c24',
  win: '#1a1420', granite: '#27252d', graniteDark: '#1e1c23', road: '#2a2830',
  bridge: '#4a5262', bridgeDark: '#343a48', steel: '#3a4050', steelDark: '#2a3040',
  station: '#5a606e', stationRoof: '#1e2a3a', snow: '#6a7488', bronze: '#1a1814',
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

// Кромка нагорного берега: верх откоса, Кремль на склоне, спуск к Рождественской; дальше — устье Оки и низкая Стрелка
const hillTop = (x) => (x < 96 ? 118 : x < 136 ? 116 : x < 190 ? 114 : x < 234 ? 114 + (x - 190) * 0.85 : 160);

function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}
function tent(R, cx, top, rows, grow, c, cDark) {
  for (let i = 0; i < rows; i++) { const w = Math.max(1, Math.round(1 + i * grow)); R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 1, top + i, 1, 1); }
}
function cross(R, x, top, h = 5) { R('gold', x, top, 1, h); R('gold', x - 1, top + 1, 3, 1); }

// Башня Кремля: кирпичный четверик с шатровой кровлей (round — круглая, как Белая)
function kTower(R, winter, cx, base, w, h, round) {
  const x = cx - (w >> 1), top = base - h;
  R('brick', x, top, w, h); R('brickDark', x + w - 2, top, 2, h);
  if (round) { R('brickHi', x, top, 1, h); }
  for (let i = 0; i < w; i += 2) R('brick', x + i, top - 1, 1, 1); // зубцы-машикули
  R('win', cx - 1, top + 3, 1, 2);
  tent(R, cx, top - Math.round(w * 0.9) - 1, Math.round(w * 0.9), 1.05, 'roofK', 'roofKDark');
  if (winter) R('snow', cx - 1, top - Math.round(w * 0.5), 2, 1);
}

function house(R, L, q, winter, x, w, h, key, base) {
  const top = base - h;
  R(key, x, top, w, h); R('houseShade', x + w - 2, top, 2, h);
  R('roof', x - 1, top - 2, w + 2, 2);
  if (winter) R('snow', x - 1, top - 2, w + 2, 1);
  for (let yy = top + 2; yy < base - 2; yy += 4) for (let xx = x + 1; xx < x + w - 2; xx += 3) { R('win', xx, yy, 1, 2); if (q() < 0.6) L(xx, yy, 'win'); }
}

// Кремлёвская стена по откосу: от Георгиевской башни наверху вниз к подножию
const wallY = (x) => (x < 176 ? 110 : 110 + (x - 176) * 0.74);

export function drawFar({ winter, L, R }) {
  const q = rng(5207); // свой генератор — раскладка не зависит от дневного/ночного прохода

  // дальний город: нагорная часть за откосом и Канавино за Стрелкой
  for (let x = 0; x < W;) {
    const w = 6 + ((q() * 12) | 0), upper = x < 240;
    const tall = q() < (upper ? 0.3 : 0.2), h = tall ? 12 + ((q() * 12) | 0) : 4 + ((q() * 8) | 0);
    const base = upper ? 116 : 158, top = base - h;
    R(tall ? 'tower' : q() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < base - 2; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (q() < 0.3) L(xx, yy, 'win');
    if (tall && h > 18) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w;
  }

  // откос нагорного берега
  for (let x = 0; x < 234; x++) { const y = Math.round(hillTop(x)); R('hill', x, y, 1, 168 - y); R('hillDark', x, y + 8, 1, Math.max(0, 168 - y - 8)); }
  // деревья по откосу
  for (let x = 0; x < 234; x += 3) {
    if (x > 94 && x < 138) continue; // лестница
    const y = Math.round(hillTop(x)) + 6 + ((q() * 24) | 0), h = 3 + ((q() * 5) | 0);
    if (y + h < 157) R(q() < 0.5 ? 'tree' : 'treeDark', x, y, 4, h);
  }

  // дома Верхне-Волжской и Казанской набережных по бровке
  for (const [x, w, h, k] of [[0, 12, 10, 'house2'], [13, 10, 12, 'house1'], [26, 12, 9, 'house3'], [40, 14, 12, 'house2']]) house(R, L, q, winter, x, w, h, k, 118);

  // станция канатной дороги «Нижегородская» на откосе
  R('station', 68, 108, 22, 10); R('wallShade', 86, 108, 4, 10);
  R('stationRoof', 67, 105, 24, 3);
  if (winter) R('snow', 67, 105, 24, 1);
  R('win', 74, 111, 14, 3);
  L(80, 112, 'lamp', '#fff0c8', 0); L(90, 116, 'lamp', '#ffe2a0', 0);

  // опора канатной дороги у воды (82-метровые опоры стоят у берегов)
  for (let y = 90; y < 162; y++) { const k = (y - 90) / 72, s = Math.round(1 + k * 4); R('steel', 64 - s, y, 1, 1); R('steelDark', 64 + s, y, 1, 1); if (y % 6 === 0) R('steel', 64 - s, y, s * 2 + 1, 1); }
  R('steel', 57, 89, 16, 2);
  L(64, 88, 'red', '#ff3a3a', 0);

  // Нижне-Волжская набережная у подножия: дорога и гранит
  R('road', 0, 157, 234, 3); R('graniteDark', 0, 160, 234, 1);
  R('granite', 0, 164, 234, 2); R('graniteDark', 0, 166, 234, 2);
  for (let x = 6; x < 234; x += 14) { R('graniteDark', x, 152, 1, 5); L(x, 151, 'lamp', '#ffd88a', 0); }

  // Чкаловская лестница — «восьмёркой» от памятника Чкалову к Волге
  R('stone', 96, 115, 40, 3); R('stoneDark', 96, 117, 40, 1); // верхняя площадка
  R('stone', 94, 155, 44, 3); R('stoneDark', 94, 157, 44, 1); // нижняя площадка
  for (let i = 0; i <= 37; i++) {
    const y = 118 + i, a = Math.round(99 + i * 0.8), b = Math.round(133 - i * 0.8);
    R(i % 2 ? 'stone' : 'stoneDark', a, y, 3, 1); R(i % 2 ? 'stone' : 'stoneDark', b - 2, y, 3, 1);
  }
  R('stone', 110, 134, 12, 3); R('stoneDark', 110, 136, 12, 1); // средняя площадка
  if (winter) { R('snow', 96, 115, 40, 1); R('snow', 94, 155, 44, 1); R('snow', 110, 134, 12, 1); }
  R('stoneDark', 114, 110, 4, 5); R('bronze', 115, 104, 2, 6); R('bronze', 114, 106, 4, 1); // памятник Чкалову
  R('steelDark', 108, 152, 14, 2); R('steel', 111, 150, 6, 2); R('stoneDark', 110, 154, 10, 1); // катер «Герой» на постаменте
  for (const [x, y] of [[98, 114], [134, 114], [104, 126], [128, 126], [102, 146], [130, 146], [96, 154], [136, 154]]) L(x, y, 'lamp', '#ffe8b0', 0);

  // Кремль: деревья и собор за стеной
  for (let x = 140; x < 232; x += 3) { const h = 3 + ((q() * 5) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, Math.round(wallY(x)) - h + 1, 4, h); }
  R('wall', 180, 96, 12, 14); R('wallShade', 189, 96, 3, 14); // Михайло-Архангельский собор с шатром
  tent(R, 186, 82, 14, 0.55, 'roofK', 'roofKDark'); R('gold', 186, 78, 1, 4);
  if (winter) R('snow', 185, 88, 3, 1);
  L(186, 104, 'flood', '#ffe8c0', 0);

  // Кремлёвская стена по откосу
  for (let x = 136; x < 232; x++) {
    const y = Math.round(wallY(x));
    R('brick', x, y, 1, 6); R('brickDark', x, y + 5, 1, 1);
    if (x % 3 === 0) R('brick', x, y - 1, 1, 1); // зубцы
    if (winter && x % 2) R('snow', x, y, 1, 1);
  }
  for (const [cx, w, h, round] of [[138, 8, 14], [158, 6, 11], [176, 7, 12], [196, 8, 12, true], [214, 6, 11], [230, 8, 13]]) kTower(R, winter, cx, Math.round(wallY(cx)) + 6, w, h, round);
  for (const x of [138, 176, 196, 230]) L(x, Math.round(wallY(x)) + 6, 'flood', '#ffc890', 0);

  // устье Оки и Канавинский мост за ним
  R('river', 234, 157, 30, 11);
  for (let i = 0; i < 5; i++) R('riverHi', 236 + ((i * 7) % 24), 159 + (i % 3) * 2, 4, 1);
  R('bridge', 226, 150, 42, 2); R('bridgeDark', 226, 152, 42, 1);
  for (let x = 228; x < 268; x += 8) { R('steelDark', x, 148, 7, 1); R('steelDark', x, 149, 1, 1); R('steelDark', x + 6, 149, 1, 1); } // арочные пролёты
  for (const x of [236, 248, 260]) R('bridgeDark', x, 153, 2, 4);
  for (let x = 230; x < 268; x += 8) L(x, 149, 'lamp', '#ffe2a0', 0);

  // Стрелка: низкий мыс, парк, гранит у воды
  R('grass', 262, 159, W - 262, 5);
  for (let x = 262; x < W; x += 3) { if ((x > 288 && x < 322) || (x > 338 && x < 440)) continue; const h = 2 + ((q() * 4) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 160 - h, 4, h); }
  R('granite', 262, 164, W - 262, 2); R('graniteDark', 262, 166, W - 262, 2);
  for (let x = 266; x < W; x += 12) L(x, 162, 'lamp', '#ffe2a0', 0);

  // Александро-Невский собор: пять шатров, центральный — самый высокий
  R('nev', 292, 132, 28, 28); R('nevShade', 314, 132, 6, 28);
  for (let x = 295; x < 314; x += 5) { R('win', x, 138, 2, 7); R('win', x, 149, 2, 6); }
  for (const cx of [296, 316]) {
    R('nev', cx - 3, 118, 6, 14); R('nevShade', cx + 1, 118, 2, 14);
    tent(R, cx, 100, 18, 0.34, 'tent', 'tentDark');
    dome(R, cx, 96, [2, 3, 3, 2], 'gold', 'goldDark'); cross(R, cx, 92, 4);
  }
  R('nev', 301, 106, 10, 26); R('nevShade', 308, 106, 3, 26);
  for (let i = 0; i < 3; i++) R('win', 303 + i * 3, 110, 1, 5);
  R('nev', 300, 104, 12, 2);
  tent(R, 306, 72, 32, 0.36, 'tent', 'tentDark');
  dome(R, 306, 67, [2, 4, 4, 4, 2], 'gold', 'goldDark'); cross(R, 306, 62);
  if (winter) { R('snow', 292, 132, 28, 1); R('snow', 301, 106, 10, 1); }
  L(306, 158, 'flood', '#fff0d0', 0); L(296, 156, 'flood', '#fff0d0', 0); L(316, 156, 'flood', '#fff0d0', 0);

  // стадион «Нижний Новгород» — светлая колоннада со стеклом, «вода и ветер»
  const scx = 390, sr = 50;
  for (let x = scx - sr; x <= scx + sr; x++) {
    const k = (x - scx) / sr, top = Math.round(160 - 22 * Math.sqrt(Math.max(0, 1 - k * k * k * k)));
    R('stadGlass', x, top + 2, 1, 160 - top - 2);
    if ((x - scx + sr) % 3 === 0) R('stad', x, top + 2, 1, 160 - top - 2);
    R('stadRoof', x, top, 1, 2);
  }
  R('stadShade', scx - sr, 158, sr * 2 + 1, 2);
  if (winter) for (let x = scx - sr + 4; x <= scx + sr - 4; x++) { const k = (x - scx) / sr; R('snow', x, Math.round(160 - 22 * Math.sqrt(Math.max(0, 1 - k * k * k * k))), 1, 1); }
  for (let x = scx - 40; x <= scx + 40; x += 10) L(x, 150, 'win', null, 0.2);

  // левый берег Волги справа, вдали
  for (let x = 442; x < W; x += 3) { const h = 2 + ((q() * 4) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 159 - h, 4, h); }
}

// ---------- канатная дорога: два троса от станции «Нижегородская» к нам, на Бор ----------
// s = 0 — у станции на откосе, s = 1 — у верхнего края кадра (к станции «Борская»)
const CABLE = [
  { x0: 69, y0: 109, x1: 34, y1: -6 }, // кабины идут в Нижний
  { x0: 73, y0: 110, x1: 62, y1: -8 }, // кабины идут на Бор
];
const cablePt = (c, s) => [c.x0 + (c.x1 - c.x0) * s, c.y0 + (c.y1 - c.y0) * s + 7 * Math.sin(Math.PI * s)];
const minOfDay = (env) => env.local.getUTCHours() * 60 + env.local.getUTCMinutes() + env.local.getUTCSeconds() / 60;
// Часы работы (по данным перевозчика): пн–чт 6:45–21:00, пт–сб 6:45–22:00, вс и праздники 9:00–22:00
export function cableHours(local) {
  const wd = local.getUTCDay();
  if (wd === 0) return [9 * 60, 22 * 60];
  return [6 * 60 + 45, wd >= 5 ? 22 * 60 : 21 * 60];
}
export function cableOn(env) { const [a, b] = cableHours(env.local), m = minOfDay(env); return m >= a && m < b; }
const cabinAt = (line, k, t) => { const sp = 1 / 80, n = 7; let s = ((k / n + (line ? 1 : -1) * t * sp) % 1 + 1) % 1; return s; };

function drawCable(b, env, dayF, t) {
  const rope = mixHex('#141820', '#3a3e48', dayF);
  b.fillStyle = rope;
  for (const c of CABLE) for (let s = 0; s <= 1; s += 0.004) { const [x, y] = cablePt(c, s); b.fillRect(Math.round(x), Math.round(y), 1, 1); }
  if (!cableOn(env)) return;
  const body = mixHex('#2a2e38', '#eef0f2', Math.max(0.25, dayF)), glass = mixHex('#141820', '#4a6a8a', dayF);
  CABLE.forEach((c, line) => {
    for (let k = 0; k < 7; k++) {
      const s = cabinAt(line, k, t), [x, y] = cablePt(c, s), w = 2 + Math.round(s * 7), h = 2 + Math.round(s * 5);
      const cx = Math.round(x), cy = Math.round(y);
      b.fillStyle = rope; b.fillRect(cx, cy, 1, 1 + Math.round(s * 4));
      const top = cy + 1 + Math.round(s * 4);
      b.fillStyle = body; b.fillRect(cx - (w >> 1), top, w, h);
      if (w >= 4) { b.fillStyle = glass; b.fillRect(cx - (w >> 1) + 1, top + 1, w - 2, Math.max(1, h >> 1)); }
    }
  });
}

// ---------- ночная подсветка: Кремль, лестница, собор, стадион ----------
export function drawNight(g, env, nightF) {
  if (nightF < 0.05) return;
  const glow = (x, y, rad, rgbStr, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(${rgbStr},${a * nightF})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  glow(306, 100, 30, '255,225,170', 0.22); // собор
  glow(180, 118, 34, '255,190,130', 0.16); // Кремль
  glow(116, 136, 18, '255,230,180', 0.14); // лестница
  glow(390, 148, 44, '120,180,255', 0.22); // стадион
  // шатры собора и главка — в подсветке
  const Rg = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  g.globalAlpha = nightF * 0.7;
  dome(Rg, 306, 67, [2, 4, 4, 4, 2], '#ffd878', '#e0a848');
  for (const cx of [296, 316]) dome(Rg, cx, 96, [2, 3, 3, 2], '#ffd878', '#e0a848');
  g.globalAlpha = nightF * 0.8; g.fillStyle = '#9ad0ff';
  for (let x = 342; x <= 438; x += 3) { const k = (x - 390) / 50; g.fillRect(x, Math.round(160 - 22 * Math.sqrt(Math.max(0, 1 - k * k * k * k))), 1, 1); }
  g.globalAlpha = 1;
}

export function drawAboveLate(b, env, dayF, t) {
  streetCars(b, env, dayF, t, LANES);
  drawCable(b, env, dayF, t);
}

// ---------- теплоход по Волге + наша набережная ----------
export function drawBoats(ctx, env, dayF, t) {
  drawShip(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
}

function drawShip(ctx, env, dayF, t) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 7 || h > 22) return;
  const s = env.ms / 1000 + 900, cyc = Math.floor(s / 1700), p = (s % 1700) / 480;
  if (p >= 1) return;
  const dir = cyc % 2 ? 1 : -1, x = Math.round(dir > 0 ? -60 + p * 600 : 540 - p * 600), y = 179, nightF = 1 - dayF;
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

// Сувенир на подоконнике — хохломская ложка в стакане-подставке
export function drawSill(R, SILL) {
  R('#2a1a14', 274, SILL - 7, 8, 7); R('#b02a1a', 274, SILL - 5, 8, 2); R('#e0a830', 275, SILL - 4, 6, 1); // подставка-стаканчик
  R('#1a1210', 277, SILL - 22, 2, 16); R('#e0a830', 277, SILL - 20, 1, 3); R('#b02a1a', 278, SILL - 16, 1, 3); // черенок
  R('#1a1210', 284, SILL - 3, 4, 1); // тень
  R('#1a1210', 282, SILL - 8, 10, 5); R('#b02a1a', 283, SILL - 7, 8, 3); R('#e0a830', 284, SILL - 6, 3, 1); R('#e0a830', 288, SILL - 7, 2, 1); // вторая ложка лежит
  R('#1a1210', 280, SILL - 5, 3, 1);
  R('#e8c048', 276, SILL - 22, 3, 1);
}

// ---------- набережная переднего плана: ларьки по сезону ----------
const HOHLOMA = { awning: ['#b02a1a', '#1a1414'], counter: '#2a1a14', goods: [[1, '#e0a830'], [4, '#c83020'], [8, '#e0a830']], steam: false };
const PRYANIK = { awning: ['#2a5aa0', '#f0d890'], counter: '#8a5a34', goods: [[1, '#c8883a'], [4, '#b87030'], [8, '#c8883a']], steam: false };
const STALL_KIND = { hohloma: HOHLOMA, pryanik: PRYANIK, tea: KINDS.tea };
export const STALL_X = { icecream: 150, tea: 150, corn: 236, pryanik: 236, hohloma: 430 };
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (mo >= 5 && mo <= 9 && !env.winter) { if (h >= 10 && h < 22) return ['icecream', 'corn', 'hohloma']; return []; }
  if (h >= 10 && h < (env.winter ? 19 : 20)) return ['tea', 'pryanik', 'hohloma'];
  return [];
}
const LANES = [
  { x0: 0, x1: 234, y: 158 },   // Нижне-Волжская набережная
  { x0: 226, x1: 268, y: 150 }, // Канавинский мост
  { x0: 0, x1: 96, y: 119 },    // Верхне-Волжская по бровке
];
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: STALL_KIND[k] || k, x: STALL_X[k] }))); }

// ---------- секреты ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;

export const SECRETS = [
  {
    id: 'meteor', name: '«Метеор» на подводных крыльях', layer: 'street',
    hint: 'В навигацию по Волге иногда проносится что-то длинное и очень быстрое, почти не касаясь воды.',
    found: '«Метеоры» и «Валдаи» на подводных крыльях ходят от Нижнего вверх по Волге — в Городец, Чкаловск и до Ярославля — и вниз, в Макарьево, Чебоксары и Казань.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (env.frozen || !env.navigation || h < 8 || h > 19)) return null;
      if (!inWin(env, 2400, 40, 700)) return null;
      const p = phase(env, 2400, 40, 700), dir = env.forced ? 1 : Math.floor((secT(env) + 700) / 2400) % 2 ? 1 : -1;
      const x = dir > 0 ? -30 + p * 540 : 510 - p * 540;
      return { x: Math.round(x), y: 172, w: 22, h: 8, dir };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f2', dayF); ctx.fillRect(x + 1, y + 2, 20, 3); ctx.fillRect(st.dir > 0 ? x + 6 : x + 4, y, 12, 2);
      ctx.fillStyle = mixHex('#1a1e28', '#3a6ab0', dayF); ctx.fillRect(st.dir > 0 ? x + 7 : x + 5, y + 1, 10, 1);
      ctx.fillStyle = mixHex('#2a2a34', '#6a6a72', dayF); ctx.fillRect(x + 4, y + 5, 1, 2); ctx.fillRect(x + 17, y + 5, 1, 2);
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) ctx.fillRect(st.dir > 0 ? x - 2 - i * 2 : x + 22 + i * 2, y + 6 - (i % 2), 2, 1);
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'zakat', name: 'Закат над Стрелкой', layer: 'street',
    hint: 'Во второй половине октября и в феврале солнце садится точно за мысом, где Ока встречает Волгу.',
    found: 'С борского берега в эти недели солнце садится прямо за Стрелкой — за Александро-Невским собором, и по воде к нам тянется золотая дорожка. Летом оно уходит далеко вправо, за Волгу.',
    state(env) {
      const s = env.sun;
      if (!env.forced && (s.alt > 3 || s.alt < -1 || s.az < 241 || s.az > 252 || env.weather.cloud > 70)) return null;
      const sx = env.forced ? 306 : Math.round(azToX(s.az));
      return { x: sx - 8, y: HORIZON + 1, w: 16, h: 30, sx };
    },
    draw(ctx, env, st, dayF) {
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
    id: 'chaiki', name: 'Чайки на весеннем льду', layer: 'street',
    hint: 'В конце марта, пока Волга ещё подо льдом, на нём кто-то собирается в белую компанию.',
    found: 'Озёрные чайки возвращаются на Волгу в конце марта — раньше, чем сходит лёд, и ждут ледохода прямо на льдинах.',
    state(env) {
      const mo = month(env), d = env.local.getUTCDate(), h = env.local.getUTCHours();
      if (!env.forced && !(env.frozen && ((mo === 3 && d >= 20) || mo === 4) && h >= 8 && h < 18)) return null;
      if (!inWin(env, 1200, 150, 300)) return null;
      return { x: 170, y: 184, w: 30, h: 8 };
    },
    draw(ctx, env, st, dayF) {
      const t = env.ms / 1000;
      for (let i = 0; i < 5; i++) {
        const x = st.x + 2 + i * 6 + (i % 2), y = st.y + 3 + (i % 3), up = Math.sin(t * 1.3 + i * 2) > 0.7;
        ctx.fillStyle = mixHex('#5a6070', '#f4f6f8', dayF); ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + (i % 2 ? -1 : 3), y - 1 - (up ? 1 : 0), 1, 2);
        ctx.fillStyle = mixHex('#3a3e48', '#8a929e', dayF); ctx.fillRect(x + 1, y, 2, 1);
        ctx.fillStyle = '#e8a030'; ctx.fillRect(x + (i % 2 ? -2 : 4), y - 1 - (up ? 1 : 0), 1, 1);
      }
    },
  },
  {
    id: 'rybak', name: 'Рыбаки на льду', layer: 'street',
    hint: 'Зимой по выходным с утра на льду Волги кто-то очень терпеливо сидит над лункой.',
    found: 'Зимой на льду Волги у Нижнего и Бора сидят рыбаки с удочками над лунками. На тонкий лёд — в начале зимы и весной — выходить нельзя.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), wd = l.getUTCDay(), mo = month(env);
      if (!env.forced && !(env.frozen && (wd === 0 || wd === 6) && h >= 7 && h < 14 && mo !== 4)) return null;
      return { x: 330, y: 180, w: 12, h: 11 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#1a2a3a', '#3a4a5a', dayF); ctx.fillRect(x + 8, y + 10, 3, 1);
      ctx.fillStyle = mixHex('#2a3a4a', '#c8423a', dayF); ctx.fillRect(x, y + 6, 4, 4);
      drawPerson(ctx, x + 2, y + 7, 0.25, dayF, 0, false, true, false);
      ctx.fillStyle = mixHex('#2a2a2a', '#5a4a3a', dayF); for (let i = 0; i < 6; i++) ctx.fillRect(x + 4 + i, y + 3 + (i >> 1), 1, 1);
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x + 9, y + 6, 1, 4); ctx.globalAlpha = 1;
    },
  },
  {
    id: 'pervaya', name: 'Первая кабина утра', layer: 'sky',
    hint: 'Рано утром, в первые минуты работы, по тросу над Волгой ползёт кабина, в которой горит свет.',
    found: 'Канатная дорога открывается в 6:45 (по воскресеньям — в 9:00): первые пассажиры едут с Бора в Нижний. 3,6 километра над Волгой — за 12,5 минуты, а пролёт над рекой длиной 861 метр — рекорд Европы для канатных дорог без опор над водой.',
    state(env) {
      const [open] = cableHours(env.local), m = minOfDay(env);
      if (!env.forced && !(m >= open && m < open + 6)) return null;
      const k = env.forced ? 0.55 : 1 - (m - open) / 6; // от нас к станции «Нижегородская»
      const [x, y] = cablePt(CABLE[0], 0.15 + k * 0.7), s = 0.15 + k * 0.7, w = 2 + Math.round(s * 7);
      return { x: Math.round(x) - (w >> 1) - 1, y: Math.round(y), w: w + 2, h: 4 + Math.round(s * 9), s };
    },
    draw(b, env, st, dayF) {
      const w = st.w - 2, top = st.y + 1 + Math.round(st.s * 4), h = 2 + Math.round(st.s * 5), cx = st.x + 1 + (w >> 1);
      b.fillStyle = '#3a3e48'; b.fillRect(cx, st.y, 1, top - st.y);
      b.fillStyle = mixHex('#3a3e48', '#eef0f2', Math.max(0.3, dayF)); b.fillRect(st.x + 1, top, w, h);
      b.fillStyle = '#ffd98a'; b.fillRect(st.x + 2, top + 1, Math.max(1, w - 2), Math.max(1, h >> 1));
      b.globalAlpha = 0.25 * (1 - dayF * 0.6); b.fillRect(st.x - 2, top - 2, w + 6, h + 4); b.globalAlpha = 1;
    },
  },
];

// События по новостям (fireworks — салют над Стрелкой)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 306, 40, dayF); }
