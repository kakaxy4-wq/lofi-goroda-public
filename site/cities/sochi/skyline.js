// Сочи: окно на Приморской набережной у устья Верещагинки (рядом с «Жемчужиной»), смотрим на запад.
// Слева — открытое море до горизонта, туда садится солнце. Справа вдоль берега:
// мол порта с огнём на голове, яхты марины, мыс со Сочинским маяком, Морской вокзал со шпилем,
// набережная к «Ривьере» с пальмами, зелёные предгорья и Главный Кавказский хребет
// (хребет чуть сдвинут к морю — художественное сжатие). Снег зимой — только на горах.

import { rng, clamp, mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  ridge: '#8e9fba', ridgeShade: '#7888a6', snow: '#f4f6fa', snowShade: '#d2dae8',
  hill: '#5f8a4a', hillDark: '#4a733c', tree: '#3a6a34', treeDark: '#2c5428',
  bldg: '#efe8da', bldgShade: '#d2c8b4', bldg2: '#eadcb8', roof: '#b45c3c',
  terminal: '#f7f3ea', termShade: '#d8d0c0', column: '#fffdf8', termRoof: '#c6baa6', win: '#5a6878',
  spire: '#dde2ea', spireDark: '#a0a8b4', star: '#d0322a', gold: '#e8b840',
  rock: '#8c8676', rockDark: '#6c6658', shrub: '#4c7c3c',
  light: '#f8f8f4', lantern: '#c8342a',
  quay: '#bcb4a4', quayDark: '#8c8678',
  yacht: '#fafaf8', yachtShade: '#c8ccd4', mast: '#d4d8de',
  palm: '#3e7a3a', palmDark: '#2e5e2c', trunk: '#8a6a4a',
};
const NIGHT = {
  ridge: '#1e2440', ridgeShade: '#181d36', snow: '#6a7490', snowShade: '#56607c',
  hill: '#131b1c', hillDark: '#0f1517', tree: '#121a1a', treeDark: '#0e1414',
  bldg: '#2a2c3c', bldgShade: '#222432', bldg2: '#2c2a36', roof: '#2a1e22',
  terminal: '#a89c86', termShade: '#867c6a', column: '#c4b8a0', termRoof: '#6e6656', win: '#1a1622',
  spire: '#9aa0ac', spireDark: '#6a707c', star: '#b02a24', gold: '#b08a3a',
  rock: '#26242a', rockDark: '#1c1a20', shrub: '#141c18',
  light: '#b8b8b4', lantern: '#7a2a26',
  quay: '#2c2a32', quayDark: '#201e26',
  yacht: '#8a8c94', yachtShade: '#5a5e68', mast: '#6a6e78',
  palm: '#141e18', palmDark: '#101814', trunk: '#241c18',
};
// Осень в Сочи поздняя и мягкая: чуть желтеют лиственные деревья на склонах, пальмы зелёные.
const AUTUMN = { day: { tree: '#8a8034', treeDark: '#6e5e2a', hill: '#6f8444' }, night: { tree: '#1c1a14', treeDark: '#161410' } };
// Зима: склоны остаются вечнозелёными, снег — только на хребте (рисуется в drawFar по флагу winter)
const WINTER = { day: { hill: '#58804a', hillDark: '#46693a', tree: '#36602f', ridge: '#95a4bd' }, night: {} };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Линейная интерполяция по точкам [[x, y], …]
const poly = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
};
const RIDGE = [[380, 146], [390, 134], [398, 128], [406, 131], [414, 121], [420, 117], [426, 122], [434, 111], [440, 107], [446, 113], [452, 119], [460, 113], [468, 109], [476, 115], [482, 113]];
const hillTop = (x) => 158 - (x - 384) * 0.3 + Math.sin(x * 0.17) * 2;

// Маленькая пальма на дальнем плане
function farPalm(R, x, base) {
  R('trunk', x, base - 7, 1, 7);
  R('palmDark', x - 1, base - 9, 3, 1); R('palm', x - 2, base - 8, 5, 1);
  R('palm', x - 3, base - 7, 1, 1); R('palm', x + 3, base - 7, 1, 1);
}

export function drawFar({ g, P, winter, r, L, R }) {
  // --- Главный Кавказский хребет (сжат к морю). На высоких вершинах снег лежит и летом.
  for (let x = 380; x < W; x++) {
    const y = Math.round(poly(RIDGE, x) + Math.sin(x * 1.3) * 0.6), down = poly(RIDGE, x + 1) > poly(RIDGE, x);
    R(down ? 'ridgeShade' : 'ridge', x, y, 1, 166 - y);
    const line = winter ? 130 : 110; // снеговая линия: зимой много ниже
    if (y < line) {
      const d = Math.min(line - y, winter ? 14 : 3) + (winter ? ((x * 7) % 3) : 0);
      R(down ? 'snowShade' : 'snow', x, y, 1, d);
    }
  }
  // --- зелёные предгорья
  for (let x = 384; x < W; x++) { const y = Math.round(hillTop(x)); R('hill', x, y, 1, 166 - y); R('hillDark', x, y + 5, 1, 166 - y - 5); }
  for (let x = 388; x < W; x += 3) { const y = Math.round(hillTop(x)), h = 2 + ((r() * 4) | 0); R(r() < 0.5 ? 'tree' : 'treeDark', x, y - h + 2, 3, h); }
  // --- город на склонах: белые дома курортной застройки
  for (let x = 398; x < W;) {
    const w = 5 + ((r() * 7) | 0), tall = r() < 0.3, h = tall ? 12 + ((r() * 10) | 0) : 5 + ((r() * 7) | 0), top = 160 - h;
    R(r() < 0.6 ? 'bldg' : 'bldg2', x, top, w, h); R('bldgShade', x + w - 1, top, 1, h);
    if (!tall && r() < 0.5) R('roof', x, top - 1, w, 1);
    for (let yy = top + 2; yy < 158; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.35) L(xx, yy, 'win');
    if (tall && r() < 0.5) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w + ((r() * 4) | 0);
  }
  // --- набережная за портом: дорога, фонари, пальмы
  R('quay', 392, 160, W - 392, 2); R('quayDark', 392, 162, W - 392, 6);
  for (let x = 398; x < W; x += 13) farPalm(R, x, 160);
  for (let x = 404; x < W; x += 13) { R('quayDark', x, 154, 1, 6); L(x, 153, 'lamp', '#ffe2a0', 0); }

  // --- Морской вокзал (1955): колоннада, ярусная башня, шпиль 71 м со звездой
  R('termRoof', 355, 146, 40, 1);
  R('terminal', 356, 147, 38, 17); R('termShade', 390, 147, 4, 17);
  for (let x = 358; x < 390; x += 3) { R('column', x, 150, 1, 10); R('win', x + 1, 151, 2, 8); }
  R('column', 356, 160, 38, 1); R('termShade', 356, 161, 38, 3); // цоколь и лестница
  for (let x = 359; x < 390; x += 3) L(x + 1, 155, 'win');
  // первый ярус башни
  R('terminal', 366, 130, 16, 17); R('termShade', 379, 130, 3, 17); R('column', 365, 129, 18, 1);
  for (const x of [369, 373, 377]) R('win', x, 134, 2, 7);
  R('column', 365, 126, 1, 3); R('column', 382, 126, 1, 3); // скульптуры по углам
  // второй ярус
  R('terminal', 368, 118, 12, 11); R('termShade', 378, 118, 2, 11); R('column', 367, 117, 14, 1);
  for (const x of [371, 375]) R('win', x, 121, 2, 6);
  R('column', 367, 114, 1, 3); R('column', 380, 114, 1, 3);
  // ротонда-колоннада
  R('terminal', 370, 107, 8, 10); R('column', 369, 106, 10, 1);
  for (const x of [371, 373, 375]) R('win', x, 109, 1, 6);
  // шпиль из нержавеющей стали
  for (let y = 70; y < 106; y++) {
    const w = 1 + Math.round((y - 70) / 35 * 3), x0 = 374 - (w >> 1);
    R('spire', x0, y, w, 1); if (w > 2) R('spireDark', x0 + w - 1, y, 1, 1);
  }
  // звезда — копия звезды ордена Отечественной войны
  R('star', 374, 62, 1, 1); R('star', 373, 63, 3, 1); R('star', 370, 64, 9, 1);
  R('star', 372, 65, 5, 1); R('star', 372, 66, 5, 1); R('star', 371, 67, 2, 1); R('star', 376, 67, 2, 1);
  R('gold', 374, 65, 1, 1); R('gold', 374, 68, 1, 2);
  L(374, 162, 'flood', '#ffe6b8', 0); L(362, 162, 'flood', '#ffe6b8', 0); L(386, 162, 'flood', '#ffe6b8', 0);

  R('quay', 334, 164, 60, 1); R('quayDark', 334, 165, 60, 3); // причальная стенка у вокзала
  // --- мыс со Сочинским маяком (перед вокзалом, ближе к нам)
  for (let x = 334; x < 363; x++) {
    const y = Math.round(150 + Math.abs(x - 348) * 0.9);
    R(x > 348 ? 'rockDark' : 'rock', x, y, 1, 168 - y);
    if (r() < 0.55) R('shrub', x, y, 1, 1 + ((r() * 2) | 0));
  }
  R('bldg', 351, 146, 8, 5); R('roof', 351, 145, 8, 1); R('win', 353, 148, 1, 2); R('win', 356, 148, 1, 2); // домик смотрителя
  R('light', 346, 136, 4, 15); R('termShade', 349, 136, 1, 15); R('win', 347, 141, 1, 2);
  R('rockDark', 345, 135, 6, 1); R('lantern', 346, 131, 4, 4); R('lantern', 347, 130, 2, 1);
  R('light', 347, 132, 2, 2);

  // --- мол порта и яхты марины «Сочи Гранд Марина»
  R('quay', 262, 163, 76, 2); R('quayDark', 262, 165, 76, 3);
  R('light', 262, 157, 2, 6); R('lantern', 262, 156, 2, 1); L(262, 155, 'red', '#ff4a3a', 0); // огонь на голове мола
  for (let x = 284; x < 334; x += 6) {
    const sail = r() < 0.6;
    R('yacht', x, 160, 5, 2); R('yachtShade', x, 162, 5, 1);
    if (sail) { const top = 147 + ((r() * 5) | 0); R('mast', x + 2, top, 1, 160 - top); L(x + 2, top, 'lamp', '#fff4d0', 0); }
    else { R('yacht', x + 1, 158, 3, 2); R('win', x + 2, 159, 2, 1); L(x + 3, 159, 'win'); }
  }
}

// ---------- ночь: подсветка вокзала, звезда на шпиле, огонь маяка ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const grad = g.createRadialGradient(374, 128, 2, 374, 128, 40);
  grad.addColorStop(0, `rgba(255,236,196,${0.22 * nightF})`); grad.addColorStop(1, 'rgba(255,236,196,0)');
  g.fillStyle = grad; g.fillRect(330, 80, 90, 88);
  g.globalAlpha = nightF * 0.8; g.fillStyle = '#f0f4ff'; g.fillRect(374, 72, 1, 34); // шпиль в лучах прожекторов
  g.fillStyle = '#fff2d8'; for (let x = 358; x < 390; x += 3) g.fillRect(x, 150, 1, 10); // колоннада
  const sg = g.createRadialGradient(374, 65, 0, 374, 65, 9);
  sg.addColorStop(0, `rgba(255,70,50,${0.55 * nightF})`); sg.addColorStop(1, 'rgba(255,70,50,0)');
  g.globalAlpha = 1; g.fillStyle = sg; g.fillRect(364, 55, 20, 20);
  g.globalAlpha = nightF; g.fillStyle = '#ff5a44'; g.fillRect(372, 64, 5, 2); g.fillRect(374, 62, 1, 2);
  // маяк: вспышка раз в несколько секунд
  const ph = t % 5;
  if (ph < 1.5) {
    const k = nightF * Math.sin((ph / 1.5) * Math.PI);
    const lg = g.createRadialGradient(348, 133, 0, 348, 133, 16);
    lg.addColorStop(0, `rgba(255,252,236,${0.7 * k})`); lg.addColorStop(1, 'rgba(255,252,236,0)');
    g.globalAlpha = 1; g.fillStyle = lg; g.fillRect(330, 116, 36, 34);
    g.globalAlpha = k; g.fillStyle = '#ffffff'; g.fillRect(347, 132, 2, 2);
    g.globalAlpha = k * 0.25; g.fillRect(310, 133, 76, 1); // луч над водой
  }
  g.globalAlpha = 1;
}

// Пена у мола и мыса — море у Сочи не замерзает
export function drawAbove(b, env, dayF, t) {
  const k = clamp(0.3 + env.weather.wind / 12, 0.3, 1);
  b.fillStyle = mixHex('#4a5060', '#f4f8fa', dayF);
  for (let x = 262; x < 364; x += 2) {
    const a = Math.sin(t * 1.3 + x * 0.45) + Math.sin(t * 0.7 - x * 0.13);
    if (a > 0.6) { b.globalAlpha = k * clamp(a - 0.6); b.fillRect(x, 167, 2, 1); }
  }
  b.globalAlpha = 1;
}
export function drawAboveLate(b, env, dayF, t) { drawCars(b, env, dayF, t); }

// ---------- передний план: галька и прибой, катер, набережная с ларьками, пальмы ----------
export function drawBoats(ctx, env, dayF, t) {
  drawSurf(ctx, env, dayF, t);
  drawKater(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
  drawPalm(ctx, 62, 202, 50, dayF, t, env);
  drawPalm(ctx, 240, 202, 44, dayF, t + 1.7, env);
}

const BEACH = 193; // кромка гальки
function drawSurf(ctx, env, dayF, t) {
  const pebble = mixHex('#26242c', '#a8a296', dayF), pebbleD = mixHex('#1c1a22', '#86806f', dayF), wet = mixHex('#1e1e28', '#7c786e', dayF);
  ctx.fillStyle = pebble; ctx.fillRect(0, BEACH, W, 200 - BEACH);
  ctx.fillStyle = wet; ctx.fillRect(0, BEACH, W, 2);
  const r = rng(77); ctx.fillStyle = pebbleD;
  for (let i = 0; i < 180; i++) ctx.fillRect((r() * W) | 0, BEACH + 2 + ((r() * 5) | 0), 1 + ((r() * 2) | 0), 1);
  const wave = clamp(0.35 + env.weather.wind / 10, 0.35, 1.3);
  const foam = mixHex('#5a6070', '#f6f9fb', dayF);
  ctx.fillStyle = foam;
  // валы идут к берегу и становятся заметнее у кромки
  for (let i = 0; i < 3; i++) {
    const p = ((t / 7) + i / 3) % 1, y = Math.round(180 + p * (BEACH - 182));
    for (let x = 0; x < W; x += 2) {
      const a = Math.sin(x * 0.05 + i * 2.1 + t * 0.2) + Math.sin(x * 0.013 - t * 0.1);
      if (a > -0.3) { ctx.globalAlpha = clamp(0.28 * p * wave * (a + 0.3)); ctx.fillRect(x, y, 2, 1); }
    }
  }
  // накат: пена забегает на гальку и откатывается
  for (let k = 0; k < 2; k++) {
    const ph = (t / 6 + k * 0.5) % 1, reach = Math.sin(ph * Math.PI);
    const y = BEACH - 1 + Math.round(reach * 3 * wave);
    for (let x = 0; x < W; x++) {
      const a = Math.sin(x * 0.21 + k * 3 + t * 0.4) + Math.sin(x * 0.06 - t * 0.25);
      if (a > -0.5) { ctx.globalAlpha = clamp((0.35 + 0.5 * reach) * (a + 0.5) / 2); ctx.fillRect(x, y + (a > 1 ? 1 : 0), 1, 1); }
    }
  }
  ctx.globalAlpha = 1;
}

// Прогулочный катер: морские прогулки из порта вдоль берега
function drawKater(ctx, env, dayF, t) {
  if (!env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 9 || h >= 20 || env.weather.kind === 'storm') return;
  const p = ((env.ms / 1000 + 60) % 600) / 220;
  if (p >= 1) return;
  const x = Math.round(420 - p * 480), y = 180, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f4f4f0', dayF); ctx.fillRect(x, y, 26, 3); ctx.fillRect(x + 2, y + 3, 22, 1);
  ctx.fillStyle = mixHex('#1a1e28', '#2a5a9a', dayF); ctx.fillRect(x + 1, y + 2, 25, 1);
  ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 5, y - 4, 15, 4);
  ctx.fillStyle = mixHex('#20242e', '#3a6a9a', dayF); for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 4, y - 3, 2, 1);
  ctx.fillStyle = mixHex('#2a1a1a', '#d8342a', dayF); ctx.fillRect(x + 12, y - 8, 1, 4); ctx.fillRect(x + 13, y - 8, 3, 2);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 27 + i * 2, y + 3 - (i % 2), 2, 1);
  if (nightF > 0.2) { ctx.globalAlpha = nightF; ctx.fillStyle = '#ffd98a'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 4, y - 3, 2, 1); }
  ctx.globalAlpha = 1;
}

// Пальма переднего плана: ствол с кольцами и перистые листья, качаются на ветру
function drawPalm(ctx, x, base, h, dayF, t, env) {
  const trunk = mixHex('#1c1614', '#7a5a3e', dayF), ring = mixHex('#141010', '#5e4430', dayF);
  const leaf = mixHex('#101814', '#3e7a3a', dayF), leafD = mixHex('#0c1210', '#2c5c2a', dayF);
  const sway = Math.sin(t * 0.9) * clamp(env.weather.wind / 8, 0.2, 1.4);
  const top = base - h;
  for (let y = base; y > top; y--) {
    const k = (base - y) / h, xx = Math.round(x + k * k * 4 + sway * k * 0.6);
    ctx.fillStyle = (y % 3 === 0) ? ring : trunk; ctx.fillRect(xx, y, 2, 1);
  }
  const cx = Math.round(x + 4 + sway * 0.6) + 1, cy = top;
  const FRONDS = [[-1, -0.35, 0.05, 15], [-1, 0.05, 0.04, 13], [-0.6, -0.8, 0.07, 10], [0.6, -0.8, 0.07, 10], [1, -0.35, 0.05, 15], [1, 0.05, 0.04, 13], [-0.2, -1, 0.1, 7], [0.3, 0.5, 0.03, 8]];
  FRONDS.forEach(([dx, dy, droop, len], i) => {
    const w = Math.sin(t * 1.6 + i) * 0.4 * clamp(env.weather.wind / 8, 0.2, 1.4);
    for (let j = 1; j <= len; j++) {
      const px = Math.round(cx + dx * j + w * j * 0.1), py = Math.round(cy + dy * j + droop * j * j + (dx > 0 ? w : -w) * j * 0.05);
      ctx.fillStyle = j % 2 ? leaf : leafD; ctx.fillRect(px, py, 1, 1);
      if (j > 2 && j < len - 1) { ctx.fillStyle = leafD; ctx.fillRect(px, py + 1, 1, 1); }
    }
  });
  ctx.fillStyle = mixHex('#1a140c', '#c89040', dayF); ctx.fillRect(cx - 1, cy + 1, 1, 1); ctx.fillRect(cx + 1, cy + 2, 1, 1); // финики
}

// Сувенир на подоконнике: ракушка-рапана и веточка мандарина
export function drawSill(R, SILL) {
  const x = 250, y = SILL;
  // рапана: завиток и раскрытое устье
  R('#8a5a34', x + 1, y - 2, 11, 2); R('#b07a44', x + 2, y - 4, 9, 2); R('#c8905a', x + 3, y - 6, 6, 2); R('#d8a870', x + 4, y - 7, 3, 1);
  R('#6a4226', x + 4, y - 4, 1, 2); R('#6a4226', x + 7, y - 4, 1, 2); R('#6a4226', x + 5, y - 6, 1, 1);
  R('#f0b890', x + 8, y - 3, 4, 2); R('#e89a70', x + 9, y - 2, 3, 1);
  // веточка мандарина
  R('#4a3a24', x + 14, y - 1, 10, 1);
  R('#3e7a3a', x + 15, y - 4, 3, 2); R('#2c5c2a', x + 22, y - 5, 3, 2);
  R('#e8862a', x + 17, y - 3, 3, 3); R('#f4a040', x + 17, y - 3, 1, 1);
  R('#e8862a', x + 20, y - 4, 3, 3); R('#f4a040', x + 20, y - 4, 1, 1);
}

// ---------- улица: машины у порта, набережная с курортными ларьками ----------
// Свои ларьки (формат движка: навес, прилавок, товар, пар)
export const KINDS_SOCHI = {
  churchkhela: { awning: ['#8a2a4a', '#f0e0c0'], counter: '#8a5a34', goods: [[1, '#7a2438'], [4, '#c08a3a'], [7, '#6a2a40'], [10, '#b87a34']], steam: false },
  mandarin: { awning: ['#e8862a', '#f4f4f4'], counter: '#8a5a34', goods: [[1, '#f08a20'], [4, '#f4a040'], [7, '#f08a20'], [10, '#3e7a3a']], steam: false },
};
// Слоты ларьков на набережной: у каждого — вид по сезону
export const STALL_X = { a: 96, b: 160, c: 320, d: 410 };
export function stallKinds(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  const summer = mo >= 5 && mo <= 10, winter = mo === 12 || mo <= 2;
  const open = summer ? h >= 9 && h < 23 : h >= 10 && h < 20;
  if (!open) return {};
  const k = {};
  k.a = summer ? 'corn' : winter ? 'mandarin' : null;
  k.b = 'churchkhela';
  k.c = summer ? 'icecream' : 'tea';
  if (env.navigation && h >= 9 && h < 20) k.d = 'boats';
  for (const id of Object.keys(k)) if (!k[id]) delete k[id];
  return k;
}
export function stalls(env) { return Object.values(stallKinds(env)); }
const LANES = [{ x0: 390, x1: 484, y: 160 }]; // набережная за портом
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawPromenade(ctx, env, dayF, t) {
  const k = stallKinds(env);
  const list = Object.keys(k).map((slot) => ({ kind: KINDS_SOCHI[k[slot]] || k[slot], x: STALL_X[slot] }));
  streetPromenade(ctx, { ...env, winter: false }, dayF, t, list); // снега на набережной в Сочи не рисуем
}

// ---------- секреты Сочи ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
const calmSea = (env) => env.weather.kind !== 'storm' && env.weather.wind < 12;
export const SECRETS = [
  {
    id: 'dolphins', name: 'Дельфины-афалины', layer: 'street',
    hint: 'Днём, в тихую погоду, в море иногда мелькают чьи-то спины.',
    found: 'Черноморские афалины и правда подходят к сочинскому берегу — чаще всего весной и летом, в штиль.',
    state(env) {
      if (!env.forced && (env.sun.alt < 2 || !calmSea(env))) return null;
      if (!inWin(env, 1500, 30, 400)) return null;
      const p = phase(env, 1500, 30, 400); return { x: Math.round(40 + p * 200), y: 172, w: 30, h: 12 };
    },
    draw(ctx, env, st, dayF) {
      const body = mixHex('#1c2028', '#4e5c6c', dayF), belly = mixHex('#2a2e36', '#a8b0b8', dayF), tt = env.ms / 1000;
      for (let d = 0; d < 3; d++) {
        const q = (tt * 0.45 + d * 0.31) % 1, x = st.x + d * 10, y = st.y + 9;
        if (q < 0.5) {
          const a = q / 0.5, hgt = Math.round(Math.sin(a * Math.PI) * 6), dx = Math.round(a * 6);
          ctx.fillStyle = body; ctx.fillRect(x + dx, y - hgt, 5, 2); ctx.fillRect(x + dx + 2, y - hgt - 1, 1, 1); // тело, плавник
          ctx.fillRect(a < 0.5 ? x + dx - 1 : x + dx + 5, y - hgt + (a < 0.5 ? 1 : -1), 1, 1);                // хвост / клюв
          ctx.fillStyle = belly; ctx.fillRect(x + dx + 1, y - hgt + 1, 3, 1);
        }
        if (q < 0.06 || (q > 0.46 && q < 0.54)) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#eef4f8'; ctx.fillRect(x + (q < 0.1 ? 0 : 6), y, 3, 1); ctx.fillRect(x + (q < 0.1 ? 1 : 7), y - 1, 1, 1); ctx.globalAlpha = 1; }
      }
    },
  },
  {
    id: 'parasail', name: 'Парашют за катером', layer: 'street',
    hint: 'Летом днём над морем кто-то летит на цветном куполе.',
    found: 'Парасейлинг — полёт на парашюте на буксире за катером — одно из летних развлечений сочинских пляжей.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(month(env) >= 6 && month(env) <= 9 && h >= 10 && h < 18 && calmSea(env) && !['rain', 'storm'].includes(env.weather.kind))) return null;
      if (!inWin(env, 900, 90, 150)) return null;
      const p = phase(env, 900, 90, 150), bx = Math.round(-20 + p * 320);
      return { x: bx + 30, y: 96, w: 14, h: 12, bx };
    },
    draw(ctx, env, st, dayF) {
      const { x, y, bx } = st, by = 184, cols = ['#e8423a', '#f4f4f4', '#f0c040', '#3a7ad0'];
      for (let i = 0; i < 4; i++) { const w = [8, 12, 14, 14][i]; for (let j = 0; j < w; j++) { ctx.fillStyle = mixHex('#202028', cols[(j >> 1) % 4], 0.4 + dayF * 0.6); ctx.fillRect(x + 7 - (w >> 1) + j, y + i, 1, 1); } }
      ctx.fillStyle = mixHex('#1a1a20', '#3a3a44', dayF); ctx.fillRect(x + 1, y + 4, 1, 4); ctx.fillRect(x + 12, y + 4, 1, 4);
      ctx.fillStyle = mixHex('#1a1a20', '#e0b090', dayF); ctx.fillRect(x + 6, y + 8, 2, 1); ctx.fillStyle = mixHex('#1a1a20', '#e8c040', dayF); ctx.fillRect(x + 6, y + 9, 2, 3);
      ctx.globalAlpha = 0.5; ctx.fillStyle = mixHex('#202028', '#e8e8e8', dayF); // трос к катеру
      const n = Math.hypot(x + 6 - bx - 4, by - y - 12);
      for (let i = 0; i < n; i += 2) ctx.fillRect(Math.round(bx + 4 + (x + 6 - bx - 4) * i / n), Math.round(by - (by - y - 12) * i / n), 1, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f0', dayF); ctx.fillRect(bx, by, 12, 2); ctx.fillStyle = mixHex('#1a1e28', '#c8342a', dayF); ctx.fillRect(bx + 1, by + 2, 10, 1);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) ctx.fillRect(bx - 2 - i * 2, by + 2 - (i % 2), 2, 1); ctx.globalAlpha = 1;
    },
  },
  {
    id: 'liner', name: 'Круизный лайнер', layer: 'street',
    hint: 'С весны до осени у самого горизонта медленно проходит большой белый корабль.',
    found: 'В сезон из Сочи уходят морские круизы: лайнер «Князь Владимир» ходит по Чёрному морю в Новороссийск, Ялту и Севастополь.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(month(env) >= 5 && month(env) <= 10 && h >= 7 && h < 23)) return null;
      if (!inWin(env, 3600, 240, 1200)) return null;
      const p = phase(env, 3600, 240, 1200); return { x: Math.round(250 - p * 290), y: 157, w: 36, h: 11 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, nightF = 1 - dayF;
      ctx.fillStyle = mixHex('#3a3e4a', '#f2f2ee', dayF); ctx.fillRect(x, y + 6, 36, 3); ctx.fillRect(x + 2, y + 9, 32, 1);
      ctx.fillStyle = mixHex('#1a1e28', '#2a3a5a', dayF); ctx.fillRect(x + 1, y + 9, 34, 1);
      ctx.fillStyle = mixHex('#343844', '#eaeae6', dayF); ctx.fillRect(x + 5, y + 3, 26, 3); ctx.fillRect(x + 9, y + 1, 16, 2);
      ctx.fillStyle = mixHex('#2a2e38', '#2a4a8a', dayF); ctx.fillRect(x + 22, y - 1, 3, 3);
      ctx.fillStyle = mixHex('#20242e', '#5a6a7a', dayF); for (let i = 0; i < 12; i++) ctx.fillRect(x + 6 + i * 2, y + 4, 1, 1);
      if (nightF > 0.2) { ctx.globalAlpha = nightF; ctx.fillStyle = '#ffd98a'; for (let i = 0; i < 16; i++) ctx.fillRect(x + 3 + i * 2, y + 7, 1, 1); for (let i = 0; i < 12; i++) ctx.fillRect(x + 6 + i * 2, y + 4, 1, 1); ctx.globalAlpha = 1; }
    },
  },
  {
    id: 'salute', name: 'Салют над морем', layer: 'sky',
    hint: 'В конце мая, в день рождения города, и в новогоднюю полночь небо над портом может расцвести.',
    found: 'День города Сочи отмечают в последнюю субботу мая — обычно вечером над набережной салют. И конечно, в новогоднюю полночь.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), m = l.getUTCMinutes(), d = l.getUTCDate();
      const cityDay = month(env) === 5 && d >= 25 && l.getUTCDay() === 6 && h === 22 && m < 15;
      const newYear = month(env) === 1 && d === 1 && h === 0 && m < 15;
      if (!env.forced && !cityDay && !newYear) return null;
      return { x: 180, y: 20, w: 240, h: 80 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 300, 44, dayF); },
  },
];

// События по новостям (data/events.json): fireworks — салют над портом
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 300, 44, dayF); }
