// Настоящее звёздное небо: яркие звёзды и созвездия над городом, по реальным координатам.
// Каталог — яркие звёзды (J2000): RA в часах, склонение в градусах, звёздная величина m,
// оттенок (b голубоватый, w белый, y жёлтоватый, r красноватый). Координаты округлены (~0.1°),
// для пиксельного неба этого достаточно. Видно только то, что в этот момент и из этого
// города реально поднимается над горизонтом и попадает в кадр окна.

import { W, HORIZON } from './const.js';
import { smooth, rng } from './util.js';
import { eqToHorizontal } from './astro.js';

const RAD = Math.PI / 180;

const STARS = {
  // Большая Медведица — ковш
  Dubhe: [11.062, 61.75, 1.79, 'y'], Merak: [11.031, 56.38, 2.37, 'w'], Phecda: [11.897, 53.69, 2.44, 'w'],
  Megrez: [12.257, 57.03, 3.31, 'w'], Alioth: [12.900, 55.96, 1.77, 'w'], Mizar: [13.399, 54.93, 2.23, 'w'],
  Alcor: [13.417, 54.99, 4.00, 'w'], Alkaid: [13.792, 49.31, 1.86, 'b'],
  // Малая Медведица — ковш поменьше, Полярная на конце ручки
  Polaris: [2.530, 89.26, 1.98, 'y'], Yildun: [17.536, 86.59, 4.36, 'w'], eUMi: [16.766, 82.04, 4.23, 'w'],
  zUMi: [15.734, 77.79, 4.32, 'w'], Kochab: [14.845, 74.16, 2.08, 'y'], Pherkad: [15.345, 71.83, 3.05, 'w'],
  // Кассиопея — W
  Caph: [0.153, 59.15, 2.27, 'y'], Schedar: [0.675, 56.54, 2.24, 'y'], Navi: [0.945, 60.72, 2.47, 'b'],
  Ruchbah: [1.430, 60.24, 2.68, 'w'], Segin: [1.907, 63.67, 3.38, 'b'],
  // Орион — охотник, зима на юге
  Betelgeuse: [5.919, 7.41, 0.45, 'r'], Bellatrix: [5.418, 6.35, 1.64, 'b'], Meissa: [5.585, 9.93, 3.39, 'b'],
  Mintaka: [5.533, -0.30, 2.25, 'b'], Alnilam: [5.604, -1.20, 1.69, 'b'], Alnitak: [5.679, -1.94, 1.74, 'b'],
  Saiph: [5.796, -9.67, 2.06, 'b'], Rigel: [5.242, -8.20, 0.18, 'b'],
  // Псы: Сириус и Процион по бокам от Ориона
  Sirius: [6.752, -16.72, -1.46, 'w'], Mirzam: [6.378, -17.96, 1.98, 'b'],
  Procyon: [7.655, 5.22, 0.34, 'y'], Gomeisa: [7.452, 8.29, 2.89, 'w'],
  // Телец — V-образная голова и Плеяды
  Aldebaran: [4.599, 16.51, 0.85, 'r'], eTau: [4.477, 19.18, 3.53, 'y'], gTau: [4.330, 15.63, 3.65, 'y'],
  Elnath: [5.438, 28.61, 1.65, 'w'],
  Electra: [3.748, 24.12, 3.70, 'b'], Taygeta: [3.753, 24.47, 4.29, 'b'], Maia: [3.763, 24.37, 3.87, 'b'], Alcyone: [3.791, 24.11, 2.87, 'b'],
  // Возничий — пятиугольник с Капеллой
  Capella: [5.278, 46.00, 0.08, 'y'], Menkalinan: [5.992, 44.95, 1.90, 'w'], tAur: [5.995, 37.21, 2.62, 'w'], iAur: [4.950, 33.17, 2.69, 'y'],
  // Близнецы
  Castor: [7.577, 31.89, 1.58, 'w'], Pollux: [7.755, 28.03, 1.14, 'y'], Alhena: [6.629, 16.40, 1.93, 'w'],
  // Летний треугольник
  Vega: [18.615, 38.78, 0.03, 'b'], Deneb: [20.690, 45.28, 1.25, 'w'], Altair: [19.846, 8.87, 0.77, 'w'],
  // Лебедь — Северный Крест
  Sadr: [20.371, 40.26, 2.23, 'y'], dCyg: [19.749, 45.13, 2.87, 'b'], eCyg: [20.770, 33.97, 2.48, 'y'], Albireo: [19.512, 27.96, 3.05, 'y'],
  // Лира — параллелограмм при Веге
  Sheliak: [18.834, 33.36, 3.52, 'b'], Sulafat: [18.982, 32.69, 3.24, 'b'], zLyr: [18.746, 37.60, 4.34, 'b'], dLyr: [18.908, 36.90, 4.30, 'r'],
  // Орёл
  Tarazed: [19.771, 10.61, 2.72, 'y'], Alshain: [19.921, 6.41, 3.71, 'y'],
  // Волопас — воздушный змей
  Arcturus: [14.261, 19.18, -0.05, 'y'], Izar: [14.750, 27.07, 2.37, 'y'], Seginus: [14.535, 38.31, 3.03, 'b'],
  bBoo: [15.032, 40.39, 3.50, 'r'], dBoo: [15.258, 33.31, 3.47, 'y'], Alphecca: [15.578, 26.30, 2.22, 'b'],
  // Персей
  Mirfak: [3.405, 49.86, 1.79, 'y'], Algol: [3.136, 40.96, 2.12, 'b'], gPer: [3.079, 53.51, 2.93, 'b'],
  dPer: [3.715, 47.79, 3.01, 'b'], ePer: [3.964, 40.01, 2.88, 'b'], zPer: [3.902, 31.88, 2.85, 'b'],
  // Андромеда и квадрат Пегаса
  Alpheratz: [0.140, 29.09, 2.06, 'b'], dAnd: [0.656, 30.86, 3.27, 'b'], Mirach: [1.162, 35.62, 2.05, 'r'], Almach: [2.065, 42.33, 2.26, 'r'],
  Markab: [23.079, 15.21, 2.49, 'w'], Scheat: [23.063, 28.08, 2.42, 'r'], Algenib: [0.220, 15.18, 2.83, 'b'], Enif: [21.736, 9.88, 2.38, 'y'],
  // Лев — серп и спина
  Regulus: [10.139, 11.97, 1.35, 'b'], Denebola: [11.818, 14.57, 2.13, 'w'], Algieba: [10.333, 19.50, 2.08, 'y'],
  Zosma: [11.235, 20.52, 2.56, 'w'], Chertan: [11.237, 15.43, 3.32, 'w'], hLeo: [10.123, 16.76, 3.51, 'y'], eLeo: [9.764, 23.77, 2.98, 'y'],
  // Дева
  Spica: [13.420, -11.16, 0.98, 'b'], Porrima: [12.694, -1.45, 2.74, 'w'], Vindemiatrix: [13.036, 10.96, 2.83, 'y'], dVir: [12.927, 3.40, 3.38, 'y'],
  // Скорпион — виден на юге низко, крюк хвоста
  Antares: [16.490, -26.43, 1.06, 'r'], dSco: [16.005, -22.62, 2.32, 'b'], bSco: [16.091, -19.81, 2.62, 'b'],
  sSco: [16.353, -25.59, 2.89, 'b'], tSco: [16.598, -28.22, 2.82, 'b'], eSco: [16.836, -34.29, 2.29, 'y'],
  uSco: [17.512, -37.30, 2.69, 'b'], Shaula: [17.560, -37.10, 1.63, 'b'],
  // Дракон и Цефей — вокруг полюса
  Rastaban: [17.507, 52.30, 2.79, 'y'], Eltanin: [17.943, 51.49, 2.23, 'y'], xDra: [17.892, 56.87, 3.75, 'b'],
  zDra: [17.146, 65.71, 3.17, 'b'], dDra: [19.209, 67.66, 3.07, 'y'],
  Alderamin: [21.310, 62.59, 2.44, 'w'], Alfirk: [21.478, 70.56, 3.08, 'b'], Errai: [23.656, 77.63, 3.21, 'y'],
  zCep: [22.181, 58.20, 3.35, 'y'], hCep: [20.754, 61.84, 3.43, 'y'],
  // одиночные
  Fomalhaut: [22.961, -29.62, 1.16, 'w'],
};

const LINES = [
  ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Dubhe'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'],
  ['Polaris', 'Yildun'], ['Yildun', 'eUMi'], ['eUMi', 'zUMi'], ['zUMi', 'Kochab'], ['Kochab', 'Pherkad'], ['Pherkad', 'zUMi'],
  ['Caph', 'Schedar'], ['Schedar', 'Navi'], ['Navi', 'Ruchbah'], ['Ruchbah', 'Segin'],
  ['Betelgeuse', 'Bellatrix'], ['Bellatrix', 'Mintaka'], ['Mintaka', 'Alnilam'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Betelgeuse'],
  ['Alnitak', 'Saiph'], ['Saiph', 'Rigel'], ['Rigel', 'Mintaka'], ['Betelgeuse', 'Meissa'], ['Meissa', 'Bellatrix'],
  ['Sirius', 'Mirzam'], ['Procyon', 'Gomeisa'],
  ['gTau', 'eTau'], ['eTau', 'Aldebaran'], ['gTau', 'Aldebaran'], ['gTau', 'Elnath'],
  ['Capella', 'Menkalinan'], ['Menkalinan', 'tAur'], ['tAur', 'Elnath'], ['tAur', 'iAur'], ['iAur', 'Capella'],
  ['Castor', 'Pollux'], ['Pollux', 'Alhena'],
  ['Deneb', 'Sadr'], ['Sadr', 'dCyg'], ['Sadr', 'eCyg'], ['Sadr', 'Albireo'],
  ['Vega', 'zLyr'], ['zLyr', 'Sheliak'], ['Sheliak', 'Sulafat'], ['Sulafat', 'dLyr'], ['dLyr', 'zLyr'],
  ['Tarazed', 'Altair'], ['Altair', 'Alshain'],
  ['Arcturus', 'Izar'], ['Izar', 'dBoo'], ['dBoo', 'bBoo'], ['bBoo', 'Seginus'], ['Seginus', 'Arcturus'],
  ['gPer', 'Mirfak'], ['Mirfak', 'dPer'], ['dPer', 'ePer'], ['ePer', 'zPer'], ['Mirfak', 'Algol'],
  ['Alpheratz', 'dAnd'], ['dAnd', 'Mirach'], ['Mirach', 'Almach'],
  ['Markab', 'Scheat'], ['Scheat', 'Alpheratz'], ['Alpheratz', 'Algenib'], ['Algenib', 'Markab'], ['Markab', 'Enif'],
  ['Regulus', 'hLeo'], ['hLeo', 'Algieba'], ['Algieba', 'eLeo'], ['Algieba', 'Zosma'], ['Zosma', 'Denebola'], ['Denebola', 'Chertan'], ['Chertan', 'Regulus'],
  ['Spica', 'Porrima'], ['Porrima', 'dVir'], ['dVir', 'Vindemiatrix'],
  ['bSco', 'dSco'], ['dSco', 'sSco'], ['sSco', 'Antares'], ['Antares', 'tSco'], ['tSco', 'eSco'], ['eSco', 'uSco'], ['uSco', 'Shaula'],
  ['Rastaban', 'Eltanin'], ['Eltanin', 'xDra'], ['xDra', 'zDra'], ['zDra', 'dDra'],
  ['Alderamin', 'hCep'], ['hCep', 'zCep'], ['zCep', 'Errai'], ['Errai', 'Alfirk'], ['Alfirk', 'Alderamin'],
];

const COL = { b: '#c9d7ff', w: '#f2f5ff', y: '#ffedcb', r: '#ffbe8f' };

// фоновые слабые звёзды: набор случайный, но координаты постоянные — звезды движутся
// вместе с небом (в отличие от старого шума, привязанного к экрану)
const FAINT = [];
{ const r = rng(2609); for (let i = 0; i < 90; i++) FAINT.push([r() * 24, Math.min(85, Math.max(-30, Math.asin(r() * 2 - 1) / RAD)), 4.5 + r() * 0.8]); }

let cacheKey = '', cache = null;

export function drawStars(g, starF, env, t, xz, yz) {
  if (starF <= 0.02) return;
  const key = Math.floor(env.ms / 60000) + ':' + env.lat.toFixed(1) + ',' + env.lon.toFixed(1);
  if (key !== cacheKey) { // пересчёт раз в минуту звёздного времени (0.25° поворота неба)
    cacheKey = key;
    const pts = [], pos = {}, segs = [];
    const add = (ra, dec, m, c, id) => {
      const h = eqToHorizontal(ra * 15 * RAD, dec * RAD, env.ms, env.lat, env.lon);
      if (h.alt < 0.5) return null;
      const x = xz(h.az);
      if (x < -8 || x > W + 8) return null;
      const y = yz(h.alt);
      if (y < -6 || y >= HORIZON - 2) return null;
      const p = { x: Math.round(x), y: Math.round(y), m, c, tw: (ra * 7.3 + dec) % 6.28, ext: 0.35 + 0.65 * smooth(0, 12, h.alt) };
      pts.push(p);
      if (id) pos[id] = p;
      return p;
    };
    for (const id in STARS) { const s = STARS[id]; add(s[0], s[1], s[2], s[3], id); }
    for (const f of FAINT) add(f[0], f[1], f[2], 'f');
    for (const [a, b2] of LINES) { if (pos[a] && pos[b2]) segs.push([pos[a], pos[b2]]); }
    cache = { pts, segs };
  }
  const { pts, segs } = cache;
  for (const p of pts) {
    const tw = 0.55 + 0.45 * Math.sin(t * (p.m > 3 ? 1.7 : 1.1) + p.tw);
    const a = Math.min(1, starF * p.ext * Math.max(0.12, 1.18 - p.m * 0.22) * tw);
    g.globalAlpha = a;
    g.fillStyle = p.c === 'f' ? '#dce4f8' : COL[p.c];
    const s = p.m < 1 ? 2 : 1;
    g.fillRect(p.x, p.y, s, s);
    if (p.m < 0.6) { // лучики у самых ярких — Сириус, Вега, Арктур, Капелла
      g.globalAlpha = a * 0.5;
      g.fillRect(p.x - 2, p.y, 1, 1); g.fillRect(p.x + s + 1, p.y, 1, 1);
      g.fillRect(p.x, p.y - 2, 1, 1); g.fillRect(p.x, p.y + s + 1, 1, 1);
    }
  }
  // созвездия: едва заметный пунктир, чтобы узор читался, но линий «в лоб» не было
  g.globalAlpha = starF * 0.13; g.fillStyle = '#aab8e8';
  for (const [p, q] of segs) {
    const n = Math.hypot(q.x - p.x, q.y - p.y) | 0;
    for (let i = 0; i <= n; i += 3) g.fillRect(Math.round(p.x + (q.x - p.x) * i / n), Math.round(p.y + (q.y - p.y) * i / n), 1, 1);
  }
  g.globalAlpha = 1;
}
