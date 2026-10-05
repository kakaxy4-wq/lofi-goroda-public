// Владимир: вид из заречной поймы, с правого (южного) берега Клязьмы, на север-северо-запад —
// на высокий левый берег со старым городом. Классическая «речная» панорама Владимира:
// соборы на гребне холма, под склоном железная дорога и вокзал, справа мост через Клязьму.
// Слева направо: водонапорная башня, Золотые ворота (сжато — в жизни они глубже в городе),
// колокольня и Успенский собор, Присутственные места («Палаты»), Дмитриевский собор,
// Богородице-Рождественский монастырь, мост через Клязьму.

import { rng, mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks, drawPerson } from '../../engine/street.js';

const DAY = {
  far: '#a4a8b4', farDark: '#8e94a2', farRoof: '#7a8090',
  hill: '#6f8a5a', hillDark: '#5a7348', tree: '#3e6b3d', treeDark: '#2f5531',
  stone: '#f2eee2', stoneShade: '#d4cebe', carve: '#c8c0ae',
  gold: '#e4b848', goldDark: '#b88a30',
  brick: '#a8503c', brickDark: '#84402e', trim: '#f0e8d8', roofDark: '#4a5a52',
  red: '#b4503e', redShade: '#8e3e30', win: '#5a5462',
  station: '#d8d2c4', stationShade: '#b0aa9c',
  rail: '#5a524c', railBed: '#7a7068', wire: '#4a4e48',
  bridge: '#d8d8d2', bridgeDark: '#aeaea8',
  shore: '#7a8a52', shoreDark: '#5a6a40', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a',
  hill: '#141c1c', hillDark: '#101616', tree: '#151d1f', treeDark: '#101719',
  stone: '#a09682', stoneShade: '#80786a', carve: '#766e60',
  gold: '#c8a040', goldDark: '#8a6a2a',
  brick: '#6a3428', brickDark: '#52281e', trim: '#8a8070', roofDark: '#1a2220',
  red: '#6e3228', redShade: '#56261e', win: '#1a1420',
  station: '#4a4a52', stationShade: '#3a3a42',
  rail: '#1a1a20', railBed: '#24222a', wire: '#1a1c22',
  bridge: '#6a6a72', bridgeDark: '#4a4a52',
  shore: '#161c18', shoreDark: '#101412', snow: '#6a7488',
};
const AUTUMN = { day: { tree: '#c08a30', treeDark: '#946026', hill: '#8a8a4a', hillDark: '#6e6e3a', shore: '#8a8248' }, night: { tree: '#221c16', treeDark: '#1a1511' } };
const WINTER = {
  day: { tree: '#5d5853', treeDark: '#48443f', hill: '#e2e8ee', hillDark: '#c8d0da', shore: '#e8eef4', shoreDark: '#c4ccd6' },
  night: { tree: '#1a1a1e', treeDark: '#141418', hill: '#2c3244', hillDark: '#242a3a', shore: '#2a3040', shoreDark: '#222838' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Гребень высокого берега: y верхней кромки склона. Справа берег опускается к мосту.
const crest = (x) => (x < 392 ? 132 : x < 470 ? 132 + (x - 392) * 0.28 : 154);
const RAIL = 155; // полотно железной дороги под склоном

// Шлемовидный купол: строки ширины сверху вниз
function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 4) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}
// Крест над главой
function cross(R, cx, top) { R('gold', cx, top, 1, 6); R('gold', cx - 1, top + 2, 3, 1); }
// Закомары — полукруглые завершения стен
function zakomary(R, x0, y, bays, bw) {
  for (let i = 0; i < bays; i++) {
    const cx = x0 + i * bw + (bw >> 1);
    [bw - 8, bw - 4, bw - 2, bw].forEach((w, k) => R('stone', cx - (w >> 1), y + k, Math.max(1, w), 1));
  }
}

export function drawFar({ g, P, winter, r, L, R }) {
  // город за гребнем: низкие дома старого центра
  for (let x = 0; x < 400;) {
    const w = 5 + ((r() * 10) | 0), h = 3 + ((r() * 9) | 0), top = Math.round(crest(x)) - h;
    R(r() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    R('farRoof', x, top, w, 1);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < top + h - 1; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.35) L(xx, yy, 'win');
    x += w;
  }

  // склон высокого берега до железной дороги
  for (let x = 0; x < W; x++) {
    const y = Math.round(crest(x));
    R('hill', x, y, 1, RAIL - y);
    if (RAIL - y > 10) R('hillDark', x, y + 10, 1, RAIL - y - 10);
  }

  // водонапорная башня на Козловом валу (1912): кирпич, остеклённая галерея, шатёр
  R('brick', 32, 108, 12, 24); R('brickDark', 41, 108, 3, 24);
  R('trim', 32, 116, 12, 1); R('trim', 32, 124, 12, 1);
  R('win', 36, 111, 2, 3); R('win', 36, 119, 2, 3); R('win', 36, 126, 2, 4);
  R('trim', 30, 101, 16, 7); R('stoneShade', 30, 107, 16, 1);
  for (let i = 0; i < 5; i++) { R('win', 31 + i * 3, 103, 2, 3); L(31 + i * 3, 104, 'win'); }
  for (let i = 0; i < 8; i++) { const w = 2 + i * 2; R('roofDark', 38 - (w >> 1), 93 + i, w, 1); }
  R('roofDark', 37, 90, 2, 3); R('gold', 38, 86, 1, 4);
  if (winter) R('snow', 32, 99, 12, 1);
  L(38, 128, 'flood', '#ffd9a0', 0);

  // Золотые ворота: белокаменная арка, круглые башни-контрфорсы (1795), надвратная церковь
  for (const bx of [57, 89]) { R('stone', bx, 119, 6, 13); R('stone', bx + 1, 118, 4, 1); R('stoneShade', bx + 4, 119, 2, 13); }
  R('stone', 62, 113, 28, 19); R('stoneShade', 84, 113, 6, 19);
  R('win', 72, 118, 8, 14); R('win', 73, 117, 6, 1);
  R('stoneShade', 62, 113, 28, 1);
  R('stone', 70, 105, 12, 8); R('stoneShade', 78, 105, 4, 8); R('win', 73, 107, 2, 3); R('win', 77, 107, 2, 3);
  R('roofDark', 69, 104, 14, 1);
  R('stone', 74, 101, 4, 3);
  dome(R, 76, 97, [2, 4, 6, 6], 'gold', 'goldDark');
  cross(R, 76, 91);
  if (winter) { R('snow', 62, 112, 28, 1); R('snow', 69, 103, 14, 1); }
  L(76, 130, 'flood', '#ffe0a8', 0);

  // колокольня Успенского собора (1810): четыре яруса, золочёный шпиль
  const tiers = [[116, 100, 14, 32], [118, 90, 10, 10], [119, 82, 8, 8], [120, 76, 6, 6]];
  for (const [x, y, w, h] of tiers) {
    R('stone', x, y, w, h); R('stoneShade', x + w - 2, y, 2, h); R('trim', x - 1, y, w + 2, 1);
    R('win', x + (w >> 1) - 1, y + 2, 2, Math.min(5, h - 3));
  }
  for (let i = 0; i < 18; i++) { const w = Math.max(1, Math.round(4 - i * 0.2)); R(i % 3 ? 'gold' : 'goldDark', 123 - (w >> 1), 58 + i, w, 1); }
  R('gold', 123, 54, 1, 4);
  if (winter) R('snow', 115, 100, 16, 1);
  L(123, 128, 'flood', '#ffe0a8', 0);

  // Успенский собор: белый камень, пять золотых шлемовидных глав
  R('stone', 140, 108, 70, 24); R('stoneShade', 200, 108, 10, 24);
  zakomary(R, 140, 104, 5, 14);
  R('stoneShade', 140, 118, 70, 1);
  for (let x = 142; x < 208; x += 3) R('carve', x, 119, 1, 3);
  for (let i = 0; i < 5; i++) R('win', 140 + i * 14 + 6, 124, 2, 5);
  // задние малые главы, за ними — передние
  for (const cx of [157, 193]) { R('stoneShade', cx - 3, 97, 6, 7); dome(R, cx, 92, [1, 3, 5, 6, 7], 'goldDark', 'goldDark'); }
  for (const cx of [150, 200]) { R('stone', cx - 3, 97, 6, 7); R('win', cx - 1, 99, 1, 3); dome(R, cx, 92, [1, 3, 5, 6, 7], 'gold', 'goldDark'); cross(R, cx, 86); }
  R('stone', 169, 88, 12, 16); R('stoneShade', 178, 88, 3, 16);
  for (let x = 171; x < 180; x += 3) R('win', x, 92, 1, 5);
  dome(R, 175, 79, [1, 3, 5, 7, 9, 11, 12, 12, 13], 'gold', 'goldDark');
  cross(R, 175, 73);
  if (winter) { for (const cx of [150, 200]) R('snow', cx - 3, 96, 6, 1); }
  L(175, 128, 'flood', '#ffe0a8', 0); L(150, 128, 'flood', '#ffe0a8', 0); L(200, 128, 'flood', '#ffe0a8', 0);

  // Здание Присутственных мест (1785–1790), ныне музейный центр «Палаты»
  R('red', 222, 116, 48, 16); R('redShade', 262, 116, 8, 16);
  R('roofDark', 223, 112, 46, 3); R('trim', 220, 115, 52, 1);
  for (let x = 224; x < 270; x += 6) R('trim', x, 116, 1, 16);
  for (let x = 226; x < 266; x += 6) { R('win', x, 119, 2, 3); R('win', x, 126, 2, 3); L(x, 120, 'win'); L(x + 1, 127, 'win'); }
  if (winter) R('snow', 223, 112, 46, 1);

  // Дмитриевский собор (1194–1197): одна глава-шлем, резьба по белому камню
  R('stone', 284, 106, 26, 26); R('stoneShade', 304, 106, 6, 26);
  zakomary(R, 284, 102, 3, 9);
  for (let y = 108; y < 117; y += 2) for (let x = 286 + ((y >> 1) & 1); x < 308; x += 2) R('carve', x, y, 1, 1);
  R('stoneShade', 284, 118, 26, 1);
  for (let x = 286; x < 309; x += 3) R('carve', x, 119, 1, 3);
  for (const x of [288, 296, 304]) R('win', x, 124, 2, 5);
  R('stone', 293, 92, 8, 10); R('stoneShade', 299, 92, 2, 10); R('win', 295, 95, 1, 4); R('win', 298, 95, 1, 4);
  dome(R, 297, 85, [1, 3, 5, 7, 9, 10, 10], 'gold', 'goldDark');
  cross(R, 297, 79);
  L(297, 128, 'flood', '#ffe0a8', 0);

  // Богородице-Рождественский монастырь: стена и восстановленный собор
  R('stone', 330, 124, 62, 8); R('stoneShade', 330, 131, 62, 1);
  for (let x = 330; x < 392; x += 4) R('stone', x, 122, 2, 2);
  for (const tx of [328, 388]) { R('stone', tx, 118, 6, 14); R('stoneShade', tx + 4, 118, 2, 14); R('roofDark', tx, 116, 6, 2); }
  R('stone', 348, 108, 24, 16); R('stoneShade', 366, 108, 6, 16);
  zakomary(R, 348, 104, 3, 8);
  R('stone', 356, 96, 8, 10); R('stoneShade', 362, 96, 2, 10);
  dome(R, 360, 90, [1, 3, 5, 7, 9, 9], 'gold', 'goldDark');
  cross(R, 360, 84);
  if (winter) { R('snow', 330, 122, 62, 1); R('snow', 328, 116, 6, 1); R('snow', 388, 116, 6, 1); }
  L(360, 128, 'flood', '#ffe0a8', 0);

  // деревья на склоне
  for (let i = 0; i < 300; i++) {
    const x = (r() * (W + 4)) | 0, top = Math.round(crest(x)) + 2, span = RAIL - 4 - top;
    if (span < 3) continue;
    const y = top + ((r() * span) | 0), h = 3 + ((r() * 4) | 0);
    R(r() < 0.5 ? 'tree' : 'treeDark', x, y - h + 3, 3 + ((r() * 3) | 0), h);
  }

  // вокзал у подножия холма
  R('station', 246, 145, 46, 10); R('stationShade', 286, 145, 6, 10); R('roofDark', 245, 144, 48, 1);
  for (let x = 249; x < 288; x += 4) { R('win', x, 148, 2, 3); L(x, 149, 'win'); }
  if (winter) R('snow', 245, 143, 48, 1);
  for (let x = 250; x < 292; x += 14) L(x, 143, 'lamp', '#ffe2a0', 0);

  // железная дорога: полотно, рельсы, опоры контактной сети
  R('railBed', 0, RAIL, W, 3); R('rail', 0, RAIL, W, 1);
  R('wire', 0, 146, W, 1);
  for (let x = 6; x < W; x += 26) R('wire', x, 146, 1, 9);

  // берег у воды
  R('shore', 0, 158, W, 6); R('shoreDark', 0, 164, W, 4);

  // мост через Клязьму: арочные пролёты, фонари
  R('bridgeDark', 380, 148, 100, 1); R('bridge', 380, 149, 100, 3);
  for (let i = 0; i < 4; i++) {
    const x0 = 384 + i * 26;
    R('bridgeDark', x0, 152, 3, 16);
    for (let dx = 3; dx < 26; dx++) { const k = (dx - 14.5) / 11.5, ay = Math.round(154 + 11 * k * k); R('bridge', x0 + dx, 152, 1, Math.max(0, ay - 152)); }
  }
  if (winter) R('snow', 380, 148, 100, 1);
  for (let x = 384; x < 480; x += 12) { R('bridgeDark', x, 143, 1, 5); L(x, 142, 'lamp', '#ffe2a0', 0); }
}

// ---------- ночная подсветка: соборы на гребне ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const glow = (x, y, rad, rgbStr, a, box) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, `rgba(${rgbStr},${a * nightF})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
    g.fillStyle = gr; g.fillRect(box[0], box[1], box[2], box[3]);
  };
  glow(175, 104, 44, '255,214,150', 0.22, [128, 60, 96, 76]);   // Успенский
  glow(297, 108, 30, '255,214,150', 0.2, [264, 74, 66, 62]);    // Дмитриевский
  glow(76, 116, 22, '255,200,130', 0.16, [52, 90, 50, 44]);     // Золотые ворота
  // золото куполов поблёскивает в прожекторах
  g.globalAlpha = nightF * (0.6 + 0.2 * Math.sin(t * 0.7)); g.fillStyle = '#ffe8a8';
  for (const [x, y, h] of [[173, 81, 6], [148, 93, 3], [198, 93, 3], [295, 87, 4], [74, 98, 2], [358, 92, 3], [122, 62, 10]]) g.fillRect(x, y, 1, h);
  g.globalAlpha = 1;
}

// ---------- машины на мосту; байдарки летом; набережная на нашем берегу ----------
export function drawAboveLate(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
export function drawBoats(ctx, env, dayF, t) {
  drawKayak(ctx, env, dayF, t);
  streetPromenade(ctx, env, dayF, t, stalls(env).map((s) => ({ kind: STALL_KINDS[s.k] || s.k, x: s.x })));
}
const LANES = [{ x0: 378, x1: 484, y: 150 }]; // мост через Клязьму

// Клязьма — популярная река для байдарочных сплавов: летом по ней проплывают лодки
function drawKayak(ctx, env, dayF, t) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 8 || h >= 20) return;
  const p = ((env.ms / 1000 + 300) % 600) / 240;
  if (p >= 1) return;
  const x = Math.round(500 - p * 540), y = 184, paddle = Math.sin(t * 3) > 0 ? 1 : -1;
  ctx.fillStyle = mixHex('#2a2420', '#d8583a', dayF); ctx.fillRect(x, y + 3, 16, 2); ctx.fillRect(x + 1, y + 5, 14, 1);
  for (const px of [4, 10]) {
    drawPerson(ctx, x + px, y + 4, px === 4 ? 0.1 : 0.55, dayF, t, false, false, false);
    ctx.fillStyle = mixHex('#1a1a20', '#e8d8a0', dayF); ctx.fillRect(x + px - 2, y + 1 + paddle, 1, 2); ctx.fillRect(x + px + 3, y + 1 - paddle, 1, 2);
  }
  ctx.globalAlpha = 0.4; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x + 16, y + 6, 8, 1); ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — баночка варенья из владимирской вишни (справа от герани)
export function drawSill(R, SILL) {
  const x = 428;
  R('#b4aea2', x - 1, SILL, 14, 1);                            // тень
  R('#6a1422', x, SILL - 9, 12, 9); R('#8e1c2c', x + 1, SILL - 8, 3, 7); // банка с вареньем
  R('#c8d8e0', x, SILL - 9, 12, 1); R('#e8f0f4', x + 1, SILL - 7, 1, 4);  // стекло и блик
  R('#f0ece0', x - 1, SILL - 12, 14, 3);                       // крышка-салфетка
  for (let i = 0; i < 14; i += 2) R('#c8303a', x - 1 + i, SILL - 12, 1, 3); // в горошек
  R('#c8a050', x - 1, SILL - 10, 14, 1);                        // бечёвка
  R('#f4ecd8', x + 3, SILL - 6, 6, 3); R('#8e1c2c', x + 4, SILL - 5, 4, 1); // этикетка
}

// ---------- ларьки на набережной ----------
// Свои виды: вишня (владимирская вишня созревает в июле), огурцы (суздальский «праздник огурца»),
// муромские калачи — к чаю круглый год.
export const STALL_KINDS = {
  cherry: { awning: ['#a8243a', '#f4f0e8'], counter: '#8a5a34', goods: [[1, '#9a1a2a'], [4, '#c02a3a'], [8, '#9a1a2a']], steam: false },
  cucumber: { awning: ['#3a8a3a', '#f0ecd8'], counter: '#8a5a34', goods: [[1, '#3a7a2a'], [4, '#5a9a3a'], [8, '#3a7a2a']], steam: false },
  kalach: { awning: ['#c8862a', '#f4ecd8'], counter: '#8a5a34', goods: [[1, '#d8a050'], [5, '#e0b060'], [9, '#d8a050']], steam: true },
};
export const STALL_X = [150, 236, 322];
// Какие ларьки работают сейчас: [{ k, x }]
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (mo >= 5 && mo <= 9 && h >= 10 && h < 22) {
    const out = [{ k: 'icecream', x: 150 }, { k: mo === 7 ? 'cherry' : 'kalach', x: 236 }];
    if (mo >= 7) out.push({ k: 'cucumber', x: 322 });
    return out;
  }
  if ((mo >= 11 || mo <= 3) && h >= 10 && h < 20) return [{ k: 'tea', x: 236 }, { k: 'kalach', x: 322 }];
  if (h >= 10 && h < 21) return [{ k: 'kalach', x: 236 }, { k: 'tea', x: 322 }];
  return [];
}

// ---------- секреты Владимира ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
export const SECRETS = [
  {
    id: 'lastochka', name: '«Ласточка» под соборами', layer: 'sky',
    hint: 'Под холмом иногда проносится красно-белая стрела.',
    found: 'По ходу Москва — Владимир — Нижний Новгород ходят скоростные «Ласточки»; путь идёт вдоль Клязьмы прямо под соборным холмом.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (h < 5 || h >= 23)) return null;
      if (!inWin(env, 1500, 16, 300)) return null;
      const p = phase(env, 1500, 16, 300); return { x: Math.round(-46 + p * 530), y: 149, w: 46, h: 7 };
    },
    draw(b, env, st, dayF) {
      const { x, y } = st, nightF = 1 - dayF;
      b.fillStyle = mixHex('#3a3c44', '#eceef0', dayF); b.fillRect(x, y + 1, 44, 5);
      b.fillStyle = mixHex('#4a1a1a', '#d8323a', dayF); b.fillRect(x, y + 4, 44, 1); b.fillRect(x + 42, y + 1, 2, 4); b.fillRect(x + 44, y + 3, 2, 2);
      b.fillStyle = nightF > 0.4 ? '#ffe2a0' : mixHex('#14161c', '#3a4658', dayF);
      for (let i = 0; i < 10; i++) b.fillRect(x + 2 + i * 4, y + 2, 3, 1);
      b.fillStyle = mixHex('#1a1a20', '#4a4c54', dayF); b.fillRect(x + 21, y + 1, 1, 5); // межвагонный стык
      b.fillStyle = mixHex('#1a1a20', '#5a5c64', dayF); b.fillRect(x + 12, y - 2, 4, 1); b.fillRect(x + 13, y - 1, 1, 2); // токоприёмник
    },
  },
  {
    id: 'tyazhelovoz', name: 'Владимирский тяжеловоз', layer: 'street',
    hint: 'Днём по набережной иногда неспешно проходит кто-то очень большой.',
    found: 'Владимирский тяжеловоз — порода, выведенная на конных заводах Владимирской земли и утверждённая в 1946 году.',
    state(env) {
      const h = env.local.getUTCHours(), k = env.weather.kind;
      if (!env.forced && (h < 10 || h >= 19 || k === 'rain' || k === 'storm')) return null;
      if (!inWin(env, 3600, 70, 1200)) return null;
      const p = phase(env, 3600, 70, 1200); return { x: Math.round(-24 + p * 530), y: 199, w: 18, h: 14 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, step = Math.sin(env.ms / 260) > 0 ? 1 : 0, d = (c) => mixHex('#141018', c, 0.3 + dayF * 0.7);
      ctx.fillStyle = d('#7a4222'); ctx.fillRect(x + 2, y + 5, 11, 5);             // корпус, гнедой
      ctx.fillRect(x + 12, y + 2, 3, 5); ctx.fillRect(x + 14, y + 1, 4, 3);          // шея и голова
      ctx.fillStyle = d('#2a1a12'); ctx.fillRect(x + 12, y + 1, 2, 4); ctx.fillRect(x + 1, y + 5, 2, 4); // грива и хвост
      ctx.fillStyle = d('#f0ece4'); ctx.fillRect(x + 16, y + 2, 1, 1);               // проточина
      ctx.fillStyle = d('#5a3018');
      for (const [lx, ph] of [[3, 0], [5, 1], [10, 1], [12, 0]]) ctx.fillRect(x + lx, y + 10, 1, 3 - (ph === step ? 1 : 0));
      ctx.fillStyle = d('#f0ece4'); for (const lx of [3, 5, 10, 12]) ctx.fillRect(x + lx, y + 12, 1, 1); // «щётки» над копытами
      drawPerson(ctx, x - 4, y + 14, 0.7, dayF, env.ms / 1000, false, env.winter, true); // коновод
      ctx.fillStyle = d('#3a2a1a'); for (let i = 0; i < 16; i += 2) ctx.fillRect(x - 2 + i, y + 9 - (i >> 2), 1, 1); // повод от руки к голове
    },
  },
  {
    id: 'heron', name: 'Серая цапля', layer: 'street',
    hint: 'На рассвете и вечером у нашего берега кто-то стоит в воде не шевелясь.',
    found: 'Серые цапли охотятся на мелководье в пойме Клязьмы — стоят неподвижно и ждут рыбу.',
    state(env) {
      const h = env.local.getUTCHours(), mo = month(env);
      if (!env.forced && !(mo >= 4 && mo <= 9 && !env.frozen && ((h >= 5 && h < 9) || (h >= 18 && h < 21)))) return null;
      if (!inWin(env, 1800, 90, 700)) return null;
      return { x: 112, y: 181, w: 7, h: 17 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, d = (c) => mixHex('#141018', c, 0.3 + dayF * 0.7), dip = (env.ms % 9000) < 900 ? 2 : 0;
      ctx.fillStyle = d('#2a2a30'); ctx.fillRect(x + 3, y + 11, 1, 6); ctx.fillRect(x + 5, y + 11, 1, 6);  // ноги
      ctx.fillStyle = d('#8e949c'); ctx.fillRect(x + 1, y + 7, 6, 4); ctx.fillStyle = d('#6a7078'); ctx.fillRect(x + 1, y + 7, 2, 3); // корпус, крыло
      ctx.fillStyle = d('#e8e8e8'); ctx.fillRect(x + 5, y + 3 + dip, 1, 4); ctx.fillRect(x + 4, y + 2 + dip, 2, 2); // шея
      ctx.fillStyle = d('#2a2a30'); ctx.fillRect(x + 3, y + 2 + dip, 1, 1);          // хохолок
      ctx.fillStyle = d('#d8b040'); ctx.fillRect(x + 6, y + 3 + dip, 2, 1);           // клюв
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x, y + 17, 9, 1); ctx.globalAlpha = 1; // круги на воде
    },
  },
  {
    id: 'vishnya', name: 'Вишнёвый цвет на склоне', layer: 'sky',
    hint: 'В середине мая склон под соборами на пару недель становится белым.',
    found: 'Владимир издавна славится вишней: в Патриаршем саду на склоне у Клязьмы растят старинные сорта владимирской вишни.',
    state(env) {
      const mo = month(env), dd = env.local.getUTCDate();
      if (!env.forced && !(mo === 5 && dd >= 8 && dd <= 25)) return null;
      return { x: 84, y: 134, w: 40, h: 16 };
    },
    draw(b, env, st, dayF) {
      const r = rng(519), sway = Math.sin(env.ms / 1400) > 0.6 ? 1 : 0;
      for (let i = 0; i < 120; i++) {
        const px = st.x + ((r() * st.w) | 0), py = st.y + ((r() * st.h) | 0), big = r() < 0.4;
        b.fillStyle = mixHex('#3a3a48', r() < 0.3 ? '#f8d8e0' : '#fbf8f4', dayF);
        b.fillRect(px + (py < st.y + 5 ? sway : 0), py, big ? 2 : 1, big ? 2 : 1);
      }
      // лепестки летят к реке
      b.fillStyle = mixHex('#3a3a48', '#fbeef0', dayF);
      for (let i = 0; i < 6; i++) { const ph = ((env.ms / 1000) * 0.15 + i / 6) % 1; b.fillRect(Math.round(st.x + 10 + i * 5 + ph * 30), Math.round(st.y + 4 + ph * 26), 1, 1); }
    },
  },
];

// События по новостям (fireworks — салют над соборами)
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 240, 40, dayF); }
