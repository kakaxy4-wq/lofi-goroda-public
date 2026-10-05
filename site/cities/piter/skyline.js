// Петербург: вид из мансарды на Неву, Петропавловку, Стрелку и Дворцовый мост.
// Модуль силуэта для движка сцены (engine/scene.js): палитры, дальний план и свои слои.

import { rng, clamp, mixHex } from '../../engine/util.js';
import { W, HORIZON, SILL } from '../../engine/const.js';
import { drawCars as streetCars, drawPromenade as streetPromenade, drawPerson, drawFireworks } from '../../engine/street.js';

const LAKHTA_TOP = 60;
const lakhtaW = (y) => Math.max(1, Math.round(1 + ((y - LAKHTA_TOP) / (156 - LAKHTA_TOP)) * 8));

// ---------- палитры дальнего плана ----------
const DAY = {
  far: '#8f98aa', farDark: '#7a849c', farRoof: '#6a7590',
  wall: '#9c8a7a', wallDark: '#7f6f63', wallTop: '#b6a696',
  cath: '#e8c9a4', cathShade: '#c9a784', pil: '#f5eee2', win: '#5a5064',
  roof: '#6f8c82', roofDark: '#57716a',
  tree: '#3e6b3d', treeDark: '#2f5531',
  birzha: '#ebe4d4', birzhaShade: '#c9c0ae',
  rostral: '#b2483b', rostralDark: '#8a3429', bronze: '#8e6c3c',
  granite: '#8c7c72', graniteDark: '#6f625a', sand: '#cdb88e',
  lakhta: '#a3c3de', lakhtaDark: '#7ca2c6', lakhtaHi: '#d6e8f6', tv: '#8c919b',
  mosque: '#3fb0bf', bridge: '#607483', bridgeDark: '#4b5b69', snow: '#eef2f6',
};
const NIGHT = {
  far: '#1c2239', farDark: '#171c31', farRoof: '#12172a',
  wall: '#2d2a35', wallDark: '#23202b', wallTop: '#383440',
  cath: '#8c6e5a', cathShade: '#6c5446', pil: '#ab8b72', win: '#1a1420',
  roof: '#26343a', roofDark: '#1d282e',
  tree: '#151d1f', treeDark: '#101719',
  birzha: '#7d7164', birzhaShade: '#5f564d',
  rostral: '#7a3a31', rostralDark: '#5a2a24', bronze: '#5a4830',
  granite: '#27252d', graniteDark: '#1e1c23', sand: '#3a352f',
  lakhta: '#1f2d4a', lakhtaDark: '#19243d', lakhtaHi: '#28385a', tv: '#1f232d',
  mosque: '#2a5a70', bridge: '#46546c', bridgeDark: '#343f54', snow: '#6a7488',
};
const AUTUMN = { day: { tree: '#bb8c32', treeDark: '#915f27' }, night: { tree: '#221c16', treeDark: '#1a1511' } };
const WINTER = { day: { tree: '#5d5853', treeDark: '#48443f' }, night: { tree: '#1a1a1e', treeDark: '#141418' } };

export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Дальний план. g — холст, P — палитра, R(ключ, x, y, w, h) — прямоугольник цветом палитры,
// L(x, y, вид, цвет, порог) — огонёк (окна, фонари, подсветка), r — детерминированный ГСЧ.
export function drawFar({ g, P, winter, r, L, R }) {

  // город за рекой
  for (let x = 0; x < W;) {
    const w = 6 + ((r() * 12) | 0), h = 5 + ((r() * 14) | 0), top = 158 - h;
    R(r() < 0.5 ? 'far' : 'farDark', x, top, w, h);
    if (winter) R('snow', x, top, w, 1);
    else if (r() < 0.3) R('farRoof', x + 1, top - 1, w - 2, 1);
    if (r() < 0.25) R('farRoof', x + 2, top - 3, 1, 3); // трубы
    for (let yy = top + 2; yy < 156; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < 0.32) L(xx, yy, 'win');
    x += w;
  }

  // Лахта-центр — далеко на северо-западе: пятигранная башня с закруткой и решётчатый шпиль
  for (let y = LAKHTA_TOP; y < 156; y++) {
    const w = lakhtaW(y), x0 = 150 - (w >> 1);
    for (let i = 0; i < w; i++) R(['lakhta', 'lakhtaDark', 'lakhtaHi'][Math.floor(i * 0.9 + y * 0.14) % 3], x0 + i, y, 1, 1);
  }
  for (let y = 40; y < LAKHTA_TOP; y++) { const k = (y - 40) / (LAKHTA_TOP - 40); R('lakhtaDark', Math.round(150 - k), y, 1, 1); R('lakhtaDark', Math.round(150 + k), y, 1, 1); if (y % 4 === 0) R('lakhtaDark', Math.round(150 - k), y, Math.round(2 * k) + 1, 1); }

  // Телебашня
  for (let y = 92; y < 158; y++) {
    const k = (y - 92) / 66;
    R('tv', Math.round(446 - k * 5), y, 1, 1);
    R('tv', Math.round(450 + k * 5), y, 1, 1);
    if (y % 6 === 0) R('tv', Math.round(446 - k * 5), y, Math.round(5 + k * 10), 1);
  }
  R('tv', 444, 94, 9, 2); R('tv', 447, 66, 3, 28); R('tv', 448, 58, 1, 8);
  L(448, 58, 'red', '#ff3a3a', 0); L(444, 94, 'red', '#ff3a3a', 0); L(452, 94, 'red', '#ff3a3a', 0);

  // Соборная мечеть за крепостью
  R('far', 391, 136, 18, 16);
  for (let i = 0; i < 9; i++) { const w = Math.round(Math.sqrt(81 - (8 - i) ** 2) * 2); R('mosque', 400 - (w >> 1), 127 + i, w, 1); }
  R('mosque', 399, 123, 2, 4);
  for (const mx of [385, 414]) { R('far', mx, 110, 2, 42); R('mosque', mx, 106, 2, 4); R('far', mx - 1, 120, 4, 1); }

  // деревья вдоль крепости
  for (let x = 180; x < 430; x += 3) {
    const h = 4 + ((r() * 7) | 0);
    R(r() < 0.5 ? 'tree' : 'treeDark', x, 154 - h, 4, h);
    if (winter && r() < 0.5) R('snow', x, 154 - h, 3, 1);
  }

  // Стрелка Васильевского: Биржа и Ростральные колонны
  R('granite', 0, 156, 130, 2); R('graniteDark', 0, 158, 130, 10);
  R('birzhaShade', 40, 148, 62, 8); // подиум
  R('birzha', 44, 136, 54, 12);
  for (let x = 45; x < 97; x += 3) R('birzhaShade', x, 137, 1, 11);
  R('birzha', 42, 134, 58, 2);
  for (let i = 0; i < 6; i++) R('birzha', 52 + i * 3, 128 + (5 - i), 38 - i * 6, 1); // фронтон
  if (winter) R('snow', 42, 133, 58, 1);
  for (const cx of [28, 118]) {
    R('granite', cx - 4, 144, 9, 12);
    R('rostral', cx - 2, 108, 5, 36); R('rostralDark', cx + 1, 108, 2, 36);
    for (const py of [116, 124, 132, 140]) { R('bronze', cx - 4, py, 2, 2); R('bronze', cx + 3, py, 2, 2); }
    R('pil', cx - 3, 104, 7, 4); R('bronze', cx - 3, 100, 7, 4); R('bronze', cx - 1, 98, 3, 2);
    L(cx, 144, 'flood', '#ffcf8a', 0);
  }
  L(70, 146, 'flood', '#ffd9a0', 0);

  // Петропавловская крепость: стена, Нарышкин бастион, пляж
  R('wallTop', 182, 153, 244, 2); R('wall', 182, 155, 244, 9); R('granite', 182, 164, 244, 4);
  for (let x = 186; x < 426; x += 8) R('wallDark', x, 156, 1, 7);
  R('wallTop', 200, 150, 46, 3); R('wall', 198, 153, 50, 11); // бастион
  R('wallDark', 214, 142, 1, 11); // флагшток
  R('sand', 256, 166, 150, 2);
  // Невские ворота
  R('pil', 360, 152, 12, 10); R('win', 364, 156, 4, 6);
  for (let i = 0; i < 4; i++) R('pil', 361 + i, 151 - i, 10 - i * 2, 1);
  for (let x = 188; x < 424; x += 12) L(x, 152, 'lamp', '#ffd88a', 0);

  // Петропавловский собор: корпус, малый купол, колокольня (шпиль — динамический)
  R('roofDark', 307, 131, 50, 3); R('cath', 306, 134, 52, 20);
  for (let x = 309; x < 356; x += 7) { R('pil', x, 134, 1, 20); R('win', x + 2, 139, 3, 6); R('win', x + 3, 138, 1, 1); }
  R('cathShade', 355, 134, 3, 20); R('pil', 306, 134, 52, 1);
  if (winter) R('snow', 307, 130, 50, 1);
  R('cath', 340, 124, 9, 7); R('pil', 340, 124, 9, 1);
  [4, 8, 10, 10, 10].forEach((w, i) => R(i < 2 ? 'roof' : 'roofDark', 344 - (w >> 1), 119 + i, w, 1));
  R('bronze', 343, 114, 3, 5); R('bronze', 344, 110, 1, 4);
  // колокольня
  R('cath', 290, 118, 19, 36); R('cathShade', 305, 118, 4, 36);
  for (const x of [290, 296, 302, 308]) R('pil', x, 119, 1, 35);
  R('win', 298, 124, 3, 8); R('win', 298, 138, 3, 8); R('pil', 288, 117, 23, 2);
  R('cath', 293, 106, 13, 11); R('cathShade', 303, 106, 3, 11); R('pil', 292, 105, 15, 1);
  R('pil', 297, 108, 5, 5); R('win', 299, 109, 1, 2); R('win', 299, 110, 2, 1); // часы
  R('cath', 295, 97, 9, 8); R('win', 298, 99, 3, 5); R('pil', 294, 96, 11, 1);
  R('pil', 293, 101, 2, 4); R('pil', 304, 101, 2, 4); // волюты
  L(299, 150, 'flood', '#ffe0a8', 0);

  // Троицкий мост справа, низкий
  R('bridgeDark', 426, 161, 54, 2);
  for (let x = 430; x < 480; x += 12) { R('bridge', x, 162, 2, 6); L(x, 158, 'lamp', '#ffe2a0', 0); R('bridgeDark', x, 158, 1, 3); }

  // Дворцовый мост — неподвижные части (разводные пролёты рисуются отдельно)
  const deck = (x0, x1) => { R('bridge', x0, 159, x1 - x0, 3); for (let x = x0; x < x1; x += 2) R('bridgeDark', x, 157, 1, 2); R('bridgeDark', x0, 157, x1 - x0, 1); };
  deck(0, 74); deck(106, 184);
  const arch = (x0, x1) => {
    const mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
    for (let x = x0; x < x1; x++) {
      const k = (x - mid) / half, y = Math.round(162 + k * k * 5);
      R('bridgeDark', x, y, 1, 2);
      if (x % 3 === 0) R('bridgeDark', x, 162, 1, y - 162);
    }
  };
  arch(0, 38); arch(40, 72); arch(108, 142); arch(144, 182);
  for (const px of [38, 72, 106, 142, 182]) {
    R('granite', px - 2, 161, 6, 7);
    R('bridgeDark', px, 150, 1, 7);
    L(px, 149, 'lamp', '#ffe2a0', 0);
  }
}

function drawSpire(g, dayF, t) {
  const gold = mixHex('#c8942c', '#e8b83a', dayF), hi = mixHex('#f0c860', '#fff0a8', dayF), sh = mixHex('#8a6420', '#a87a1c', dayF);
  // золотой барабан
  g.fillStyle = gold; g.fillRect(296, 90, 7, 6);
  g.fillStyle = sh; for (let x = 297; x < 303; x += 2) g.fillRect(x, 90, 1, 6);
  // шпиль
  for (let y = 30; y < 90; y++) {
    const w = Math.max(1, Math.round(1 + ((y - 30) / 60) * 4));
    const x0 = 299 - (w >> 1) + (w % 2 ? 0 : 1);
    g.fillStyle = gold; g.fillRect(x0, y, w, 1);
    if (w > 1) { g.fillStyle = hi; g.fillRect(x0, y, 1, 1); }
    if (w > 2) { g.fillStyle = sh; g.fillRect(x0 + w - 1, y, 1, 1); }
  }
  // ангел с крестом
  g.fillStyle = hi;
  g.fillRect(299, 21, 1, 9); g.fillRect(297, 23, 5, 1);
  g.fillStyle = gold; g.fillRect(297, 27, 1, 2); g.fillRect(301, 26, 2, 2); g.fillRect(300, 25, 1, 4);
  // блик ползёт вверх по шпилю
  const k = (t % 9) / 2.2;
  if (k < 1) { g.fillStyle = '#ffffff'; g.globalAlpha = Math.sin(k * Math.PI); g.fillRect(299, Math.round(88 - k * 58), 1, 2); g.globalAlpha = 1; }
  // ночная подсветка
  if (dayF < 0.6) {
    const grad = g.createRadialGradient(299, 70, 2, 299, 70, 40);
    grad.addColorStop(0, `rgba(255,200,110,${0.16 * (1 - dayF)})`); grad.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = grad; g.fillRect(259, 20, 80, 110);
  }
}

function drawBridgeLeaves(g, open, dayF) {
  const ang = open * 1.25; // до ~72°
  const col = mixHex(NIGHT.bridge, DAY.bridge, dayF), dark = mixHex(NIGHT.bridgeDark, DAY.bridgeDark, dayF);
  const leaf = (px, dir) => {
    // пролёт — сплошная балка 3px и ферма над ней
    const nx = -Math.sin(ang) * dir, ny = -Math.cos(ang);
    for (let s = 0; s < 17; s += 0.5) {
      const x = px + dir * Math.cos(ang) * s, y = 160 - Math.sin(ang) * s;
      g.fillStyle = col; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      const k = 1 - s / 17, tx = x + nx * 4 * k, ty = y + ny * 4 * k;
      if (Math.round(s * 2) % 4 === 0) { g.fillStyle = dark; g.fillRect(Math.round(tx), Math.round(ty), 1, 1); }
    }
  };
  leaf(74, 1); leaf(105, -1);
  if (dayF < 0.6) { // фонари вдоль пролётов
    g.globalAlpha = 1 - dayF; g.fillStyle = '#ffe2a0';
    for (const [px, dir] of [[74, 1], [105, -1]]) for (let s = 4; s < 17; s += 6) g.fillRect(Math.round(px + dir * Math.cos(ang) * s), Math.round(160 - Math.sin(ang) * s) - 3, 1, 1);
    g.globalAlpha = 1;
  }
  if (open > 0.02 && dayF < 0.7) { // огни на концах пролётов
    g.fillStyle = '#ff5a4a';
    g.fillRect(Math.round(74 + Math.cos(ang) * 16), Math.round(160 - Math.sin(ang) * 16) - 2, 1, 1);
    g.fillRect(Math.round(105 - Math.cos(ang) * 16), Math.round(160 - Math.sin(ang) * 16) - 2, 1, 1);
  }
}

function drawFlag(g, t, dayF) {
  const cols = ['#f4f4f4', '#2d5fb8', '#d63a32'];
  for (let x = 0; x < 8; x++) {
    const dy = Math.round(Math.sin(t * 4 - x * 0.9) * 0.8);
    for (let s = 0; s < 3; s++) {
      g.fillStyle = mixHex(mixHex(cols[s], '#1a1a28', 0.7), cols[s], dayF);
      g.fillRect(215 + x, 142 + s + dy, 1, 1);
    }
  }
}

function drawCannon(g, env) {
  // полуденный выстрел с Нарышкина бастиона
  const l = env.local;
  if (l.getUTCHours() !== 12 || l.getUTCMinutes() !== 0) return;
  const s = l.getUTCSeconds() + l.getUTCMilliseconds() / 1000;
  if (s > 14) return;
  if (s < 0.35) { g.fillStyle = '#ffd070'; g.fillRect(246, 150, 4, 3); }
  for (let i = 0; i < 6; i++) {
    const r = 2 + s * (1.2 + i * 0.25), x = 250 + s * (2 + i) + i * 2, y = 150 - s * (0.8 + i * 0.3);
    g.globalAlpha = clamp(0.7 - s / 14) * 0.9; g.fillStyle = '#d8dce2';
    g.beginPath(); g.arc(Math.round(x), Math.round(y), r, 0, 6.28); g.fill();
  }
  g.globalAlpha = 1;
}

// Факелы Ростральных колонн (по праздникам — у нас по клику)
function drawTorches(g, t) {
  const cols = ['#fff2a0', '#ffc040', '#ff7a20', '#d8401a'];
  for (const cx of [28, 118]) {
    const grad = g.createRadialGradient(cx, 92, 1, cx, 92, 22);
    grad.addColorStop(0, 'rgba(255,150,60,0.35)'); grad.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = grad; g.fillRect(cx - 22, 70, 44, 44);
    for (let i = 0; i < 26; i++) {
      const r = rng(i * 13 + Math.floor(t * 12));
      const h = r() * 10, x = cx + Math.round((r() - 0.5) * (6 - h * 0.4)), y = 97 - Math.round(h);
      g.fillStyle = cols[Math.min(3, Math.floor(h / 2.6))];
      g.fillRect(x, y, 1, r() < 0.3 ? 2 : 1);
    }
  }
}

// Медиафасад Лахты ночью: обычно спокойный бело-голубой с волной вверх;
// в день матча «Зенита» — сине-бело-голубые полосы.
function drawLakhtaFacade(g, env, nightF, t) {
  const zen = env.zenit?.glow;
  for (let y = LAKHTA_TOP; y < 156; y++) {
    const w = lakhtaW(y), x0 = 150 - (w >> 1);
    let col, a;
    if (zen) {
      const band = Math.floor((y + t * 6) / 5) % 3;
      col = ['#1f5fd0', '#f4f8ff', '#62b6f2'][band]; a = 0.85;
    } else {
      const wave = 0.5 + 0.5 * Math.sin(y * 0.22 - t * 1.1);
      col = mixHex('#5aaeff', '#e4f2ff', wave); a = 0.35 + wave * 0.45;
    }
    g.globalAlpha = nightF * a; g.fillStyle = col; g.fillRect(x0, y, w, 1);
  }
  g.globalAlpha = (Math.sin(t * 3) > 0 ? 1 : 0.2) * Math.max(nightF, 0.4); g.fillStyle = '#ff3030'; g.fillRect(150, 39, 1, 1);
  g.globalAlpha = 1;
}

// Телебашня ночью: архитектурная подсветка решётки, цвета медленно бегут вверх;
// в день матча «Зенита» — сине-бело-голубая. Красные заградительные огни — отдельно, в lights.
function drawTvLights(g, env, nightF, t) {
  const zen = env.zenit?.glow;
  g.globalAlpha = nightF * 0.85;
  for (let y = 66; y < 158; y++) {
    const k = (Math.max(y, 92) - 92) / 66;
    g.fillStyle = zen ? ['#1f5fd0', '#f4f8ff', '#62b6f2'][Math.floor((y + t * 5) / 6) % 3]
      : `hsl(${(200 + Math.sin(t * 0.07) * 60 + (158 - y) * 1.4 + t * 8) % 360}, 75%, 62%)`;
    if (y < 94) { g.fillRect(447, y, y % 3 ? 1 : 3, 1); continue; } // мачта
    g.fillRect(Math.round(446 - k * 5), y, 1, 1); g.fillRect(Math.round(450 + k * 5), y, 1, 1);
    if (y % 6 === 0) g.fillRect(Math.round(446 - k * 5), y, Math.round(5 + k * 10), 1);
  }
  g.globalAlpha = 1;
}

function drawBoats(ctx, env, dayF, t) {
  if (env.frozen) return;
  const sec = env.ms / 1000;
  // грузовое судно во время развода: идёт вверх по Неве, раз в 11 минут
  if (env.bridge.open > 0.8) {
    const cyc = 660, p = (sec % cyc) / 240;
    if (p < 1) drawShip(ctx, Math.round(-60 + p * 580), 176, dayF, true);
  }
  // прогулочный теплоход днём и вечером
  const h = env.local.getUTCHours();
  if (env.bridge.season && h >= 10 && h <= 23) {
    const p = ((sec + 200) % 420) / 180;
    if (p < 1) drawShip(ctx, Math.round(500 - p * 560), 196, dayF, false);
  }
}

function drawShip(ctx, x, y, dayF, cargo) {
  const nightF = 1 - dayF;
  if (cargo) {
    ctx.fillStyle = mixHex('#141820', '#3a3030', dayF); ctx.fillRect(x, y, 58, 5); ctx.fillRect(x + 2, y + 5, 54, 2);
    ctx.fillStyle = mixHex('#1c2028', '#9a3a2a', dayF); ctx.fillRect(x + 4, y - 3, 40, 3); // трюм
    ctx.fillStyle = mixHex('#3a3e48', '#e8e8e8', dayF); ctx.fillRect(x + 46, y - 9, 10, 9); ctx.fillRect(x + 48, y - 12, 5, 3);
    ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.4 + nightF * 0.6;
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 47 + i * 3, y - 7, 2, 1);
    ctx.fillStyle = '#ff4a3a'; ctx.fillRect(x, y - 1, 1, 1); ctx.fillStyle = '#5aff7a'; ctx.fillRect(x + 57, y - 1, 1, 1);
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x - 6, y + 6, 8, 1); ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = mixHex('#2a2e38', '#f2f2ee', dayF); ctx.fillRect(x, y, 34, 4);
    ctx.fillStyle = mixHex('#1a1e28', '#2a4a7a', dayF); ctx.fillRect(x + 1, y + 4, 32, 2);
    ctx.fillStyle = mixHex('#30343e', '#e0e0dc', dayF); ctx.fillRect(x + 4, y - 4, 24, 4);
    ctx.fillStyle = '#ffd98a'; ctx.globalAlpha = 0.3 + nightF * 0.7;
    for (let i = 0; i < 7; i++) ctx.fillRect(x + 5 + i * 3, y - 3, 2, 1);
    if (nightF > 0.3) for (let i = 0; i < 12; i++) { ctx.fillStyle = `hsl(${i * 40},80%,65%)`; ctx.fillRect(x + i * 3, y - 6 + (i % 2), 1, 1); }
    ctx.globalAlpha = 1;
  }
}

// Флаг в сине-бело-голубых цветах висит на карнизе у правой шторы (без логотипа клуба)
function drawMatchFlag(ctx, t, dayF) {
  const x0 = 410, y0 = 5, w = 26, h = 30, dim = 0.55 + dayF * 0.45;
  ctx.fillStyle = '#6a5a40'; ctx.fillRect(x0 - 1, y0, w + 2, 2);
  const cols = ['#1f5fd0', '#f4f8ff', '#62b6f2'].map((c) => mixHex('#101018', c, dim)), fringe = mixHex('#101018', '#e8e0c8', dim);
  for (let x = 0; x < w; x++) {
    const sway = Math.round(Math.sin(t * 1.6 + x * 0.25) * 1.2 * (x / w));
    for (let band = 0; band < 3; band++) { ctx.fillStyle = cols[band]; ctx.fillRect(x0 + x, y0 + 2 + band * 10 + sway, 1, 10); }
    if (x % 2 === 0) { ctx.fillStyle = fringe; ctx.fillRect(x0 + x, y0 + 2 + h + sway, 1, 2); }
  }
}

// ---------- подключение к движку ----------
export function drawAbove(b, env, dayF, t) { drawSpire(b, dayF, t); drawBridgeLeaves(b, env.bridge.open, dayF); drawFlag(b, t, dayF); }
export function drawNight(g, env, nightF, t) { drawLakhtaFacade(g, env, nightF, t); drawTvLights(g, env, nightF, t); }
export function drawAboveLate(b, env, dayF, t) { drawCannon(b, env); if (env.torch) drawTorches(b, t); drawStreetCars(b, env, dayF, t); }
export function drawBoatsAndStreet(ctx, env, dayF, t) { drawBoats(ctx, env, dayF, t); drawStreet(ctx, env, dayF, t); }
export { drawBoatsAndStreet as drawBoats };
export function drawRoom(ctx, env, dayF, t) { if (env.zenit?.flag) drawMatchFlag(ctx, t, dayF); }
// Сувенир на подоконнике — Чижик-Пыжик на постаменте
export function drawSill(R, SILL) {
  R('#6a7282', 360, SILL - 2, 10, 3); R('#8a92a2', 360, SILL - 2, 10, 1); // постамент
  R('#c89a3a', 362, SILL - 6, 5, 4); R('#e8c060', 363, SILL - 6, 2, 1); R('#c89a3a', 366, SILL - 7, 2, 2); R('#2a1a0a', 367, SILL - 7, 1, 1);
}

// ---------- улица: машины на мостах, набережная, ларьки (движок — engine/street.js) ----------
const openMonth = (env, a, b) => { const m = env.local.getUTCMonth() + 1; return m >= a && m <= b; };
export function stalls(env) {
  const h = env.local.getUTCHours(), mo = env.local.getUTCMonth() + 1, d = env.local.getUTCDate(), out = [];
  if (openMonth(env, 5, 10) && h >= 10 && h < 23) out.push({ kind: 'boats', x: 150 });              // «Кораблики» с зазывалой
  if (openMonth(env, 5, 9) && h >= 11 && h < 22) out.push({ kind: 'icecream', x: 236 });
  if (((mo === 4 && d >= 15) || mo === 5) && h >= 10 && h < 20) out.push({ kind: 'koryushka', x: 322 }); // весенняя корюшка
  if ((mo >= 11 || mo <= 3) && h >= 10 && h < 20) out.push({ kind: 'tea', x: 236 });
  return out;
}
const LANES = [
  { x0: 0, x1: 72, y: 157, active: (e) => !e.bridge.open }, { x0: 108, x1: 182, y: 157, active: (e) => !e.bridge.open }, // Дворцовый
  { x0: 426, x1: 484, y: 160 },                                                                                          // Троицкий
];
function drawStreetCars(b, env, dayF, t) { streetCars(b, env, dayF, t, LANES); }
function drawStreet(ctx, env, dayF, t) { streetPromenade(ctx, env, dayF, t, stalls(env)); }

// ---------- секреты Петербурга ----------
const sec = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((sec(env) + shift) % period) < dur;
const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((sec(env) + shift) % period) / dur));
export const SECRETS = [
  {
    id: 'nerpa', name: 'Нерпа в Неве', layer: 'street',
    hint: 'Иногда из воды выглядывает круглая голова.',
    found: 'Балтийские нерпы и правда иногда заплывают в Неву.',
    state(env) { if (env.frozen || !inWin(env, 2700, 14, 300)) return null; return { x: 262, y: 183, w: 6, h: 5 }; },
    draw(ctx, env, st, dayF) {
      const c = mixHex('#1e2028', '#5a5a62', dayF);
      ctx.fillStyle = c; ctx.fillRect(st.x + 1, st.y, 4, 1); ctx.fillRect(st.x, st.y + 1, 6, 3);
      ctx.fillStyle = '#0c0c10'; ctx.fillRect(st.x + 1, st.y + 1, 1, 1); ctx.fillRect(st.x + 4, st.y + 1, 1, 1);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#dfe8f0'; ctx.fillRect(st.x - 3, st.y + 4, 12, 1); ctx.fillRect(st.x - 5, st.y + 6, 16, 1); ctx.globalAlpha = 1;
    },
  },
  {
    id: 'meteor', name: '«Метеор» на подводных крыльях', layer: 'street',
    hint: 'Летом днём по Неве проносится что-то очень быстрое.',
    found: '«Метеоры» ходят от Дворцовой набережной в Петергоф.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && (!openMonth(env, 5, 9) || h < 10 || h >= 19)) return null;
      if (!inWin(env, 1800, 10, 900)) return null;
      const p = phase(env, 1800, 10, 900); return { x: Math.round(490 - p * 540), y: 182, w: 20, h: 8 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = mixHex('#2a2e38', '#f4f4f2', dayF); ctx.fillRect(x + 2, y + 2, 18, 3); ctx.fillRect(x + 5, y, 10, 2);
      ctx.fillStyle = mixHex('#1a1e28', '#3a6ab0', dayF); ctx.fillRect(x + 6, y + 1, 8, 1);
      ctx.fillStyle = mixHex('#2a2a34', '#6a6a72', dayF); ctx.fillRect(x + 4, y + 5, 1, 3); ctx.fillRect(x + 16, y + 5, 1, 3); // крылья
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) ctx.fillRect(x + 20 + i * 2, y + 7 - (i % 2), 2, 1); ctx.globalAlpha = 1; // бурун
    },
  },
  {
    id: 'sails', name: 'Алые паруса', layer: 'street',
    hint: 'В конце июня, ближе к полуночи, по Неве идёт особенный корабль.',
    found: '«Алые паруса» — праздник выпускников, бриг с алыми парусами идёт по Неве.',
    state(env) {
      const l = env.local, mo = l.getUTCMonth() + 1, d = l.getUTCDate(), h = l.getUTCHours();
      if (!env.forced && !(mo === 6 && d >= 20 && (h >= 23 || h < 2))) return null;
      if (!inWin(env, 1200, 120)) return null;
      const p = phase(env, 1200, 120); return { x: Math.round(-30 + p * 520), y: 158, w: 22, h: 22 };
    },
    draw(ctx, env, st, dayF) {
      const { x, y } = st;
      ctx.fillStyle = '#3a2418'; ctx.fillRect(x, y + 18, 22, 3); ctx.fillRect(x + 2, y + 21, 18, 1); // корпус
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(x + 7, y + 2, 1, 16); ctx.fillRect(x + 14, y, 1, 18); // мачты
      for (const [mx, top, w, hgt] of [[3, 4, 9, 12], [10, 2, 10, 14]]) for (let i = 0; i < hgt; i++) { ctx.fillStyle = i % 3 ? '#e02a2a' : '#ff4a3a'; ctx.fillRect(x + mx + (i < 3 ? 1 : 0), y + top + i, w - (i < 3 ? 2 : 0), 1); }
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(x, y + 23, 22, 6); ctx.globalAlpha = 1; // отражение
    },
  },
  {
    id: 'koryushka', name: 'Рыбак с корюшкой', layer: 'street',
    hint: 'Весной на парапете кто-то очень терпеливый.',
    found: 'Весной Санкт-Петербург пахнет свежими огурцами — это корюшка.',
    state(env) {
      const l = env.local, mo = l.getUTCMonth() + 1, d = l.getUTCDate(), h = l.getUTCHours();
      if (!env.forced && !(((mo === 4 && d >= 10) || mo === 5) && h >= 6 && h < 21)) return null;
      return { x: 420, y: 190, w: 8, h: 12 };
    },
    draw(ctx, env, st, dayF) {
      drawPerson(ctx, st.x + 3, st.y + 11, 0.3, dayF, 0, false, false, false);
      ctx.fillStyle = mixHex('#2a2a2a', '#5a4a3a', dayF); for (let i = 0; i < 10; i++) ctx.fillRect(st.x + 4 - i, st.y + 5 - (i >> 1), 1, 1); // удочка
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#dfe8f0'; for (let i = 0; i < 12; i++) ctx.fillRect(st.x - 6, st.y + i, 1, 1); ctx.globalAlpha = 1; // леска
    },
  },
];

// ---------- события по новостям (данные — data/events.json) ----------
// basejump: с шпиля Петропавловки прыгает парашютист; fireworks: салют над крепостью.
export function drawEvents(b, env, dayF, t) {
  const ev = env.event;
  if (!ev) return;
  if (ev.kind === 'basejump') {
    const cyc = 24, p = (t % cyc) / cyc;
    if (p < 0.12) { const k = p / 0.12, y = 26 + k * k * 30; b.fillStyle = '#2a2a34'; b.fillRect(302, Math.round(y), 1, 2); b.fillStyle = '#e8c040'; b.fillRect(302, Math.round(y) - 1, 1, 1); }
    else if (p < 0.9) {
      const k = (p - 0.12) / 0.78, x = Math.round(302 + k * 38 + Math.sin(t * 1.3) * 2), y = Math.round(58 + k * 96);
      const cols = ['#e8423a', '#f4f4f4', '#3a7ad0'];
      for (let i = 0; i < 9; i++) { b.fillStyle = cols[Math.floor(i / 3)]; b.fillRect(x - 4 + i, y - 8 + (i === 0 || i === 8 ? 1 : 0), 1, 2); }
      b.fillStyle = '#c8ccd4'; b.fillRect(x - 3, y - 6, 1, 4); b.fillRect(x + 3, y - 6, 1, 4); // стропы
      b.fillStyle = '#2a2a34'; b.fillRect(x, y - 2, 1, 3);
    }
  }
  if (ev.kind === 'fireworks') drawFireworks(b, t, 300, 60, dayF);
}
