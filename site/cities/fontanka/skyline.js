// Санкт-Петербург, Фонтанка: вид с набережной через реку на запад. Слева — дома и Михайловский замок
// с золотым шпилем, у гранитной стены над водой — Чижик-Пыжик (у Первого Инженерного моста),
// правее — ограда Летнего сада с деревьями за ней и Пантелеймоновский мост с фонарями.

import { mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade } from '../../engine/street.js';

const DAY = {
  far: '#9aa2b4', farDark: '#868ea2', facade: '#d8b878', facade2: '#c89a8a', facade3: '#a8b8a0', win: '#6a6070', roof: '#7a6a5a',
  castle: '#c8643a', castleShade: '#a04e2c', white: '#f2eee6', whiteShade: '#d4cec2', gold: '#e2b23e', goldDark: '#b8862a',
  tree: '#3e6b3d', treeDark: '#2f5531', treeHi: '#5a8a4a', fence: '#2a2a30', fenceGold: '#d8a83a', pillar: '#a89a8a',
  granite: '#8c8278', graniteDark: '#6f665e', road: '#8a8680', bridge: '#5a5e68', bridgeGold: '#e2b23e', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', facade: '#7a6a50', facade2: '#6a5050', facade3: '#566050', win: '#1a1420', roof: '#2a2420',
  castle: '#6a3420', castleShade: '#52281a', white: '#a69c88', whiteShade: '#837a6a', gold: '#c89a3a', goldDark: '#9a722a',
  tree: '#151d1f', treeDark: '#101719', treeHi: '#1c2a24', fence: '#121216', fenceGold: '#a8802a', pillar: '#4a4440',
  granite: '#27252d', graniteDark: '#1e1c23', road: '#26242a', bridge: '#2a2c34', bridgeGold: '#b8902a', snow: '#6a7488',
};
const AUTUMN = { day: { tree: '#bb8c32', treeDark: '#915f27', treeHi: '#d8a848' }, night: { tree: '#221c16', treeDark: '#1a1511' } };
const WINTER = { day: { tree: '#5d5853', treeDark: '#48443f', treeHi: '#e8eef4' }, night: { tree: '#1a1a1e', treeDark: '#141418', treeHi: '#3a4252' } };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

export function drawFar({ g, P, winter, r, L, R }) {
  // дома дальнего берега слева: фасады с рядами окон
  for (let x = 0; x < 70;) {
    const w = 14 + ((r() * 10) | 0), h = 30 + ((r() * 14) | 0), top = 158 - h, c = ['facade', 'facade2', 'facade3'][(r() * 3) | 0];
    R(c, x, top, w, h); R('roof', x, top - 2, w, 2); if (winter) R('snow', x, top - 2, w, 1);
    for (let yy = top + 3; yy < 154; yy += 6) for (let xx = x + 2; xx < x + w - 2; xx += 4) { R('win', xx, yy, 2, 3); if (r() < 0.5) L(xx, yy + 1, 'win'); }
    x += w;
  }
  // Михайловский замок: кирпично-оранжевые стены, белые наличники и портик, золотой шпиль
  R('castle', 72, 112, 176, 46); R('castleShade', 236, 112, 12, 46); R('white', 70, 110, 180, 2); R('roof', 70, 106, 180, 4);
  if (winter) R('snow', 70, 106, 180, 1);
  for (let x = 78; x < 244; x += 8) { R('white', x - 1, 118, 5, 1); R('win', x, 119, 3, 7); R('white', x - 1, 132, 5, 1); R('win', x, 133, 3, 6); R('win', x, 145, 3, 6); L(x + 1, 121, 'win'); L(x + 1, 135, 'win'); }
  // центральный ризалит с портиком и колоннами
  R('castle', 140, 98, 44, 14); R('white', 138, 96, 48, 2);
  for (let x = 144; x < 182; x += 6) R('white', x, 112, 2, 30);
  R('white', 140, 108, 44, 3); for (let i = 0; i < 6; i++) R('white', 162 - (22 - i * 4), 92 - i, (22 - i * 4) * 2, 1); // фронтон
  // восьмигранная башенка и шпиль
  R('castle', 156, 72, 12, 26); R('castleShade', 165, 72, 3, 26); R('white', 155, 72, 14, 1); R('win', 160, 78, 3, 6);
  R('white', 157, 66, 10, 6); R('gold', 158, 62, 8, 4);
  for (let i = 0; i < 26; i++) { const w = Math.max(1, Math.round(4 - i * 0.14)); R('gold', 162 - (w >> 1), 61 - i, w, 1); }
  R('goldDark', 163, 40, 1, 20); R('gold', 162, 32, 1, 4); R('gold', 160, 34, 5, 1);
  L(162, 150, 'flood', '#ffe0a8', 0); L(100, 150, 'flood', '#ffe0a8', 0); L(220, 150, 'flood', '#ffe0a8', 0);

  // проход к Мойке и Первый Инженерный мост — низкий чугунный пролёт
  R('far', 248, 124, 36, 34);
  R('bridge', 248, 150, 36, 4); R('bridgeGold', 248, 149, 36, 1);
  for (let x = 250; x < 284; x += 4) R('bridge', x, 145, 1, 4);

  // Летний сад: деревья и знаменитая ограда — чёрные копья с золотыми наконечниками, гранитные столбы с вазами
  // кроны лип и дубов — круглые, внахлёст, у некоторых светлая макушка
  for (let x = 286; x < 440; x += 9) {
    const cx = x + ((r() * 4) | 0), cy = 108 + ((r() * 14) | 0), rad = 8 + ((r() * 5) | 0), c = r() < 0.5 ? 'tree' : 'treeDark';
    R('treeDark', cx, cy, 2, 152 - cy); // ствол
    for (let yy = -rad; yy <= rad; yy++) { const hw = Math.round(Math.sqrt(rad * rad - yy * yy) * 1.1); R(c, cx - hw, cy + yy, hw * 2 + 1, 1); }
    R('treeHi', cx - (rad >> 1), cy - rad + 2, rad, 2);
  }
  for (let x = 286; x < 438; x += 3) { R('fence', x, 140, 1, 14); R('fenceGold', x, 139, 1, 1); }
  R('fence', 284, 146, 154, 1); R('fence', 284, 152, 154, 1);
  for (let x = 286; x < 440; x += 24) { R('pillar', x, 134, 4, 20); R('pillar', x - 1, 131, 6, 3); R('fenceGold', x, 128, 4, 3); }

  // Пантелеймоновский мост справа: пролёт с фонарями и золочёными орлами
  R('bridge', 436, 150, 44, 4); R('bridgeGold', 436, 149, 44, 1);
  for (let x = 440; x < 480; x += 10) { R('bridge', x, 138, 1, 11); R('bridgeGold', x - 1, 136, 3, 2); L(x, 136, 'lamp', '#ffe2a0', 0); }

  // набережная того берега: дорога, гранит у воды
  R('road', 0, 154, 248, 4); R('road', 284, 154, 196, 4); R('graniteDark', 0, 158, W, 2);
  R('granite', 0, 160, W, 3); R('graniteDark', 0, 163, W, 5);
  if (winter) R('snow', 0, 160, W, 1);
  for (let x = 6; x < W; x += 20) { R('graniteDark', x, 147, 1, 7); L(x, 146, 'lamp', '#ffd88a', 0); }

  // Чижик-Пыжик: крошечная бронзовая птичка на уступе гранитной стены, над самой водой
  R('graniteDark', 262, 164, 8, 2); R('gold', 264, 161, 4, 3); R('goldDark', 267, 160, 2, 2); R('fence', 268, 160, 1, 1);
}

// ---------- ночью: шпиль замка в подсветке, фонари мостов ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  const gr = g.createRadialGradient(162, 60, 1, 162, 60, 24);
  gr.addColorStop(0, `rgba(255,220,150,${0.25 * nightF})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = gr; g.fillRect(138, 30, 48, 60);
  g.globalAlpha = nightF * 0.8; g.fillStyle = '#ffe8b0'; g.fillRect(162, 36, 1, 26); g.globalAlpha = 1;
}

// ---------- кораблики по Фонтанке в навигацию, набережная нашего берега ----------
export function drawBoats(ctx, env, dayF, t) {
  for (const [shift, dir] of [[0, 1], [170, -1]]) drawBoat(ctx, env, dayF, shift, dir);
  drawPromenade(ctx, env, dayF, t);
}
export function drawAboveLate(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }

function drawBoat(ctx, env, dayF, shift, dir) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 10 || h > 23) return;
  const p = ((env.ms / 1000 + shift) % 340) / 150;
  if (p >= 1) return;
  const x = Math.round(dir > 0 ? -34 + p * 548 : 514 - p * 548), y = 186, nightF = 1 - dayF;
  // открытый катер: корпус, сиденья с пассажирами, гид на носу
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 30, 3);
  ctx.fillStyle = mixHex('#1a1e28', '#2a4a6a', dayF); ctx.fillRect(x + 1, y + 3, 28, 2);
  for (let i = 0; i < 7; i++) { ctx.fillStyle = mixHex('#141018', ['#c8423a', '#3a6ab0', '#e8c040', '#4a8a5a'][i % 4], 0.35 + dayF * 0.65); ctx.fillRect(x + 4 + i * 3, y - 2, 2, 2); }
  ctx.fillStyle = mixHex('#30343e', '#e8e4dc', dayF); ctx.fillRect(x + 2, y - 5, 26, 1); // тент
  if (nightF > 0.3) { ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = nightF; ctx.fillRect(x + (dir > 0 ? 29 : 0), y, 1, 1); ctx.globalAlpha = 1; }
}

// Сувенир на подоконнике — кулёк пышек с сахарной пудрой
export function drawSill(R, SILL) {
  R('#e8dcc0', 356, SILL - 8, 12, 8); R('#d8c8a8', 364, SILL - 8, 4, 8); R('#c8b898', 356, SILL - 9, 12, 1);
  for (const [dx, dy] of [[1, -11], [6, -12], [3, -14]]) { R('#d8a058', 356 + dx, SILL + dy, 5, 3); R('#f8f4ec', 356 + dx + 1, SILL + dy, 3, 1); R('#8a5a2a', 356 + dx + 2, SILL + dy + 1, 1, 1); }
}

// ---------- набережная нашего берега: ларёк «Кораблики» в навигацию, кофе; машины на том берегу ----------
const KINDS = {
  coffee: { counter: '#6a4a34', awning: ['#2a5a4a', '#f2eee6'], goods: [[2, '#f4f4f4'], [6, '#8a5a3a'], [9, '#f4f4f4']], steam: true },
  pyshki: { counter: '#c8862a', awning: ['#c8423a', '#f2e8c8'], goods: [[2, '#e8c890'], [6, '#e8c890'], [9, '#f8f4ec']], steam: true },
};
export function stalls(env) {
  const h = env.local.getUTCHours();
  if (h < 9 || h >= 23) return [];
  return env.navigation && !env.frozen ? ['boats', 'coffee', 'pyshki'] : ['coffee', 'pyshki'];
}
export const STALL_X = { boats: 150, coffee: 236, pyshki: 322 };
const LANES = [{ x0: -6, x1: 250, y: 157 }, { x0: 282, x1: 486, y: 157 }];
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k) => ({ kind: KINDS[k] || k, x: STALL_X[k] }))); }

// ---------- секреты Фонтанки ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const month = (env) => env.local.getUTCMonth() + 1;
export const SECRETS = [
  {
    id: 'ghost', name: 'Призрак в окне замка', layer: 'sky',
    hint: 'Глубокой ночью в одном из окон Михайловского замка иногда загорается слабый свет.',
    found: 'Павел I прожил в Михайловском замке всего сорок дней и погиб здесь в 1801 году. С тех пор говорят, что по ночам в окнах видят его призрак.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(h >= 0 && h < 4)) return null;
      if (!inWin(env, 1200, 40, 300)) return null;
      return { x: 190, y: 132, w: 5, h: 9 };
    },
    draw(b, env, st) {
      const k = 0.5 + 0.5 * Math.sin(env.ms / 400);
      b.globalAlpha = 0.5 + 0.4 * k; b.fillStyle = '#cfe8ff'; b.fillRect(st.x + 1, st.y + 1, 3, 7);
      b.fillStyle = '#5a6a80'; b.fillRect(st.x + 2, st.y + 2, 1, 2); b.fillRect(st.x + 1, st.y + 4, 3, 3); b.globalAlpha = 1; // силуэт в треуголке
    },
  },
  {
    id: 'coin', name: 'Монетка попала в Чижика', layer: 'street',
    hint: 'Днём у Чижика-Пыжика иногда что-то блестит и падает в воду.',
    found: 'Чижику-Пыжику бросают монетки с парапета: попасть на уступ — к удаче. Памятник появился здесь в 1994 году.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (h < 10 || h > 21 || env.frozen)) return null;
      if (!inWin(env, 300, 4, 50)) return null;
      return { x: 260, y: 156, w: 12, h: 10 };
    },
    draw(ctx, env, st) {
      const p = ((env.ms / 1000) % 4) / 4, y = st.y + Math.round(p * 8);
      ctx.fillStyle = '#ffe890'; ctx.fillRect(st.x + 5, y, 2, 2);
      if (p > 0.6) { ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ffffff'; ctx.fillRect(st.x + 2, st.y + 10, 8, 1); ctx.globalAlpha = 1; }
    },
  },
  {
    id: 'sup', name: 'Сапбордисты на Фонтанке', layer: 'street',
    hint: 'Летом по Фонтанке кто-то идёт стоя прямо по воде.',
    found: 'Летом по рекам и каналам Санкт-Петербурга катаются на сапбордах — с воды город выглядит совсем иначе.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(month(env) >= 6 && month(env) <= 8 && h >= 7 && h < 21 && !env.frozen)) return null;
      if (!inWin(env, 1100, 70, 600)) return null;
      const p = env.forced ? 0.4 : (((secT(env) + 600) % 1100) / 70); return { x: Math.round(500 - p * 520), y: 178, w: 20, h: 10 };
    },
    draw(ctx, env, st, dayF) {
      const d = (c) => mixHex('#141018', c, 0.4 + dayF * 0.6), paddle = Math.sin(env.ms / 400) > 0 ? 1 : 0;
      for (const dx of [0, 11]) {
        const x = st.x + dx;
        ctx.fillStyle = d('#e8e4dc'); ctx.fillRect(x, st.y + 8, 8, 1);
        ctx.fillStyle = d(dx ? '#3a6ab0' : '#c8423a'); ctx.fillRect(x + 3, st.y + 3, 2, 4); ctx.fillStyle = d('#e0b090'); ctx.fillRect(x + 3, st.y + 1, 2, 2);
        ctx.fillStyle = d('#2a2a30'); ctx.fillRect(x + 1 + paddle * 5, st.y + 3, 1, 6);
      }
    },
  },
];
