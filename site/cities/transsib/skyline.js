// Лофи-поезд по Транссибу: вид из окна купе на юг. Пейзаж не стоит на месте — он бежит мимо,
// слоями с разной скоростью (параллакс): дальние хребты, сопки и степь, лес у полотна,
// опоры контактной сети, насыпь. Всё привязано к километру, где сейчас общий поезд
// (route.js), поэтому у всех слушателей за окном одно и то же место. Маршрут Москва —
// Владивосток: среднерусские леса, Урал с обелиском «Европа — Азия», Барабинская степь,
// тайга, мосты через большие реки, Байкал у Слюдянки, сопки Забайкалья и море у Владивостока.

import { mixHex, clamp, smooth } from '../../engine/util.js';
import { W, HORIZON, SILL } from '../../engine/const.js';
import { STOPS, BRIDGES, KM1 } from './route.js';
import { miniPoints } from './journey.js';

// Палитры нужны движку (комната и сезоны); пейзаж смешивает свои цвета по dayF сам
const DAY = { far: '#8a9ab8' }, NIGHT = { far: '#1e2438' };
export const PALETTE = { DAY, NIGHT, AUTUMN: { day: {}, night: {} }, WINTER: { day: {}, night: {} } };
export const NO_GULLS = true;
export function drawFar() {} // неподвижного дальнего плана у поезда нет

// px на метр пути для слоёв: чем ближе, тем быстрее бежит
const PX_FAR = 0.02, PX_MID = 0.15, PX_WOOD = 1.6, PX_POLE = 6, PX_GROUND = 10;
const CX = W / 2;

// ---------- шум ----------
const hash = (i, s = 0) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
function noise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; }
const bump = (km, a, b, edge) => smooth(a - edge, a, km) * (1 - smooth(b, b + edge, km));

// Рельеф вдоль всей линии: среднерусская равнина, вятские увалы, Урал (пик на 1650–1790),
// Зауралье и Западно-Сибирская равнина, Кузнецкое нагорье и отроги Саян, Хамар-Дабан над
// Байкалом, Яблоновый хребет, амурские сопки, Сихотэ-Алинь перед морем
const ridgeAmp = (km) => 4 + 8 * bump(km, 500, 1150, 80)
  + 26 * bump(km, 1650, 1790, 200) + 6 * bump(km, 1790, 2150, 80) + 2 * bump(km, 2150, 3260, 100)
  + 12 * bump(km, 3400, 3820, 80) + 14 * bump(km, 3900, 4150, 80) + 5 * bump(km, 4150, 4460, 80)
  + 8 * bump(km, 4515, 4930, 80) + 5 * bump(km, 4930, 5290, 80) + 18 * bump(km, 5290, 5450, 60)
  + 3 * bump(km, 5450, 5800, 80) + 14 * bump(km, 5800, 6300, 100) + 6 * bump(km, 6300, 6900, 100)
  + 8 * bump(km, 6900, 7865, 100) + 3 * bump(km, 7865, 8520, 100) + 9 * bump(km, 8520, 9200, 100)
  + 2 * bump(km, 9200, KM1, 60);

// Вода у пути: lake — гладь до галечного берега, river — под мостом до самой насыпи.
// Моста через Волгу на маршруте нет (линия идёт севернее реки) — Волга видна широкой водой
// на стоянке в Ярославле, вокзал стоит у самой реки
const WATERS = [
  { a: 277, b: 287, kind: 'river', wide: true },  // Волга у Ярославля
  { a: 1442, b: 1446, kind: 'river' },            // Кама у Перми (мост 1443.4–1444.6; границы не сверены)
  { a: 3332, b: 3336, kind: 'river', wide: true },// Обь перед Новосибирском — самая широкая
  { a: 4100, b: 4103, kind: 'river' },            // Енисей за Красноярском
  { a: 5290, b: 5340, kind: 'lake' },             // Байкал у Слюдянки
  { a: 8513, b: 8517, kind: 'river' },            // Амур перед Хабаровском
  { a: 9270, b: 9290, kind: 'lake', sea: true },  // Амурский залив у Владивостока
  ...BRIDGES.map((r) => ({ a: r.km0, b: r.km1, kind: 'river' })),
];
const waterAt = (km) => WATERS.find((w) => km > w.a && km < w.b) || null;
const lakeK = (km) => (waterAt(km) ? 1 : 0);

// Сезон и время суток → цвета слоя
function colors(env, dayF) {
  const w = env.winter, a = env.autumn, km = env.train?.km ?? 0;
  const d = (day, night) => mixHex(night, day, dayF);
  // земля: зелёная луговая, в степи — жёлто-зелёные тона
  const steppe = km > 1790 && km < 3260 ? '#8ca050' : km > 5450 && km < 5800 ? '#9aa050' : km > 6300 && km < 7500 ? '#969c48' : '#6c8c4a';
  return {
    far: d('#8e9cbc', '#1d2338'), farHi: d('#a8b4cc', '#252c44'), snow: d('#eef2f8', '#55607c'),
    // зимой вода встаёт: светлый лёд (Байкал, моря и реки — тем же приёмом, что Нева в движке)
    lake: d(w ? '#dfe8f0' : '#7d98b8', w ? '#26304a' : '#141c30'), sea: d(w ? '#d6e2ec' : '#5f7e9c', w ? '#202a40' : '#101828'),
    lakeHi: d(w ? '#9ab4c8' : '#c4d4e6', '#2a3654'), // летом блики, по льду — тёмные трещины
    hill: d(w ? '#6d7a78' : a ? '#9a8a40' : '#4a7450', '#111a1c'), hillDark: d(w ? '#56625f' : a ? '#7c6e32' : '#3a5e42', '#0d1416'),
    larch: d(w ? '#6a5d55' : a ? '#d9a032' : '#55884a', '#141c1a'), larchHi: d(w ? '#eef2f6' : a ? '#f0c050' : '#6ea05c', '#1e2826'),
    pine: d('#2c4a34', '#0e1614'), pineHi: d(w ? '#e6ecf2' : '#3c6044', '#16201e'),
    pineAmur: d('#22402c', '#0c1412'), // амурская тайга темнее
    birchTrunk: d('#d8d8d0', '#46484e'),
    ground: d(w ? '#e2e8ee' : a ? '#8c7c46' : steppe, w ? '#2a3044' : '#121814'),
    groundDark: d(w ? '#c8d0da' : a ? '#76683a' : '#58763c', w ? '#222838' : '#0e1310'),
    terrik: d('#8c8880', '#2e2e34'), terrikDark: d('#6a6660', '#222228'),
    sand: d('#e0c890', '#3a3428'), gravel: d('#8a8480', '#24242a'), gravelDark: d('#6e6864', '#1a1a20'),
    mast: d('#7c848c', '#1c2028'), wire: d('#4a5058', '#2a3038'),
    wall: d('#e8e0cc', '#6c6658'), wallShade: d('#c8bea8', '#4e4a40'), roof: d('#4a6a8a', '#1a2230'), trim: d('#2f6aa0', '#1c2a40'),
    platform: d('#a8a49c', '#2e2e34'), win: d('#5a6a80', '#1a1a24'),
  };
}

// Перебор предметов, расставленных вдоль пути через каждые step метров: (i, x на экране)
function along(cam, px, step, fn, pad = 60) {
  const half = (CX + pad) / px;
  for (let i = Math.floor((cam - half) / step); i <= Math.ceil((cam + half) / step); i++) fn(i, Math.round(CX + (i * step - cam) * px));
}

// Ёлочка: ярусы снизу вверх, светлая кромка слева (солнце на юге, мы смотрим на юг — свет сверху-спереди)
function fir(g, x, base, h, c, hi) {
  const w = Math.max(1, Math.round(h * 0.42));
  for (let y = 0; y < h; y++) {
    const k = 1 - y / h, hw = Math.max(0, Math.round(w * k * (0.75 + 0.25 * ((y % 3) === 0))));
    g.fillStyle = c; g.fillRect(x - hw, base - y, hw * 2 + 1, 1);
    if (hi && hw > 1 && y % 3 === 0) { g.fillStyle = hi; g.fillRect(x - hw, base - y, Math.max(1, hw >> 1), 1); }
  }
  g.fillStyle = c; g.fillRect(x, base - h - 1, 1, 2);
}
// Лиственница: реже, прозрачнее, макушка тоньше; зимой голая — только ствол и ветки
function larch(g, x, base, h, c, hi, bare) {
  if (bare) {
    g.fillStyle = c; g.fillRect(x, base - h, 1, h);
    for (let y = 3; y < h - 2; y += 3) { const l = Math.round((1 - y / h) * h * 0.25); g.fillRect(x - l, base - y, l, 1); g.fillRect(x + 1, base - y - 1, l, 1); }
    return;
  }
  const w = Math.max(1, Math.round(h * 0.3));
  for (let y = 0; y < h; y += 1) {
    if (y % 2 && y < h - 3) continue; // ажурная крона
    const hw = Math.round(w * (1 - y / h));
    g.fillStyle = c; g.fillRect(x - hw, base - y, hw * 2 + 1, 1);
    if (hi && hw > 1) { g.fillStyle = hi; g.fillRect(x - hw, base - y, 1, 1); }
  }
  g.fillStyle = c; g.fillRect(x, base - h, 1, h);
}
// Берёза: белый ствол и ажурная крона (осенью золотая, зимой голая — ствол остаётся белым)
function birch(g, x, base, h, c, hi, trunk, bare) {
  if (bare) {
    g.fillStyle = trunk; g.fillRect(x, base - h, 1, h);
    for (let y = 3; y < h - 2; y += 3) { const l = Math.round((1 - y / h) * h * 0.25); g.fillRect(x - l, base - y, l, 1); g.fillRect(x + 1, base - y - 1, l, 1); }
    return;
  }
  g.fillStyle = trunk; g.fillRect(x, base - h, 1, h);
  const w = Math.max(1, Math.round(h * 0.3));
  for (let y = 2; y < h; y += 1) {
    if (y % 2 && y < h - 3) continue;
    const hw = Math.round(w * (1 - y / h));
    g.fillStyle = c; g.fillRect(x - hw, base - y, hw * 2 + 1, 1);
    if (hi && hw > 1) { g.fillStyle = hi; g.fillRect(x - hw, base - y, 1, 1); }
  }
}

// ---------- над горизонтом: хребты, Байкал, сопки в тайге ----------
export function drawAbove(b, env, dayF) {
  const tr = env.train, C = colors(env, dayF), km = tr.km;
  // дальние хребты: по столбцам, у каждого свой километр
  for (let x = 0; x < W; x++) {
    const k = km + (x - CX) / PX_FAR / 1000;
    const amp = ridgeAmp(k);
    const h = amp * (0.55 * noise(k * 0.35, 1) + 0.3 * noise(k * 1.3, 2) + 0.15 * noise(k * 4.1, 3));
    const top = Math.round(HORIZON - 16 - h);
    b.fillStyle = C.far; b.fillRect(x, top, 1, HORIZON - top);
    const snowLine = HORIZON - 16 - Math.max(30, amp * 0.62); // выше — снег почти круглый год
    if (top < snowLine) { b.fillStyle = C.snow; b.fillRect(x, top, 1, Math.min(snowLine - top, 2 + ((hash(x + Math.floor(k * 50), 4) * 4) | 0))); }
    else if (env.winter && top < HORIZON - 26) { b.fillStyle = C.snow; b.fillRect(x, top, 1, 1); }
  }
  // сопки с тайгой ближе; у Байкала, больших рек и моря — гладь воды
  for (let x = 0; x < W; x++) {
    const k = km + (x - CX) / PX_MID / 1000, lk = lakeK(k);
    if (lk > 0.5) {
      b.fillStyle = waterAt(k).sea ? C.sea : C.lake; b.fillRect(x, HORIZON - 10, 1, 10);
      continue;
    }
    const h = Math.round(6 + 22 * noise(k * 2.2, 5) + 6 * noise(k * 9, 6));
    const top = HORIZON - 4 - h;
    b.fillStyle = C.hill; b.fillRect(x, top, 1, HORIZON - top);
    b.fillStyle = C.hillDark; b.fillRect(x, top + Math.max(2, h >> 1), 1, HORIZON - top - Math.max(2, h >> 1));
    // макушки деревьев по гребню
    const m = (k * 1000) / 20, f = m - Math.floor(m), hh = 1 + hash(Math.floor(m), 7) * 4;
    const spike = Math.round(hh - Math.abs(f - 0.5) * 6);
    if (spike > 0) { b.fillStyle = C.hill; b.fillRect(x, top - spike, 1, spike); }
  }
}

// ---------- ниже горизонта: лес у полотна, опоры, станция, насыпь ----------
export function drawGround(ctx, env, dayF, t) {
  const tr = env.train, C = colors(env, dayF), cam = tr.km * 1000, nightF = 1 - dayF;
  // поляна до леса
  ctx.fillStyle = C.ground; ctx.fillRect(0, HORIZON, W, SILL - HORIZON);
  ctx.fillStyle = C.groundDark; ctx.fillRect(0, HORIZON, W, 3);
  // в степи — полосы полей, уходящие от полотна
  if (tr.km > 1790 && tr.km < 3260) {
    ctx.fillStyle = C.groundDark;
    for (let x = 0; x < W; x++) {
      const k = tr.km + (x - CX) / PX_MID / 1000;
      if (noise(k * 0.8, 15) > 0.72) ctx.fillRect(x, HORIZON + 2, 1, 5);
    }
  }
  // вода: гладь от дальнего берега почти до насыпи, блики (зимой — трещины), галечный берег
  for (let x = 0; x < W; x++) {
    const wt = waterAt(tr.km + (x - CX) / PX_MID / 1000);
    if (!wt) continue;
    const shore = wt.kind === 'river' && !wt.wide ? 200 : 186 + Math.round(3 * noise((cam + (x - CX) / PX_WOOD) / 40, 8));
    ctx.fillStyle = wt.sea ? C.sea : C.lake; ctx.fillRect(x, HORIZON, 1, shore - HORIZON);
    ctx.fillStyle = C.lakeHi;
    for (let y = HORIZON + 2; y < shore - 2; y += 4) if (hash(x * 7 + y, Math.floor(t * 1.5) + y) < 0.05 + 0.02 * dayF) ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = C.gravel; ctx.fillRect(x, shore, 1, 2);
  }
  const st = STOPS.find((s) => Math.abs(s.km * 1000 - cam) < 700);
  if (tr.km > 5020 && tr.km < 5100) drawTerriki(ctx, C, cam); // терриконы Черемхово
  // лес у полотна: состав и густота по зонам; у воды и станции реже
  along(cam, PX_WOOD, 6, (i, x) => {
    const r = hash(i, 11);
    const k = tr.km + (x - CX) / PX_MID / 1000; // та же разметка, что у воды в кадре
    if (lakeK(k) > 0.5) return;
    if (st && Math.abs(i * 6 - st.km * 1000) < 260 && r < 0.85) return;
    const h = 18 + ((hash(i, 12) * 26) | 0), base = HORIZON + 10 + ((hash(i, 13) * 6) | 0);
    if (k < 1150) {                    // среднерусские леса и вятские увалы: ель с берёзой
      if (r < 0.3) birch(ctx, x, base, h, C.larch, C.larchHi, C.birchTrunk, env.winter);
      else fir(ctx, x, base, h, C.pine, C.pineHi);
    } else if (k < 1790) {             // Урал: ель и лиственница пополам
      if (r < 0.5) larch(ctx, x, base, h, C.larch, C.larchHi, env.winter);
      else fir(ctx, x, base, h, C.pine, C.pineHi);
    } else if (k < 3260) {             // степь и лесостепь: редкие берёзовые колки
      if (r < 0.22) birch(ctx, x, base, h - 4, C.larch, C.larchHi, C.birchTrunk, env.winter);
    } else if (k < 5290) {             // тайга: сосна и лиственница, гуще
      if (r < 0.4) larch(ctx, x, base, h, C.larch, C.larchHi, env.winter);
      else fir(ctx, x, base, h, C.pine, C.pineHi);
    } else if (k < 5450) {             // берег Байкала: лес реже
      if (r < 0.3) fir(ctx, x, base, h, C.pine, C.pineHi);
    } else if (k < 6300) {             // селенгинская степь: одиночные сосны
      if (r < 0.18) fir(ctx, x, base, h - 4, C.pine, C.pineHi);
    } else if (k < 7500) {             // Даурия: сосна и лиственница редко
      if (r < 0.22) { if (r < 0.11) larch(ctx, x, base, h - 4, C.larch, C.larchHi, env.winter); else fir(ctx, x, base, h - 4, C.pine, C.pineHi); }
    } else {                           // амурская тайга и Сихотэ-Алинь: темнее и гуще к югу
      if (r < 0.45) fir(ctx, x, base, h, C.pineAmur, C.pineHi);
      else larch(ctx, x, base, h, C.larch, C.larchHi, env.winter);
    }
  });
  if (st) drawStation(ctx, env, C, cam, st, nightF, t);
  // контактная сеть на всём пути: опоры с консолями
  const masts = [];
  along(cam, PX_POLE, 65, (i, x) => masts.push(x), 120);
  for (const x of masts) {
    ctx.fillStyle = C.mast;
    ctx.fillRect(x, 96, 3, 112); ctx.fillRect(x - 18, 100, 21, 2); ctx.fillRect(x - 14, 104, 2, 6);
  }
  // провода провисают между опорами
  ctx.fillStyle = C.wire;
  for (let j = 0; j < masts.length - 1; j++) {
    const a = masts[j], bx = masts[j + 1];
    for (let x = Math.max(0, a); x < Math.min(W, bx); x++) { const u = (x - a) / (bx - a); ctx.fillRect(x, 110 + Math.round(u * (1 - u) * 10), 1, 1); }
  }
  if (tr.bridge) drawTruss(ctx, C, cam);
  // насыпь у самого вагона: щебень смазан скоростью
  ctx.fillStyle = C.gravel; ctx.fillRect(0, 200, W, SILL - 200);
  const blur = clamp(tr.speed / 20) * 10;
  ctx.fillStyle = C.gravelDark;
  along(cam, PX_GROUND, 0.9, (i, x) => { const y = 201 + ((hash(i, 21) * 12) | 0); ctx.fillRect(x, y, 1 + Math.round(blur * hash(i, 22)), 1); }, 20);
}

// Терриконы Черемхово: серые конусы с тёмными полосами и копёр шахты (положение не сверено)
function drawTerriki(ctx, C, cam) {
  const spots = [5048, 5060, 5072];
  for (let j = 0; j < spots.length; j++) {
    const x = Math.round(CX + (spots[j] * 1000 - cam) * PX_MID);
    if (x < -30 || x > W + 30) continue;
    const hh = 12 + ((hash(j, 42) * 6) | 0), bw = 8 + ((hash(j, 43) * 4) | 0), base = HORIZON + 8;
    for (let y = 0; y < hh; y++) {
      const hw = Math.max(0, Math.round(bw * (1 - y / hh)));
      ctx.fillStyle = y % 3 ? C.terrik : C.terrikDark; ctx.fillRect(x - hw, base - y, hw * 2 + 1, 1);
    }
    if (j === 1) { // копёр: вышка-эстакада
      ctx.fillStyle = C.mast;
      ctx.fillRect(x + bw + 4, base - 16, 2, 16); ctx.fillRect(x + bw + 9, base - 16, 2, 16);
      ctx.fillRect(x + bw + 2, base - 17, 11, 2); ctx.fillRect(x + bw + 5, base - 22, 5, 6);
    }
  }
}

// Ферма моста: стойки и раскосы бегут мимо окна быстрее всего остального
function drawTruss(ctx, C, cam) {
  const posts = [];
  along(cam, PX_POLE, 9, (i, x) => posts.push(x), 80);
  ctx.fillStyle = C.mast;
  ctx.fillRect(0, 92, W, 3); ctx.fillRect(0, 196, W, 4); // верхний и нижний пояс
  for (let j = 0; j < posts.length; j++) {
    const x = posts[j];
    ctx.fillRect(x, 92, 3, 106);
    const nx = posts[j + 1];
    if (nx === undefined) continue;
    for (let y = 95; y < 196; y++) { const u = (y - 95) / 101; ctx.fillRect(Math.round(j % 2 ? x + (nx - x) * u : nx - (nx - x) * u), y, 2, 1); }
  }
}

// Вокзал: светлый двухэтажный вокзал с синей отделкой, длинный перрон и фонари.
// На стоянке перрон живёт: торговки с пирожками (у Байкала — с омулем), проводница у тамбура
function drawStation(ctx, env, C, cam, st, nightF, t) {
  const x0 = Math.round(CX + (st.km * 1000 - cam) * PX_POLE);
  ctx.fillStyle = C.platform; ctx.fillRect(x0 - 900, 192, 1800, 8);
  ctx.fillStyle = C.wallShade; ctx.fillRect(x0 - 900, 199, 1800, 1);
  // здание
  const bx = x0 - 90, by = 128, bw = 180, bh = 64;
  ctx.fillStyle = C.wall; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = C.wallShade; ctx.fillRect(bx, by + bh - 4, bw, 4);
  ctx.fillStyle = C.roof; ctx.fillRect(bx - 6, by - 6, bw + 12, 6); ctx.fillRect(x0 - 40, by - 12, 80, 6);
  ctx.fillStyle = C.trim; ctx.fillRect(bx, by + 30, bw, 2);
  // окна: ночью горят тёплым
  for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
    const wx = bx + 8 + i * 19, wy = by + 8 + row * 30;
    const lit = nightF > 0.3 && hash(i + row * 9, st.km) < 0.7;
    ctx.fillStyle = lit ? '#ffd27a' : C.win; ctx.fillRect(wx, wy, 11, 16);
    ctx.fillStyle = C.wallShade; ctx.fillRect(wx + 5, wy, 1, 16);
  }
  ctx.fillStyle = C.trim; ctx.fillRect(x0 - 9, by + 36, 18, 28); // дверь
  // вывеска с названием станции
  ctx.font = '9px Lofi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sw = Math.ceil(ctx.measureText(st.name).width / 2) + 5;
  ctx.fillStyle = C.trim; ctx.fillRect(x0 - sw, by - 20, sw * 2, 12);
  ctx.fillStyle = nightF > 0.3 ? '#ffe6b0' : '#f4f0e4'; ctx.fillText(st.name, x0, by - 14);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // фонари на перроне
  for (let k = -3; k <= 3; k++) {
    const lx = x0 + k * 150 + 60;
    ctx.fillStyle = C.mast; ctx.fillRect(lx, 160, 2, 32); ctx.fillRect(lx - 3, 159, 8, 2);
    if (nightF > 0.2) {
      const gr = ctx.createRadialGradient(lx + 1, 162, 0, lx + 1, 162, 26);
      gr.addColorStop(0, `rgba(255,214,140,${0.45 * nightF})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = gr; ctx.fillRect(lx - 25, 136, 52, 60);
      ctx.fillStyle = '#ffe6b0'; ctx.fillRect(lx - 2, 161, 6, 1);
    }
  }
  // жизнь на перроне — только на стоянке; у Байкала торговки с омулем есть и на короткой стоянке
  if (env.train.at !== st) return;
  const baikal = st.km > 5290 && st.km < 5340;
  if (st.dwell >= 10 || baikal) {
    const ox = x0 - 150;
    // столик с товаром
    ctx.fillStyle = C.mast; ctx.fillRect(ox, 184, 16, 8);
    ctx.fillStyle = C.wall; ctx.fillRect(ox - 1, 184, 18, 1);
    // 1–2 торговки в платках
    for (let j = 0; j < 2; j++) {
      if (j && hash(st.km, 51) < 0.5) break;
      const fx = ox - 8 - j * 8;
      ctx.fillStyle = j ? '#c84a3a' : '#3a6ac4'; ctx.fillRect(fx, 179, 3, 2);  // платок
      ctx.fillStyle = '#d8a878'; ctx.fillRect(fx + 1, 180, 1, 1);              // лицо
      ctx.fillStyle = j ? '#a83a2c' : '#2e4a94'; ctx.fillRect(fx, 181, 3, 6);  // платье
      ctx.fillStyle = '#2e2a28'; ctx.fillRect(fx, 187, 3, 5);                  // юбка
    }
    // табличка на двух ножках: у Байкала — «Омуль», иначе «Пирожки»
    ctx.fillStyle = C.mast; ctx.fillRect(ox + 2, 168, 1, 16); ctx.fillRect(ox + 13, 168, 1, 16);
    ctx.fillStyle = '#f4f0e4'; ctx.fillRect(ox - 10, 159, 26, 9);
    ctx.font = '7px Lofi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2e3a4e'; ctx.fillText(baikal ? 'Омуль' : 'Пирожки', ox + 3, 164);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (baikal) { // связка вяленого омуля на краю стола
      ctx.fillStyle = '#c4c8cc';
      for (let j = 0; j < 3; j++) { ctx.fillRect(ox + 17, 178 + j * 2, 4, 1); ctx.fillRect(ox + 21, 178 + j * 2, 1, 1); }
    }
    // пар над пирожками
    ctx.fillStyle = '#f4f0e8';
    for (let j = 0; j < 3; j++) if (hash(Math.floor(t * 2) + j, 52) < 0.7) ctx.fillRect(ox + 4 + j * 4, 183 - (Math.floor(t * 2 + j * 1.3) % 3), 1, 1);
  }
  // проводница у тамбура: стоит, изредка шагает
  const gx = x0 + 230 + (Math.sin(t * 0.7) > 0.75 ? 1 : 0);
  ctx.fillStyle = '#f4f0e4'; ctx.fillRect(gx, 179, 3, 1);   // фуражка
  ctx.fillStyle = '#d8a878'; ctx.fillRect(gx, 180, 3, 2);   // лицо
  ctx.fillStyle = '#2e3a4e'; ctx.fillRect(gx, 182, 3, 7);   // форма
  ctx.fillStyle = '#22262e'; ctx.fillRect(gx, 189, 3, 3);   // юбка
}

// ---------- тоннелей на Транссибе нет — слой пуст ----------
export function drawCover() {}

// Покачивание: на стыках вид за окном вздрагивает на пиксель
export function sway(env) {
  const tr = env.train;
  if (!tr.speed || tr.dark > 0.9) return 0;
  const p = ((tr.km * 1000) % 25) / 25;
  return p < 0.035 ? 1 : 0;
}

// ---------- купе: нижняя полка, схема маршрута на столе, дверь в коридор с титаном ----------
// Цвета комнаты умножаются на тот же тон, что движок кладёт на интерьер (день — холодный, ночь — тёплый)
const mul = (c, tint) => { const a = parseInt(c.slice(1), 16), b = parseInt(tint.slice(1), 16); const ch = (s) => Math.round(((a >> s) & 255) * ((b >> s) & 255) / 255); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
const roomTint = (dayF) => mixHex('#9a7866', '#a4a2b4', dayF);

// Нижняя полка вместо кресла: дерматин, свёрнутое одеяло, подушка и пакет с бельём
export function drawSeat(ctx, env, dayF) {
  const tn = roomTint(dayF), R = (c, x, y, w, h) => { ctx.fillStyle = mul(c, tn); ctx.fillRect(x, y, w, h); };
  R('#2c1e16', 0, 256, 96, 14);
  R('#5e2a2a', 0, 222, 90, 36); R('#4a2020', 0, 256, 90, 2);              // передняя стенка полки
  for (let x = 14; x < 90; x += 19) R('#4e2222', x, 224, 1, 32);           // швы обивки
  R('#7e3634', 0, 210, 92, 12); R('#9a4a44', 0, 210, 92, 1); R('#5a2626', 0, 221, 92, 1); // сиденье
  // одеяло, сложенное вчетверо: клетка
  for (let y = 199; y < 211; y++) for (let x = 4; x < 46; x++) {
    let c = (x >> 2) % 2 === (y >> 2) % 2 ? '#3e5a7a' : '#2f4862';
    if (x % 8 === 0 || y % 8 === 3) c = '#c8b890';
    R(c, x, y, 1, 1);
  }
  R('#24384e', 4, 210, 42, 1);
  R('#f0ece2', 12, 194, 24, 6); R('#d8d2c4', 12, 199, 24, 1); R('#5a7ab8', 12, 196, 24, 1); // бельё в пакете
  // подушка у окна
  for (let y = 0; y < 14; y++) { const w = 38 - Math.abs(7 - y) % 3; R(y < 2 ? '#f4f2ec' : '#e6e2d8', 50 + (38 - w) / 2 | 0, 197 + y, w, 1); }
  R('#c8c2b4', 50, 210, 38, 1); R('#f8f6f0', 56, 199, 14, 2);
  // верхняя полка: торец с обивкой и скатанный полосатый матрас; поручень-лесенка
  R('#5e2a2a', 0, 104, 88, 8); R('#7e3634', 0, 104, 88, 2); R('#4a2020', 0, 111, 88, 1);
  R('#9aa0a8', 86, 102, 2, 12);                                                     // ограничитель
  for (let x = 6; x < 64; x++) { const stripe = ((x >> 2) % 2) ? '#e8e2d4' : '#6a7aa0'; R(stripe, x, 96, 1, 8); }
  R('#d8d2c4', 6, 96, 58, 1); R('#4a5878', 6, 103, 58, 1); R('#c8c2b4', 63, 97, 2, 6); // торцы скатки
  R('#8a8e96', 82, 112, 2, 98); R('#b8bcc4', 82, 112, 1, 98);                      // поручень
  for (const y of [140, 170]) { R('#8a8e96', 74, y, 10, 2); R('#b8bcc4', 74, y, 10, 1); } // ступеньки
}

function drawRouteCard(ctx, env, dayF, t) {
  const tn = roomTint(dayF), R = (c, x, y, w, h) => { ctx.fillStyle = mul(c, tn); ctx.fillRect(x, y, w, h); };
  const x0 = 256, y0 = 197;
  R('#3a2416', x0 + 2, 237, 42, 1);                          // тень на столе
  R('#26344e', x0, y0, 44, 38);                              // рамка
  R('#efe6cf', x0 + 2, y0 + 2, 40, 34);                      // бумага
  R('#2f5a8a', x0 + 2, y0 + 2, 40, 4); R('#e8d8a8', x0 + 4, y0 + 3, 12, 1); R('#e8d8a8', x0 + 18, y0 + 3, 8, 1);
  R('#a8c4dc', x0 + 30, y0 + 12, 2, 6);                      // Байкал
  R('#a8c4dc', x0 + 39, y0 + 26, 2, 2);                      // Японское море у угла
  const m = miniPoints(x0 + 3, y0 + 8, 38, 21), tr = env.train;
  for (let km = 0; km <= KM1; km += 25) {
    const [x, y] = m.at(km), done = tr.dir > 0 ? km <= tr.km : km >= tr.km;
    R(done ? '#c8423a' : '#6a7a90', Math.round(x), Math.round(y), 1, 1);
  }
  for (const st of STOPS) { const [x, y] = m.at(st.km); R('#26344e', Math.round(x), Math.round(y) - 1, 1, 1); }
  const [cx, cy] = m.at(tr.km);
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff5040' : '#ffd060'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
  ctx.font = '7px Lofi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2f5a8a'; ctx.fillText('9288 км', x0 + 22, y0 + 34);
  ctx.textAlign = 'left';
  R('#1a2438', x0 + 8, 235, 3, 2); R('#1a2438', x0 + 33, 235, 3, 2); // ножки-подставка
}

function drawCorridor(ctx, env, dayF, t) {
  const tn = roomTint(dayF), R = (c, x, y, w, h) => { ctx.fillStyle = mul(c, tn); ctx.fillRect(x, y, w, h); }, nightF = 1 - dayF;
  // стена купе справа, пластик «под дерево», и широкий проём откатной двери
  R('#cbb48c', 432, 0, 48, 226); for (let x = 435; x < 480; x += 7) R('#b8a07a', x, 0, 1, 226);
  R('#9aa0a8', 436, 22, 2, 204); R('#9aa0a8', 476, 22, 2, 204); R('#9aa0a8', 436, 22, 42, 2);
  // коридор: противоположная стена с окном и занавесками, пол с ковровой дорожкой, плафон
  R('#e2d4ae', 438, 24, 38, 172); R('#cdbf98', 438, 24, 38, 2);
  const sky = mixHex('#141a30', '#9ec0e0', dayF);
  ctx.fillStyle = sky; ctx.fillRect(440, 56, 12, 46);                              // окно коридора — на другую сторону
  ctx.fillStyle = mixHex('#1a2430', '#5a7a5a', dayF); ctx.fillRect(440, 90, 12, 12); // лес той стороны
  R('#9aa0a8', 439, 55, 14, 1); R('#9aa0a8', 439, 102, 14, 1); R('#9aa0a8', 445, 56, 1, 46);
  R('#d8c8a0', 438, 54, 3, 30); R('#d8c8a0', 451, 54, 3, 30);                       // занавески коридора
  R('#b8a684', 438, 196, 38, 30);
  for (let y = 196; y < 226; y++) { const w = 14 + (y - 196) * 0.2 | 0; R(y % 5 ? '#6e2a26' : '#7e322c', 456 - (w >> 1), y, w, 1); } // дорожка: ровная, чуть шире к нам
  ctx.fillStyle = nightF > 0.3 ? '#ffe0a0' : mul('#f4f0e0', tn); ctx.fillRect(446, 26, 16, 2);
  // ТИТАН: блестящий цилиндр, купол с трубой в потолок, табличка, термометр, стекло уровня воды,
  // латунный кран с рычагом, поддон-решётка со стаканом, внизу — дверца топки
  const x0 = 454, w = 20, top = 82, bot = 176;
  const steel = ['#6e747e', '#8c929c', '#aab0ba', '#c4cad2', '#dfe4ea', '#f4f7fa', '#dfe4ea', '#c4cad2', '#b4bac4', '#aab0ba', '#a0a6b0', '#969ca6', '#8c929c', '#848a94', '#7c828c', '#767c86', '#70767f', '#6a7079', '#646a73', '#5c626b'];
  R('#4a4a52', x0 + 9, 24, 3, top - 30);                                             // дымовая труба в потолок
  R('#5a5a62', x0 + 7, 24, 7, 2);
  for (let i = 0; i < 6; i++) { const hw = Math.round(w / 2 * Math.sqrt(1 - ((6 - i) / 7) ** 2)); R(steel[Math.min(19, 10 - hw + 5)], x0 + 10 - hw, top - 6 + i, hw * 2, 1); } // купол
  for (let i = 0; i < w; i++) R(steel[i], x0 + i, top, 1, bot - top);                 // тело с бликом
  R('#5c626b', x0, top + 8, w, 1); R('#5c626b', x0, bot - 6, w, 1);                   // обечайки
  R('#c8423a', x0 + 3, top + 12, 14, 5); for (let i = 0; i < 6; i++) R('#f4ece4', x0 + 4 + i * 2, top + 14, 1, 1); // «КИПЯТОК»
  // термометр: круглый циферблат со стрелкой
  for (let yy = -4; yy <= 4; yy++) { const hw = Math.round(Math.sqrt(16 - yy * yy)); R(yy === -4 || yy === 4 ? '#2a2a30' : '#f6f2e8', x0 + 7 - hw, top + 26 + yy, hw * 2 + 1, 1); }
  R('#2a2a30', x0 + 3, top + 26, 1, 1); R('#2a2a30', x0 + 11, top + 26, 1, 1);
  const ang = -0.6 + 1.2 * (0.8 + 0.2 * Math.sin(t * 0.2));                            // кипит — стрелка у ста
  ctx.fillStyle = '#c8302a'; for (let r = 0; r < 4; r++) ctx.fillRect(Math.round(x0 + 7 + Math.sin(ang) * r), Math.round(top + 26 - Math.cos(ang) * r), 1, 1);
  // стекло уровня воды: трубка в латунных колпачках
  R('#c8963a', x0 + 15, top + 20, 3, 2); R('#c8963a', x0 + 15, top + 52, 3, 2);
  R('#cfe4ee', x0 + 16, top + 22, 1, 30); R('#3a6a9a', x0 + 16, top + 34, 1, 18);
  // кран: латунный корпус, рычаг, носик; поддон-решётка; стакан в подстаканнике
  const ty = top + 60;
  R('#a87a2a', x0 + 6, ty, 8, 4); R('#e0b050', x0 + 6, ty, 8, 1); R('#8a6020', x0 + 9, ty + 4, 2, 3);
  R('#2a2a30', x0 + 12, ty - 5, 1, 5); R('#2a2a30', x0 + 12, ty - 6, 3, 1);           // рычаг
  R('#5a5e66', x0 + 2, ty + 15, 16, 2); for (let i = 0; i < 16; i += 2) R('#3a3e46', x0 + 2 + i, ty + 15, 1, 2); // поддон
  R('#c4cad2', x0 + 7, ty + 9, 6, 6); R('#a8501a', x0 + 8, ty + 10, 4, 3); R('#8c929c', x0 + 7, ty + 13, 6, 2); // стакан
  if ((t % 5) < 0.6) { ctx.fillStyle = '#cfe4f4'; ctx.fillRect(x0 + 9, ty + 7 + ((t % 5) * 4 | 0), 1, 1); }       // капля из крана
  // низ: топка с дверцей и прорезями, ножки
  R('#4a4e56', x0, bot, w, 16); R('#5c626b', x0, bot, w, 1);
  R('#2e3036', x0 + 4, bot + 4, 12, 9); R('#9aa0a8', x0 + 14, bot + 7, 2, 2);          // дверца и ручка
  const glow = nightF * (0.55 + 0.45 * Math.sin(t * 3.1) * Math.sin(t * 1.7));
  for (let i = 0; i < 3; i++) { R('#1a1a1e', x0 + 6, bot + 6 + i * 2, 8, 1); if (glow > 0.05) { ctx.globalAlpha = glow; ctx.fillStyle = '#ff8a3a'; ctx.fillRect(x0 + 6, bot + 6 + i * 2, 8, 1); ctx.globalAlpha = 1; } }
  R('#2a2a30', x0 + 1, bot + 16, 3, 4); R('#2a2a30', x0 + w - 4, bot + 16, 3, 4);
  // пар из-под купола
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 10; i++) { const ph = (t * 0.22 + i / 10) % 1; ctx.globalAlpha = 0.2 * (1 - ph); ctx.fillRect(x0 + 6 + ((i * 5) % 9) + Math.round(Math.sin(t + i) * 2), top - 7 - ph * 30, 1, 1); }
  ctx.globalAlpha = 1;
  R('#7a5a3c', 474, 24, 3, 202);                                                     // торец откатной двери
}

export function drawRoom(ctx, env, dayF, t) {
  drawCorridor(ctx, env, dayF, t);
  drawRouteCard(ctx, env, dayF, t);
}

// ---------- секреты ----------
const month = (env) => env.local.getUTCMonth() + 1;
const secT = (env) => env.ms / 1000;
export const SECRETS = [
  {
    id: 'obelisk', name: 'Обелиск Европа — Азия', layer: 'street',
    hint: 'На ходу, между Пермью и Екатеринбургом, у полотна мелькает каменный столб — поезд пересекает границу двух частей света.',
    found: 'На 1777-м километре граница Европы и Азии. Обелиск у о.п. Вершина — здесь Транссиб переезжает из одной части света в другую; такие же столбы стоят и на других перевалах Урала.',
    state(env) {
      const tr = env.train;
      if (!env.forced && !(tr.km > 1774 && tr.km < 1780 && tr.speed > 0)) return null; // зона о.п. Вершина (1777)
      const cam = tr.km * 1000, x = Math.round(CX + (1777 * 1000 - cam) * PX_WOOD);
      if (!env.forced && (x < -20 || x > W + 20)) return null;
      return { x: env.forced ? 300 : x, y: HORIZON + 6, w: 8, h: 14 };
    },
    draw(ctx, env, st, dayF) {
      const c = mixHex('#8a8a86', '#3a3a40', dayF), d = mixHex('#6e6e6a', '#2c2c32', dayF), { x, y } = st;
      ctx.fillStyle = d; ctx.fillRect(x + 1, y + 12, 6, 2);      // постамент
      ctx.fillStyle = c; ctx.fillRect(x + 2, y + 2, 4, 10);      // стела
      ctx.fillStyle = d; ctx.fillRect(x + 3, y, 2, 2);           // шпиль
      ctx.fillStyle = mixHex('#d8d4c8', '#55555c', dayF); ctx.fillRect(x + 2, y + 6, 4, 2); // табличка
    },
  },
  {
    id: 'nerpa', name: 'Нерпа у Байкала', layer: 'street',
    hint: 'Летом у берега Байкала приглядитесь к воде: блеснёт тёмная голова — и круги по глади.',
    found: 'Байкальская нерпа — единственный пресноводный тюлень мира. Живёт в Байкале, зимой дышит через продухи во льду.',
    state(env) {
      const tr = env.train, mo = month(env), h = env.local.getUTCHours();
      if (!env.forced && !(tr.km > 5290 && tr.km < 5340 && mo >= 5 && mo <= 9 && h >= 6 && h < 21)) return null;
      const x = env.forced ? 180 : Math.round(CX + (hash(Math.floor(tr.km * 10), 61) * 160 - 80));
      return { x, y: HORIZON + 5, w: 6, h: 4 };
    },
    draw(ctx, env, st, dayF) {
      const c = mixHex('#141820', '#2a3038', dayF), r = mixHex('#b8c8d8', '#39445c', dayF), { x, y } = st, k = Math.floor(secT(env) * 1.5) % 2;
      ctx.fillStyle = r; ctx.fillRect(x - 2, y + 1 + k, 1, 1); ctx.fillRect(x + 4, y + 2 - k, 1, 1); ctx.fillRect(x - 1, y + 3, 1, 1); ctx.fillRect(x + 3, y, 1, 1); // круги
      ctx.fillStyle = c; ctx.fillRect(x, y + k, 3, 2); ctx.fillRect(x + 2, y - 1 + k, 1, 1); // голова и морда
    },
  },
  {
    id: 'km9288', name: 'Столб 9288 км', layer: 'street',
    hint: 'На стоянке во Владивостоке отыщите справа от вокзала полосатый километровый столб.',
    found: 'У вокзала Владивостока стоит столб с числом 9288 — столько километров от Ярославского вокзала Москвы. Конец Транссиба, дальше — море.',
    state(env) {
      const tr = env.train;
      if (!env.forced && !(tr.at && tr.at.km === KM1)) return null; // только на стоянке во Владивостоке
      return { x: 400, y: 174, w: 12, h: 18 }; // на перроне, справа от здания вокзала
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#e8e4dc', '#4e4c52', dayF); ctx.fillRect(x + 5, y + 8, 2, 10); // белый столб
      ctx.fillStyle = mixHex('#c8423a', '#6e2822', dayF);
      for (const yy of [9, 12, 15]) ctx.fillRect(x + 5, y + yy, 2, 2);                       // красные полосы
      ctx.fillStyle = mixHex('#2e3a4e', '#1c2430', dayF); ctx.fillRect(x, y, 12, 8);         // табличка
      ctx.font = '7px Lofi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4f0e4'; ctx.fillText('9288', x + 6, y + 4);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    },
  },
];
