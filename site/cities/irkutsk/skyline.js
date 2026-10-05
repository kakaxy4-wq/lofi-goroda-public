// Иркутск: окно над смотровой площадкой «Глазково» (левый берег Ангары, между рощей «Звёздочка»
// и рекой, открыта в 2021 году), смотрим на северо-восток, через Ангару на исторический центр.
// Слева направо: Глазковский мост (1936, четыре арки, по нему ходят трамваи к вокзалу), вдали —
// Спасская церковь, Богоявленский собор и Московские ворота на Нижней набережной, ближе —
// Верхняя набережная (бульвар Гагарина) и памятник Александру III у воды.
// Реальные азимуты с площадки: мост ≈ 347–22°, храмы ≈ 36°, ворота ≈ 39°, памятник ≈ 90°.
// Храмы и ворота на деле стоят почти на одной линии взгляда; в кадре разнесены на ~60 px
// (художественное сжатие), все постройки укрупнены, набережная переднего плана придвинута к окну.
// Ангара ниже Иркутской ГЭС зимой не замерзает и в морозы парит — это главная деталь сцены.

import { rng, mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawPerson, drawFireworks } from '../../engine/street.js';

const DAY = {
  hillFar: '#a4aec0', hillFarDark: '#97a2b6', farCity: '#c0bcb6', farCityDark: '#aaa6a2',
  bldg: '#e8dcc4', bldg2: '#d8c4a8', bldg3: '#c8ccd0', bldgShade: '#b0a690', roof: '#7a6a62', win: '#5a6474',
  tree: '#4f7a44', treeDark: '#3c6234',
  bridge: '#cfcac0', bridgeShade: '#a8a49c', bridgeDark: '#8a867e', pylon: '#dcd8ce',
  bank: '#a8a29a', bankDark: '#88827a',
  church: '#f2f0ea', churchShade: '#d4d0c6', churchRoof: '#4f8a64', churchDome: '#3f7a56', gold: '#d8b040', decor: '#b8604a',
  gate: '#efe4cc', gateShade: '#cfc2a6', gateDark: '#5a5048',
  granite: '#6a5e5a', bronze: '#4a4438', bronzeHi: '#6a604c',
  snow: '#eef2f6',
};
const NIGHT = {
  hillFar: '#141a2a', hillFarDark: '#111624', farCity: '#1e2030', farCityDark: '#181a28',
  bldg: '#2a2a36', bldg2: '#2c2832', bldg3: '#262a34', bldgShade: '#1e1e28', roof: '#1a1a22', win: '#1a1622',
  tree: '#141c1c', treeDark: '#101616',
  bridge: '#4a4a52', bridgeShade: '#36363e', bridgeDark: '#22222a', pylon: '#5a5a62',
  bank: '#2a2a32', bankDark: '#1e1e26',
  church: '#9a9890', churchShade: '#7a786e', churchRoof: '#2a3a32', churchDome: '#243a2e', gold: '#a8883a', decor: '#5a3430',
  gate: '#a89e8a', gateShade: '#888070', gateDark: '#1a1820',
  granite: '#222026', bronze: '#2a2622', bronzeHi: '#3a3428',
  snow: '#5a6478',
};
// Сибирская осень: берёзы и тополя на набережных желтеют в сентябре
const AUTUMN = { day: { tree: '#c89a3a', treeDark: '#a07028' }, night: { tree: '#201c14', treeDark: '#1a1610' } };
// Зима: снег на крышах и склонах, деревья в инее
const WINTER = {
  day: { tree: '#b4bcc4', treeDark: '#9aa2ac', hillFar: '#c4ccd8', hillFarDark: '#b4bccb', churchRoof: '#e4eaf0', roof: '#dfe4ea' },
  night: { tree: '#2a2e38', treeDark: '#22262e', hillFar: '#20263a', churchRoof: '#3a4252', roof: '#30364a' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

const BASE = 164; // линия правого берега (верх гранитной стенки)
const DECK = 148; // верх полотна Глазковского моста
const PIERS = [18, 52, 86, 120, 154]; // пять речных опор, четыре арочных пролёта

// Холмы за городом на северо-востоке
const hillY = (x) => Math.round(141 + Math.sin(x * 0.021) * 3 + Math.sin(x * 0.007 + 1) * 3);

function house(R, L, q, winter, x, base, w, h, cols = ['bldg', 'bldg2', 'bldg3']) {
  const top = base - h, k = q();
  R(cols[(k * cols.length) | 0], x, top, w, h); R('bldgShade', x + w - 1, top, 1, h);
  R('roof', x - 1, top - 1, w + 2, 1); if (winter) R('snow', x - 1, top - 2, w + 2, 1);
  for (let yy = top + 2; yy < base - 1; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) { R('win', xx, yy, 1, 1); if (q() < 0.55) L(xx, yy, 'win'); }
}
function tree(R, q, x, base, h) {
  R(q() < 0.5 ? 'tree' : 'treeDark', x - 1, base - h, 3, h - 1); R('treeDark', x, base - 1, 1, 1);
}

export function drawFar({ winter, L, R }) {
  const q = rng(1661); // свой генератор: раскладка не зависит от чисел движка

  // --- холмы на горизонте
  for (let x = 0; x < W; x++) { const y = hillY(x); R(x % 9 ? 'hillFar' : 'hillFarDark', x, y, 1, 168 - y); }

  // --- дальняя застройка центра за Нижней набережной (2–3 км)
  for (let x = 150; x < 300;) {
    const w = 3 + ((q() * 5) | 0), h = 3 + ((q() * 6) | 0);
    R(q() < 0.5 ? 'farCity' : 'farCityDark', x, BASE - 1 - h, w, h);
    if (q() < 0.5) L(x + 1, BASE - h + 1, 'win');
    x += w + ((q() * 2) | 0);
  }
  // левый берег вниз по течению, за мостом
  for (let x = 0; x < 150;) {
    const w = 3 + ((q() * 5) | 0), h = 2 + ((q() * 5) | 0);
    R(q() < 0.5 ? 'farCity' : 'farCityDark', x, 160 - h, w, h);
    if (q() < 0.4) L(x + 1, 160 - h + 1, 'win');
    x += w + 1 + ((q() * 3) | 0);
  }
  R('bankDark', 0, 160, 150, 8);

  // --- Спасская церковь (1706–1710): белый четверик, колокольня со шпилем (1758–1762)
  {
    const x = 218;
    R('church', x, 150, 13, 13); R('churchShade', x + 11, 150, 2, 13);
    R('churchRoof', x - 1, 148, 15, 2); R('churchRoof', x + 2, 146, 9, 2);
    R('church', x + 5, 141, 4, 5); R('churchDome', x + 5, 139, 4, 2); R('churchDome', x + 6, 138, 2, 1); R('gold', x + 6, 135, 1, 3);
    for (const wx of [x + 2, x + 6, x + 9]) { R('win', wx, 153, 1, 3); L(wx, 153, 'win', null, 0.3); }
    // колокольня с тонким шпилем
    R('church', x + 15, 140, 6, 23); R('churchShade', x + 20, 140, 1, 23);
    R('churchRoof', x + 14, 139, 8, 1); R('church', x + 16, 133, 4, 6); R('win', x + 17, 135, 2, 2);
    R('churchRoof', x + 16, 131, 4, 2); for (let i = 0; i < 9; i++) R(i < 7 ? 'churchRoof' : 'gold', x + 17 + (i > 4 ? 1 : 0), 122 + i, i > 4 ? 1 : 2, 1);
    R('gold', x + 18, 119, 1, 3); R('gold', x + 17, 120, 3, 1);
    R('church', x + 22, 155, 4, 8); R('churchRoof', x + 22, 154, 4, 1); // трапезная
  }
  // --- Богоявленский собор (1718–1746): сибирское барокко, зелёные главы, колокольня 1812–1815
  {
    const x = 246;
    R('church', x, 148, 20, 15); R('churchShade', x + 17, 148, 3, 15);
    for (let i = 0; i < 20; i += 2) R('decor', x + i, 150, 1, 1); // изразцовый пояс
    for (let i = 1; i < 20; i += 3) R('decor', x + i, 157, 1, 1);
    R('churchRoof', x - 1, 146, 22, 2);
    R('church', x + 6, 141, 8, 5); R('churchRoof', x + 5, 140, 10, 1);
    const dome = (cx, top, s) => { // луковичная глава с крестом
      R('churchDome', cx - s, top + 2, s * 2 + 1, 2); R('churchDome', cx - s + 1, top + 1, s * 2 - 1, 1); R('churchDome', cx, top, 1, 1);
      R('gold', cx, top - 3, 1, 3); R('gold', cx - 1, top - 2, 3, 1);
    };
    dome(x + 10, 135, 3); R('church', x + 9, 138, 3, 2);
    dome(x + 3, 142, 1); dome(x + 17, 142, 1);
    for (const wx of [x + 2, x + 6, x + 13, x + 16]) { R('win', wx, 152, 1, 3); L(wx, 152, 'win', null, 0.3); }
    // колокольня
    const b = x + 22;
    R('church', b, 140, 7, 23); R('churchShade', b + 6, 140, 1, 23); R('decor', b, 146, 7, 1);
    R('church', b + 1, 133, 5, 7); R('win', b + 2, 135, 3, 2); R('churchRoof', b, 132, 7, 1);
    dome(b + 3, 127, 2);
  }
  // --- Московские ворота (1813, разобраны в 1928, воссозданы в 2011): триумфальная арка, 19 м
  {
    const x = 280;
    R('gate', x, 151, 14, 12); R('gateShade', x + 12, 151, 2, 12);
    R('gateDark', x + 5, 155, 4, 8); R('gateDark', x + 6, 154, 2, 1); // проезд
    R('gateShade', x, 151, 14, 1); R('gate', x + 2, 147, 10, 4); R('gateShade', x + 2, 147, 10, 1);
    R('gate', x + 4, 144, 6, 3); R('gate', x + 5, 141, 4, 3); R('gold', x + 6, 138, 2, 3);
    R('gateShade', x + 1, 152, 1, 11); R('gateShade', x + 10, 152, 1, 11);
  }
  // деревья Нижней набережной перед храмами
  for (let x = 212; x < 300; x += 4) if (q() < 0.6) tree(R, q, x, BASE, 3 + ((q() * 3) | 0));

  // --- Верхняя набережная: бульвар Гагарина, дома ближе к нам и крупнее
  for (let x = 300; x < W;) {
    const w = 8 + ((q() * 8) | 0), h = 9 + ((q() * 6) | 0) + Math.round((x - 300) / 40);
    if (x > 420 && x < 448) { x = 448; continue; } // сквер у памятника
    house(R, L, q, winter, x, BASE - 1, w, h);
    x += w + 1 + ((q() * 3) | 0);
  }
  for (let x = 302; x < W; x += 3) if (q() < 0.7) tree(R, q, x, BASE, 4 + ((q() * 5) | 0));
  // Александровский сквер: деревья вокруг памятника
  for (const tx of [418, 422, 444, 448, 452]) tree(R, q, tx, BASE - 1, 9 + ((q() * 4) | 0));

  // --- памятник Александру III (1908, восстановлен в 2003): гранитный постамент, бронзовая фигура
  {
    const x = 433;
    R('granite', x - 6, 160, 13, 4); R('granite', x - 4, 154, 9, 6); R('bronzeHi', x - 4, 154, 9, 1);
    R('granite', x - 3, 152, 7, 2);
    R('bronze', x - 1, 145, 3, 7); R('bronzeHi', x - 1, 145, 1, 7); R('bronze', x - 1, 143, 3, 2); // фигура
    R('bronze', x + 2, 147, 1, 4); R('bronze', x - 2, 146, 1, 3); // рука на сабле, плечо
    L(x - 7, 158, 'flood', '#ffe6b8', 0); L(x + 7, 158, 'flood', '#ffe6b8', 0);
  }

  // --- гранитная стенка правого берега с фонарями
  R('bank', 160, BASE, W - 160, 2); R('bankDark', 160, BASE + 2, W - 160, 2);
  for (let x = 166; x < W; x += 12) { R('bankDark', x, BASE - 4, 1, 4); L(x, BASE - 5, 'lamp', '#ffd88a', 0); }

  // --- Глазковский мост (1936): четыре железобетонные арки, пять речных опор
  R('bridge', 0, DECK, 168, 3); R('pylon', 0, DECK - 1, 168, 1); R('bridgeDark', 0, DECK + 3, 168, 1);
  for (let x = 0; x < 168; x += 2) R('bridgeShade', x, DECK - 2, 1, 1); // перила
  for (let i = 0; i < PIERS.length - 1; i++) {
    const a = PIERS[i] + 2, b = PIERS[i + 1] - 2, mid = (a + b) / 2, half = (b - a) / 2;
    for (let x = a; x <= b; x++) {
      const k = (x - mid) / half, top = Math.round(DECK + 5 + (BASE - DECK - 3) * k * k);
      R('bridgeShade', x, top, 1, 2); // арка
      if ((x - a) % 3 === 0 && top > DECK + 4) R('bridgeShade', x, DECK + 4, 1, top - DECK - 4); // стойки над аркой
    }
  }
  for (const px of PIERS) { R('bridge', px - 2, DECK + 3, 5, 168 - DECK - 3); R('bridgeDark', px + 2, DECK + 3, 1, 168 - DECK - 3); }
  for (const px of [PIERS[0], PIERS[PIERS.length - 1]]) { // пилоны на крайних речных опорах
    R('pylon', px - 2, DECK - 11, 5, 10); R('bridgeShade', px + 2, DECK - 11, 1, 10); R('pylon', px - 3, DECK - 12, 7, 1);
  }
  R('bridge', 160, DECK + 3, 8, BASE - DECK - 3); // устой на правом берегу
  for (let x = 4; x < 168; x += 8) L(x, DECK - 3, 'lamp', '#ffd070', 0);
}

// ---------- ночь: подсветка храмов, ворот и моста ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const glow = (cx, cy, r, a, c = '255,236,200') => {
    const gr = g.createRadialGradient(cx, cy, 1, cx, cy, r);
    gr.addColorStop(0, `rgba(${c},${a * nightF})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  glow(230, 146, 22, 0.22); glow(258, 146, 24, 0.22); glow(287, 152, 14, 0.25, '255,214,150');
  glow(433, 150, 12, 0.2, '255,214,150');
  // контурная подсветка фасадов
  g.globalAlpha = nightF * 0.55; g.fillStyle = '#fff4dc';
  g.fillRect(218, 150, 13, 1); g.fillRect(233, 140, 6, 1); g.fillRect(246, 148, 20, 1); g.fillRect(268, 140, 7, 1);
  g.fillStyle = '#ffd890'; g.fillRect(280, 151, 14, 1); g.fillRect(282, 147, 10, 1); g.fillRect(285, 155, 4, 1);
  g.globalAlpha = nightF * 0.8; g.fillStyle = '#ffe2a0'; g.fillRect(235, 119, 1, 3); g.fillRect(256, 132, 1, 3); // кресты
  // фонари вдоль арок моста отражают тёплый свет
  g.globalAlpha = nightF * 0.6; g.fillStyle = '#ffc860';
  for (let x = 2; x < 166; x += 3) g.fillRect(x, DECK + 3, 1, 1);
  g.globalAlpha = 1;
}

// Машины по Глазковскому мосту
const LANES = [{ x0: 0, x1: 168, y: DECK - 1 }, { x0: 0, x1: 168, y: DECK - 1 }];
export function drawAboveLate(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }

// ---------- вода: пар над Ангарой, набережная ----------
export function drawBoats(ctx, env, dayF, t) {
  if (env.winter && env.weather.temp <= -10) drawSteam(ctx, env, dayF, t, Math.min(1, (-env.weather.temp - 8) / 18) * 0.55);
  drawPromenade(ctx, env, dayF, t);
}

// Ангара ниже ГЭС не замерзает: в мороз над тёплой водой поднимается туман («парение»)
function drawSteam(ctx, env, dayF, t, k, top = 160) {
  const c = mixHex('#3a4256', '#eef2f6', dayF), r = rng(77);
  ctx.fillStyle = c;
  for (let i = 0; i < 90; i++) {
    const y0 = 168 + ((r() * 30) | 0), w = 8 + ((r() * 26) | 0), sp = 2 + r() * 4, rise = r() * 4;
    const ph = (t * 0.05 + r()) % 1, y = Math.round(y0 - ph * (y0 - top) * 0.6 - rise);
    const x = Math.round(((r() * (W + 60) - sp * t) % (W + 60) + W + 60) % (W + 60) - 30); // туман сносит течением влево
    ctx.globalAlpha = k * 0.5 * Math.sin(ph * Math.PI);
    ctx.fillRect(x, y, w, 1 + ((r() * 2) | 0));
  }
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике: фигурка байкальской нерпы и кедровая шишка
export function drawSill(R, SILL) {
  const x = 252, y = SILL;
  // нерпа: серебристо-серое веретено, круглая голова, большие тёмные глаза
  R('#8a8e98', x, y - 4, 12, 4); R('#a4a8b2', x + 1, y - 5, 10, 1); R('#6e727c', x, y - 1, 12, 1);
  R('#8a8e98', x + 8, y - 8, 6, 5); R('#a4a8b2', x + 9, y - 9, 4, 1);
  R('#14141a', x + 9, y - 7, 1, 1); R('#14141a', x + 12, y - 7, 1, 1); R('#3a3a44', x + 11, y - 5, 1, 1);
  R('#6e727c', x - 2, y - 2, 2, 1); R('#6e727c', x - 3, y - 3, 1, 1); // ласты
  R('#6e727c', x + 5, y - 1, 3, 1);
  // кедровая шишка
  const s = x + 17;
  R('#7a4a24', s, y - 7, 5, 6); R('#9a6232', s + 1, y - 8, 3, 1); R('#5a3418', s + 1, y - 1, 3, 1);
  for (const [dx, dy] of [[0, -6], [2, -6], [4, -6], [1, -4], [3, -4], [0, -2], [2, -2], [4, -2]]) R('#b07a42', s + dx, y + dy, 1, 1);
}

// ---------- набережная: ларьки ----------
export const KINDS_IRK = {
  buuzy: { awning: ['#2a5aa0', '#f4f0e0'], counter: '#d8d0c0', goods: [[1, '#f8f4ea'], [4, '#f8f4ea'], [7, '#f8f4ea'], [10, '#f8f4ea']], steam: true },
  nuts: { awning: ['#6a4a2a', '#e8d8b0'], counter: '#8a5a34', goods: [[1, '#7a4a24'], [4, '#a06a3a'], [7, '#7a4a24'], [10, '#5a3a1e']], steam: false },
};
export const STALL_X = { a: 150, b: 232, c: 278 };
export function stallKinds(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  const warm = mo >= 6 && mo <= 8;
  if (!(warm ? h >= 10 && h < 22 : h >= 11 && h < 19)) return {};
  const k = { b: 'buuzy' };
  if (mo >= 9 || mo <= 3) k.a = 'nuts'; // урожай кедрового ореха — с конца лета
  k.c = warm ? 'icecream' : 'tea';
  return k;
}
export function stalls(env) { return Object.values(stallKinds(env)); }
function drawPromenade(ctx, env, dayF, t) {
  const k = stallKinds(env);
  const list = Object.keys(k).map((slot) => ({ kind: KINDS_IRK[k[slot]] || k[slot], x: STALL_X[slot] }));
  streetPromenade(ctx, env, dayF, t, list);
}

// ---------- секреты Иркутска ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
export const isCityDay = (local) => local.getUTCMonth() === 5 && local.getUTCDate() <= 8 && [0, 6].includes(local.getUTCDay());

export const SECRETS = [
  {
    id: 'steam', name: 'Ангара парит', layer: 'street',
    hint: 'В сильный мороз, утром, над рекой иногда встаёт густой белый туман — а вода под ним не замерзает.',
    found: 'Ниже Иркутской ГЭС Ангара не замерзает даже в сорокаградусный мороз: турбины пропускают глубинную воду, которая теплее воздуха, и течение быстрое — лёд не успевает встать. В морозы над тёплой водой поднимается туман, а деревья на берегах обрастают инеем.',
    state(env) {
      const mo = month(env), h = env.local.getUTCHours();
      if (!env.forced && !((mo === 12 || mo <= 2) && env.weather.temp <= -20 && h >= 7 && h < 12)) return null;
      if (!inWin(env, 5400, 900, 400)) return null;
      return { x: 220, y: 156, w: 146, h: 30 };
    },
    draw(ctx, env, st, dayF) {
      drawSteam(ctx, env, dayF, env.ms / 1000, 1, 140);
      const c = mixHex('#3a4256', '#eef2f6', dayF), tt = env.ms / 1000;
      ctx.fillStyle = c;
      for (let y = 156; y < 196; y++) {
        const a = (1 - Math.abs(y - 172) / 26) * 0.55;
        for (let x = 0; x < W; x += 3) {
          const w = Math.sin(x * 0.04 - tt * 0.15 + y * 0.2) + Math.sin(x * 0.013 + tt * 0.07);
          if (w < -0.2) continue;
          ctx.globalAlpha = a; ctx.fillRect(x, y, 3, 1);
        }
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'ducks', name: 'Утки на зимней Ангаре', layer: 'street',
    hint: 'Зимним днём по тёмной воде, среди пара, течением сносит маленькую стайку.',
    found: 'Незамерзающая Ангара — зимовка для уток. В марте 2025 года орнитологи насчитали в Иркутске рекордные 949 крякв, а у истока Ангары — 603 гоголя: тёплая зима и подкормка горожан удержали птиц от перелёта.',
    state(env) {
      const mo = month(env);
      if (!env.forced && (env.sun.alt < 1 || !(mo >= 11 || mo <= 3))) return null;
      if (!inWin(env, 1800, 90, 300)) return null;
      const p = phase(env, 1800, 90, 300); return { x: Math.round(350 - p * 120), y: 180, w: 26, h: 5 };
    },
    draw(ctx, env, st, dayF) {
      const body = mixHex('#1e1c20', '#7a6448', dayF), head = mixHex('#14181a', '#2a6a3a', dayF), bill = mixHex('#3a3020', '#e8b830', dayF);
      for (const [dx, dy, male] of [[0, 1, 1], [6, 0, 0], [11, 2, 1], [17, 0, 0], [22, 1, 1]]) {
        const x = st.x + dx, y = st.y + dy, bob = Math.sin(env.ms / 600 + dx) > 0.7 ? 1 : 0;
        ctx.fillStyle = body; ctx.fillRect(x, y + 2 + bob, 4, 2); ctx.fillRect(x + 3, y + 1 + bob, 1, 1);
        ctx.fillStyle = male ? head : body; ctx.fillRect(x - 1, y + bob, 2, 2);
        ctx.fillStyle = bill; ctx.fillRect(x - 2, y + 1 + bob, 1, 1);
        ctx.globalAlpha = 0.35; ctx.fillStyle = mixHex('#3a4050', '#e8eef2', dayF); ctx.fillRect(x + 4, y + 4, 4, 1); ctx.globalAlpha = 1;
      }
    },
  },
  {
    id: 'babr', name: 'Бабр с соболем', layer: 'street',
    hint: 'Иногда по набережной проходит человек с белым флагом. Присмотритесь, кто на нём.',
    found: 'На флаге Иркутска — бабр с соболем в зубах на зелёной земле и синяя полоса внизу. «Бабр» — старое сибирское название тигра. В 1878 году в описании губернского герба его по ошибке назвали «бобром», и художники 119 лет рисовали странного зверя с перепончатыми лапами; ошибку исправили в 1997 году. Бронзовый бабр с 2012 года стоит в 130-м квартале.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (h < 9 || h >= 21 || ['rain', 'storm'].includes(env.weather.kind))) return null;
      const cd = isCityDay(env.local);
      if (!(cd ? inWin(env, 1200, 120, 500) : inWin(env, 5400, 90, 1700))) return null;
      const p = phase(env, cd ? 1200 : 5400, cd ? 120 : 90, cd ? 500 : 1700);
      return { x: Math.round(226 + p * 110), y: 189, w: 12, h: 22 };
    },
    draw(ctx, env, st, dayF) {
      const x = st.x, y = 210, dim = (c) => mixHex('#141018', c, 0.3 + dayF * 0.7), wave = Math.sin(env.ms / 250) > 0 ? 1 : 0;
      drawPerson(ctx, x, y, 0.3, dayF, env.ms / 1000, false, env.winter, true);
      ctx.fillStyle = dim('#4a3a2a'); ctx.fillRect(x + 2, y - 20, 1, 15); // древко
      ctx.fillStyle = dim('#f4f4f0'); ctx.fillRect(x + 3, y - 20 + wave, 9, 6); // белое полотнище
      ctx.fillStyle = dim('#2a5ab0'); ctx.fillRect(x + 3, y - 16 + wave, 9, 2); ctx.fillRect(x + 12, y - 16 + wave, 1, 1); // синяя полоса с косицей
      ctx.fillStyle = dim('#3a8a3a'); ctx.fillRect(x + 4, y - 17 + wave, 4, 1); // зелёная земля
      ctx.fillStyle = dim('#1a1a1e'); ctx.fillRect(x + 4, y - 19 + wave, 4, 2); ctx.fillRect(x + 7, y - 20 + wave, 1, 1); // бабр
      ctx.fillStyle = dim('#c8342a'); ctx.fillRect(x + 8, y - 19 + wave, 1, 1); // червлёный соболь в зубах
    },
  },
  {
    id: 'tram', name: 'Трамвай на Глазковском мосту', layer: 'sky',
    hint: 'Вечером по мосту иногда проползает вагон с жёлтыми окнами — не машина.',
    found: 'Трамвайная линия на Глазковском мосту появилась в 1947 году, двухпутной стала к 1949-му. Трамваи и сейчас ходят по мосту от центра к вокзалу на левом берегу.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (h < 17 || h >= 23)) return null;
      if (!inWin(env, 1500, 45, 900)) return null;
      const p = phase(env, 1500, 45, 900); return { x: Math.round(160 - p * 160), y: DECK - 6, w: 14, h: 6 };
    },
    draw(b, env, st, dayF) {
      const { x, y } = st, nightF = 1 - dayF;
      b.fillStyle = mixHex('#3a1e1e', '#c83a32', dayF); b.fillRect(x, y + 1, 14, 5);
      b.fillStyle = mixHex('#4a4440', '#efe6d0', dayF); b.fillRect(x, y + 1, 14, 1); b.fillRect(x + 1, y + 2, 12, 2);
      b.fillStyle = mixHex('#2a2a30', '#3a4a5a', dayF); for (let i = 0; i < 4; i++) b.fillRect(x + 2 + i * 3, y + 2, 2, 2);
      b.fillStyle = '#2a2a30'; b.fillRect(x + 5, y - 2, 1, 3); b.fillRect(x + 3, y - 2, 4, 1); // пантограф
      if (nightF > 0.2) { b.globalAlpha = nightF; b.fillStyle = '#ffd98a'; for (let i = 0; i < 4; i++) b.fillRect(x + 2 + i * 3, y + 2, 2, 2); b.fillStyle = '#fff4c8'; b.fillRect(x - 1, y + 4, 1, 1); b.globalAlpha = 1; }
    },
  },
];

// События по новостям (data/events.json): fireworks — салют над центром
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 290, 40, dayF); }
