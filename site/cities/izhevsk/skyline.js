// Ижевск: вид через Ижевский пруд на центр города. Слева направо: Летний сад с колесом обозрения,
// монумент «Навеки с Россией» (два пилона по 46 м, между ними медный рельеф), здание Арсенала (Национальный музей),
// Свято-Михайловский собор из красного кирпича с золотыми главами, новые дома. Пруд зимой подо льдом.

import { mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  far: '#9aa2b4', farDark: '#868ea2', tower: '#a8b2c4', hill: '#6f8a5a', hillDark: '#5a7348', tree: '#3e6b3d', treeDark: '#2f5531',
  brick: '#b8503a', brickDark: '#8e3a2a', trim: '#f2ece0', gold: '#e2b23e', goldDark: '#b8862a',
  pylon: '#d8d4cc', pylonDark: '#a8a49c', copper: '#c8843a', copperHi: '#e8b060',
  yellow: '#e8c878', yellowShade: '#c8a858', white: '#f2eee6', win: '#6a6070', roof: '#5f7a66',
  wheel: '#c8ccd4', cabin: '#d84a3a', road: '#8a8680', granite: '#8c8278', graniteDark: '#6f665e', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', tower: '#222a44', hill: '#141c1c', hillDark: '#101616', tree: '#151d1f', treeDark: '#101719',
  brick: '#6e3026', brickDark: '#55251e', trim: '#a69c88', gold: '#c89a3a', goldDark: '#9a722a',
  pylon: '#8a8a94', pylonDark: '#5e5e6a', copper: '#8a5a2a', copperHi: '#c8903a',
  yellow: '#8a7850', yellowShade: '#6a5a3c', white: '#a69c88', win: '#1a1420', roof: '#22302a',
  wheel: '#5a5e6a', cabin: '#7a3028', road: '#26242a', granite: '#27252d', graniteDark: '#1e1c23', snow: '#6a7488',
};
const AUTUMN = { day: { tree: '#bb8c32', treeDark: '#915f27', hill: '#8a8a4a', hillDark: '#6e6e3a' }, night: { tree: '#221c16', treeDark: '#1a1511' } };
const WINTER = { day: { tree: '#5d5853', treeDark: '#48443f', hill: '#dfe6ec', hillDark: '#c4ccd6' }, night: { tree: '#1a1a1e', treeDark: '#141418', hill: '#2c3244', hillDark: '#242a3a' } };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 1, top + i, 1, 1); });
}
const ONION = [2, 4, 6, 7, 7, 6, 4, 2, 3];

export function drawFar({ g, P, winter, r, L, R }) {
  // город на берегу: дома разной высоты, правее — новые высотки
  for (let x = 0; x < W;) {
    const tall = (x > 372 || (x > 90 && x < 160) || (x > 262 && x < 292)) && r() < 0.55, w = 8 + ((r() * 12) | 0), h = tall ? 26 + ((r() * 22) | 0) : 6 + ((r() * 12) | 0), top = 152 - h;
    R(tall ? 'tower' : r() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    if (winter) R('snow', x, top, w, 1);
    for (let yy = top + 2; yy < 150; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.3) L(xx, yy, 'win');
    if (tall) L(x + (w >> 1), top, 'red', '#ff3a3a', 0);
    x += w;
  }
  // береговой склон с деревьями
  for (let x = 0; x < W; x++) { R('hill', x, 148, 1, 8); R('hillDark', x, 152, 1, 4); }
  for (let x = 0; x < W; x += 3) { if (x > 160 && x < 196) continue; const h = 4 + ((r() * 7) | 0); R(r() < 0.5 ? 'tree' : 'treeDark', x, 149 - h, 4, h + 1); }

  // Летний сад: колесо обозрения
  const cx = 56, cy = 112, RAD = 26;
  for (let a = 0; a < 6.283; a += 0.04) R('wheel', Math.round(cx + Math.cos(a) * RAD), Math.round(cy + Math.sin(a) * RAD), 1, 1);
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; for (let s = 0; s < RAD; s += 2) R('wheel', Math.round(cx + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s), 1, 1); R('cabin', Math.round(cx + Math.cos(a) * RAD) - 1, Math.round(cy + Math.sin(a) * RAD) + 1, 3, 3); L(Math.round(cx + Math.cos(a) * RAD), Math.round(cy + Math.sin(a) * RAD), 'lamp', '#ffb8e8', 0); }
  for (const dx of [-1, 1]) for (let s = 0; s < 36; s++) R('wheel', cx + dx * Math.round(s * 0.4), cy + s, 1, 1); // опоры

  // монумент «Навеки с Россией»: два пилона, между ними золотистый медный рельеф
  const mx = 176, top = 64;
  R('hill', mx - 10, 146, 30, 4);
  for (const px of [mx, mx + 9]) { R('pylon', px, top, 4, 150 - top); R('pylonDark', px + 3, top, 1, 150 - top); }
  for (let y = top + 18; y < 140; y += 1) { R(y % 6 < 3 ? 'copper' : 'copperHi', mx + 4, y, 5, 1); }
  for (const y of [top + 30, top + 52, top + 70]) R('copperHi', mx + 5, y, 3, 4); // фигуры рельефа
  L(mx + 6, 146, 'flood', '#ffe2a8', 0);

  // Арсенал (Национальный музей): жёлтое здание ампир с портиком и белыми колоннами
  R('yellow', 206, 130, 50, 18); R('yellowShade', 250, 130, 6, 18); R('roof', 204, 127, 54, 3);
  R('white', 222, 124, 18, 4); R('yellow', 224, 128, 14, 2);
  for (let x = 223; x < 240; x += 3) R('white', x, 130, 1, 18);
  for (let x = 209; x < 220; x += 4) R('win', x, 135, 2, 5); for (let x = 242; x < 254; x += 4) R('win', x, 135, 2, 5);

  // Свято-Михайловский собор: красный кирпич, белые наличники, высокий шатёр, боковые башни и золотые главы
  const sx = 296;
  R('brick', sx, 114, 64, 36); R('brickDark', sx + 58, 114, 6, 36); R('trim', sx - 1, 114, 66, 1);
  for (let x = sx + 3; x < sx + 60; x += 6) { R('trim', x, 120, 3, 1); R('win', x, 121, 3, 6); R('trim', x, 132, 3, 1); R('win', x + 1, 133, 2, 5); }
  // кокошники над карнизом
  for (let x = sx + 2; x < sx + 62; x += 8) dome(R, x + 3, 109, [3, 5, 7, 7, 7], 'brick', 'brickDark');
  // боковые башни-колокольни с шатрами
  for (const bx of [sx + 2, sx + 54]) {
    R('brick', bx, 92, 8, 22); R('brickDark', bx + 6, 92, 2, 22); R('trim', bx - 1, 92, 10, 1); R('win', bx + 3, 97, 2, 5);
    for (let i = 0; i < 10; i++) { const w = Math.max(1, Math.round(8 * (1 - i / 10))); R(i % 3 === 1 ? 'trim' : 'brick', bx + 4 - (w >> 1), 91 - i, w, 1); }
    dome(R, bx + 4, 74, ONION, 'gold', 'goldDark'); R('gold', bx + 4, 70, 1, 4);
  }
  // центральный объём и высокий шатёр
  R('brick', sx + 20, 84, 24, 30); R('brickDark', sx + 40, 84, 4, 30); R('trim', sx + 19, 84, 26, 1);
  for (let x = sx + 23; x < sx + 41; x += 5) R('win', x, 90, 2, 6);
  for (let i = 0; i < 30; i++) { const w = Math.max(1, Math.round(20 * (1 - i / 30))); R(i % 5 === 2 ? 'trim' : 'brick', sx + 32 - (w >> 1), 83 - i, w, 1); }
  dome(R, sx + 32, 46, ONION, 'gold', 'goldDark'); R('gold', sx + 32, 40, 1, 6); R('gold', sx + 30, 42, 5, 1);
  // малые главы у основания шатра
  for (const x of [sx + 16, sx + 48, sx + 24, sx + 40]) { R('brick', x - 2, 84, 5, 4); dome(R, x, 75, ONION, 'gold', 'goldDark'); R('gold', x, 71, 1, 4); }
  L(sx + 32, 146, 'flood', '#ffd8a8', 0); L(sx + 8, 146, 'flood', '#ffd8a8', 0); L(sx + 56, 146, 'flood', '#ffd8a8', 0);

  // набережная на том берегу: дорога и фонари, гранит у воды
  R('road', 0, 154, W, 4); R('graniteDark', 0, 158, W, 2);
  for (let x = 6; x < W; x += 18) { R('graniteDark', x, 148, 1, 6); L(x, 147, 'lamp', '#ffd88a', 0); }
  R('granite', 0, 160, W, 3); R('graniteDark', 0, 163, W, 5);
  if (winter) R('snow', 0, 160, W, 1);
}

// ---------- ночью: подсветка монумента, золото собора, колесо обозрения переливается ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const glow = (x, y, rr, rgb, a) => { const gr = g.createRadialGradient(x, y, 1, x, y, rr); gr.addColorStop(0, `rgba(${rgb},${a * nightF})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); };
  glow(182, 100, 22, '255,220,150', 0.22); glow(328, 76, 30, '255,210,150', 0.2);
  g.globalAlpha = nightF * 0.6; g.fillStyle = '#ffe8b8'; g.fillRect(176, 64, 1, 86); g.fillRect(185, 64, 1, 86);
  // колесо: огоньки по кругу бегут
  for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12 + t * 0.2, on = (k + Math.floor(t * 4)) % 3 === 0;
    g.globalAlpha = nightF * (on ? 0.95 : 0.35); g.fillStyle = `hsl(${(k * 15 + t * 20) % 360},80%,70%)`;
    g.fillRect(Math.round(56 + Math.cos(a) * 26), Math.round(112 + Math.sin(a) * 26), 1, 1);
  }
  g.globalAlpha = 1;
}

// ---------- теплоход по пруду в навигацию, набережная на нашем берегу ----------
export function drawBoats(ctx, env, dayF, t) {
  drawBoat(ctx, env, dayF);
  drawPromenade(ctx, env, dayF, t);
}
export function drawAboveLate(b, env, dayF, t) { drawCars(b, env, dayF, t); }

function drawBoat(ctx, env, dayF) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 10 || h > 21) return;
  const p = ((env.ms / 1000 + 60) % 540) / 240;
  if (p >= 1) return;
  const x = Math.round(500 - p * 540), y = 186, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 32, 4);
  ctx.fillStyle = mixHex('#1a1e28', '#3a5a8a', dayF); ctx.fillRect(x + 1, y + 4, 30, 2);
  ctx.fillStyle = mixHex('#30343e', '#e0e0dc', dayF); ctx.fillRect(x + 6, y - 5, 20, 5);
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7;
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 7 + i * 3, y - 4, 2, 1);
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — тарелка пельменей
export function drawSill(R, SILL) {
  R('#e8e4dc', 354, SILL - 1, 20, 2); R('#c8c2b6', 356, SILL + 1, 16, 1);
  for (const [dx, dy] of [[2, -3], [6, -3], [10, -3], [14, -3], [4, -5], [8, -5], [12, -5], [8, -7]]) { R('#f2ead8', 356 + dx, SILL + dy, 4, 2); R('#d8ccb0', 356 + dx + 3, SILL + dy, 1, 2); }
  R('#f4f4f0', 362, SILL - 9, 3, 1); // сметана
}

// ---------- улица: машины и трамвай на набережной, ларьки на нашем берегу ----------
const KINDS = {
  perepechi: { counter: '#c8862a', awning: ['#c8423a', '#f2ece0'], goods: [[2, '#e8b860'], [6, '#e8b860'], [9, '#c83a3a']], steam: true },
  kvas: { counter: '#6a3a1a', awning: ['#e8b030', '#6a3a1a'], goods: [[2, '#8a5a2a'], [6, '#8a5a2a'], [9, '#f4f4f4']] },
  icecream: { counter: '#f4f4f4', awning: ['#3a6fb8', '#f4f4f4'], goods: [[2, '#f8e8c0'], [6, '#f8e8c0'], [9, '#e8a0b0']] },
  pelmeni: { counter: '#8a4a2a', awning: ['#2a5a8a', '#f2ece0'], goods: [[2, '#f2ead8'], [6, '#f2ead8'], [9, '#f4f4f4']], steam: true },
};
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  if (h < 10 || h >= 22) return [];
  if (mo >= 5 && mo <= 9) return ['kvas', 'icecream', 'perepechi'];
  return ['pelmeni', 'perepechi'];
}
export const STALL_X = { kvas: 150, icecream: 236, perepechi: 322, pelmeni: 150 };
const LANES = [{ x0: -6, x1: 486, y: 157 }];
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); drawTram(b, env, dayF); }
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: KINDS[k], x: STALL_X[k] }))); }
// трамвай по набережной: красно-белый, с 6 утра до часу ночи
function drawTram(b, env, dayF) {
  const h = env.local.getUTCHours();
  if (h >= 1 && h < 6) return;
  const p = ((env.ms / 1000) % 300) / 120;
  if (p >= 1) return;
  const x = Math.round(-30 + p * 540), y = 150, nightF = 1 - dayF;
  b.fillStyle = mixHex('#5a2020', '#d84a3a', dayF); b.fillRect(x, y, 24, 5);
  b.fillStyle = mixHex('#3a3a40', '#f2f2ee', dayF); b.fillRect(x, y + 1, 24, 1);
  b.fillStyle = nightF > 0.3 ? '#ffe2a0' : '#3a4a5a'; for (let i = 0; i < 6; i++) b.fillRect(x + 2 + i * 4, y + 2, 2, 2);
  b.fillStyle = '#2a2a30'; b.fillRect(x + 11, y - 3, 1, 3);
}

// ---------- секреты Ижевска ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
export const SECRETS = [
  {
    id: 'izh', name: 'Мотоцикл «ИЖ» с коляской', layer: 'sky',
    hint: 'Днём по набережной иногда с треском проезжает что-то с коляской.',
    found: 'Мотоциклы «ИЖ» выпускали в Ижевске с 1928 года; «ИЖ Планету» с коляской помнят по всей стране.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (h < 8 || h > 21 || env.frozen)) return null;
      if (!inWin(env, 1500, 22, 400)) return null;
      const p = phase(env, 1500, 22, 400); return { x: Math.round(-20 + p * 520), y: 150, w: 12, h: 6 };
    },
    draw(b, env, st, dayF) {
      const { x, y } = st, d = (c) => mixHex('#1a1a20', c, 0.35 + dayF * 0.65);
      b.fillStyle = d('#c8423a'); b.fillRect(x + 1, y + 2, 6, 2); b.fillStyle = d('#3a6fb8'); b.fillRect(x + 7, y + 1, 4, 3); // мотоцикл и коляска
      b.fillStyle = d('#2a2a30'); b.fillRect(x + 1, y + 4, 2, 2); b.fillRect(x + 5, y + 4, 2, 2); b.fillRect(x + 9, y + 4, 2, 2);
      b.fillStyle = d('#e0b090'); b.fillRect(x + 3, y - 1, 2, 2); b.fillStyle = d('#3a3a40'); b.fillRect(x + 3, y + 1, 2, 1);
    },
  },
  {
    id: 'fishers', name: 'Рыбаки на льду', layer: 'street',
    hint: 'Зимой днём на льду пруда сидят тёмные фигурки — и не двигаются.',
    found: 'Зимой Ижевский пруд замерзает, и на лёд выходят рыбаки с ящиками и лунками.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(env.frozen && h >= 8 && h < 17)) return null;
      return { x: 150, y: 176, w: 90, h: 8 };
    },
    draw(ctx, env, st, dayF) {
      const d = (c) => mixHex('#141018', c, 0.4 + dayF * 0.6);
      for (const [dx, col] of [[0, '#3a4a6a'], [26, '#6a3a3a'], [60, '#3a5a3a'], [84, '#4a4a5a']]) {
        const x = st.x + dx, y = st.y + 6;
        ctx.fillStyle = d('#2a2a30'); ctx.fillRect(x + 3, y - 1, 3, 2); // ящик
        ctx.fillStyle = d(col); ctx.fillRect(x + 3, y - 5, 3, 4); ctx.fillStyle = d('#e0b090'); ctx.fillRect(x + 4, y - 7, 2, 2);
        ctx.fillStyle = d('#1a2030'); ctx.fillRect(x, y + 1, 2, 1); // лунка
      }
    },
  },
  {
    id: 'skier', name: 'Лыжница на пруду', layer: 'street',
    hint: 'По льду пруда иногда кто-то быстро бежит — оставляя за собой две полоски.',
    found: 'Галина Кулакова из Удмуртии — четырёхкратная олимпийская чемпионка по лыжным гонкам; монумент на берегу в народе зовут «лыжами Кулаковой».',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(env.frozen && h >= 9 && h < 16)) return null;
      if (!inWin(env, 900, 30, 120)) return null;
      const p = phase(env, 900, 30, 120); return { x: Math.round(-10 + p * 500), y: 180, w: 8, h: 8 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, d = (c) => mixHex('#141018', c, 0.4 + dayF * 0.6), k = Math.sin(env.ms / 160) > 0 ? 1 : 0;
      ctx.fillStyle = d('#c8423a'); ctx.fillRect(x + 3, y + 1, 2, 4); ctx.fillStyle = d('#e0b090'); ctx.fillRect(x + 3, y - 1, 2, 2);
      ctx.fillStyle = d('#2a2a30'); ctx.fillRect(x + 2 + k, y + 5, 1, 2); ctx.fillRect(x + 5 - k, y + 5, 1, 2); ctx.fillRect(x, y + 7, 9, 1);
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#c8d4e0'; ctx.fillRect(x - 30, y + 7, 30, 1); ctx.globalAlpha = 1;
    },
  },
  {
    id: 'babushki', name: 'Песня на набережной', layer: 'sky',
    hint: 'Летним вечером на том берегу собираются женщины в белых нарядах — и поют.',
    found: 'В Удмуртии поют все — а «Бурановские бабушки» из удмуртского села Бураново в 2012 году заняли второе место на «Евровидении».',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(month(env) >= 6 && month(env) <= 8 && h >= 18 && h < 21)) return null;
      return { x: 120, y: 144, w: 26, h: 8 };
    },
    draw(b, env, st, dayF) {
      const d = (c) => mixHex('#141018', c, 0.4 + dayF * 0.6);
      for (let i = 0; i < 6; i++) {
        const x = st.x + i * 4, sway = Math.sin(env.ms / 300 + i) > 0 ? 1 : 0;
        b.fillStyle = d('#f4f2ea'); b.fillRect(x, st.y + 2 - sway, 3, 5); b.fillStyle = d('#c8423a'); b.fillRect(x, st.y + 5 - sway, 3, 1);
        b.fillStyle = d('#e0b090'); b.fillRect(x + 1, st.y - sway, 1, 2); b.fillStyle = d('#e2b23e'); b.fillRect(x, st.y - 1 - sway, 3, 1); // монисто
      }
    },
  },
];

export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 240, 50, dayF); }
