// Владивосток: окно на склоне сопки Орлиное Гнездо (199 м, центр города), смотрим на юг-юго-запад,
// на бухту Золотой Рог. Слева направо: лесистая сопка и застроенные склоны мыса Чуркина (южный берег),
// вдали — Русский мост на остров Русский (на самом деле он почти точно за Золотым мостом, в кадре
// сдвинут влево — художественное сжатие), Золотой мост через бухту, Корабельная набережная
// с подводной лодкой С-56, Морской вокзал, краны порта и сопки центра.
// Набережная переднего плана придвинута к окну — тоже художественное сжатие.

import { rng, mixHex } from '../../engine/util.js';
import { W } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawFireworks } from '../../engine/street.js';

const DAY = {
  isl: '#9aa8bc', islDark: '#8a98ae', farBr: '#c8d0dc', farBrDark: '#a8b2c2',
  hill: '#6a8858', hillDark: '#587548', tree: '#3f6a3a', treeDark: '#30562e',
  hill2: '#7a9464', hill2Dark: '#66804f',
  bldg: '#e4e0d6', bldg2: '#d8cfc0', bldg3: '#c8d0d6', bldgShade: '#b0aaa0', roof: '#8a7a70', win: '#5a6474',
  pylon: '#eceae4', pylonShade: '#c4c2bc', deck: '#d8d4cc', deckDark: '#8a8680', cable: '#d0ccc4',
  quay: '#b8b2a6', quayDark: '#8a8478',
  sub: '#3a3e44', subHi: '#5a6068', subRed: '#a8342a',
  term: '#f0ece2', termShade: '#cfc8b8', termRoof: '#8a96a4',
  crane: '#d89a30', craneDark: '#a8742a', cont1: '#b8452e', cont2: '#2e6a9a', cont3: '#d8b040', cont4: '#4a8a5a',
  ship: '#8a3a30', shipTop: '#ecebe6', ferry: '#f4f4f0', ferryBand: '#2a5a9a',
  snow: '#eef2f6',
};
const NIGHT = {
  isl: '#1a2034', islDark: '#161b2e', farBr: '#4a5470', farBrDark: '#343c56',
  hill: '#141c1e', hillDark: '#10171a', tree: '#121a1a', treeDark: '#0e1414',
  hill2: '#161e22', hill2Dark: '#12191c',
  bldg: '#2a2c38', bldg2: '#2c2a34', bldg3: '#262a36', bldgShade: '#1e2028', roof: '#1c1a22', win: '#1a1622',
  pylon: '#8e8c88', pylonShade: '#6a6864', deck: '#5a5854', deckDark: '#2a2826', cable: '#6a6660',
  quay: '#2c2a32', quayDark: '#201e26',
  sub: '#1a1c22', subHi: '#2a2e36', subRed: '#5a2420',
  term: '#8e887c', termShade: '#6e6a60', termRoof: '#3a3e48',
  crane: '#5a4a30', craneDark: '#3a3024', cont1: '#3a2220', cont2: '#1e2a3a', cont3: '#3a3420', cont4: '#1e2e24',
  ship: '#2e1a18', shipTop: '#6e6c68', ferry: '#8a8a88', ferryBand: '#1e2a3e',
  snow: '#5a6478',
};
// Осень в Приморье яркая: дубы и клёны на сопках желтеют и краснеют в октябре
const AUTUMN = { day: { tree: '#b0783a', treeDark: '#8a4a2e', hill: '#8a8a52', hillDark: '#76723e', hill2: '#9a8e58' }, night: { tree: '#1e1a14', treeDark: '#181410' } };
// Зима: лес на сопках голый, снега немного, склоны буро-серые с белыми пятнами
const WINTER = {
  day: { tree: '#6e665c', treeDark: '#5a544c', hill: '#a8aaa0', hillDark: '#94968e', hill2: '#b4b6ac', hill2Dark: '#a0a298' },
  night: { tree: '#1a1a1e', treeDark: '#151518', hill: '#262a34', hillDark: '#20242e', hill2: '#2a2e38' },
};
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

const poly = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return pts[pts.length - 1][1];
};
// Мыс Чуркина: слева лесистая сопка, седловина (за ней виден Русский мост), застроенные склоны к Золотому мосту
const CH = [[0, 114], [22, 110], [44, 106], [62, 110], [80, 122], [96, 138], [110, 143], [170, 144], [190, 138], [214, 128], [244, 124], [274, 132], [306, 142], [336, 152], [352, 158]];
export const chTop = (x) => Math.round(poly(CH, x));
// Сопки центра за Морским вокзалом и портом
const RS = [[330, 152], [344, 140], [362, 132], [384, 127], [404, 121], [424, 118], [444, 122], [480, 126]];
const rsTop = (x) => Math.round(poly(RS, x));
// Золотой мост: полотно идёт от Чуркина (слева, дальше) к центру (справа, ближе)
const deckY = (x) => 132 + (x - 150) * 14 / 200;
const PYL = [{ x: 200, top: 70, w: 5 }, { x: 290, top: 50, w: 7 }];

function line(R, c, x0, y0, x1, y1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) R(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
}
function panel(R, L, q, winter, x, base, w, h) {
  const top = base - h, k = q();
  R(k < 0.4 ? 'bldg' : k < 0.75 ? 'bldg2' : 'bldg3', x, top, w, h); R('bldgShade', x + w - 1, top, 1, h);
  if (winter) R('snow', x, top, w, 1);
  for (let yy = top + 2; yy < base - 1; yy += 2) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (q() < 0.4) L(xx, yy, 'win');
}

export function drawFar({ winter, L, R }) {
  const q = rng(1860); // свой генератор: раскладка не зависит от чисел движка

  // --- остров Русский вдали
  for (let x = 90; x < W; x++) { const y = Math.round(140 + Math.sin(x * 0.05) * 2 + Math.sin(x * 0.013) * 2); R(x % 7 ? 'isl' : 'islDark', x, y, 1, 168 - y); }

  // --- Русский мост (2012): A-образные пилоны, пролёт 1104 м. Далеко и бледно.
  R('farBr', 96, 137, 86, 1); R('farBrDark', 96, 138, 86, 1);
  for (const px of [120, 158]) {
    line(R, 'farBr', px - 3, 139, px, 114); line(R, 'farBr', px + 3, 139, px, 114);
    R('farBr', px - 1, 126, 3, 1);
    for (let k = 0; k < 4; k++) { line(R, 'farBrDark', px, 116 + k * 2, px - 6 - k * 4, 137); line(R, 'farBrDark', px, 116 + k * 2, px + 6 + k * 4, 137); }
    L(px, 113, 'red', '#ff3a3a', 0);
  }
  for (let x = 98; x < 182; x += 6) L(x, 136, 'lamp', '#f4e8c8', 0);

  // --- мыс Чуркина: сопки до воды
  for (let x = 0; x < 360; x++) { const y = chTop(x); R('hill', x, y, 1, 168 - y); R('hillDark', x, y + 6, 1, Math.max(0, 168 - y - 6)); }
  // лесистая сопка слева — лес подступает к городу (здесь иногда проходит тигр)
  for (let x = 16; x < 100; x += 2) { const y = chTop(x), h = 2 + ((q() * 3) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, y - h + 2, 3, h); }
  for (let x = 20; x < 96; x += 3) { const y = chTop(x) + 4 + ((q() * 14) | 0); R(q() < 0.5 ? 'tree' : 'treeDark', x, y, 3, 2); }
  // застройка на склонах: панельные дома уступами
  for (let x = 98; x < 340;) {
    const w = 5 + ((q() * 5) | 0), base = Math.min(166, chTop(x + w) + 10 + ((q() * 8) | 0)), h = 6 + ((q() * 10) | 0);
    panel(R, L, q, winter, x, base, w, h);
    if (q() < 0.5) { const b2 = Math.min(166, base + 8), h2 = 5 + ((q() * 6) | 0); panel(R, L, q, winter, x + 2, b2, w, h2); }
    x += w + 1 + ((q() * 4) | 0);
  }
  for (let x = 100; x < 340; x += 4) if (q() < 0.5) { const y = chTop(x); R('tree', x, y - 1, 2, 2); }
  // берег Чуркина: причалы
  R('quayDark', 60, 165, 240, 3);
  for (let x = 70; x < 300; x += 24) L(x, 164, 'lamp', '#ffd88a', 0);

  // --- сопки центра за Морским вокзалом: плотная застройка
  for (let x = 330; x < W; x++) { const y = rsTop(x); R('hill2', x, y, 1, 168 - y); R('hill2Dark', x, y + 8, 1, 168 - y - 8); }
  for (let x = 336; x < W;) {
    const w = 4 + ((q() * 6) | 0), base = rsTop(x + w) + 8 + ((q() * 10) | 0), h = 5 + ((q() * 12) | 0);
    panel(R, L, q, winter, x, Math.min(158, base), w, h);
    x += w + ((q() * 3) | 0);
  }

  // --- Корабельная набережная и подводная лодка С-56 (мемориал с 1975 года)
  R('quay', 292, 162, 64, 2); R('quayDark', 292, 164, 64, 4);
  for (const sx of [304, 312, 320]) R('quayDark', sx, 160, 2, 2); // ложементы
  R('sub', 300, 157, 26, 3); R('sub', 298, 158, 2, 1); R('sub', 326, 158, 2, 1); R('subHi', 300, 157, 26, 1);
  R('sub', 309, 153, 6, 4); R('subHi', 309, 153, 6, 1); R('sub', 311, 150, 1, 3); // рубка, перископ
  R('subRed', 301, 159, 24, 1);
  for (const lx of [296, 332]) { R('quayDark', lx, 152, 1, 10); L(lx, 151, 'lamp', '#ffe2a0', 0); }

  // --- Морской вокзал: светлое здание у причала, паром у стенки
  R('termRoof', 350, 144, 46, 2);
  R('term', 351, 146, 44, 14); R('termShade', 391, 146, 4, 14);
  for (let x = 353; x < 390; x += 3) { R('win', x, 149, 2, 3); R('win', x, 154, 2, 3); L(x, 149, 'win'); L(x, 154, 'win'); }
  R('term', 368, 138, 10, 8); R('termRoof', 367, 137, 12, 1); R('win', 370, 140, 2, 3); R('win', 374, 140, 2, 3);
  R('quayDark', 373, 130, 1, 7); R('#2a5aa0', 374, 130, 3, 1); R('#f4f4f4', 374, 131, 3, 1); R('#c8342a', 374, 132, 3, 1); // флаг
  R('quay', 348, 162, 50, 2); R('quayDark', 348, 164, 50, 4);
  R('ferry', 352, 161, 34, 3); R('ferryBand', 352, 163, 34, 1); R('ferry', 358, 158, 22, 3); R('win', 360, 159, 18, 1);
  for (let x = 360; x < 378; x += 3) L(x, 159, 'win');
  L(372, 162, 'flood', '#ffe6b8', 0);

  // --- порт: контейнеры, портальные краны, сухогруз
  R('quay', 398, 162, 82, 2); R('quayDark', 398, 164, 82, 4);
  const cols = ['cont1', 'cont2', 'cont3', 'cont4'];
  for (let x = 400; x < 462; x += 4) { const hh = 1 + ((q() * 3) | 0); for (let k = 0; k < hh; k++) R(cols[(q() * 4) | 0], x, 159 - k * 2, 4, 2); }
  for (const cx of [404, 420, 436, 452]) {
    R('crane', cx, 138, 1, 24); R('crane', cx + 6, 138, 1, 24); R('craneDark', cx, 150, 7, 1);
    R('crane', cx - 1, 137, 9, 2); R('craneDark', cx + 2, 133, 3, 4);
    line(R, 'crane', cx + 3, 134, cx - 9, 128); line(R, 'craneDark', cx + 3, 133, cx + 12, 137); // стрела и противовес
    L(cx - 9, 127, 'red', '#ff3a2a', 0); L(cx + 3, 150, 'flood', '#ffe0b0', 0);
  }
  R('ship', 402, 163, 44, 4); R('ship', 400, 163, 2, 2); R('shipTop', 436, 157, 8, 6); R('win', 438, 159, 5, 1); L(440, 159, 'win');

  // --- Золотой мост (2012): V-образные пилоны 226 м, пролёт 737 м, веер вант
  for (const p of PYL) {
    const dy = Math.round(deckY(p.x));
    for (let y = p.top; y < dy; y++) {
      const k = (y - p.top) / (dy - p.top), off = Math.round((1 - k) * (p.w - 1) / 2) + 1;
      R('pylon', p.x - off, y, 1, 1); R('pylonShade', p.x + off, y, 1, 1);
    }
    R('pylon', p.x - 1, p.top, 3, 1);
    R('pylon', p.x - 1, dy, 2, 166 - dy); R('pylonShade', p.x + 1, dy, 1, 166 - dy);
    for (let k = 0; k < 6; k++) {
      const ay = p.top + 4 + k * 4, span = p.x === 200 ? 7 + k * 8 : 9 + k * 10;
      for (const s of [-1, 1]) { const ex = p.x + s * span; line(R, 'cable', p.x + s, ay, ex, Math.round(deckY(ex)) - 1); }
    }
    L(p.x, p.top - 1, 'red', '#ff3a2a', 0);
  }
  for (let x = 150; x < 356; x++) { const y = Math.round(deckY(x)); R('deck', x, y, 1, 2); R('deckDark', x, y + 2, 1, 1); }
  for (let x = 152; x < 356; x += 5) L(x, Math.round(deckY(x)) - 1, 'lamp', '#ffd070', 0);
  R('deckDark', 354, Math.round(deckY(354)) + 2, 2, 12); // съезд на набережную
}

// ---------- ночь: золотая подсветка Золотого моста ----------
export function drawNight(g, env, nightF, t) {
  if (nightF < 0.05) return;
  for (const p of PYL) {
    const dy = Math.round(deckY(p.x));
    const grad = g.createRadialGradient(p.x, (p.top + dy) / 2, 2, p.x, (p.top + dy) / 2, 40);
    grad.addColorStop(0, `rgba(255,200,110,${0.16 * nightF})`); grad.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = grad; g.fillRect(p.x - 40, p.top - 10, 80, dy - p.top + 20);
    g.globalAlpha = nightF * 0.85; g.fillStyle = '#ffd88a';
    for (let y = p.top; y < dy; y++) { const k = (y - p.top) / (dy - p.top), off = Math.round((1 - k) * (p.w - 1) / 2) + 1; g.fillRect(p.x - off, y, 1, 1); g.fillRect(p.x + off, y, 1, 1); }
    g.globalAlpha = nightF * (0.35 + 0.1 * Math.sin(t * 0.8)); g.fillStyle = '#ffc860';
    for (let k = 0; k < 6; k++) {
      const ay = p.top + 4 + k * 4, span = p.x === 200 ? 7 + k * 8 : 9 + k * 10;
      for (const s of [-1, 1]) {
        const ex = p.x + s * span, ey = Math.round(deckY(ex)) - 1, n = Math.max(Math.abs(ex - p.x), ey - ay);
        for (let i = 0; i <= n; i += 2) g.fillRect(Math.round(p.x + s + (ex - p.x - s) * i / n), Math.round(ay + (ey - ay) * i / n), 1, 1);
      }
    }
  }
  g.globalAlpha = nightF * 0.9; g.fillStyle = '#ffe0a0';
  for (let x = 150; x < 356; x += 2) g.fillRect(x, Math.round(deckY(x)) + 2, 1, 1);
  g.globalAlpha = 1;
}

export function drawAboveLate(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
// Полосы движения по наклонному полотну Золотого моста — отрезками
const LANES = [];
for (let x = 152; x < 350; x += 33) LANES.push({ x0: x, x1: x + 33, y: Math.round(deckY(x + 16)) - 1 });

// ---------- вода: лёд зимой, буксир, набережная ----------
export function drawBoats(ctx, env, dayF, t) {
  if (env.ice) drawIce(ctx, env, dayF);
  drawTug(ctx, env, dayF, t);
  drawPromenade(ctx, env, dayF, t);
}

// В сильные морозы бухта частично покрывается льдом, по фарватеру ходят буксиры — полностью не замерзает
function drawIce(ctx, env, dayF) {
  const r = rng(31), ice = mixHex('#3a4458', '#dfe8ee', dayF), iceD = mixHex('#2a3244', '#b8c6d2', dayF);
  for (let i = 0; i < 70; i++) {
    const nearFar = r() < 0.55, y = nearFar ? 168 + ((r() * 8) | 0) : 188 + ((r() * 11) | 0), x = (r() * W) | 0, w = 6 + ((r() * 30) | 0);
    ctx.globalAlpha = 0.75; ctx.fillStyle = r() < 0.7 ? ice : iceD; ctx.fillRect(x, y, w, 1 + ((r() * 2) | 0));
  }
  ctx.globalAlpha = 1;
}

// Портовый буксир ходит по бухте днём
function drawTug(ctx, env, dayF, t) {
  const h = env.local.getUTCHours();
  if (h < 6 || h >= 22) return;
  const p = ((env.ms / 1000 + 200) % 700) / 300;
  if (p >= 1) return;
  const x = Math.round(-20 + p * 380), y = 176, nightF = 1 - dayF;
  ctx.fillStyle = mixHex('#1e1a1c', '#2a2a30', dayF); ctx.fillRect(x, y, 14, 3);
  ctx.fillStyle = mixHex('#2a1a18', '#b8342a', dayF); ctx.fillRect(x, y + 2, 14, 1);
  ctx.fillStyle = mixHex('#30343e', '#f0ece4', dayF); ctx.fillRect(x + 4, y - 3, 6, 3);
  ctx.fillStyle = mixHex('#1a1a1e', '#2a2a30', dayF); ctx.fillRect(x + 6, y - 5, 2, 2);
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) ctx.fillRect(x - 2 - i * 2, y + 2 - (i % 2), 2, 1);
  if (nightF > 0.2) { ctx.globalAlpha = nightF; ctx.fillStyle = '#ffd98a'; ctx.fillRect(x + 5, y - 2, 4, 1); ctx.fillStyle = '#4aff6a'; ctx.fillRect(x + 13, y - 1, 1, 1); }
  ctx.globalAlpha = 1;
}

// Сувенир на подоконнике: створка морского гребешка и игрушечный тигрёнок
export function drawSill(R, SILL) {
  const x = 250, y = SILL;
  // гребешок: веер с рёбрами
  R('#c8784a', x, y - 2, 12, 2); R('#e0946a', x + 1, y - 4, 10, 2); R('#eca880', x + 2, y - 6, 8, 2); R('#f4c098', x + 4, y - 7, 4, 1);
  for (const dx of [2, 5, 8]) R('#a85a36', x + dx, y - 5, 1, 4);
  R('#c8784a', x + 4, y - 1, 4, 1);
  // тигрёнок: сидит, полосатый
  const tx = x + 15;
  R('#e08a2e', tx, y - 7, 9, 7); R('#f0a040', tx, y - 7, 9, 1);
  R('#e08a2e', tx + 1, y - 12, 7, 5); R('#e08a2e', tx + 1, y - 13, 2, 1); R('#e08a2e', tx + 6, y - 13, 2, 1);
  R('#f4eee4', tx + 2, y - 9, 5, 2); R('#1e1a1a', tx + 2, y - 11, 1, 1); R('#1e1a1a', tx + 6, y - 11, 1, 1); R('#3a2020', tx + 4, y - 9, 1, 1);
  for (const dx of [1, 4, 7]) R('#2a1e1a', tx + dx, y - 6, 1, 3);
  R('#2a1e1a', tx + 3, y - 12, 1, 1); R('#2a1e1a', tx + 5, y - 12, 1, 1);
  R('#f4eee4', tx + 1, y - 1, 3, 1); R('#f4eee4', tx + 5, y - 1, 3, 1);
  R('#e08a2e', tx + 9, y - 3, 3, 1); R('#2a1e1a', tx + 11, y - 4, 1, 1);
}

// ---------- набережная: ларьки ----------
export const KINDS_VL = {
  scallop: { awning: ['#2a6a9a', '#f4f4f4'], counter: '#4a4a52', goods: [[1, '#f0d0b0'], [4, '#e8b890'], [7, '#f0d0b0'], [10, '#e8b890']], steam: true },
  pyanse: { awning: ['#c8342a', '#f4e8d0'], counter: '#d8d4cc', goods: [[1, '#f8f6f0'], [4, '#f8f6f0'], [7, '#f8f6f0']], steam: true },
};
export const STALL_X = { a: 146, b: 226, c: 280 };
export function stallKinds(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1;
  const warm = mo >= 5 && mo <= 9, cold = mo >= 11 || mo <= 3;
  if (!(warm ? h >= 10 && h < 22 : h >= 10 && h < 19)) return {};
  const k = { b: 'pyanse' };
  if (mo >= 5 && mo <= 10) k.a = 'scallop';
  if (warm) k.c = 'icecream'; else if (cold) k.c = 'tea';
  return k;
}
export function stalls(env) { return Object.values(stallKinds(env)); }
function drawPromenade(ctx, env, dayF, t) {
  const k = stallKinds(env);
  const list = Object.keys(k).map((slot) => ({ kind: KINDS_VL[k[slot]] || k[slot], x: STALL_X[slot] }));
  streetPromenade(ctx, env, dayF, t, list);
}

// ---------- секреты Владивостока ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((secT(env) + shift) % period) / dur));
const month = (env) => env.local.getUTCMonth() + 1;
const noFog = (env) => env.weather.kind !== 'fog';

export const SECRETS = [
  {
    id: 'tiger', name: 'Амурский тигр на сопке', layer: 'sky',
    hint: 'Очень редко, днём или в сумерках, по гребню сопки за Золотым мостом кто-то неспешно идёт.',
    found: 'Тигры в Приморье живут в тайге и в город заходят редко, но бывает: 8 января 2025 года амурский тигр вышел на горнолыжный склон базы «Лесная поляна» на Садгороде (Советский район Владивостока); через два дня его отловили у бухты Шамора и увезли в реабилитационный центр. Здесь, на Чуркине, — художественный вымысел по мотивам таких случаев.',
    state(env) {
      if (!env.forced && (env.sun.alt < -4 || !noFog(env) || env.weather.kind === 'storm')) return null;
      if (!inWin(env, 7200, 60, 3100)) return null;
      const p = phase(env, 7200, 60, 3100), x = Math.round(232 + p * 60); // гребень за мостом — эту часть кадра видно и на телефоне
      return { x, y: chTop(x + 3) - 5, w: 9, h: 5 };
    },
    draw(b, env, st, dayF) {
      const fur = mixHex('#2a2018', '#d8883a', dayF), dark = mixHex('#121010', '#2a1c14', dayF), step = Math.sin(env.ms / 300) > 0;
      const { x, y } = st;
      b.fillStyle = fur; b.fillRect(x + 1, y + 1, 5, 2); b.fillRect(x + 6, y, 2, 2); // тело и голова
      b.fillStyle = dark; b.fillRect(x + 2, y + 1, 1, 2); b.fillRect(x + 4, y + 1, 1, 2); // полосы
      b.fillStyle = fur; b.fillRect(x, y, 1, 1); b.fillRect(x - 1, y - 1, 1, 1); // хвост
      b.fillStyle = dark; b.fillRect(x + (step ? 1 : 2), y + 3, 1, 1); b.fillRect(x + (step ? 5 : 4), y + 3, 1, 1); // лапы
    },
  },
  {
    id: 'larga', name: 'Ларга в бухте', layer: 'street',
    hint: 'С поздней осени до весны из воды иногда показывается круглая усатая голова.',
    found: 'Ларга — пятнистый тюлень Японского моря. Она правда заходит в Золотой Рог: зимой 2026 года её снимали ныряющей за рыбой среди льда в бухте, рядом с чайками и орланами.',
    state(env) {
      const mo = month(env);
      if (!env.forced && (env.sun.alt < 0 || !(mo >= 11 || mo <= 4))) return null;
      if (!inWin(env, 1500, 30, 700)) return null;
      const p = phase(env, 1500, 30, 700); return { x: Math.round(236 + p * 20), y: 178, w: 6, h: 5, p };
    },
    draw(ctx, env, st, dayF) {
      const up = st.p < 0.85 || env.forced, body = mixHex('#1c2028', '#6a6e72', dayF), spot = mixHex('#14161c', '#3a3e44', dayF);
      ctx.globalAlpha = 0.5; ctx.fillStyle = mixHex('#3a4050', '#e8eef2', dayF); ctx.fillRect(st.x - 2, st.y + 4, 10, 1); ctx.globalAlpha = 1;
      if (!up) return;
      ctx.fillStyle = body; ctx.fillRect(st.x + 1, st.y, 4, 4); ctx.fillRect(st.x, st.y + 1, 6, 3);
      ctx.fillStyle = spot; ctx.fillRect(st.x + 1, st.y + 1, 1, 1); ctx.fillRect(st.x + 4, st.y + 1, 1, 1); ctx.fillRect(st.x + 2, st.y + 3, 2, 1);
      ctx.fillStyle = mixHex('#2a2e36', '#c8ccd0', dayF); ctx.fillRect(st.x - 1, st.y + 2, 1, 1); ctx.fillRect(st.x + 6, st.y + 2, 1, 1); // усы
    },
  },
  {
    id: 'eagle', name: 'Орлан-белохвост', layer: 'sky',
    hint: 'Зимним днём над бухтой медленно кружит большая тёмная птица с белым хвостом.',
    found: 'Зимой в Золотом Роге кормятся орланы-белохвосты: в январе 2026 года их снимали над замерзающей бухтой вместе с ларгами, чайками и крохалями.',
    state(env) {
      const mo = month(env);
      if (!env.forced && (env.sun.alt < 2 || !(mo === 12 || mo <= 3))) return null;
      if (!inWin(env, 1700, 40, 200)) return null;
      const p = phase(env, 1700, 40, 200), x = Math.round(60 + p * 320);
      return { x, y: Math.round(92 + Math.sin(p * 9) * 8), w: 11, h: 5 };
    },
    draw(b, env, st, dayF) {
      const c = mixHex('#141216', '#4a3a2e', dayF), { x, y } = st, flap = Math.sin(env.ms / 500) > 0.6;
      b.fillStyle = c; b.fillRect(x, y + (flap ? 0 : 1), 4, 1); b.fillRect(x + 6, y + (flap ? 0 : 1), 4, 1); b.fillRect(x + 3, y + 1, 4, 2);
      b.fillStyle = mixHex('#3a3a40', '#f4f4f0', dayF); b.fillRect(x + 4, y + 3, 2, 1); // белый хвост
      b.fillStyle = mixHex('#3a3020', '#e8c040', dayF); b.fillRect(x + 7, y + 1, 1, 1); // клюв
    },
  },
  {
    id: 'fog', name: 'Мост в морском тумане', layer: 'sky',
    hint: 'Весенним или летним утром с моря иногда наползает туман — и от моста остаются одни пилоны.',
    found: 'Весной и в начале лета тёплый влажный воздух остывает над холодным Японским морем, и на город наползает адвективный туман — порой на недели. Пилоны Золотого моста тогда торчат над белой пеленой.',
    state(env) {
      const mo = month(env), h = env.local.getUTCHours();
      if (!env.forced && !(mo >= 4 && mo <= 7 && h >= 5 && h < 11 && !['rain', 'storm'].includes(env.weather.kind))) return null;
      if (!inWin(env, 3000, 240, 900)) return null;
      return { x: 186, y: 46, w: 112, h: 30 };
    },
    draw(b, env, st, dayF) {
      const c = mixHex('#3a4050', '#e6eaee', dayF), tt = env.ms / 1000;
      b.fillStyle = c;
      for (let y = 96; y < 168; y++) {
        const a = Math.min(1, (y - 96) / 24) * 0.85;
        for (let x = 0; x < W; x += 3) {
          const w = Math.sin(x * 0.03 + tt * 0.1) + Math.sin(x * 0.011 - tt * 0.05 + y * 0.05);
          if (y < 110 && w < 0.4) continue;
          b.globalAlpha = a; b.fillRect(x, y, 3, 1);
        }
      }
      b.globalAlpha = 1;
    },
  },
  {
    id: 'ferry', name: 'Паром на острова', layer: 'street',
    hint: 'Днём от Морского вокзала иногда отходит белый паром.',
    found: 'От Морского вокзала ходят пассажирские паромы на острова Попова и Рейнеке — там нет моста, и по морю до них добираются круглый год.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (h < 7 || h >= 20 || env.weather.kind === 'storm')) return null;
      if (!inWin(env, 2400, 150, 1500)) return null;
      const p = phase(env, 2400, 150, 1500); return { x: Math.round(420 - p * 240), y: 178, w: 26, h: 9 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st, nightF = 1 - dayF;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f0', dayF); ctx.fillRect(x, y + 4, 26, 3); ctx.fillRect(x + 2, y + 7, 22, 1);
      ctx.fillStyle = mixHex('#1a1e28', '#2a5a9a', dayF); ctx.fillRect(x + 1, y + 6, 25, 1);
      ctx.fillStyle = mixHex('#30343e', '#e8e8e4', dayF); ctx.fillRect(x + 4, y, 16, 4);
      ctx.fillStyle = mixHex('#20242e', '#3a5a7a', dayF); for (let i = 0; i < 5; i++) ctx.fillRect(x + 5 + i * 3, y + 1, 2, 1);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 27 + i * 2, y + 7 - (i % 2), 2, 1);
      if (nightF > 0.2) { ctx.globalAlpha = nightF; ctx.fillStyle = '#ffd98a'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 5 + i * 3, y + 1, 2, 1); }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'salute', name: 'Салют в День города', layer: 'sky',
    hint: 'В начале июля, в дни рождения города, вечером над бухтой может расцвести небо.',
    found: 'Владивосток основан 2 июля 1860 года: экипаж транспорта «Маньчжур» поставил военный пост на берегу Золотого Рога. День города празднуют в начале июля, праздник завершается фейерверком в 22:00.',
    state(env) {
      const l = env.local, h = l.getUTCHours(), m = l.getUTCMinutes(), d = l.getUTCDate();
      const cityDay = month(env) === 7 && d <= 7 && l.getUTCDay() === 6 && h === 22 && m < 15;
      if (!env.forced && !cityDay) return null;
      return { x: 130, y: 20, w: 240, h: 70 };
    },
    draw(b, env, st, dayF) { drawFireworks(b, env.ms / 1000, 250, 40, dayF); },
  },
];

// События по новостям (data/events.json): fireworks — салют над бухтой
export function drawEvents(b, env, dayF, t) { if (env.event?.kind === 'fireworks') drawFireworks(b, t, 250, 40, dayF); }

export const isCityDaySalute = (local) => local.getUTCMonth() === 6 && local.getUTCDate() <= 7 && local.getUTCDay() === 6;
