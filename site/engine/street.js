// Улица для любого города: машины на дорогах и мостах, набережная на переднем плане
// с прохожими и ларьками. Город задаёт полосы движения и какие ларьки где и когда работают.

import { rng, mixHex } from './util.js';
import { W } from './const.js';

const CAR_COLORS = ['#c8423a', '#e8e4dc', '#3a5a8a', '#2a2a30', '#d8b040', '#6a8a6a', '#8a8e98'];

// Машины. lanes: [{ x0, x1, y, active?(env) }] — рисуются в буфер над горизонтом, отражаются в воде
export function drawCars(b, env, dayF, t, lanes) {
  const nightF = 1 - dayF, h = env.local.getUTCHours();
  const live = lanes.filter((l) => !l.active || l.active(env));
  if (!live.length) return;
  const n = (h < 6 ? 2 : h < 9 ? 6 : h < 20 ? 8 : 4) * Math.ceil(live.length / 2);
  for (let i = 0; i < n; i++) {
    const r = rng(i * 131 + 7), lane = live[i % live.length], dir = r() < 0.5 ? 1 : -1, sp = 8 + r() * 10;
    const len = lane.x1 - lane.x0, x = lane.x0 + (((r() * len + dir * sp * t) % len) + len) % len;
    const y = lane.y + (dir > 0 ? 0 : 1);
    b.fillStyle = mixHex('#15151c', CAR_COLORS[(r() * CAR_COLORS.length) | 0], Math.max(0.25, dayF));
    b.fillRect(Math.round(x), y - 1, 3, 2);
    if (nightF > 0.2) {
      b.globalAlpha = nightF; b.fillStyle = '#fff4c8'; b.fillRect(Math.round(x) + (dir > 0 ? 3 : -1), y, 1, 1);
      b.fillStyle = '#ff3a2a'; b.fillRect(Math.round(x) + (dir > 0 ? -1 : 3), y, 1, 1); b.globalAlpha = 1;
    }
  }
}

// Сколько людей гуляет: по времени, погоде и сезону
export function crowd(env) {
  const h = env.local.getUTCHours();
  let n = h < 7 ? 1 : h < 10 ? 4 : h < 18 ? 10 : h < 22 ? 14 : 5;
  if (['rain', 'storm'].includes(env.weather.kind)) n = Math.ceil(n * 0.5);
  if (env.winter) n = Math.ceil(n * 0.6);
  return n;
}

// Виды ларьков: цвета навеса, прилавок, товар, пар
export const KINDS = {
  icecream: { awning: ['#3a7ad0', '#f4f4f4'], counter: '#e8eef4', goods: [[1, '#f4c8d8'], [4, '#f4f0e0'], [7, '#8a5a3a']], steam: false },
  corn: { awning: ['#e8c030', '#f4f4f4'], counter: '#8a5a34', goods: [[1, '#f0d040'], [8, '#f0d040']], steam: true },
  echpochmak: { awning: ['#b0503a', '#f0e0c0'], counter: '#8a5a34', goods: [[1, '#d09040'], [4, '#d09040'], [8, '#d09040']], steam: true },
  tea: { awning: ['#3a8a5a', '#f0e8d0'], counter: '#8a5a34', goods: [[2, '#c8ccd4'], [7, '#c8ccd4']], steam: true },
  boats: { awning: ['#2a4a8a', '#f4f4f4'], counter: '#f0ece0', goods: [[2, '#c8423a'], [6, '#2a4a8a']], steam: false, flags: true },
  koryushka: { awning: ['#6a9ab8', '#f4f4f4'], counter: '#c8ccd4', goods: [[1, '#b8c8d0'], [4, '#b8c8d0'], [8, '#b8c8d0']], steam: false },
};

// kind — имя встроенного вида или свой объект { awning: [c1, c2], counter, goods: [[dx, цвет]], steam, flags }
function drawStall(ctx, kind, x, dayF, t) {
  const K = typeof kind === 'string' ? KINDS[kind] : kind, Y = 206, dim = (c) => mixHex('#141018', c, 0.35 + dayF * 0.65);
  ctx.fillStyle = dim('#e0b090'); ctx.fillRect(x + 5, Y - 9, 2, 2); ctx.fillStyle = dim(kind === 'boats' ? '#2a4a8a' : '#f4f4f4'); ctx.fillRect(x + 4, Y - 7, 4, 3); // продавец
  ctx.fillStyle = dim(K.counter); ctx.fillRect(x, Y - 4, 12, 6);
  ctx.fillStyle = dim('#5a3a24'); ctx.fillRect(x, Y + 1, 12, 1);
  for (let i = 0; i < 16; i++) { ctx.fillStyle = dim(K.awning[(i >> 1) % 2]); ctx.fillRect(x - 2 + i, Y - 13 + (i < 2 || i > 13 ? 1 : 0), 1, 2); }
  ctx.fillStyle = dim('#6a6a6a'); ctx.fillRect(x + 6, Y - 11, 1, 2);
  for (const [dx, c] of K.goods) { ctx.fillStyle = dim(c); ctx.fillRect(x + dx, Y - 5, 2, 1); }
  if (K.flags) { // флажки над будкой «Кораблики»
    for (let i = 0; i < 5; i++) { ctx.fillStyle = dim(['#c8423a', '#f4f4f4', '#2a4a8a'][i % 3]); ctx.fillRect(x - 1 + i * 3, Y - 16 + (Math.sin(t * 3 + i) > 0 ? 1 : 0), 2, 2); }
    ctx.fillStyle = dim('#2a2a34'); ctx.fillRect(x + 13, Y - 8, 1, 3); ctx.fillStyle = dim('#e8e4dc'); ctx.fillRect(x + 14, Y - 9, 2, 2); // зазывала с рупором
  }
  if (K.steam) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) { const ph = (t * 0.6 + i / 6) % 1; ctx.globalAlpha = 0.25 * (1 - ph); ctx.fillRect(Math.round(x + 3 + (i % 3) * 3 + Math.sin(t * 2 + i) * 1.5), Math.round(Y - 6 - ph * 10), 1, 1); }
    ctx.globalAlpha = 1;
  }
  if (dayF < 0.6) {
    const g = ctx.createRadialGradient(x + 6, Y - 8, 0, x + 6, Y - 8, 12);
    g.addColorStop(0, `rgba(255,200,120,${0.35 * (1 - dayF)})`); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 8, Y - 20, 28, 26);
  }
}

export function drawPerson(ctx, x, y, r, dayF, t, umbrella, winter, walking) {
  const dim = (c) => mixHex('#141018', c, 0.3 + dayF * 0.7);
  const coat = winter ? ['#3a3a48', '#5a3a3a', '#2a4a5a', '#4a4a3a'][(r * 4) | 0] : ['#c8423a', '#3a6ab0', '#e8c040', '#4a8a5a', '#e8e4dc', '#8a5ab0'][(r * 6) | 0];
  const bob = walking && Math.sin(t * 8 + r * 20) > 0 ? 1 : 0;
  ctx.fillStyle = dim('#e0b090'); ctx.fillRect(x, y - 6 + bob, 2, 2);
  ctx.fillStyle = dim(coat); ctx.fillRect(x, y - 4 + bob, 2, 3);
  ctx.fillStyle = dim('#2a2a34'); ctx.fillRect(x, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1 + (walking ? bob : 0), 1, 2);
  if (umbrella) { ctx.fillStyle = dim(['#2a2a34', '#c8423a', '#3a6ab0', '#e8c040'][(r * 4) | 0]); ctx.fillRect(x - 2, y - 9 + bob, 6, 1); ctx.fillRect(x - 1, y - 10 + bob, 4, 1); ctx.fillStyle = dim('#2a2a34'); ctx.fillRect(x + 1, y - 8 + bob, 1, 2); }
}

// Набережная на переднем плане. stalls — [{ kind, x }] работающих сейчас ларьков.
export function drawPromenade(ctx, env, dayF, t, stalls = []) {
  const nightF = 1 - dayF, Y = 208;
  ctx.fillStyle = mixHex('#2a2830', '#9a948c', dayF); ctx.fillRect(0, 200, W, 3);
  ctx.fillStyle = mixHex('#3a3640', '#c8c0b4', dayF); ctx.fillRect(0, 200, W, 1);
  ctx.fillStyle = mixHex('#201e26', '#7a746c', dayF); ctx.fillRect(0, 203, W, 11);
  ctx.fillStyle = mixHex('#282630', '#8a847c', dayF); for (let x = 0; x < W; x += 8) ctx.fillRect(x, 203, 1, 11);
  if (env.winter) { ctx.fillStyle = mixHex('#4a5268', '#eef2f6', dayF); ctx.fillRect(0, 203, W, 2); }
  for (let x = 40; x < W; x += 90) {
    ctx.fillStyle = mixHex('#1a1a20', '#3a3a40', dayF); ctx.fillRect(x, 186, 1, 17); ctx.fillRect(x - 1, 185, 3, 1);
    if (nightF > 0.1) { const g = ctx.createRadialGradient(x, 186, 0, x, 190, 26); g.addColorStop(0, `rgba(255,214,140,${0.45 * nightF})`); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26, 170, 52, 44); ctx.fillStyle = '#ffe2a0'; ctx.globalAlpha = nightF; ctx.fillRect(x - 1, 186, 3, 1); ctx.globalAlpha = 1; }
  }
  for (const s of stalls) drawStall(ctx, s.kind, s.x, dayF, t);
  const rain = ['rain', 'storm'].includes(env.weather.kind), n = crowd(env);
  for (let i = 0; i < n; i++) {
    const r = rng(i * 977 + 3), rr = r(), dir = r() < 0.5 ? 1 : -1, sp = 3 + r() * 5;
    if (i < 2 && stalls.length) { const sx = stalls[i % stalls.length].x; drawPerson(ctx, sx + 15 + i * 3, Y + 4, rr, dayF, t, rain, env.winter, false); continue; } // очередь
    const x = ((((r() * (W + 40)) + dir * sp * t) % (W + 40)) + W + 40) % (W + 40) - 20;
    drawPerson(ctx, Math.round(x), Y + 2 + ((r() * 4) | 0), rr, dayF, t, rain && r() < 0.8, env.winter, true);
  }
}

// Секреты города: редкие события, которые можно найти кликом.
// secret = { id, name, hint, found, layer: 'sky'|'street', state(env) → null | { x, y, w, h, p }, draw(ctx, env, st, dayF) }
export function drawSecrets(ctx, env, dayF, secrets, layer) {
  for (const s of secrets || []) {
    if (s.layer !== layer) continue;
    const st = env.forceSecret === s.id ? s.state({ ...env, forced: true }) : s.state(env);
    if (st) s.draw(ctx, env, st, dayF);
  }
}
export function secretAt(x, y, env, secrets) {
  for (const s of secrets || []) {
    const st = env.forceSecret === s.id ? s.state({ ...env, forced: true }) : s.state(env);
    if (st && x >= st.x - 3 && x < st.x + st.w + 3 && y >= st.y - 3 && y < st.y + st.h + 3) return s;
  }
  return null;
}

// Салют: вспышки над точкой (cx, top), каждые ~1,4 с новая
export function drawFireworks(b, t, cx, top, dayF) {
  const vis = 1 - dayF * 0.7, cols = ['#ff5a4a', '#ffd84a', '#6ae0ff', '#b88aff', '#8aff9a', '#ffffff'];
  for (let k = 0; k < 4; k++) {
    const slot = Math.floor(t / 1.4) - k, age = t - slot * 1.4;
    if (age > 2.6) continue;
    const r = rng(slot * 17 + 5), x = cx + (r() - 0.5) * 180, y = top + r() * 40, col = cols[(r() * cols.length) | 0], rad = 4 + age * 14;
    b.globalAlpha = Math.max(0, 1 - age / 2.6) * vis; b.fillStyle = col;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; b.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad + age * age * 2), 1, 1); }
  }
  b.globalAlpha = 1;
}
