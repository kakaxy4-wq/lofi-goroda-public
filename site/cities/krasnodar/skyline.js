// Краснодар: вид с острова парка 30-летия Победы через Затон Кубани на восток-северо-восток.
// Слева направо: Поцелуев мост (пешеходный, вантовый, А-образный пилон), высотки Кубанской
// набережной, стадион «Краснодар» с медиафасадом (на деле ~7 км — художественно приближен),
// телебашня (180 м), Свято-Екатерининский собор, высотки центра. Внизу — Кубанская набережная.

import { mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  far: '#b4ada4', farDark: '#a0998f', farRoof: '#8e877e',
  tower: '#ece6da', towerShade: '#cfc7b8', towerB: '#e2d2b8', towerBShade: '#c4b294', towerC: '#cbd6de', towerCShade: '#a9b6c0', accent: '#c8744a',
  tree: '#4c7a36', treeDark: '#3a632c', grass: '#86a24c',
  bridge: '#f4f4f0', bridgeDark: '#bcc0c6', cable: '#d6dae0',
  stadium: '#e4e6ea', stadiumDark: '#aeb2ba', screen: '#46505c', screenHi: '#5a8a78',
  tv: '#9aa2ac', tvDark: '#6e7680',
  brick: '#b85038', brickDark: '#903c2a', trim: '#f2e8d6', gold: '#e8b838', goldDark: '#b88a22', winDark: '#5a4048',
  road: '#7a746c', granite: '#a89e8e', graniteDark: '#80786c',
};
const NIGHT = {
  far: '#1e2238', farDark: '#191c30', farRoof: '#141729',
  tower: '#262b44', towerShade: '#1e2238', towerB: '#2a2a40', towerBShade: '#222236', towerC: '#24293e', towerCShade: '#1c2034', accent: '#3a2a30',
  tree: '#121a18', treeDark: '#0e1513', grass: '#161e1a',
  bridge: '#9aa0ac', bridgeDark: '#5e6470', cable: '#7a8290',
  stadium: '#6a7080', stadiumDark: '#40465a', screen: '#1a1e2a', screenHi: '#20283a',
  tv: '#3a4052', tvDark: '#2a3040',
  brick: '#6a3428', brickDark: '#502820', trim: '#9a8e7a', gold: '#c89a3a', goldDark: '#8a6a2a', winDark: '#1a1420',
  road: '#24222a', granite: '#2a2830', graniteDark: '#201e26',
};
// Осень на юге поздняя и золотая; зима мягкая — деревья голые, но трава не белеет
const AUTUMN = { day: { tree: '#b89434', treeDark: '#8e6a2a', grass: '#a09a4a' }, night: { tree: '#221c14', treeDark: '#1a1510' } };
const WINTER = { day: { tree: '#6a6658', treeDark: '#555246', grass: '#8a9070' }, night: { tree: '#18191c', treeDark: '#131416' } };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Геометрия ориентиров (нужна и дальнему плану, и ночной подсветке)
const SX = 238;             // стадион: левый край медиафасада, ширина 48
const TX = 323;             // телебашня
const CX = 362;             // главный купол собора
const PX = 66, PT = 112;    // Поцелуев мост: А-образный пилон и его вершина
const deckY = (x) => Math.round(153 - x * 0.03); // настил моста чуть уходит вдаль к набережной

// Купол: строки ширины от вершины вниз
function dome(R, cx, top, widths, c, cDark) {
  widths.forEach((w, i) => { R(c, cx - (w >> 1), top + i, w, 1); if (w > 3) R(cDark, cx + (w >> 1) - 2, top + i, 2, 1); });
}
function lineR(R, x0, y0, x1, y1, c, th = 1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= n; i++) R(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), th, 1);
}

export function drawFar({ g, P, winter, r, L, R }) {
  // 1. дальний малоэтажный город
  for (let x = 0; x < W;) {
    const w = 5 + ((r() * 10) | 0), h = 4 + ((r() * 12) | 0), top = 148 - h;
    R(r() < 0.5 ? 'far' : 'farDark', x, top, w, h); R('farRoof', x, top, w, 1);
    for (let yy = top + 2; yy < 146; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.3) L(xx, yy, 'win');
    x += w;
  }

  // 2. телебашня на улице Радио: решётчатая, сужается кверху
  for (let y = 30; y < 148; y++) {
    const hw = Math.round(1 + (y - 30) / 118 * 6);
    R('tv', TX - hw, y, 1, 1); R('tvDark', TX + hw, y, 1, 1);
    if (y % 7 === 0) R('tv', TX - hw, y, hw * 2 + 1, 1);
    if (y % 7 === 3) R('tvDark', TX - (hw >> 1), y, hw + 1, 1);
  }
  R('tv', TX - 3, 64, 7, 2); R('tvDark', TX - 3, 66, 7, 1); // площадка
  R('tv', TX - 2, 96, 5, 1);
  R('tv', TX, 18, 1, 12); // антенна
  L(TX, 18, 'red', '#ff3a3a', 0); L(TX, 64, 'red', '#ff3a3a', 0); L(TX, 100, 'red', '#ff3a3a', 0);

  // 3. стадион «Краснодар»: кольцо с медиафасадом по периметру
  for (let i = 0; i < 48; i++) { // вантовая крыша — пологим горбом над кольцом
    const top = 128 - Math.round(4 * Math.sin(Math.PI * (i + 0.5) / 48));
    R(i < 2 || i > 45 ? 'stadiumDark' : 'stadium', SX + i, top, 1, 130 - top);
  }
  R('stadiumDark', SX + 2, 129, 44, 1);
  R('screen', SX + 1, 130, 46, 9); R('screen', SX, 131, 48, 7); // медиафасад со скруглёнными краями
  for (let x = SX + 1; x < SX + 47; x += 2) R((x >> 1) % 3 ? 'screenHi' : 'screen', x, 132 + ((x >> 2) % 3), 1, 3); // днём — бледная картинка
  R('stadiumDark', SX + 1, 139, 46, 1); R('stadium', SX + 2, 140, 44, 7);
  for (let x = SX + 4; x < SX + 44; x += 5) R('stadiumDark', x, 141, 2, 6); // входы
  for (let x = SX + 3; x < SX + 45; x += 4) L(x, 143, 'win');

  // 4. Свято-Екатерининский собор: красный кирпич, пять глав, главная — золотая; колокольня у входа
  R('brick', 342, 118, 40, 30); R('brickDark', 374, 118, 8, 30);
  R('trim', 341, 117, 42, 1); R('trim', 342, 129, 40, 1);
  for (let x = 345; x < 380; x += 6) { R('trim', x, 120, 3, 1); R('winDark', x, 121, 3, 6); }
  for (let x = 346; x < 380; x += 8) R('winDark', x, 133, 2, 5);
  R('brick', CX - 8, 104, 16, 14); R('brickDark', CX + 4, 104, 4, 14); R('trim', CX - 9, 103, 18, 1);
  for (const dx of [-5, -1, 3]) R('winDark', CX + dx, 107, 2, 6);
  dome(R, CX, 91, [2, 6, 10, 12, 14, 16, 16, 18, 18, 18, 18, 18], 'gold', 'goldDark');
  R('gold', CX, 83, 1, 8); R('gold', CX - 2, 85, 5, 1);
  for (const cx of [348, 377]) {
    R('brick', cx - 4, 110, 8, 8); R('brickDark', cx + 2, 110, 2, 8); R('trim', cx - 5, 109, 10, 1);
    dome(R, cx, 102, [2, 4, 6, 8, 8, 8, 8], 'gold', 'goldDark');
    R('gold', cx, 97, 1, 5); R('gold', cx - 1, 98, 3, 1);
  }
  R('brick', 331, 106, 11, 42); R('brickDark', 339, 106, 3, 42); R('trim', 330, 105, 13, 1);
  R('trim', 334, 108, 4, 1); R('winDark', 334, 109, 4, 6);
  R('brick', 333, 98, 7, 8); R('brickDark', 338, 98, 2, 8); R('winDark', 335, 100, 2, 4);
  dome(R, 336, 92, [2, 4, 6, 6, 6, 6], 'gold', 'goldDark');
  R('gold', 336, 87, 1, 5); R('gold', 335, 88, 3, 1);
  L(CX, 140, 'flood', '#ffd9a0', 0); L(336, 140, 'flood', '#ffd9a0', 0);

  // 5. высотки Кубанской набережной и центра: [x, ширина, верх, вариант]
  const TOWERS = [[2, 14, 114, 0], [24, 12, 122, 1], [104, 14, 110, 1], [120, 12, 118, 2], [136, 16, 100, 0], [154, 12, 112, 1],
    [168, 18, 92, 2], [188, 14, 106, 1], [204, 16, 98, 0], [222, 13, 114, 1], [290, 14, 110, 1],
    [388, 14, 104, 0], [404, 18, 94, 2], [424, 14, 110, 0], [440, 16, 100, 1], [458, 12, 114, 0], [472, 10, 120, 1]];
  for (const [x, w, top, b] of TOWERS) {
    const c = ['tower', 'towerB', 'towerC'][b], cs = c + 'Shade';
    R(c, x, top, w, 152 - top); R(cs, x + w - 3, top, 3, 152 - top);
    R('accent', x, top, w, 2);
    for (let y = top + 5; y < 150; y += 4) R(cs, x, y, w - 3, 1); // балконы
    for (let y = top + 3; y < 148; y += 2) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.35) L(xx, y, 'win');
    if (top < 100) L(x + (w >> 1), top - 1, 'red', '#ff3a3a', 0);
  }

  // 6. деревья вдоль набережной, дорога, фонари, гранит у воды
  for (let x = 0; x < W; x += 3) {
    const h = 5 + ((r() * 6) | 0);
    R(r() < 0.5 ? 'tree' : 'treeDark', x, 156 - h, 4, h);
  }
  R('grass', 0, 155, W, 1);
  R('road', 0, 156, W, 4); R('granite', 0, 160, W, 2); R('graniteDark', 0, 162, W, 6);
  for (let x = 6; x < W; x += 16) { R('graniteDark', x, 150, 1, 6); L(x, 149, 'lamp', '#ffd88a', 0); }

  // 7. Поцелуев мост: белый настил через Затон, А-образный пилон в центре, ванты веером
  for (let x = 0; x < 126; x++) {
    const y = deckY(x);
    R('bridge', x, y, 1, 2); R('bridgeDark', x, y + 2, 1, 1); R('cable', x, y - 3, 1, 1);
    if (x % 4 === 0) R('cable', x, y - 2, 1, 2);
  }
  const pb = deckY(PX);
  lineR(R, PX - 6, pb, PX, PT, 'bridge', 2); lineR(R, PX + 6, pb, PX + 1, PT, 'bridge', 2);
  R('bridge', PX - 3, 128, 8, 1);
  for (let k = 1; k <= 5; k++) {
    lineR(R, PX, PT + 2, PX - k * 10, deckY(PX - k * 10) - 3, 'cable');
    lineR(R, PX + 1, PT + 2, PX + 1 + k * 10, deckY(PX + 1 + k * 10) - 3, 'cable');
  }
  R('bridgeDark', PX - 1, pb + 3, 3, 168 - pb - 3); // опора в воде
  R('bridgeDark', 122, deckY(122) + 3, 3, 168 - deckY(122) - 3);
  for (let x = 8; x < 124; x += 18) { R('cable', x, deckY(x) - 7, 1, 4); L(x, deckY(x) - 8, 'lamp', '#fff0c8', 0); } // шары-фонари
}

// ---------- ночь: медиафасад, подсветка моста, собор и телебашня ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  // медиафасад стадиона: цвета перетекают волной (в дни матчей — drawEvents)
  if (env.event?.kind !== 'match') {
    const base = (t * 12) % 360;
    g.globalAlpha = nightF * 0.9;
    for (let i = 0; i < 16; i++) { g.fillStyle = `hsl(${(base + i * 14) % 360},75%,58%)`; g.fillRect(SX + i * 3, 130, 3, 9); }
    g.globalAlpha = 1;
    const halo = g.createRadialGradient(SX + 24, 134, 2, SX + 24, 134, 34);
    halo.addColorStop(0, `hsla(${(base + 100) % 360},80%,60%,${0.16 * nightF})`); halo.addColorStop(1, 'hsla(0,0%,0%,0)');
    g.fillStyle = halo; g.fillRect(SX - 12, 100, 72, 48);
  }
  // Поцелуев мост: разноцветная иллюминация по пилону и вантам
  const hue = (t * 20) % 360;
  g.globalAlpha = nightF * 0.85;
  for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) {
    const x0 = s < 0 ? PX : PX + 1, x1 = x0 + s * k * 10, y1 = deckY(x1) - 3, n = Math.ceil(Math.hypot(x1 - x0, y1 - PT - 2));
    g.fillStyle = `hsl(${(hue + k * 36) % 360},80%,65%)`;
    for (let i = 0; i <= n; i += 3) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(PT + 2 + (y1 - PT - 2) * i / n), 1, 1);
  }
  g.fillStyle = `hsl(${(hue + 180) % 360},70%,70%)`;
  for (let y = PT; y < deckY(PX); y += 2) { const k = (y - PT) / (deckY(PX) - PT); g.fillRect(Math.round(PX - k * 6), y, 1, 1); g.fillRect(Math.round(PX + 1 + k * 5), y, 1, 1); }
  // собор — тёплым светом, золото главы бликует
  g.globalAlpha = 1;
  const c = g.createRadialGradient(CX, 108, 2, CX, 108, 32);
  c.addColorStop(0, `rgba(255,200,120,${0.2 * nightF})`); c.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = c; g.fillRect(CX - 36, 76, 72, 72);
  // телебашня светится по всей высоте
  g.globalAlpha = nightF * (0.6 + 0.4 * Math.sin(t * 0.8));
  g.fillStyle = '#cfe6ff';
  for (let y = 34; y < 146; y += 10) { const hw = Math.round(1 + (y - 30) / 118 * 6); g.fillRect(TX - hw, y, 1, 1); g.fillRect(TX + hw, y, 1, 1); }
  g.globalAlpha = 1;
}

// ---------- теплоход по Затону в навигацию + набережная на нашем берегу ----------
export function drawBoats(ctx, env, dayF, t) {
  drawBoat(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
}
export function drawAboveLate(b, env, dayF, t) { drawCars(b, env, dayF, t); }

function drawBoat(ctx, env, dayF, t) {
  if (env.frozen || !env.navigation) return;
  const h = env.local.getUTCHours();
  if (h < 10 || h > 21) return;
  const p = ((env.ms / 1000 + 300) % 540) / 240;
  if (p >= 1) return;
  const x = Math.round(520 - p * 580), y = 186, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 34, 4); ctx.fillRect(x - 2, y + 1, 2, 2); // корпус, нос влево
  ctx.fillStyle = mixHex('#1a2030', '#2a5a9a', dayF); ctx.fillRect(x, y + 2, 34, 1);
  ctx.fillStyle = mixHex('#15181f', '#3a4250', dayF); ctx.fillRect(x + 1, y + 4, 32, 2);
  ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 4, y - 4, 26, 4); // нижняя палуба
  ctx.fillStyle = mixHex('#30343e', '#c8ccd4', dayF); ctx.fillRect(x + 5, y - 6, 24, 1); // леер открытой верхней палубы
  for (let i = 0; i < 5; i++) { ctx.fillStyle = mixHex('#141018', ['#c8423a', '#3a6ab0', '#e8c040', '#4a8a5a', '#e8e4dc'][i], 0.35 + dayF * 0.65); ctx.fillRect(x + 7 + i * 4, y - 8, 1, 2); } // пассажиры
  ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7;
  for (let i = 0; i < 7; i++) ctx.fillRect(x + 6 + i * 3, y - 3, 2, 1);
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(x + 34, y + 5, 12, 1); ctx.fillRect(x + 40, y + 6, 8, 1);
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике — миска кубанской черешни
export function drawSill(R, SILL) {
  for (let i = 0; i < 4; i++) R(i ? '#dcd6ca' : '#f0ebe0', 428 + i, SILL - 5 + i, 18 - i * 2, 1);
  R('#b4aea2', 432, SILL - 1, 10, 1);
  for (const [x, y] of [[429, SILL - 7], [432, SILL - 8], [435, SILL - 7], [438, SILL - 8], [441, SILL - 7], [433, SILL - 10], [437, SILL - 11], [440, SILL - 10]]) {
    R('#6e1020', x, y, 3, 3); R('#b8203a', x, y, 2, 2); R('#f08898', x, y, 1, 1);
  }
  R('#5a7a2a', 434, SILL - 13, 1, 3); R('#5a7a2a', 438, SILL - 14, 1, 3); R('#5a7a2a', 434, SILL - 14, 5, 1);
}

// ---------- улица: машины на Кубанской набережной, набережная с южными ларьками ----------
// Свои виды ларьков (движок принимает объект { awning, counter, goods, steam, flags })
const CUSTOM = {
  cherry: { awning: ['#c8283a', '#f4f4f4'], counter: '#8a5a34', goods: [[1, '#8a1426'], [4, '#c8283a'], [8, '#8a1426']], steam: false },
  kvas: { awning: ['#e8a030', '#f4f0e0'], counter: '#d88a2a', goods: [[2, '#6a3a14'], [7, '#6a3a14']], steam: false },
  hurma: { awning: ['#e87a20', '#f4f0e0'], counter: '#8a5a34', goods: [[1, '#f08a20'], [4, '#e0701a'], [8, '#f08a20']], steam: false },
  mandarin: { awning: ['#f0a020', '#3a7a44'], counter: '#8a5a34', goods: [[1, '#f4a020'], [5, '#f4a020'], [8, '#f4a020']], steam: false },
};
// Какие ларьки работают сейчас (не больше трёх, по сезону)
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1, day = env.local.getUTCDate();
  const summer = mo >= 5 && mo <= 9;
  if (h < 10 || h >= (summer ? 22 : 20)) return [];
  const out = [];
  if ((mo === 5 && day >= 20) || mo === 6 || (mo === 7 && day <= 15)) out.push('cherry');
  if (mo >= 7 && mo <= 9) out.push('corn');
  if (mo >= 5 && mo <= 9) out.push('kvas');
  if (mo >= 4 && mo <= 10) out.push('icecream');
  if (mo >= 10 && mo <= 12) out.push('hurma');
  if (mo === 11 || mo === 12 || mo <= 2) out.push('mandarin');
  if (mo >= 11 || mo <= 3) out.push('tea');
  return out.slice(0, 3);
}
export const SLOT_X = [150, 236, 322];
const LANES = [{ x0: -6, x1: 484, y: 158 }]; // Кубанская набережная на том берегу
function drawCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawPromenade(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env).map((k, i) => ({ kind: CUSTOM[k] || k, x: SLOT_X[i] }))); }

// ---------- секреты Краснодара ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
export const SECRETS = [
  {
    id: 'heron', name: 'Цапля над Затоном', layer: 'street',
    hint: 'Тёплым утром или вечером низко над водой пролетает кто-то длинноногий.',
    found: 'Серые цапли живут по берегам Кубани и её стариц прямо в городе и рыбачат на мелководье.',
    state(env) {
      const h = env.local.getUTCHours(), mo = month(env);
      if (!env.forced && !(mo >= 4 && mo <= 9 && ((h >= 6 && h < 9) || (h >= 18 && h < 21)) && !env.frozen)) return null;
      if (!inWin(env, 900, 30, 120)) return null;
      const p = phase(env, 900, 30, 120);
      return { x: Math.round(500 - p * 540), y: 172 + Math.round(Math.sin(p * 9) * 2), w: 16, h: 8 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, up = Math.sin(env.ms / 260) > 0;
      const body = mixHex('#3a3c44', '#d0d4da', dayF), dark = mixHex('#1a1c22', '#3e424c', dayF);
      ctx.fillStyle = body; ctx.fillRect(x + 3, y + 3, 6, 2); ctx.fillRect(x + 1, y + 2, 2, 1); ctx.fillRect(x, y + 3, 2, 1); // тело и шея
      ctx.fillStyle = mixHex('#3a3020', '#e0b040', dayF); ctx.fillRect(x - 2, y + 3, 2, 1); // клюв
      ctx.fillStyle = dark; ctx.fillRect(x + 9, y + 4, 6, 1); // ноги вытянуты назад
      if (up) { ctx.fillRect(x + 4, y, 4, 1); ctx.fillRect(x + 5, y + 1, 3, 2); } else { ctx.fillRect(x + 4, y + 5, 4, 1); ctx.fillRect(x + 5, y + 6, 3, 1); }
    },
  },
  {
    id: 'cormorants', name: 'Бакланы', layer: 'street',
    hint: 'Зимним днём над самой водой иногда проносится чёрная цепочка птиц.',
    found: 'Часть бакланов зимует на Кубани: летают низко над водой цепочкой и сушат крылья на корягах.',
    state(env) {
      const h = env.local.getUTCHours(), mo = month(env);
      if (!env.forced && !((mo >= 11 || mo <= 3) && h >= 8 && h < 17 && !env.frozen)) return null;
      if (!inWin(env, 1500, 40, 400)) return null;
      const p = phase(env, 1500, 40, 400);
      return { x: Math.round(-30 + p * 540), y: 176, w: 22, h: 5 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, c = mixHex('#0c0c10', '#23232a', dayF);
      ctx.fillStyle = c;
      for (let k = 0; k < 3; k++) {
        const bx = x + k * 8, by = y + (k % 2), up = Math.sin(env.ms / 120 + k * 1.7) > 0;
        ctx.fillRect(bx, by + 2, 4, 1); ctx.fillRect(bx + 4, by + 1, 2, 1); // тело и шея вперёд (вправо)
        ctx.fillRect(bx + 1, by + (up ? 0 : 3), 2, 1);
        ctx.fillRect(bx + 1, by + (up ? 1 : 3), 1, 1);
      }
    },
  },
  {
    id: 'wedding', name: 'Молодожёны на Поцелуевом мосту', layer: 'sky',
    hint: 'По выходным на белом мостике слева кто-то в белом платье.',
    found: 'Молодожёны вешают на перила Поцелуева моста именные замки — и целуются на счастье.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), wd = l.getUTCDay(), mo = month(env);
      if (!env.forced && !(mo >= 4 && mo <= 10 && (wd === 5 || wd === 6) && h >= 11 && h < 18)) return null;
      if (!inWin(env, 1200, 120, 500)) return null;
      return { x: 88, y: 138, w: 8, h: 12 };
    },
    draw(b, env, st, dayF) {
      const { x } = st, dim = (c) => mixHex('#141018', c, 0.35 + dayF * 0.65), foot = deckY(x) - 1;
      b.fillStyle = dim('#e0b090'); b.fillRect(x, foot - 6, 2, 2); b.fillRect(x + 3, foot - 6, 2, 2); // головы
      b.fillStyle = dim('#22222c'); b.fillRect(x, foot - 4, 2, 5); // жених
      b.fillStyle = dim('#fbfbf6'); b.fillRect(x + 3, foot - 4, 2, 2); b.fillRect(x + 2, foot - 2, 4, 3); b.fillRect(x + 5, foot - 6, 1, 3); // платье и фата
      if (Math.sin(env.ms / 500) > 0) { // сердечко
        b.fillStyle = '#ff6a8a';
        b.fillRect(x + 1, foot - 11, 1, 1); b.fillRect(x + 3, foot - 11, 1, 1); b.fillRect(x + 1, foot - 10, 3, 1); b.fillRect(x + 2, foot - 9, 1, 1);
      }
    },
  },
  {
    id: 'newyear', name: 'Новогодний салют', layer: 'sky',
    hint: 'Одна ночь в году, ровно в полночь, небо над городом расцветает.',
    found: 'В новогоднюю ночь Краснодар встречает праздник салютами над крышами.',
    state(env) {
      const l = env.local;
      if (!env.forced && !(month(env) === 1 && l.getUTCDate() === 1 && l.getUTCHours() === 0 && l.getUTCMinutes() < 20)) return null;
      return { x: 180, y: 10, w: 240, h: 80 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 300, 40, dayF); },
  },
];

// События по новостям: fireworks — салют над центром; match — медиафасад в цветах клуба
export function drawEvents(b, env, dayF, t) {
  const k = env.event?.kind;
  if (k === 'fireworks') drawFireworks(b, t, 300, 40, dayF);
  if (k === 'match') {
    const step = Math.floor(t * 4);
    for (let i = 0; i < 16; i++) { b.fillStyle = ((i + step) % 4) < 2 ? '#2fae5a' : '#101614'; b.fillRect(SX + i * 3, 130, 3, 9); }
  }
}
