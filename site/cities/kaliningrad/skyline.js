// Калининград: вид из окна дома на Эпроновской улице (южный берег Новой Преголи) на север-северо-восток.
// Слева направо: Музей Мирового океана с НИС «Витязь» и подлодкой Б-413 (художественное сжатие: на самом деле
// музей левее и дальше, за эстакадой), Эстакадный мост, остров Канта с Кафедральным собором и могилой Канта,
// пешеходный разводной Юбилейный мост, фахверковая Рыбная деревня с башней «Маяк».

import { mixHex, rng } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  far: '#a4acbc', farDark: '#9098aa', farRoof: '#7c8498', tower: '#b0b8c6',
  bank: '#6f8a5a', bankDark: '#5a7348', tree: '#3e6b3d', treeDark: '#2f5531',
  granite: '#8c8278', graniteDark: '#6f665e',
  brick: '#a8583e', brickDark: '#84422e', brickHi: '#c06a4a', roof: '#8a3e2e', roofDark: '#6a2e24',
  spire: '#4f7a68', spireDark: '#3a5c4e', winG: '#3a3440', stone: '#d8cfc0', stoneDark: '#b4aa9a',
  conc: '#c4c6ca', concDark: '#9a9ea6', iron: '#3a3a40',
  hullW: '#eeeeea', hullShade: '#c8ccd0', hullD: '#2a2e38', funnel: '#d8a040', mast: '#5a5e66', sub: '#34383e',
  fw1: '#f2ead8', fw2: '#ecdcc0', fw3: '#e8d0b0', timber: '#5a3a26', roofR: '#a8442e', roofB: '#6a4a3a', win: '#5a6070',
  mayak: '#e8dcc8', mayakDark: '#c4b6a0', mayakRoof: '#4a5a52', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a', tower: '#222a44',
  bank: '#141c1c', bankDark: '#101616', tree: '#151d1f', treeDark: '#101719',
  granite: '#27252d', graniteDark: '#1e1c23',
  brick: '#6a3428', brickDark: '#4e261e', brickHi: '#7a3e30', roof: '#3a1e1a', roofDark: '#2a1614',
  spire: '#1e3a30', spireDark: '#162c24', winG: '#16121c', stone: '#6a6660', stoneDark: '#524e4a',
  conc: '#6a6e7a', concDark: '#4a4e5a', iron: '#1a1a20',
  hullW: '#8a8e9a', hullShade: '#6a6e7a', hullD: '#14161c', funnel: '#7a5a2a', mast: '#2a2c34', sub: '#16181e',
  fw1: '#5a5650', fw2: '#56504a', fw3: '#524a42', timber: '#1e140e', roofR: '#3a1c16', roofB: '#241a16', win: '#1a1420',
  mayak: '#6e6a62', mayakDark: '#56524c', mayakRoof: '#1e2622', snow: '#6a7488',
};
const AUTUMN = {
  day: { tree: '#b8883a', treeDark: '#8a6028', bank: '#8a8a4a', bankDark: '#6e6e3a' },
  night: { tree: '#221c16', treeDark: '#1a1511' },
};
// Мягкая балтийская зима: снег на крышах, деревья голые; река обычно не замерзает
const WINTER = {
  day: { tree: '#5d5853', treeDark: '#48443f', bank: '#dfe6ec', bankDark: '#c4ccd6' },
  night: { tree: '#1a1a1e', treeDark: '#141418', bank: '#2c3244', bankDark: '#242a3a' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

const RYB_HOUSES = [[338, 16, 26, 'fw1', 'roofR'], [355, 14, 30, 'fw2', 'roofB'], [370, 18, 24, 'fw3', 'roofR'], [389, 10, 20, 'fw1', 'roofB'],
  [420, 16, 32, 'fw2', 'roofR'], [437, 14, 26, 'fw3', 'roofB'], [452, 16, 30, 'fw1', 'roofR'], [469, 12, 22, 'fw2', 'roofB']];

function fachwerk(R, L, q, winter, x, w, h, wall, roof, base = 160) {
  const top = base - h;
  R(wall, x, top, w, h);
  // балки: стойки, ригель, раскосы
  for (let xx = x; xx < x + w; xx += 4) R('timber', xx, top, 1, h);
  R('timber', x + w - 1, top, 1, h);
  for (let yy = top; yy < base; yy += 8) R('timber', x, yy, w, 1);
  for (let i = 0; i < 4; i++) { R('timber', x + 1 + i, top + 4 + i, 1, 1); R('timber', x + w - 2 - i, top + 4 + i, 1, 1); }
  for (let yy = top + 2; yy < base - 3; yy += 8) for (let xx = x + 2; xx < x + w - 2; xx += 4) { R('win', xx, yy, 2, 3); if (q() < 0.7) L(xx, yy + 1, 'win'); }
  // щипец к реке
  const half = w >> 1;
  for (let i = 0; i <= half; i++) { R(roof, x + half - i, top - half + i - 1, i * 2 + (w & 1), 1); }
  if (winter) for (let i = 0; i <= half; i += 1) { R('snow', x + half - i, top - half + i - 1, 1, 1); R('snow', x + half + i + (w & 1) - 1, top - half + i - 1, 1, 1); }
}

export function drawFar({ winter, L, R }) {
  const q = rng(1255); // свой генератор: раскладка не зависит от чисел движка

  // город за рекой: Альтштадт, Ломзе, новые кварталы
  for (let x = 0; x < W;) {
    const w = 6 + ((q() * 12) | 0), tall = q() < 0.2, h = tall ? 16 + ((q() * 10) | 0) : 5 + ((q() * 10) | 0), top = 152 - h;
    R(tall ? 'tower' : q() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < 150; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (q() < 0.3) L(xx, yy, 'win');
    if (tall) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w;
  }

  // берег за рекой и гранитная кромка
  R('bank', 0, 156, W, 10); R('bankDark', 0, 160, W, 6);
  R('granite', 0, 164, W, 2); R('graniteDark', 0, 166, W, 2);

  // Музей Мирового океана: НИС «Витязь» и подводная лодка Б-413 у причала (сжатие — музей ближе, чем в жизни)
  R('graniteDark', 0, 158, 64, 2);
  R('hullW', 4, 149, 42, 6); R('hullW', 2, 147, 8, 2); R('hullShade', 40, 149, 6, 6); R('hullD', 4, 155, 42, 2);
  R('hullW', 14, 142, 22, 7); R('hullShade', 32, 142, 4, 7); R('hullW', 17, 138, 12, 4);
  for (let x = 18; x < 28; x += 3) { R('win', x, 139, 2, 1); L(x, 139, 'win', null, 0.2); }
  for (let x = 6; x < 44; x += 4) R('win', x, 151, 1, 1);
  R('funnel', 26, 132, 5, 6); R('hullD', 26, 132, 5, 1);
  R('mast', 12, 122, 1, 25); R('mast', 9, 126, 7, 1); R('mast', 38, 127, 1, 22); R('mast', 35, 131, 7, 1);
  L(12, 121, 'red', '#ff3a3a', 0); L(38, 126, 'lamp', '#fff4c8', 0);
  R('sub', 46, 155, 18, 2); R('sub', 48, 154, 12, 1); R('sub', 52, 150, 4, 4); R('sub', 53, 148, 1, 2);
  L(24, 157, 'flood', '#cfe0ff', 0);

  // Эстакадный мост: длинная бетонная эстакада над обоими рукавами Преголи
  R('conc', 58, 145, 120, 3); R('concDark', 58, 148, 120, 1);
  for (let x = 62; x < 178; x += 18) { R('concDark', x, 149, 3, 15); R('conc', x, 149, 1, 15); }
  for (let x = 60; x < 178; x += 12) { R('iron', x, 140, 1, 5); L(x, 140, 'lamp', '#ffe0a0', 0); }
  if (winter) R('snow', 58, 145, 120, 1);

  // остров Канта: деревья парка скульптур
  for (let x = 166; x < 300; x += 3) { const h = 5 + ((q() * 7) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, 158 - h, 4, h + 2); }

  // Кафедральный собор: кирпичная готика, южная башня со шпилем, крутая черепичная кровля
  R('brick', 214, 120, 62, 33); R('brickDark', 270, 120, 6, 33);
  for (let i = 0; i < 15; i++) R(i < 3 ? 'roofDark' : 'roof', 216 + Math.max(0, 3 - i), 105 + i, 58 - Math.max(0, 3 - i) * 2, 1);
  R('roofDark', 216, 119, 58, 1);
  if (winter) R('snow', 219, 105, 52, 2);
  for (let x = 220; x < 270; x += 7) { R('winG', x, 127, 3, 16); R('winG', x + 1, 126, 1, 1); R('brickHi', x, 135, 3, 1); }
  for (let x = 216; x < 276; x += 7) R('brickDark', x + 5, 121, 1, 32); // контрфорсы
  // алтарная часть на востоке, пониже
  R('brick', 276, 128, 14, 25); R('brickDark', 286, 128, 4, 25);
  for (let i = 0; i < 7; i++) R('roof', 276, 121 + i, 14 - Math.max(0, 6 - i), 1);
  R('winG', 280, 134, 2, 12);
  // башня с часами и шпилем
  R('brick', 196, 86, 20, 67); R('brickDark', 211, 86, 5, 67); R('brickHi', 196, 86, 20, 1);
  for (const y of [96, 112, 128]) { R('winG', 201, y, 2, 8); R('winG', 207, y, 2, 8); }
  R('stone', 202, 104, 6, 5); R('brickDark', 204, 105, 2, 2); // циферблат
  R('winG', 203, 140, 5, 13); // портал
  for (let i = 0; i < 24; i++) { const w = Math.max(1, Math.round(1 + i * 0.85)); R('spire', 206 - (w >> 1), 62 + i, w, 1); if (w > 3) R('spireDark', 206 + (w >> 1) - 1, 62 + i, 1, 1); }
  R('spire', 205, 58, 1, 4); R('funnel', 205, 57, 2, 1);
  if (winter) R('snow', 196, 85, 20, 1);
  // колоннада над могилой Канта у северо-восточного угла
  R('stone', 290, 145, 10, 1); for (let x = 290; x < 300; x += 2) R('stone', x, 146, 1, 7); R('stoneDark', 290, 152, 10, 1);
  L(206, 150, 'flood', '#ffe0b0', 0); L(245, 152, 'flood', '#ffd8a8', 0); L(270, 152, 'flood', '#ffd8a8', 0);

  // Юбилейный мост: крайние пролёты и ажурные фонари (средний, разводной, рисуется отдельно)
  R('iron', 292, 156, 14, 2); R('iron', 322, 156, 16, 2);
  for (const x of [294, 306, 322, 336]) R('concDark', x, 158, 2, 8);
  for (const x of [296, 302, 326, 332]) { R('iron', x, 150, 1, 6); R('iron', x - 1, 150, 3, 1); L(x, 149, 'lamp', '#ffe8b0', 0); }

  // Рыбная деревня: фахверк вдоль набережной
  for (const [x, w, h, wall, roof] of RYB_HOUSES) fachwerk(R, L, q, winter, x, w, h, wall, roof);
  // башня «Маяк» (около 33 м) со смотровой площадкой
  R('mayak', 402, 104, 13, 56); R('mayakDark', 411, 104, 4, 56);
  for (let y = 112; y < 158; y += 10) { R('timber', 402, y, 13, 1); R('win', 407, y + 3, 2, 4); L(407, y + 4, 'win'); }
  R('iron', 399, 101, 19, 1); R('iron', 399, 98, 1, 3); R('iron', 417, 98, 1, 3); R('iron', 399, 98, 19, 1); // галерея
  R('mayak', 404, 92, 9, 6); R('win', 405, 94, 2, 3); R('win', 409, 94, 2, 3);
  for (let i = 0; i < 8; i++) R('mayakRoof', 408 - (i >> 1) - 1, 84 + i, (i >> 1) * 2 + 3, 1);
  R('iron', 408, 80, 1, 4);
  if (winter) R('snow', 405, 84, 7, 1);
  L(408, 95, 'lamp', '#ffe8a0', 0);
  R('granite', 336, 160, 144, 2);
  for (let x = 342; x < W; x += 14) L(x, 158, 'lamp', '#ffd88a', 0);
  L(360, 158, 'flood', '#ffd0a0', 0); L(450, 158, 'flood', '#ffd0a0', 0);
}

// ---------- Юбилейный мост: средний пролёт (развод — секрет) ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const dayOfYear = (l) => Math.floor((Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - Date.UTC(l.getUTCFullYear(), 0, 1)) / 864e5);
// Разводят изредка, ночью, для прохода судов: в навигацию примерно раз в пять ночей, с 2:10 до 2:40
function razvodNatural(env) {
  const l = env.local, h = l.getUTCHours(), m = l.getUTCMinutes();
  return env.navigation && dayOfYear(l) % 5 === 0 && h === 2 && m >= 10 && m < 40;
}
const razvodOn = (env) => env.forceSecret === 'razvod' || razvodNatural(env);

export function drawAbove(b, env, dayF, t) {
  if (razvodOn(env)) return; // поднятые крылья рисует секрет
  b.fillStyle = mixHex('#1a1a20', '#3a3a40', dayF); b.fillRect(306, 156, 16, 2);
  // прохожие на пешеходном мосту
  const h = env.local.getUTCHours();
  const n = h < 7 ? 0 : h < 22 ? 4 : 1;
  for (let i = 0; i < n; i++) {
    const r = rng(i * 53 + 11), dir = r() < 0.5 ? 1 : -1, x = 292 + (((r() * 46 + dir * t * (1.5 + r())) % 46) + 46) % 46;
    b.fillStyle = mixHex('#141018', ['#c8423a', '#3a6ab0', '#e8e4dc', '#4a8a5a'][(r() * 4) | 0], Math.max(0.3, dayF));
    b.fillRect(Math.round(x), 153, 1, 3);
  }
}

// ---------- ночная подсветка: собор, «Маяк», Рыбная деревня ----------
export function drawNight(g, env, nightF) {
  if (nightF < 0.05) return;
  const glow = (x, y, rad, rgbStr, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(${rgbStr},${a * nightF})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  };
  glow(244, 132, 40, '255,200,140', 0.2);
  glow(206, 100, 24, '255,210,150', 0.2);
  glow(408, 95, 12, '255,230,160', 0.35);
  glow(400, 150, 50, '255,200,130', 0.12);
  glow(314, 152, 16, '255,230,170', 0.15);
  // тёплый контур собора в подсветке
  g.globalAlpha = nightF * 0.35; g.fillStyle = '#ffc890';
  g.fillRect(196, 86, 1, 66); g.fillRect(214, 120, 56, 1); g.fillRect(206, 62, 1, 24);
  g.globalAlpha = 1;
}

export function drawAboveLate(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
export function drawBoats(ctx, env, dayF, t) { drawPromenade(ctx, env, dayF, t); }

// ---------- набережная на нашем берегу: ларьки ----------
const FISH = { awning: ['#4a7aa0', '#f0ece0'], counter: '#8a5a34', goods: [[1, '#c89040'], [4, '#b87a30'], [8, '#c89040']], steam: false };
const AMBER = { awning: ['#c87a1a', '#f4e8c8'], counter: '#5a3a24', goods: [[1, '#f0a020'], [4, '#e8c040'], [7, '#d88a18']], steam: false };
const MARZIPAN = { awning: ['#d88aa0', '#f8f0e8'], counter: '#f0e0c8', goods: [[1, '#e8d0a0'], [4, '#f4c8d8'], [8, '#e8d0a0']], steam: false };
const COFFEE = { awning: ['#5a3a2a', '#e8dcc8'], counter: '#8a5a34', goods: [[2, '#f0ece0'], [7, '#f0ece0']], steam: true };
const STALL_KIND = { fish: FISH, amber: AMBER, marzipan: MARZIPAN, coffee: COFFEE };
export const STALL_X = { icecream: 150, tea: 150, fish: 236, amber: 192, coffee: 420, marzipan: 420 };
// Какие ларьки работают сейчас: летом мороженое и кофе, в холодный сезон чай с какао и марципан
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (mo >= 5 && mo <= 9 && h >= 10 && h < 22) return ['icecream', 'fish', 'amber', 'coffee'];
  if (h >= 10 && h < 20) return ['tea', 'fish', 'amber', 'marzipan'];
  return [];
}
const LANES = [{ x0: 56, x1: 178, y: 145 }]; // Эстакадный мост (Юбилейный — пешеходный)
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: STALL_KIND[k] || k, x: STALL_X[k] }))); }

// ---------- расписания ----------
// Прогулочный кораблик от Рыбной деревни: в навигацию с 11 до 19, в начале часа, 8 минут в кадре
export function korablikRun(env) {
  if (!env.navigation) return -1;
  const l = env.local, h = l.getUTCHours(), m = l.getUTCMinutes() + l.getUTCSeconds() / 60;
  if (h < 11 || h > 19 || m >= 8) return -1;
  return m / 8;
}
// День Военно-морского флота — последнее воскресенье июля
export function isNavyDay(local) { return local.getUTCMonth() === 6 && local.getUTCDay() === 0 && local.getUTCDate() >= 25; }

// ---------- секреты Калининграда ----------
export const SECRETS = [
  {
    id: 'razvod', name: 'Развод Юбилейного моста', layer: 'sky',
    hint: 'Глубокой ночью, в навигацию, пешеходный мост у Рыбной деревни иногда поднимает руки к небу.',
    found: 'Средний пролёт Юбилейного моста разводной. Изредка, ночью, его разводят, чтобы пропустить суда по Преголе.',
    state(env) {
      if (!env.forced && !razvodNatural(env)) return null;
      return { x: 304, y: 140, w: 20, h: 18 };
    },
    draw(b, env, st, dayF) {
      b.fillStyle = mixHex('#1a1a20', '#3a3a40', dayF);
      for (let i = 0; i < 12; i++) { b.fillRect(306 + (i >> 2), 156 - i, 2, 1); b.fillRect(320 - (i >> 2), 156 - i, 2, 1); }
      b.fillStyle = '#ff3a2a'; b.globalAlpha = Math.sin(env.ms / 400) > 0 ? 1 : 0.3;
      b.fillRect(309, 143, 1, 1); b.fillRect(318, 143, 1, 1); b.globalAlpha = 1;
    },
  },
  {
    id: 'korablik', name: 'Прогулочный кораблик', layer: 'street',
    hint: 'Летом в начале часа от причала у фахверковых домиков что-то отчаливает.',
    found: 'В навигацию от причалов у Рыбной деревни отходят прогулочные кораблики — по Преголе мимо острова Канта и Музея Мирового океана.',
    state(env) {
      let p = korablikRun(env);
      if (p < 0) { if (!env.forced) return null; p = 0.4; }
      return { x: Math.round(420 - p * 380), y: 176, w: 22, h: 9 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, nightF = 1 - dayF;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f0', dayF); ctx.fillRect(x, y + 4, 22, 3); ctx.fillRect(x - 1, y + 3, 3, 1);
      ctx.fillStyle = mixHex('#1a1e28', '#2a4a8a', dayF); ctx.fillRect(x + 1, y + 7, 20, 1);
      ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 4, y + 1, 15, 3);
      ctx.fillStyle = mixHex('#30343e', '#c8423a', dayF); ctx.fillRect(x + 4, y, 15, 1);
      ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7;
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 5 + i * 2, y + 2, 1, 1);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 22, y + 7, 6, 1); ctx.globalAlpha = 1; // след
    },
  },
  {
    id: 'organ', name: 'Органный вечер в соборе', layer: 'sky',
    hint: 'Некоторыми вечерами высокие окна собора на острове светятся изнутри тёплым светом.',
    found: 'Кафедральный собор — музей и концертный зал. С 2008 года в нём крупнейший в России органный комплекс: в большом органе 6301 труба. Концерты идут почти каждый день.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(h >= 18 && h < 22 && env.sun.alt < 3 && inWin(env, 2400, 120, 700))) return null;
      return { x: 218, y: 124, w: 56, h: 20 };
    },
    draw(b, env, st) {
      const k = 0.6 + 0.4 * Math.sin(env.ms / 900);
      b.fillStyle = '#ffd070';
      for (let x = 220; x < 270; x += 7) { b.globalAlpha = 0.55 + 0.35 * k; b.fillRect(x, 127, 3, 16); b.fillRect(x + 1, 126, 1, 1); }
      const gr = b.createRadialGradient(245, 134, 2, 245, 134, 34);
      gr.addColorStop(0, 'rgba(255,200,110,0.3)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
      b.globalAlpha = k; b.fillStyle = gr; b.fillRect(210, 100, 70, 60);
      b.globalAlpha = 1;
    },
  },
  {
    id: 'uchkot', name: 'Учёный кот на «Маяке»', layer: 'sky',
    hint: 'Когда солнце низко, на самом верху башни у Рыбной деревни что-то поблёскивает.',
    found: 'На смотровой площадке башни «Маяк» живёт скульптура учёного кота. Чтобы поздороваться, нужно подняться по винтовой лестнице на самый верх.',
    state(env) {
      if (!env.forced && !(env.sun.alt > -1 && env.sun.alt < 12 && env.weather.cloud < 75 && inWin(env, 1500, 45, 500))) return null;
      return { x: 404, y: 93, w: 8, h: 8 };
    },
    draw(b, env, st, dayF) {
      b.fillStyle = mixHex('#2a2420', '#4a3a30', Math.max(dayF, 0.3));
      b.fillRect(406, 96, 3, 2); b.fillRect(406, 95, 1, 1); b.fillRect(408, 95, 1, 1); b.fillRect(409, 97, 1, 1);
      if (Math.sin(env.ms / 250) > 0.3) { b.fillStyle = '#fff4c0'; b.fillRect(407, 96, 1, 1); } // блик очков
    },
  },
  {
    id: 'flags', name: 'Флаги расцвечивания на «Витязе»', layer: 'sky',
    hint: 'В последнее воскресенье июля у старых кораблей слева от моста праздничный наряд.',
    found: 'В День Военно-морского флота корабли Набережной исторического флота Музея Мирового океана встречают праздник расцвечиванием — гирляндами сигнальных флагов.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(isNavyDay(env.local) && h >= 8 && h < 22)) return null;
      return { x: 2, y: 120, w: 46, h: 32 };
    },
    draw(b, env, st, dayF) {
      const cols = ['#c8423a', '#f4f4f4', '#2a4a8a', '#e8c040', '#3a8a5a'];
      const seg = (x0, y0, x1, y1, i0) => {
        for (let i = 0; i <= 12; i++) {
          b.fillStyle = mixHex('#141018', cols[(i + i0) % cols.length], Math.max(0.35, dayF));
          b.fillRect(Math.round(x0 + (x1 - x0) * i / 12), Math.round(y0 + (y1 - y0) * i / 12 + (Math.sin(env.ms / 500 + i) > 0.6 ? 1 : 0)), 1, 2);
        }
      };
      seg(2, 147, 12, 122, 0); seg(12, 122, 38, 127, 2); seg(38, 127, 46, 149, 4);
    },
  },
];

// События по новостям (fireworks — салют над Преголей)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 250, 40, dayF); }

// Сувенир на подоконнике — кусочек балтийского янтаря
export function drawSill(R, SILL) {
  R('#6a4a2a', 272, SILL - 2, 18, 2); R('#8a6a3a', 272, SILL - 2, 18, 1); // подставка
  const rows = [[277, 5], [275, 9], [274, 12], [274, 13], [275, 12], [276, 10]];
  rows.forEach(([x, w], i) => R(i < 2 ? '#f0a830' : '#d88418', x, SILL - 8 + i, w, 1));
  R('#b86a10', 284, SILL - 6, 3, 4); R('#ffd878', 277, SILL - 7, 2, 1); R('#ffe8a8', 276, SILL - 6, 1, 1);
  R('#8a4a0a', 280, SILL - 4, 1, 1); // мушка внутри
}
