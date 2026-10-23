// Окно «Дорога»: вид из-за лобового стекла праворульного минивэна Honda Stepwgn. Мы сидим на левом
// пассажирском месте и смотрим вперёд: машина едет на запад, к Москве, Давид — справа за рулём.
// Дорога в псевдо-3D, как в OutRun: точка схода на горизонте, строка экрана = расстояние впереди
// (z = CF / d), всё, что бежит навстречу (разметка, столбики, деревья, встречные), считается от
// километра дороги env.car.km: машина стоит — пейзаж стоит. Дальний план (хребты, сопки) почти
// неподвижен и лишь медленно меняется с километражем. Зоны леса, воды и хребтов привязаны к
// «эквивалентному километру Транссиба» env.train.km (= env.car.rail).
// На стоянке: достопримечательность ближайшего города впереди-слева у горизонта или стела региона
// у правой обочины; машина стоит на площадке у края дороги.

import { mixHex, clamp, smooth } from '../../engine/util.js';
import { W, HORIZON, SILL } from '../../engine/const.js';
import { STOPS, sightNear, regionAt } from './route.js';

// Палитры нужны движку (комната и сезоны); пейзаж смешивает свои цвета по dayF сам
const DAY = { far: '#8a9ab8' }, NIGHT = { far: '#1e2438' };
export const PALETTE = { DAY, NIGHT, AUTUMN: { day: {}, night: {} }, WINTER: { day: {}, night: {} } };
export const NO_GULLS = true;
export function drawFar() {} // неподвижного дальнего плана нет — всё считается в drawAbove

const KM1 = 9280;        // километров дороги от Владивостока до Москвы
const RAIL_END = 9288;   // и столько же примерно «Транссиба» — по нему зоны пейзажа
const CX = W / 2;

// ---------- перспектива ----------
// Камера на высоте CAMH метров, фокус F пикселей: строка экрана d = y - HORIZON лежит на расстоянии
// z = CF / d, на ней один метр занимает d / CAMH пикселей. Дорога: полосы по 3,5 м, ось X = 0 — разделительная
// линия, наша полоса справа (X > 0). Камера едет в 1,35 м правее оси; на стоянке — на площадке у края.
const VX = 250, F = 200, CAMH = 1.2, CF = F * CAMH;
const Z_MAX = 250;   // дальше строки сливаются с горизонтом — это уже «дальний план»
const ROW_END = 224; // ниже строк торпеды не видно
const CAM_RUN = 1.35, CAM_PARK = 3.9;

// ---------- шум ----------
const hash = (i, s = 0) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
function noise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; }
const bump = (km, a, b, edge) => smooth(a - edge, a, km) * (1 - smooth(b, b + edge, km));

// Рельеф вдоль всей линии (по rail-км, считая от Москвы): среднерусская равнина, вятские увалы,
// Урал, Западно-Сибирская равнина, Кузнецкое нагорье и Саяны, Хамар-Дабан над Байкалом, Яблоновый
// хребет, амурские сопки, Сихотэ-Алинь
const ridgeAmp = (km) => 4 + 8 * bump(km, 500, 1150, 80)
  + 26 * bump(km, 1650, 1790, 200) + 6 * bump(km, 1790, 2150, 80) + 2 * bump(km, 2150, 3260, 100)
  + 12 * bump(km, 3400, 3820, 80) + 14 * bump(km, 3900, 4150, 80) + 5 * bump(km, 4150, 4460, 80)
  + 8 * bump(km, 4515, 4930, 80) + 5 * bump(km, 4930, 5290, 80) + 18 * bump(km, 5290, 5450, 60)
  + 3 * bump(km, 5450, 5800, 80) + 14 * bump(km, 5800, 6300, 100) + 6 * bump(km, 6300, 6900, 100)
  + 8 * bump(km, 6900, 7865, 100) + 3 * bump(km, 7865, 8520, 100) + 9 * bump(km, 8520, 9200, 100)
  + 2 * bump(km, 9200, RAIL_END, 60);

// Вода у дороги (rail-км): lake — гладь слева от дороги (на юге), river — под мостом (на мосту перила по обе стороны).
// Положение рек приблизительное, как и у Транссиба
const WATERS = [
  { a: 447, b: 453, kind: 'river' },               // Ока и Волга у Нижнего Новгорода
  { a: 697, b: 703, kind: 'river', wide: true },   // Волга у Чебоксар
  { a: 951, b: 957, kind: 'river', wide: true },   // Волга у Казани
  { a: 1442, b: 1446, kind: 'river' },             // Кама
  { a: 2709, b: 2713, kind: 'river', wide: true }, // Иртыш у Омска
  { a: 3332, b: 3336, kind: 'river', wide: true }, // Обь у Новосибирска — самая широкая
  { a: 4097, b: 4101, kind: 'river' },             // Енисей у Красноярска
  { a: 5183, b: 5187, kind: 'river' },             // Ангара у Иркутска
  { a: 5290, b: 5340, kind: 'lake' },              // Байкал у Култука
  { a: 5640, b: 5644, kind: 'river' },             // Селенга у Улан-Удэ
  { a: 8513, b: 8517, kind: 'river' },             // Амур у Хабаровска
  { a: 9270, b: 9290, kind: 'lake', sea: true },   // Амурский залив у Владивостока
];
const waterAt = (km) => WATERS.find((w) => km > w.a && km < w.b) || null;
// Вода на расстоянии z впереди; на стоянке у моста машина стоит на берегу, воду видно только вдали
const waterZ = (V, z) => { const w = waterAt(V.rail - z / 1000); return w && V.parked && z < 160 && w.kind === 'river' ? null : w; };

// Сезон и время суток → цвета слоя
function colors(env, dayF) {
  const w = env.winter, a = env.autumn, km = env.train?.km ?? 0;
  const d = (day, night) => mixHex(night, day, dayF);
  // земля: зелёная луговая, в степи — жёлто-зелёные тона
  const steppe = km > 1790 && km < 3260 ? '#8ca050' : km > 5450 && km < 5800 ? '#9aa050' : km > 6300 && km < 7500 ? '#969c48' : '#6c8c4a';
  return {
    far: d('#8e9cbc', '#1d2338'), farHi: d('#a8b4cc', '#252c44'), snow: d('#eef2f8', '#55607c'),
    lake: d(w ? '#dfe8f0' : '#7d98b8', w ? '#26304a' : '#141c30'), sea: d(w ? '#d6e2ec' : '#5f7e9c', w ? '#202a40' : '#101828'),
    lakeHi: d(w ? '#9ab4c8' : '#c4d4e6', '#2a3654'),
    hill: d(w ? '#6d7a78' : a ? '#9a8a40' : '#4a7450', '#111a1c'), hillDark: d(w ? '#56625f' : a ? '#7c6e32' : '#3a5e42', '#0d1416'),
    larch: d(w ? '#6a5d55' : a ? '#d9a032' : '#55884a', '#141c1a'), larchHi: d(w ? '#eef2f6' : a ? '#f0c050' : '#6ea05c', '#1e2826'),
    pine: d('#2c4a34', '#0e1614'), pineHi: d(w ? '#e6ecf2' : '#3c6044', '#16201e'),
    pineAmur: d('#22402c', '#0c1412'),
    birchTrunk: d('#d8d8d0', '#46484e'),
    ground: d(w ? '#e2e8ee' : a ? '#8c7c46' : steppe, w ? '#2a3044' : '#121814'),
    groundDark: d(w ? '#c8d0da' : a ? '#76683a' : '#58763c', w ? '#222838' : '#0e1310'),
    mast: d('#7c848c', '#1c2028'), wood: d('#5a4636', '#161210'),
    // дорога: обочина белая зимой, асфальт зимой светлее и в колее
    shoulder: d(w ? '#e8eef4' : '#9c968a', w ? '#4a5470' : '#26262c'), bank: d(w ? '#f2f6fa' : '#a8a296', w ? '#5c6684' : '#2e2e34'),
    edge: d(w ? '#c8d0da' : '#d8d6cc', w ? '#3a4260' : '#6e6e70'),
    asphalt: d(w ? '#7e848e' : '#5a5e68', w ? '#2a2e3a' : '#1c1e26'), asphaltNear: d(w ? '#767c86' : '#50545e', w ? '#242836' : '#181a22'),
    asphaltHi: d(w ? '#9aa0aa' : '#70747e', w ? '#343a4a' : '#262832'), asphaltLo: d(w ? '#5e636d' : '#40444c', w ? '#1c2030' : '#121418'),
    rut: d('#444850', '#14161c'), slush: d('#e0e6ee', '#4a5470'),
    dash: d('#ece9de', '#9a9a94'),
    postWhite: d('#eef0ea', '#6a6c78'), postBlack: d('#1c1e24', '#0a0a0e'),
  };
}

// ---------- камера ----------
// Лёгкая часть: километр дороги, изгиб трассы (медленно меняется с километражем) и поперечное положение камеры
function lview(env) {
  const car = env.car, km = car.km;
  return { cam: km * 1000, B: (noise(km / 3, 91) - 0.5) * 0.0008, camX: car.parked ? CAM_PARK : CAM_RUN, parked: !!car.parked };
}
// Экранные x и y точки на расстоянии z впереди, на поперечном смещении X от осевой линии
const pxAt = (V, X, z) => VX + (X - V.camX + V.B * z * z) * F / z;
const pyAt = (z) => HORIZON + CF / z;
// Перебор предметов вдоль пути через каждые step метров: (i, расстояние впереди)
function cellsFor(cam, step, zMin, zMax, fn) {
  for (let i = Math.ceil((cam + zMin) / step); i <= Math.floor((cam + zMax) / step); i++) fn(i, i * step - cam);
}

// Что растёт у дороги на этом rail-км: [вид, густота]
function zoneTree(k, r) {
  if (k < 1150) return [r < 0.3 ? 'birch' : 'fir', 0.85];
  if (k < 1790) return [r < 0.5 ? 'larch' : 'fir', 0.85];
  if (k < 3260) return ['birch', 0.2];
  if (k < 5290) return [r < 0.4 ? 'larch' : 'fir', 0.85];
  if (k < 5450) return ['fir', 0.3];
  if (k < 6300) return ['fir', 0.18];
  if (k < 7500) return [r < 0.5 ? 'larch' : 'fir', 0.22];
  return [r < 0.45 ? 'fir' : 'larch', 0.8];
}

// ---------- деревья ----------
// Ёлочка: ярусы снизу вверх, светлая кромка слева. Рисуются только строки, попадающие в кадр
const rowFrom = (base) => Math.max(0, base - ROW_END);
function fir(g, x, base, h, c, hi, wf = 0.4) {
  if (h < 14) { // маленькая ёлочка: простой конус
    const w = Math.max(1, Math.round(h * 0.42));
    for (let y = rowFrom(base); y < h; y++) {
      const hw = Math.max(0, Math.round(w * (1 - y / h) * (0.75 + 0.25 * ((y % 3) === 0))));
      g.fillStyle = c; g.fillRect(x - hw, base - y, hw * 2 + 1, 1);
      if (hi && hw > 1 && y % 3 === 0) { g.fillStyle = hi; g.fillRect(x - hw, base - y, Math.max(1, hw >> 1), 1); }
    }
    g.fillStyle = c; g.fillRect(x, base - h - 1, 1, 2);
    return;
  }
  // большая: ярусы лап — каждый шире внизу и сужается кверху; свет слева, тень справа и под лапой
  const w = Math.max(2, Math.round(h * wf)), T = Math.max(4, Math.round(h / 9)), dark = mixHex(c, '#000000', 0.3);
  for (let y = rowFrom(base); y < h; y++) {
    const k = 1 - y / h, ph = (y % T) / T, hw = Math.max(0, Math.round(w * k * (0.6 + 0.4 * (1 - ph))));
    g.fillStyle = c; g.fillRect(x - hw, base - y, hw * 2 + 1, 1);
    if (hw > 2) {
      const lw = Math.max(1, Math.round(hw * 0.4));
      if (ph < 0.5 && hi) { g.fillStyle = hi; g.fillRect(x - hw, base - y, lw, 1); }
      g.fillStyle = dark; g.fillRect(x + hw - Math.max(1, Math.round(hw * 0.35)), base - y, Math.max(1, Math.round(hw * 0.35)) + 1, 1);
      if (y % T === 0) g.fillRect(x - hw + lw, base - y, hw * 2 - lw + 1, 1);
    }
  }
  g.fillStyle = c; g.fillRect(x, base - h - 1, 1, 2);
}
// Лиственница: реже, прозрачнее; зимой голая
function larch(g, x, base, h, c, hi, bare) {
  if (bare) {
    g.fillStyle = c; g.fillRect(x, base - h, 1, h);
    const st = Math.max(3, Math.round(h / 12));
    for (let y = 3; y < h - 2; y += st) { const l = Math.round((1 - y / h) * h * 0.25); g.fillRect(x - l, base - y, l, 1); g.fillRect(x + 1, base - y - 1, l, 1); }
    return;
  }
  if (h >= 20) { fir(g, x, base, h, c, hi, 0.28); g.fillStyle = c; g.fillRect(x, base - h, 1, h); return; }
  const w = Math.max(1, Math.round(h * 0.3));
  for (let y = rowFrom(base); y < h; y += 1) {
    if (y % 2 && y < h - 3) continue;
    const hw = Math.round(w * (1 - y / h));
    g.fillStyle = c; g.fillRect(x - hw, base - y, hw * 2 + 1, 1);
    if (hi && hw > 1) { g.fillStyle = hi; g.fillRect(x - hw, base - y, 1, 1); }
  }
  g.fillStyle = c; g.fillRect(x, base - h, 1, h);
}
// Берёза: белый ствол и ажурная крона
function birch(g, x, base, h, c, hi, trunk, bare) {
  if (bare) {
    g.fillStyle = trunk; g.fillRect(x, base - h, 1, h);
    const st = Math.max(3, Math.round(h / 12));
    for (let y = 3; y < h - 2; y += st) { const l = Math.round((1 - y / h) * h * 0.25); g.fillRect(x - l, base - y, l, 1); g.fillRect(x + 1, base - y - 1, l, 1); }
    return;
  }
  if (h >= 20) { // крупная берёза: белый ствол с чёрными метинами и округлая крона
    const tw = Math.max(1, Math.round(h / 28)), cy = base - Math.round(h * 0.66), ry = Math.round(h * 0.34), rx = Math.round(h * 0.2);
    g.fillStyle = trunk; g.fillRect(x - (tw >> 1), cy, tw, base - cy);
    g.fillStyle = '#2a2a2e'; for (let y = cy + 6; y < base; y += 7) g.fillRect(x - (tw >> 1), y, tw, 1);
    const dark = mixHex(c, '#000000', 0.25);
    for (let yy = -ry; yy <= ry; yy++) {
      const py = cy + yy; if (py < 0 || py > ROW_END) continue;
      const hw = Math.round(rx * Math.sqrt(1 - (yy / (ry + 0.5)) ** 2) * (0.82 + 0.18 * hash(yy, 3)));
      g.fillStyle = c; g.fillRect(x - hw, py, hw * 2 + 1, 1);
      if (hw > 2) { g.fillStyle = hi; g.fillRect(x - hw, py, Math.max(1, Math.round(hw * 0.35)), 1); g.fillStyle = dark; g.fillRect(x + hw - Math.max(1, Math.round(hw * 0.3)), py, Math.max(1, Math.round(hw * 0.3)) + 1, 1); }
    }
    return;
  }
  g.fillStyle = trunk; g.fillRect(x, base - h, Math.max(1, h >> 5), h);
  const w = Math.max(1, Math.round(h * 0.3));
  for (let y = Math.max(2, rowFrom(base)); y < h; y += 1) {
    if (y % 2 && y < h - 3) continue;
    const hw = Math.round(w * (1 - y / h));
    g.fillStyle = c; g.fillRect(x - hw, base - y, hw * 2 + 1, 1);
    if (hi && hw > 1) { g.fillStyle = hi; g.fillRect(x - hw, base - y, 1, 1); }
  }
}
function drawTree(ctx, V, type, X, z, r, amur, hMax = 96) {
  const C = V.C, s = F / z, x = Math.round(pxAt(V, X, z)), base = Math.round(pyAt(z));
  // вблизи деревья не раздуваются в тёмные стены: высота ограничена, ближние — реже и дальше от дороги
  const h = Math.max(2, Math.min(hMax, Math.round((type === 'birch' ? 5.5 + r * 4 : 8 + r * 7) * s)));
  if (x < -h * 0.5 - 4 || x > W + h * 0.5 + 4) return;
  const hz = smooth(12, 260, z) * 0.7, m = (c) => (hz > 0.02 ? mixHex(c, C.far, hz) : c);
  if (type === 'fir') fir(ctx, x, base, h, m(amur ? C.pineAmur : C.pine), m(C.pineHi));
  else if (type === 'larch') larch(ctx, x, base, h, m(C.larch), m(C.larchHi), V.winter);
  else birch(ctx, x, base, h, m(C.larch), m(C.larchHi), m(C.birchTrunk), V.winter);
}

// ---------- над горизонтом: хребты, сопки, Байкал ----------
// Почти неподвижны: профиль привязан к центру кадра и сдвигается лишь вместе с километражем
export function drawAbove(b, env, dayF) {
  const rail = env.train.km, C = colors(env, dayF), amp = ridgeAmp(rail);
  for (let x = 0; x < W; x++) {
    const u = (x - CX) * 0.01 + rail * 0.002;
    const h = amp * (0.55 * noise(u * 1.4, 1) + 0.3 * noise(u * 5.2, 2) + 0.15 * noise(u * 16.4, 3));
    const top = Math.round(HORIZON - 6 - h);
    b.fillStyle = C.far; b.fillRect(x, top, 1, HORIZON - top);
    const snowLine = HORIZON - 6 - Math.max(30, amp * 0.62);
    if (top < snowLine) { b.fillStyle = C.snow; b.fillRect(x, top, 1, Math.min(snowLine - top, 2 + ((hash(x + Math.floor(rail * 3), 4) * 4) | 0))); }
    else if (env.winter && top < HORIZON - 16) { b.fillStyle = C.snow; b.fillRect(x, top, 1, 1); }
  }
  // сопки и кромка леса: тем ниже, чем реже лес по зоне
  const f = zoneTree(rail, 0.5)[1], hillC = mixHex(C.hill, C.far, 0.35), hillD = mixHex(C.hillDark, C.far, 0.35);
  for (let x = 0; x < W; x++) {
    const u = (x - CX) * 0.03 + rail * 0.006;
    const hh = Math.round(2 + (13 * noise(u, 5) + 5 * noise(u * 4.2, 6)) * (0.35 + 0.65 * f));
    b.fillStyle = hillC; b.fillRect(x, HORIZON - hh, 1, hh);
    b.fillStyle = hillD; b.fillRect(x, HORIZON - Math.max(1, hh >> 1), 1, Math.max(1, hh >> 1));
    if (f > 0.5) { const sp = Math.round(hash(x >> 1, 7) * 3.4); if (sp > 0) { b.fillStyle = hillC; b.fillRect(x, HORIZON - hh - sp, 1, sp); } }
  }
  // озеро или море слева у горизонта (на юге), если оно рядом по ходу
  let lake = null, near = 0;
  for (let dz = 0; dz <= 3; dz += 0.5) { const w = waterAt(rail - dz); if (w && w.kind === 'lake') { lake = w; near = 1 - dz / 4; break; } }
  if (lake) {
    const xe = Math.round(VX - 30 - (1 - near) * 70);
    b.fillStyle = lake.sea ? C.sea : C.lake; b.fillRect(0, HORIZON - 6, xe, 6);
    b.fillStyle = C.lakeHi; for (let x = 4; x < xe; x += 9) b.fillRect(x + ((hash(x, 9) * 4) | 0), HORIZON - 3 - ((hash(x, 10) * 3) | 0), 3, 1);
  }
}

// ---------- встречные машины ----------
// Детерминированно от времени: раз в 30 секунд (слот) по встречке проезжает одна машина с вероятностью
// 0,85, изредка за ней вторая. Скорость сближения — своя + встречные ~85 км/ч; на стоянке — только их собственная.
// Редкий ночной дальнобой мигает фарами — секрет. z — расстояние до машины впереди, м.
function vehicles(env) {
  const car = env.car, s = env.ms / 1000, night = !!car.night, vrel = ((car.speed || 0) + 85) / 3.6;
  const slot = Math.floor(s / 30), ph = s - slot * 30, out = [];
  for (const [j, jn] of [[0, 0], [1, 1]]) {
    if (hash(slot, 30 + j) > (j ? 0.22 : 0.85)) continue;
    const r = hash(slot, 32 + j), type = j ? (r < 0.5 ? 'car' : 'van') : (r < 0.45 ? 'truck' : r < 0.8 ? 'car' : 'van');
    const off = 1 + hash(slot, 34) * 15 + jn * (1.4 + hash(slot, 35) * 1.2);
    const z = Z_MAX - vrel * (ph - off);
    if (ph < off || z < 1.5) continue;
    out.push({ type, z, ci: (hash(slot, 36 + j) * 5) | 0, flash: !j && type === 'truck' && night && hash(slot, 92) < 0.15 });
  }
  return out;
}
const BODY = ['#e8e6e0', '#3a6ea8', '#c84a3a', '#5a8a58', '#d8a838'];
const CAB = ['#2c5a9a', '#c84a3a', '#e8e6e0', '#3a8a5a', '#d8a838'];
const CARS = ['#c8c8cc', '#26303e', '#a8302c', '#3a5a88', '#e8e4d8'];
// габариты (ширина, высота, м) встречного спереди
const VEH = { truck: [2.5, 3.5], van: [1.9, 2.0], car: [1.8, 1.45] };
// цвет в сумерках темнеет
const dim = (c, dayF) => mixHex(mixHex(c, '#0a0e1a', 0.78), c, dayF);
const rc = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
// Где встречная на экране: центр, линия колёс, пикселей на метр, габариты в пикселях
function vehBox(V, v) {
  const s = F / v.z, [vw, vh] = VEH[v.type], cx = Math.round(pxAt(V, -1.75, v.z)), base = Math.round(pyAt(v.z));
  return { s, cx, base, w: Math.max(2, Math.round(vw * s)), h: Math.max(2, Math.round(vh * s)) };
}

// Трапеция по строкам: от ширины w0 сверху до w1 снизу, по центру cx
function trap(ctx, c, cx, y0, h, w0, w1) {
  for (let r = 0; r < h; r++) { const w = Math.max(1, Math.round(w0 + (w1 - w0) * (r / Math.max(1, h - 1)))); rc(ctx, c, cx - (w >> 1), y0 + r, w, 1); }
}
// Стекло с градиентом и бликом: трапеция сверху вниз
function glassTrap(ctx, dk, cx, y0, h, w0, w1) {
  for (let r = 0; r < h; r++) {
    const w = Math.max(1, Math.round(w0 + (w1 - w0) * (r / Math.max(1, h - 1)))), c = dk(mixHex('#b4cde2', '#5a7088', r / Math.max(1, h - 1)));
    rc(ctx, c, cx - (w >> 1), y0 + r, w, 1);
    if (h > 6 && w > 8) { const gx = cx - (w >> 1) + 1 + Math.round(((r * 1.2) % (w * 0.5))); rc(ctx, dk('#e2eef8'), gx, y0 + r, Math.max(1, w >> 4), 1); } // диагональный блик
  }
}

// Встречная спереди: у фуры кабина с лобовым, козырьком, зеркалами, решёткой, бампером и тент; у легковушки крыша,
// стёкла и колёса в арках; у фургона плоская «газелевская» морда. Днём горит ближний, ночью — ореол и отблеск на асфальте
function drawVehicle(ctx, V, v, dayF) {
  const nightF = 1 - dayF, { s, cx, base, w, h } = vehBox(V, v), x = cx - (w >> 1);
  if (x > W + 5 || x + w < -5) return;
  const dk = (c) => dim(c, dayF), u = (m) => Math.max(1, Math.round(m * s)), big = s >= 5;
  const sh = (c, a) => dk(mixHex(c, '#000000', a)), li = (c, a) => dk(mixHex(c, '#ffffff', a));
  let hy; // высота фар над дорогой, м
  if (v.type === 'truck') {
    const tw = Math.round(w * 1.04), tx = cx - (tw >> 1), top = base - u(4.0), tc = BODY[v.ci], cab = CAB[v.ci];
    rc(ctx, dk(tc), tx, top, tw, u(3.1));                                         // тент полуприцепа: выше и шире кабины
    rc(ctx, li(tc, 0.25), tx, top, tw, 1); rc(ctx, sh(tc, 0.22), tx + tw - u(0.3), top, u(0.3), u(3.1));
    if (big) for (let rx = tx + u(0.5); rx < tx + tw - u(0.3); rx += u(0.5)) rc(ctx, sh(tc, 0.14), rx, top + u(0.15), 1, u(2.8)); // рёбра тента
    rc(ctx, dk('#2a2c30'), tx, base - u(1.0), tw, u(0.2));                         // рама под тентом
    const ct = base - u(3.3);
    rc(ctx, dk(cab), x + u(0.1), ct - u(0.3), w - u(0.2), u(0.3)); rc(ctx, li(cab, 0.3), x + u(0.1), ct - u(0.3), w - u(0.2), 1); // обтекатель на крыше
    rc(ctx, dk(cab), x, ct, w, u(2.8)); rc(ctx, li(cab, 0.3), x, ct, w, 1);       // кабина
    rc(ctx, sh(cab, 0.2), x + w - u(0.25), ct, u(0.25), u(2.6));                  // тень со стороны, дальней от света
    if (big) rc(ctx, dk('#1a1c20'), x + u(0.15), ct + u(0.12), w - u(0.3), u(0.22)); // солнцезащитный козырёк
    glassTrap(ctx, dk, cx, ct + u(0.4), u(1.1), w - u(0.4), w - u(0.4));            // лобовое
    rc(ctx, dk(cab), cx, ct + u(0.4), Math.max(1, u(0.06)), u(1.1));              // центральная стойка
    if (big) for (const sd of [0, 1]) rc(ctx, dk('#16181c'), sd ? cx + u(0.3) : cx - u(0.9), ct + u(1.45), u(0.6), Math.max(1, u(0.06))); // дворники
    const gy = base - u(1.85);
    rc(ctx, dk('#15171b'), x + u(0.4), gy, w - u(0.8), u(0.85));                  // решётка радиатора
    if (big) { for (let q = 1; q < 5; q++) rc(ctx, dk('#2e3138'), x + u(0.4), gy + Math.round(u(0.85) * q / 5), w - u(0.8), 1); rc(ctx, dk('#c8c8cc'), cx - u(0.18), gy + u(0.32), u(0.36), Math.max(1, u(0.14))); }
    rc(ctx, dk('#44474f'), x - u(0.05), base - u(0.8), w + u(0.1), u(0.45)); rc(ctx, li('#44474f', 0.35), x - u(0.05), base - u(0.8), w + u(0.1), 1); // бампер
    rc(ctx, dk('#e8e6e0'), cx - u(0.3), base - u(0.72), u(0.6), Math.max(1, u(0.16))); // номер
    for (const mx of [x - u(0.26), x + w + u(0.04)]) { rc(ctx, dk('#1a1c20'), mx, ct + u(0.35), u(0.22), u(0.75)); rc(ctx, dk('#6a7480'), mx + (mx < x ? 1 : 0), ct + u(0.4), Math.max(1, u(0.06)), u(0.6)); } // зеркала
    for (const wx of [x + u(0.05), x + w - u(0.5)]) { rc(ctx, dk(cab), wx - u(0.05), base - u(1.1), u(0.6), u(0.14)); rc(ctx, '#121418', wx, base - u(1.0), u(0.45), u(1.0)); } // колёса под крыльями
    hy = 1.35;
  } else if (v.type === 'van') {
    const bd = CARS[v.ci];
    rc(ctx, dk(bd), x, base - u(2.3), w, u(1.85)); rc(ctx, li(bd, 0.3), x, base - u(2.3), w, 1);  // кузов-фургон над кабиной
    rc(ctx, sh(bd, 0.25), x, base - u(2.05), w, Math.max(1, u(0.06)));
    rc(ctx, dk(bd), x + u(0.05), base - u(1.95), w - u(0.1), u(1.55));            // кабина
    rc(ctx, sh(bd, 0.2), x + w - u(0.22), base - u(1.95), u(0.17), u(1.5));
    glassTrap(ctx, dk, cx, base - u(1.85), u(0.85), w - u(0.4), w - u(0.4));        // высокое плоское лобовое
    rc(ctx, dk(bd), cx, base - u(1.85), Math.max(1, u(0.05)), u(0.85));
    rc(ctx, li(bd, 0.15), x + u(0.1), base - u(0.95), w - u(0.2), u(0.5));          // короткий капот
    rc(ctx, dk('#15171b'), cx - u(0.5), base - u(0.88), u(1.0), u(0.3));           // решётка
    if (big) for (let q = 1; q < 3; q++) rc(ctx, dk('#34373e'), cx - u(0.5), base - u(0.88) + Math.round(u(0.3) * q / 3), u(1.0), 1);
    rc(ctx, dk('#3a3c44'), x - u(0.03), base - u(0.48), w + u(0.06), u(0.3)); rc(ctx, li('#3a3c44', 0.35), x - u(0.03), base - u(0.48), w + u(0.06), 1);
    rc(ctx, dk('#e8e6e0'), cx - u(0.22), base - u(0.4), u(0.44), Math.max(1, u(0.12)));
    for (const mx of [x - u(0.22), x + w + u(0.02)]) rc(ctx, dk('#1a1c20'), mx, base - u(1.7), u(0.2), u(0.55));
    for (const wx of [x + u(0.1), x + w - u(0.45)]) { rc(ctx, '#0c0d10', wx - 1, base - u(0.72), u(0.35) + 2, u(0.72)); rc(ctx, '#121418', wx, base - u(0.6), u(0.35), u(0.6)); }
    hy = 0.78;
  } else {
    const bd = CARS[v.ci], ww = Math.round(w * 0.8), ww2 = Math.round(w * 0.68);
    rc(ctx, dk(bd), x, base - u(0.88), w, u(0.55)); rc(ctx, li(bd, 0.35), x + 1, base - u(0.88), w - 2, 1); // капот и крылья
    rc(ctx, sh(bd, 0.25), x + w - u(0.25), base - u(0.85), u(0.25), u(0.5));
    trap(ctx, dk(bd), cx, base - u(1.45), u(0.6), ww2, ww);                           // кабина: сужается кверху
    rc(ctx, li(bd, 0.4), cx - (ww2 >> 1) + 1, base - u(1.45), ww2 - 2, 1);           // крыша
    glassTrap(ctx, dk, cx, base - u(1.38), Math.max(2, u(0.46)), Math.max(2, ww2 - u(0.2)), Math.max(2, ww - u(0.2)));
    rc(ctx, dk('#1a1c20'), cx - u(0.4), base - u(0.74), u(0.8), u(0.22));              // решётка
    rc(ctx, dk('#3a3c44'), x, base - u(0.38), w, u(0.2)); rc(ctx, li('#3a3c44', 0.3), x, base - u(0.38), w, 1); // бампер
    rc(ctx, dk('#e8e6e0'), cx - u(0.25), base - u(0.58), u(0.5), Math.max(1, u(0.13)));
    for (const mx of [x - u(0.1), x + w - u(0.06)]) rc(ctx, dk(bd), mx, base - u(0.98), u(0.16), Math.max(1, u(0.12))); // зеркала
    for (const wx of [x + u(0.12), x + w - u(0.42)]) { rc(ctx, '#0c0d10', wx - 1, base - u(0.58), u(0.3) + 2, u(0.58)); rc(ctx, '#121418', wx, base - u(0.5), u(0.3), u(0.5)); } // колёса в арках
    hy = 0.66;
  }
  // фары: ближний свет включён и днём
  const ly = base - u(hy), lw = u(v.type === 'car' ? 0.4 : 0.34), lh = u(0.2);
  for (const lx of [x + u(0.18), x + w - u(0.18) - lw]) {
    rc(ctx, dk('#2a2c30'), lx - 1, ly - 1, lw + 2, lh + 2);
    rc(ctx, nightF > 0.2 ? '#fff6d0' : '#e8e4cc', lx, ly, lw, lh);
    if (big) rc(ctx, '#e8a030', lx, ly + lh + 1, Math.max(1, lw >> 1), Math.max(1, u(0.06))); // поворотник
    if (nightF > 0.15) {
      const R = Math.max(4, Math.round(2.2 * s)), g = ctx.createRadialGradient(lx + lw / 2, ly + lh / 2, 0, lx + lw / 2, ly + lh / 2, R);
      g.addColorStop(0, `rgba(255,244,200,${0.8 * nightF})`); g.addColorStop(0.35, `rgba(255,240,190,${0.3 * nightF})`); g.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - R, ly - R, R * 2 + lw, R * 2 + lh);
      // отблеск на асфальте: размытое пятно перед машиной и вертикальный столбик под фарой
      const gr = Math.max(8, Math.round(3.2 * s)), rg = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
      rg.addColorStop(0, `rgba(255,240,190,${0.42 * nightF})`); rg.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.save(); ctx.translate(lx + lw / 2, base + 2); ctx.scale(1, 0.18); ctx.fillStyle = rg; ctx.fillRect(-gr, -gr, gr * 2, gr * 2); ctx.restore();
      const sg = ctx.createLinearGradient(0, base, 0, base + Math.min(40, Math.round(1.2 * s) + 6));
      sg.addColorStop(0, `rgba(255,240,190,${0.28 * nightF})`); sg.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = sg; ctx.fillRect(lx + (lw >> 2), base, Math.max(1, lw >> 1), Math.min(40, Math.round(1.2 * s) + 6));
    }
  }
  if (nightF > 0.15 && v.type === 'truck') { ctx.fillStyle = '#ffb030'; for (let i = 0; i < 5; i++) ctx.fillRect(x + Math.round((w - 1) * i / 4), base - h - u(0.4), Math.max(1, u(0.2)), Math.max(1, u(0.1))); }
}

export { drawVehicle as _drawVehicle }; // для ручной проверки в консоли

// ---------- ниже горизонта: земля, дорога, лес, столбики, встречные ----------
const SX = 150, SIGHT_BASE = HORIZON + 6; // достопримечательность — впереди-слева у горизонта

export function drawGround(ctx, env, dayF, t) {
  const car = env.car, V = { ...lview(env), C: colors(env, dayF), rail: env.train.km, winter: env.winter, dayF, nightF: 1 - dayF };
  const { C, cam, rail, parked } = V, nightF = V.nightF;
  const scene = stopScene(car); // на стоянке — достопримечательность или стела региона
  drawRows(ctx, V, t);
  if (scene?.id) drawSight(ctx, scene, dayF);

  // всё, что стоит у дороги, — по расстоянию от дальнего к ближнему
  const items = [];
  const add = (z, f) => items.push({ z, f });
  // поляна под достопримечательностью: слева убираем любое дерево, крона которого (≈3 м в стороны) заходит на неё — и ближние тоже
  const clearing = (x, side, z) => scene?.id && side < 0 && Math.abs(x - SX) < scene.half + 8 + 3 * F / z;
  // лес: три слоя по обе стороны
  for (const side of [-1, 1]) for (let layer = 0; layer < 3; layer++) {
    const step = 7 + layer * 2, sd = side > 0 ? 50 : 0;
    const zMin = [36, 28, 14][layer];
    cellsFor(cam, step, zMin - 4, Z_MAX, (i, z0) => {
      const z = z0 + (hash(i, 14 + layer + sd) - 0.5) * step * 0.8;
      if (z < zMin) return;
      const k = rail - z / 1000, [type, dens] = zoneTree(k, hash(i, 17 + layer + sd));
      if (hash(i, 11 + layer * 3 + sd) > dens * (layer === 0 ? 0.8 : 1)) return;
      const wt = waterZ(V, z);
      if (wt && (wt.kind === 'river' || side < 0)) return;
      const X = side * (layer === 0 ? 9.5 + hash(i, 19 + sd) * 6 : layer === 1 ? 15 + hash(i, 20 + sd) * 14 : 26 + hash(i, 21 + sd) * 30);
      if (parked && side > 0 && X < 10 && z < 130) return; // площадка у обочины свободна
      if (clearing(pxAt(V, X, z), side, z)) return;
      add(z, () => drawTree(ctx, V, type, X, z, hash(i, 12 + sd), k >= 7500));
    });
  }
  // редкие одиночные деревья у кювета: ближе леса, но невысокие, чтобы не закрывать дорогу и небо
  for (const side of [-1, 1]) {
    const sd = side > 0 ? 50 : 0;
    cellsFor(cam, 41, 12, 140, (i, z0) => {
      const z = z0 + (hash(i, 61 + sd) - 0.5) * 20, k = rail - z / 1000, [type, dens] = zoneTree(k, hash(i, 62 + sd));
      if (hash(i, 63 + sd) > dens * 0.38 || waterZ(V, z)) return;
      const X = side * (7.2 + hash(i, 64 + sd) * 3.5);
      if (parked && side > 0 && z < 130) return;
      if (clearing(pxAt(V, X, z), side, z)) return;
      add(z, () => drawTree(ctx, V, type, X, z, hash(i, 65 + sd), k >= 7500, 58));
    });
  }
  // сигнальные столбики по обе стороны, раз в 50 м: ночью отражатели вспыхивают в свете фар
  cellsFor(cam, 50, 6, Z_MAX, (i, z) => {
    if (waterZ(V, z)?.kind === 'river') return;
    for (const side of [-1, 1]) add(z, () => {
      const s = F / z, x = Math.round(pxAt(V, side * 4.6, z)), base = Math.round(pyAt(z)), h = Math.max(2, Math.round(1.0 * s)), w = Math.max(1, Math.round(0.14 * s));
      rc(ctx, C.postWhite, x, base - h, w, h);
      rc(ctx, C.postBlack, x, base - h, w, Math.max(1, h >> 2));
      const lit = nightF > 0.2 ? Math.max(0, 1 - z / 90) * nightF : 0;
      if (lit > 0.05 || z > 30) rc(ctx, side > 0 ? `rgba(255,70,50,${0.4 + 0.6 * lit})` : `rgba(255,250,230,${0.4 + 0.6 * lit})`, x, base - h + (h >> 2), w, Math.max(1, h >> 3));
    });
  });
  // километровые столбики: белые с чёрной полосой на правой обочине
  cellsFor(cam, 1000, 6, Z_MAX, (i, z) => add(z, () => {
    const s = F / z, x = Math.round(pxAt(V, 4.8, z)), base = Math.round(pyAt(z)), h = Math.max(3, Math.round(1.5 * s)), w = Math.max(2, Math.round(0.35 * s));
    rc(ctx, C.postWhite, x, base - h, w, h); rc(ctx, C.postBlack, x, base - h + (h >> 2), w, Math.max(1, h >> 3));
    rc(ctx, mixHex(C.postWhite, '#000000', 0.2), x + w - 1, base - h, 1, h);
  }));
  // ЛЭП вдоль дороги местами: деревянные опоры с траверсой и три провода
  cellsFor(cam, 60, 8, Z_MAX + 60, (i, z) => {
    const k = rail - z / 1000;
    if (noise(k * 0.12, 7) < 0.5 || waterZ(V, z)) return;
    add(z, () => drawPole(ctx, V, z, 9.5, 60));
  });
  // перила моста: стойки через 2,5 м по обе стороны
  cellsFor(cam, 2.5, 6, 160, (i, z) => {
    if (waterZ(V, z)?.kind !== 'river') return;
    for (const side of [-1, 1]) add(z, () => {
      const s = F / z, x = Math.round(pxAt(V, side * 4.2, z)), base = Math.round(pyAt(z)), h = Math.max(2, Math.round(1.0 * s));
      rc(ctx, C.mast, x, base - h, Math.max(1, Math.round(0.1 * s)), h);
    });
  });
  // встречные
  for (const v of vehicles(env)) add(v.z, () => drawVehicle(ctx, V, v, dayF));
  // стоянка: стела у правой обочины, фонарь и фура на площадке
  if (scene) {
    if (scene.region) add(14, () => drawStela(ctx, Math.round(pxAt(V, 7.4, 14)), Math.round(pyAt(14)) + 1, dayF, scene.region));
    add(26, () => drawParkedTruck(ctx, V, 6.6, 26, dayF));
    add(21, () => drawLampPost(ctx, V, 5.6, 21, dayF));
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.f();
}

// Столб ЛЭП: ствол, траверса, три провода к следующему столбу на step метров дальше
function drawPole(ctx, V, z, X, step) {
  const C = V.C, s = F / z, x = Math.round(pxAt(V, X, z)), base = Math.round(pyAt(z)), h = Math.round(8 * s);
  if (x < -40 || x > W + 40) return;
  const hz = smooth(12, 260, z) * 0.7, col = mixHex(C.wood, C.far, hz);
  const topY = base - h, bar = Math.max(1, Math.round(1.6 * s)), th = Math.max(1, Math.round(0.28 * s));
  rc(ctx, col, x, Math.max(topY, base - ROW_END), th, h);
  rc(ctx, col, x - (bar >> 1), topY + Math.round(0.5 * s), bar, Math.max(1, th >> 1));
  const z2 = z + step, s2 = F / z2, base2 = pyAt(z2), top2 = base2 - 8 * s2;
  for (const dx of [-0.7, 0, 0.7]) {
    const x0 = pxAt(V, X + dx, z), x1 = pxAt(V, X + dx, z2), y0 = topY + Math.round(0.5 * s), y1 = top2 + 0.5 * s2;
    const n = Math.min(60, Math.ceil(Math.abs(x1 - x0) + Math.abs(y1 - y0)) + 1), sag = 1.0 * s;
    ctx.fillStyle = col;
    for (let q = 0; q <= n; q++) {
      const u = q / n, px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u + sag * 4 * u * (1 - u);
      if (px >= 0 && px < W) ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
}

// Фонарь на обочине площадки
function drawLampPost(ctx, V, X, z, dayF) {
  const nightF = 1 - dayF, s = F / z, x = Math.round(pxAt(V, X, z)), base = Math.round(pyAt(z)), h = Math.round(7.5 * s);
  const d = (a, b) => mixHex(b, a, dayF), lit = nightF > 0.15;
  rc(ctx, d('#5a5e66', '#1c1e24'), x, base - h, Math.max(1, Math.round(0.2 * s)), h);
  const ax = x - Math.round(1.6 * s);
  rc(ctx, d('#5a5e66', '#1c1e24'), ax, base - h, x - ax + 1, Math.max(1, Math.round(0.14 * s)));
  rc(ctx, lit ? '#fff0c0' : d('#c8c8c0', '#3a3a3a'), ax - Math.round(0.4 * s), base - h + 1, Math.max(2, Math.round(0.9 * s)), Math.max(1, Math.round(0.2 * s)));
  if (lit) {
    const R = Math.round(7 * s * 0.55), cx = ax + Math.round(0.4 * s), cy = base - h + 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, `rgba(255,222,150,${0.55 * nightF})`); g.addColorStop(1, 'rgba(255,222,150,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2 + 30);
  }
}

// Фура на площадке стоит к нам кормой: задние двери, габариты горят
function drawParkedTruck(ctx, V, X, z, dayF) {
  const s = F / z, x = Math.round(pxAt(V, X, z)), base = Math.round(pyAt(z)), w = Math.round(2.5 * s), h = Math.round(3.9 * s);
  const dk = (c) => dim(c, dayF), nightF = 1 - dayF, x0 = x - (w >> 1);
  rc(ctx, dk('#d8d6cc'), x0, base - h, w, h - Math.round(0.6 * s));
  rc(ctx, dk('#a8a6a0'), x0 + (w >> 1), base - h, 1, h - Math.round(0.6 * s));                // стык дверей
  rc(ctx, dk('#2a2c32'), x0, base - Math.round(0.9 * s), w, Math.round(0.4 * s));              // бампер
  rc(ctx, '#121418', x0 + Math.round(0.2 * s), base - Math.round(0.5 * s), Math.round(0.5 * s), Math.round(0.5 * s));
  rc(ctx, '#121418', x0 + w - Math.round(0.7 * s), base - Math.round(0.5 * s), Math.round(0.5 * s), Math.round(0.5 * s));
  for (const lx of [x0 + Math.round(0.15 * s), x0 + w - Math.round(0.45 * s)]) {
    rc(ctx, nightF > 0.15 ? '#ff4a30' : '#b8281e', lx, base - Math.round(1.3 * s), Math.max(1, Math.round(0.3 * s)), Math.max(1, Math.round(0.3 * s)));
    if (nightF > 0.15) {
      const R = Math.max(4, Math.round(1.3 * s)), g = ctx.createRadialGradient(lx, base - Math.round(1.2 * s), 0, lx, base - Math.round(1.2 * s), R);
      g.addColorStop(0, `rgba(255,70,40,${0.5 * nightF})`); g.addColorStop(1, 'rgba(255,70,40,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - R, base - Math.round(1.2 * s) - R, R * 2, R * 2);
    }
  }
}

// Строки земли: от горизонта вниз. Каждая строка — свой участок пути, значит, там своя вода, разметка, колея
function drawRows(ctx, V, t) {
  const { C, B, camX, cam, rail, dayF, nightF, winter, parked } = V;
  let prev = null; // линии прошлой строки: чтобы наклонные линии не рассыпались на точки
  for (let y = HORIZON; y < ROW_END; y++) {
    const d = y - HORIZON + 0.5, z = Math.min(400, CF / d), pxm = d / CAMH, ds = z * z / CF; // ds — метров пути на строку
    const aa = smooth(3, 10, ds), hz = smooth(15, 260, z) * 0.72;
    const lit = nightF > 0.12 ? nightF * (1 - smooth(5, 70, z)) : 0;
    const sh = (c, amt = 1) => { if (lit > 0.03) c = mixHex(c, '#8a7f5c', lit * 0.55 * amt); return hz > 0.02 ? mixHex(c, C.far, hz) : c; };
    const k = rail - z / 1000, wt = waterZ(V, z), river = wt?.kind === 'river', lake = wt && !river;
    const o = B * z * z, xe = (X) => Math.round(VX + (X - camX + o) * pxm), s = cam + z;
    const bandG = Math.floor(s / 20) & 1, bandA = Math.floor(s / 9) & 1;
    const cur = {};
    // земля или вода
    ctx.fillStyle = sh(mixHex(C.ground, C.groundDark, bandG * (1 - aa) * 0.5)); ctx.fillRect(0, y, W, 1);
    const wcol = wt ? sh(wt.sea ? C.sea : C.lake) : null;
    if (river) { ctx.fillStyle = wcol; ctx.fillRect(0, y, W, 1); }
    else if (lake) { ctx.fillStyle = wcol; ctx.fillRect(0, y, xe(-7.5), 1); ctx.fillStyle = sh(C.shoulder); ctx.fillRect(xe(-7.5), y, xe(-4.5) - xe(-7.5), 1); }
    // обочины; на площадке справа — широкая, сужается вдаль
    const shL = river ? -4.2 : -4.5, shR = river ? 4.2 : (parked ? 4.5 + 5 * (1 - smooth(60, 130, z)) : 4.5);
    ctx.fillStyle = sh(C.shoulder); ctx.fillRect(xe(shL), y, xe(-3.5) - xe(shL), 1); ctx.fillRect(xe(3.5), y, xe(shR) - xe(3.5), 1);
    // кювет: откос, дно (зимой в снегу с тенью) и дальний откос; на мосту и площадке нет
    if (!river) {
      const dB = sh(mixHex(C.groundDark, winter ? '#9aa8bc' : '#000000', winter ? 0.5 : 0.18)), slope = sh(winter ? C.bank : mixHex(C.ground, C.groundDark, 0.45));
      if (!lake) { ctx.fillStyle = slope; ctx.fillRect(xe(-5.6), y, xe(shL) - xe(-5.6), 1); ctx.fillStyle = dB; ctx.fillRect(xe(-7.2), y, xe(-5.6) - xe(-7.2), 1); }
      if (!parked) { ctx.fillStyle = slope; ctx.fillRect(xe(shR), y, xe(5.6) - xe(shR), 1); ctx.fillStyle = dB; ctx.fillRect(xe(5.6), y, xe(7.2) - xe(5.6), 1); }
    }
    // асфальт
    ctx.fillStyle = sh(mixHex(C.asphalt, C.asphaltHi, bandA * (1 - aa) * 0.35)); ctx.fillRect(xe(-3.5), y, xe(3.5) - xe(-3.5), 1);
    const asph = sh(C.asphalt);
    // линия шириной w метров: растягиваем до прошлой строки, если сдвинулась дальше своей ширины
    const line = (key, X, w, col) => {
      let a = xe(X - w / 2), b = Math.max(a + 1, xe(X + w / 2));
      const p = prev?.[key];
      if (p) { if (a > p.b) a = p.b; else if (b < p.a) b = p.a; }
      cur[key] = { a: xe(X - w / 2), b: Math.max(xe(X - w / 2) + 1, xe(X + w / 2)) };
      ctx.fillStyle = col; ctx.fillRect(a, y, Math.max(1, b - a), 1);
    };
    if (winter) { // снежная колея: тёмные полосы колёс
      const rut = sh(mixHex(C.asphalt, C.rut, 0.75));
      for (const X of [0.85, 2.65, -0.85, -2.65]) { const a = xe(X - 0.28), b = Math.max(a + 1, xe(X + 0.28)); ctx.fillStyle = rut; ctx.fillRect(a, y, b - a, 1); }
    }
    line('eL', -3.35, 0.16, sh(C.edge)); line('eR', 3.35, 0.16, sh(C.edge));
    // прерывистая осевая: вдали не мерцает, а сливается в бледную полосу
    const dashOn = ((s % 12) + 12) % 12 < 4;
    if (dashOn || aa > 0) line('c', 0, 0.16, mixHex(asph, sh(C.dash), (dashOn ? 1 : 0) * (1 - aa) + 0.33 * aa));
    // мост: бордюр и два прута перил по обе стороны
    if (river) {
      for (const sd of [-1, 1]) {
        const xa = xe(sd * 4.2 - 0.12), xb = Math.max(xa + 1, xe(sd * 4.2 + 0.12)), ytop = Math.round(HORIZON + d * (1 - 0.45 / CAMH));
        ctx.fillStyle = sh(C.edge); ctx.fillRect(xa, ytop, xb - xa, y - ytop + 1);
        for (const hh of [0.95, 0.62]) {
          const yb = Math.round(HORIZON + d * (1 - hh / CAMH)), key = 'b' + sd + hh, x0 = xe(sd * 4.2);
          const p = prev?.[key], xa2 = p ? Math.min(x0, p.x) : x0, xb2 = p ? Math.max(x0, p.x) : x0;
          ctx.fillStyle = sh(C.mast); ctx.fillRect(xa2, yb, Math.max(1, xb2 - xa2 + 1), 1);
          cur[key] = { x: x0 };
        }
      }
    }
    // блики на воде (зимой — лёд, без бликов)
    if (wt && !winter) {
      ctx.fillStyle = C.lakeHi;
      for (let j = 0; j < 3; j++) {
        const gx = Math.floor(hash(y * 13 + j, Math.floor(t * 1.2 + j * 3)) * (W + 40)) - 20, ok = river ? (gx < xe(-4.4) || gx > xe(4.4)) : gx < xe(-7.8);
        if (ok && hash(y, j + 5) < 0.5) { ctx.globalAlpha = 0.5; ctx.fillRect(gx, y, 1 + (hash(gx, y) * 3 | 0), 1); ctx.globalAlpha = 1; }
      }
    }
    prev = cur;
  }
}

// ---------- стоянка: что рядом интересного ----------
// Когда машина стоит (ночёвка, пауза, до старта, финиш), за дорогой виден силуэт ближайшей достопримечательности
// (до 120 км от машины, см. sightNear), а если её нет — у обочины стоит стела региона. Достопримечательности
// рисуются на дальнем плане: днём цветные, ночью тёмные, с тёплыми огоньками окон и мягкой подсветкой.

// Пиксельные заготовки: u — прямоугольник в координатах «от центра x и от земли вверх», lit — тёплое окошко
function kit(ctx, x, base, dayF) {
  const on = 1 - dayF > 0.15, d = (a, b) => mixHex(b, a, dayF);
  const u = (c, dx, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + dx, base - y - h, w, h); };
  const lit = (dx, y, w = 1, h = 2) => u(on ? '#ffd27a' : d('#46566e', '#1a1a24'), dx, y, w, h);
  const gold = d('#e8b83a', '#8a6a28'), goldHi = d('#fbe27a', '#b8943c');
  // стена с тенью справа
  const blk = (dx, y, w, h, c, sh) => { u(c, dx, y, w, h); u(sh, dx + w - 2, y, 2, h); };
  // луковка: колба расширяется, потом сходится к острию; r — наибольшая полуширина
  const onion = (c, hi, cx, y, r) => {
    const h = Math.round(r * 2.2) + 2;
    for (let i = 0; i < h; i++) {
      const t = i / (h - 1), w = t < 0.4 ? r * (0.6 + 0.4 * (t / 0.4)) : r * (1 - ((t - 0.4) / 0.6) ** 1.4);
      const hw = Math.max(0, Math.round(w));
      u(c, cx - hw, y + i, hw * 2 + 1, 1);
      if (hi && hw >= 2) u(hi, cx - hw, y + i, 1, 1);
    }
    return y + h;
  };
  const cross = (cx, y) => { u(gold, cx, y, 1, 5); u(gold, cx - 1, y + 3, 3, 1); };
  // полусфера: r — полуширина, h — высота
  const dome = (c, hi, cx, y, r, h) => {
    for (let i = 0; i < h; i++) {
      const hw = Math.round(r * Math.sqrt(1 - ((i + 0.5) / h) ** 2));
      u(c, cx - hw, y + i, hw * 2 + 1, 1);
      if (hi && hw >= 2) u(hi, cx - hw, y + i, 1, 1);
    }
  };
  // отрезок в тех же координатах
  const line = (c, x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) u(c, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
  };
  // зубцы стены
  const merlons = (c, dx, y, w, step = 4) => { for (let m = 0; m < w; m += step) u(c, dx + m, y, 2, 2); };
  return { on, d, u, lit, gold, goldHi, blk, onion, cross, dome, line, merlons };
}

// Золотой мост во Владивостоке: два А-образных пилона и веер вантов
function drawSight_goldbridge(ctx, x, base, dayF) {
  const { on, d, u, line } = kit(ctx, x, base, dayF);
  const pyl = d('#e6eaf2', '#2c3450'), cab = d('#c4ccdc', '#3c4668'), deck = d('#a2acbc', '#242c44');
  u(deck, -46, 12, 92, 2);                                   // полотно
  u(d('#8a94a6', '#1c2236'), -46, 14, 92, 1);               // перила
  for (const px of [-24, 24]) {
    u(deck, px - 4, 0, 8, 12);                              // опора
    for (let i = 0; i < 44; i++) {                          // ноги пилона сходятся наверху
      const o = Math.round(5 * (1 - i / 44));
      u(pyl, px - 1 - o, 12 + i, 2, 1); u(pyl, px + o, 12 + i, 2, 1);
    }
    u(pyl, px - 4, 28, 8, 1);                               // перемычка
    for (const k of [-24, -18, -12, -6, 6, 12, 18, 24]) { const tx = px + k; if (tx > -46 && tx < 46) line(cab, px, 52, tx, 14); }
    if (on) u('#ff5a4a', px, 56, 1, 1);                     // огонь на вершине
  }
  if (on) for (let i = -44; i <= 44; i += 5) u('#ffd27a', i, 15, 1, 1); // фонари вдоль полотна
}

// Спасо-Преображенский собор в Хабаровске: высокий, на утёсе, золотые главы
function drawSight_spaso(ctx, x, base, dayF) {
  const { d, u, lit, blk, onion, cross, gold, goldHi } = kit(ctx, x, base, dayF);
  const wall = d('#efe6cf', '#363a4c'), sh = d('#cdc2a0', '#272a3a'), hill = d('#8a7a5a', '#1a1c22');
  for (let i = 0; i < 6; i++) u(hill, -35 + i * 2, i, 70 - i * 4, 1);       // утёс
  blk(-17, 6, 34, 16, wall, sh); blk(-11, 22, 22, 11, wall, sh); blk(-4, 33, 8, 8, wall, sh);
  for (const wx of [-13, -7, -1, 5, 11]) lit(wx, 11, 2, 5);
  lit(-1, 35, 2, 4);
  onion(gold, goldHi, 0, 41, 5); cross(0, 54);
  for (const cx of [-14, 12]) { blk(cx - 2, 22, 5, 5, wall, sh); onion(gold, goldHi, cx, 27, 3); cross(cx, 36); }
  for (const cx of [-8, 8]) { blk(cx - 1, 33, 3, 4, wall, sh); onion(gold, goldHi, cx, 37, 2); cross(cx, 44); }
}

// Казанский собор в Чите: белый, с бирюзово-синими куполами — одна крупная глава и четыре малые, рядом высокая колокольня с синим шпилем
function drawSight_kazansky(ctx, x, base, dayF) {
  const { on, d, u, lit, blk, onion, cross, gold } = kit(ctx, x, base, dayF);
  const wall = d('#f4f8fc', '#3a4058'), sh = d('#c8d6e6', '#292e44'), blue = d('#1f78c4', '#14305e'), blueHi = d('#7cc8f2', '#2c5a96');
  const teal = d('#2fb0c0', '#16424e'), band = d('#2f90c8', '#1c3a64');
  const spire = (cx, y, hw, h) => { for (let i = 0; i < h; i++) u(blue, cx - Math.max(0, Math.round(hw * (1 - i / h))), y + i, Math.max(0, Math.round(hw * (1 - i / h))) * 2 + 1, 1); u(blueHi, cx - hw + 1, y, 1, Math.round(h * 0.4)); };
  blk(-22, 0, 44, 15, wall, sh); u(band, -22, 11, 44, 2); u(teal, -22, 0, 44, 1);       // основной объём с бирюзовым поясом
  for (let px = -19; px < 19; px += 6) u(sh, px, 1, 1, 10);                              // пилястры
  for (const wx of [-17, -9, -1, 7, 15]) lit(wx, 3, 2, 6);
  blk(-9, 15, 18, 7, wall, sh); for (const wx of [-5, 3]) lit(wx, 17, 2, 4);              // барабан под главой
  onion(blue, blueHi, 0, 22, 7); cross(0, 39);                                           // крупная синяя глава
  for (const cx of [-18, -12, 12, 18]) { blk(cx - 1, 15, 3, 3, wall, sh); onion(blue, blueHi, cx, 18, 2); cross(cx, 24); } // четыре малые
  // колокольня справа: ярусами, высокая, с синим шпилем
  blk(25, 0, 9, 24, wall, sh); u(band, 25, 20, 9, 2); lit(28, 8, 2, 5);
  blk(26, 24, 7, 13, wall, sh); u(teal, 26, 24, 7, 1); lit(28, 28, 2, 6);               // звонница
  blk(27, 37, 5, 5, wall, sh);
  spire(29, 42, 3, 12); cross(29, 54); u(gold, 28, 52, 3, 1);
  if (on) u('#9fe8ff', 29, 58, 1, 1);
}

// Голова Ленина в Улан-Удэ: самая большая в мире — огромная бронзовая голова без шеи прямо на кубе-постаменте
function drawSight_lenin(ctx, x, base, dayF) {
  const { on, d, u } = kit(ctx, x, base, dayF);
  const ped = d('#9a9890', '#2c2e38'), pedSh = d('#6c6a64', '#1e2028'), pedHi = d('#b8b6ae', '#3c3e4a');
  const body = d('#6a5842', '#1a1d26'), lite = d('#8a7456', '#262a38'), hi = d('#e0c898', '#5a5e74'), shade = d('#3c3024', '#0e1016'), dark = d('#2a2018', '#080a10');
  // куб-постамент
  u(ped, -17, 0, 34, 14); u(pedSh, 10, 0, 7, 14); u(pedHi, -17, 13, 34, 1); u(pedSh, -17, 0, 34, 1);
  u(pedSh, -17, 6, 27, 1);                                                                    // шов плит
  const H = 40, Y0 = 14;                                                                      // голова: 40 строк снизу вверх
  const hw = (t) => t < 0.3 ? 1 + 10 * (t / 0.3) ** 0.9 : t < 0.58 ? 11 + 3 * ((t - 0.3) / 0.28) : t < 0.82 ? 14 : 14 * Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.18) ** 2));
  for (let r = 0; r < H; r++) {
    const w = Math.max(1, Math.round(hw(r / (H - 1))));
    u(body, -w, Y0 + r, w * 2 + 1, 1);
    u(lite, -w, Y0 + r, Math.max(1, Math.ceil(w * 0.45)), 1);                                // освещённая левая сторона
    u(shade, w - Math.max(2, Math.round(w * 0.4)), Y0 + r, Math.max(2, Math.round(w * 0.4)) + 1, 1); // тень справа
  }
  // блик на лысине и выступающем лбу
  u(hi, -9, Y0 + 33, 4, 2); u(hi, -11, Y0 + 31, 3, 2); u(hi, -6, Y0 + 35, 3, 1); u(lite, -12, Y0 + 29, 6, 2);
  u(dark, -12, Y0 + 27, 24, 2);                                                               // тяжёлая надбровная дуга
  u(dark, -9, Y0 + 24, 6, 2); u(dark, 3, Y0 + 24, 6, 2);                                      // прищуренные глаза
  u(lite, -1, Y0 + 15, 2, 9); u(shade, 1, Y0 + 15, 2, 9); u(dark, -3, Y0 + 14, 7, 1);         // нос с тенью
  u(shade, -14, Y0 + 20, 2, 5); u(shade, 13, Y0 + 20, 2, 5);                                  // уши/виски
  u(dark, -8, Y0 + 11, 17, 3); u(shade, -10, Y0 + 12, 2, 2); u(shade, 9, Y0 + 12, 2, 2);      // усы
  u(dark, -2, Y0 + 9, 5, 1);                                                                   // рот
  for (let r = 0; r < 9; r++) { const w = Math.max(0, 4 - (r >> 1)); u(dark, -w, Y0 + r, w * 2 + 1, 1); } // бородка-клинышек
  // для масштаба: человек у подножия и ёлки
  const man = d('#3a3a46', '#0c0e14'), coat = d('#c04838', '#2a1618');
  u(man, 21, 0, 2, 3); u(coat, 21, 3, 2, 3); u(d('#e8c8a0', '#2c2a2e'), 21, 6, 2, 1);
  const fir = d('#2c5a3a', '#0c1c14');
  for (const [fx, fh] of [[-25, 14], [-29, 10], [27, 12], [31, 8], [34, 11]]) { for (let i = 0; i < fh; i++) u(fir, fx - Math.round((fh - i) * 0.3), i, Math.round((fh - i) * 0.6) + 1, 1); }
  if (on) { u('#ffd27a', -15, 0, 3, 1); u('#ffd27a', 12, 0, 3, 1); u('#ffd27a', -12, 14, 2, 1); u('#ffd27a', 11, 14, 2, 1); } // прожекторы
}

// Байкал: бирюзовая вода до горизонта и хребет Хамар-Дабан со снежными вершинами; ночью — лунная дорожка и огни посёлка
function drawSight_baikal(ctx, x, base, dayF) {
  const { on, d, u } = kit(ctx, x, base - 6, dayF);                            // линия земли здесь — сам горизонт
  const night = 1 - dayF;
  // озёрная вода слева и под хребтом (общий слой воды может её не показать на стоянке)
  ctx.fillStyle = d('#3fa8c4', '#142a48'); ctx.fillRect(0, base - 6, x + 64, 4);
  ctx.fillStyle = d('#7fd0e0', '#24406a'); for (let i = 0; i < x + 64; i += 7) ctx.fillRect(i + ((i * 7) % 3), base - 4 + (i % 2), 3, 1);
  const rock = d('#5a7aa0', '#243256'), rockSh = d('#44648c', '#18223e'), snow = d('#f4f8ff', '#9fb2d6'), snowSh = d('#c4d4ec', '#6c80aa');
  for (let dx = -52; dx <= 52; dx++) {
    const env = Math.max(0.2, 1 - (dx / 58) ** 2);
    const h = Math.max(4, Math.round((20 + 11 * Math.sin(dx * 0.09 + 1) + 6 * Math.sin(dx * 0.23 + 2)) * env));
    u(rock, dx, 0, 1, h); u(rockSh, dx, 0, 1, Math.round(h * 0.45)); if (dx % 7 === 0) u(rockSh, dx, 0, 1, Math.round(h * 0.8));
    const sl = Math.round(h * 0.55); if (h > 17) { u(snow, dx, sl, 1, h - sl); if (dx % 5 === 0) u(snowSh, dx, sl, 1, 2); }
  }
  if (on) {
    // огоньки посёлка у подножия, жёлтые и редкие белые
    for (const [dx, y] of [[-34, 1], [-31, 2], [-28, 1], [-25, 1], [-22, 2], [-19, 1], [-15, 1], [-12, 2], [-8, 1], [-4, 1], [3, 2], [9, 1], [15, 1], [21, 2], [28, 1]]) u(Math.abs(dx) % 3 ? '#ffd27a' : '#fff0c0', dx, y, 1, 1);
    // лунная дорожка: мерцающие штрихи, расширяющиеся к зрителю
    ctx.globalAlpha = Math.min(1, night * 1.3);
    for (let r = 1; r <= 7; r++) for (let j = -Math.ceil(r / 1.5); j <= Math.ceil(r / 1.5); j++) {
      if (((r * 5 + j * 3) & 3) === 0) continue;
      u(r % 2 ? '#e8f2ff' : '#9cb8e0', -8 + j * 3, -r, 2 + (r >> 2), 1);
    }
    ctx.globalAlpha = 1;
  }
}

// Знаменский монастырь в Иркутске: белые стены, зелёные крыши, колокольня
function drawSight_znamensky(ctx, x, base, dayF) {
  const { d, u, lit, blk, onion, cross } = kit(ctx, x, base, dayF);
  const wall = d('#f4f0e6', '#3a3e50'), sh = d('#d2ccbc', '#2a2e3e'), grn = d('#3a8a5a', '#1a3a2a'), grnHi = d('#6ac08a', '#2a5a40');
  blk(-38, 0, 74, 7, wall, sh); for (let m = -36; m < 34; m += 6) lit(m, 2, 1, 3);      // монастырская стена
  blk(-40, 0, 7, 14, wall, sh); for (let i = 0; i < 4; i++) u(grn, -41 + i, 14 + i, 9 - i * 2, 1); // угловая башенка
  blk(-24, 7, 30, 12, wall, sh); for (const wx of [-20, -13, -6, 1]) lit(wx, 10, 2, 5);
  for (let i = 0; i < 4; i++) u(grn, -25 + i * 2, 19 + i, 32 - i * 4, 1);                  // кровля
  blk(-6, 19, 6, 5, wall, sh); onion(grn, grnHi, -3, 24, 3); cross(-3, 33);
  blk(17, 7, 10, 26, wall, sh); u(sh, 17, 20, 10, 1); lit(20, 24, 2, 5); lit(20, 12, 2, 5);  // колокольня
  for (let i = 0; i < 14; i++) { const hw = Math.round(5 * (1 - i / 14)); u(grn, 22 - hw, 33 + i, hw * 2, 1); }
  cross(22, 47);
}

// Часовня Параскевы Пятницы на Караульной горе в Красноярске: маленькая шатровая часовня на холме
function drawSight_paraskeva(ctx, x, base, dayF) {
  const { on, d, u, lit, blk, cross } = kit(ctx, x, base, dayF);
  const hill = d('#5a7a48', '#10180f'), rock = d('#8a8478', '#262830'), wall = d('#f0ece0', '#3a3e50'), sh = d('#d2ccb8', '#2a2e3e'), roof = d('#4a8a78', '#1a3a38'), roofHi = d('#7ac0a8', '#2a5a52');
  for (let i = 0; i < 20; i++) { const hw = Math.round(28 * Math.sqrt(1 - (i / 20) ** 2)); u(hill, -hw, i, hw * 2, 1); if (i < 14) u(rock, -hw + 4 + (i % 3), i, 2, 1); }
  for (const [tx, th] of [[-20, 12], [-14, 15], [17, 11], [23, 8]]) for (let j = 0; j < th; j++) u(d('#2c4a34', '#0c1412'), tx - Math.round((th - j) * 0.25), 4 + j, Math.round((th - j) * 0.5) + 1, 1);
  blk(-5, 20, 10, 9, wall, sh); u(d('#3a3028', '#101018'), -1, 20, 3, 5); lit(-4, 24, 2, 3);
  for (let i = 0; i < 11; i++) { const hw = Math.round(7 * (1 - i / 11)); u(i % 4 === 3 ? roofHi : roof, -hw, 29 + i, hw * 2 + 1, 1); }
  cross(0, 40);
  if (on) u('#ffd27a', 4, 22, 1, 1);
}

// Оперный театр в Новосибирске: широкое здание, колоннада и огромный серебристый купол
function drawSight_opera(ctx, x, base, dayF) {
  const { d, u, lit, blk, dome } = kit(ctx, x, base, dayF);
  const wall = d('#e8dcc0', '#383a4a'), sh = d('#c8b898', '#282a38'), col = d('#faf4e4', '#4a4e62'), silver = d('#cfd7e0', '#2a3044'), silverHi = d('#f2f6fa', '#4c5c7c'), rib = d('#a8b4c4', '#1e2438');
  blk(-44, 0, 88, 14, wall, sh);
  for (let wx = -40; wx < 38; wx += 7) if (wx < -20 || wx > 16) lit(wx, 5, 2, 5);
  u(col, -19, 0, 38, 14); for (let px = -18; px < 18; px += 4) u(sh, px, 0, 1, 12); u(d('#ffffff', '#5a5e72'), -20, 14, 40, 1);
  for (let px = -16; px < 16; px += 8) lit(px, 3, 2, 7);
  blk(-23, 15, 46, 5, wall, sh);
  dome(silver, silverHi, 0, 20, 22, 21);
  for (let rx = -18; rx <= 18; rx += 6) for (let yy = 0; yy < 18; yy++) if (Math.abs(rx) < 22 * Math.sqrt(1 - ((yy + 0.5) / 21) ** 2)) u(rib, rx, 20 + yy, 1, 1);
  u(wall, -2, 41, 4, 4); u(d('#d8b84a', '#8a6a28'), 0, 45, 1, 5);
}

// Успенский собор в Омске: пять бирюзовых куполов со звёздами и колокольня
function drawSight_uspensky(ctx, x, base, dayF) {
  const { d, u, lit, blk, onion, cross, goldHi } = kit(ctx, x, base, dayF);
  const wall = d('#f4f2ea', '#383c4e'), sh = d('#d2cec0', '#282c3c'), blue = d('#3a9ac8', '#1c3c58'), blueHi = d('#8ad0f0', '#2c5a7a');
  const star = (cx, y) => { u(goldHi, cx, y, 1, 3); u(goldHi, cx - 1, y + 1, 3, 1); };
  blk(-17, 0, 34, 20, wall, sh); u(d('#c8a850', '#6a5428'), -17, 10, 34, 1);
  for (const wx of [-13, -7, -1, 5, 11]) { lit(wx, 3, 2, 6); lit(wx, 12, 2, 5); }
  blk(-5, 20, 10, 8, wall, sh); lit(-1, 22, 2, 4);
  onion(blue, blueHi, 0, 28, 6); star(0, 33); cross(0, 43);
  for (const cx of [-15, 12]) { blk(cx - 2, 20, 5, 5, wall, sh); onion(blue, blueHi, cx, 25, 3); cross(cx, 34); }
  for (const cx of [-8, 8]) { blk(cx - 1, 20, 3, 4, wall, sh); onion(blue, blueHi, cx, 24, 2); cross(cx, 31); }
  blk(21, 0, 7, 30, wall, sh); lit(23, 22, 2, 4); lit(23, 12, 2, 4);
  for (let i = 0; i < 10; i++) u(blue, 22 + (i >> 2), 30 + i, 5 - (i >> 2) * 2, 1);
  cross(24, 40);
}

// Мост влюблённых в Тюмени: лёгкий белый пешеходный мост-арка над Турой
function drawSight_lovers(ctx, x, base, dayF) {
  const { on, d, u } = kit(ctx, x, base, dayF);
  const white = d('#f6f8fc', '#6a7490'), thin = d('#cfd6e4', '#3a4260'), water = d('#7d98b8', '#141c30'), bank = d('#5a7a48', '#10180f');
  u(water, -46, 0, 92, 6);
  for (let i = 0; i < 8; i++) { const h = Math.floor(6 + i * 0.6); u(bank, -56 + i, 0, 12 - i, h); u(bank, 44 + i, 0, 12 - i, h); }
  u(white, -40, 7, 80, 2); u(thin, -40, 9, 80, 1);                       // настил и перила
  for (const px of [-30, -10, 10, 30]) u(thin, px, 0, 2, 7);              // опоры
  for (let i = -34; i <= 34; i++) {
    const y = 9 + Math.round(20 * (1 - (i / 34) ** 2));
    u(white, i, y, 1, 2);
    if (i % 4 === 0) u(thin, i, 10, 1, Math.max(0, y - 10));             // подвесы
    if (on && i % 6 === 0) u('#fff0c0', i, y + 2, 1, 1);                 // огни на арке
  }
  if (on) for (let i = -38; i <= 38; i += 6) u('#ffd27a', i, 10, 1, 1);
}

// Храм на Крови в Екатеринбурге: белый, пять золотых глав — и стеклянный небоскрёб «Высоцкий» справа
function drawSight_hram(ctx, x, base, dayF) {
  const { on, d, u, lit, blk, onion, cross, gold, goldHi } = kit(ctx, x, base, dayF);
  const wall = d('#f6f4ee', '#3c4054'), sh = d('#d6d2c4', '#2a2e40');
  blk(-20, 0, 28, 16, wall, sh); for (const wx of [-16, -10, -4, 2]) lit(wx, 5, 2, 6);
  blk(-14, 16, 16, 9, wall, sh); lit(-8, 18, 2, 5);
  blk(-9, 25, 6, 6, wall, sh);
  onion(gold, goldHi, -6, 31, 4); cross(-6, 42);
  for (const cx of [-18, 5]) { blk(cx - 1, 16, 4, 4, wall, sh); onion(gold, goldHi, cx, 20, 3); cross(cx, 29); }
  for (const cx of [-12, 0]) { blk(cx - 1, 25, 3, 4, wall, sh); onion(gold, goldHi, cx, 29, 2); cross(cx, 36); }
  // небоскрёб: тёмное стекло, светлые вертикальные импосты, ступенчатая корона и шпиль
  const glass = d('#3a5a82', '#121a30'), glassHi = d('#6a8ab4', '#1c2848');
  u(glass, 22, 0, 9, 50);
  for (let gx = 23; gx < 31; gx += 2) u(glassHi, gx, 0, 1, 50);
  u(glass, 23, 50, 7, 4); u(glass, 24, 54, 5, 3); u(glass, 26, 57, 1, 3);
  if (on) { for (let yy = 4; yy < 50; yy += 4) for (let gx = 23; gx < 31; gx += 2) if (((gx * 7 + yy * 3) % 5) < 2) u('#ffd27a', gx, yy, 1, 2); u('#ff5a4a', 26, 60, 1, 1); }
}

// Мечеть Кул-Шариф в Казанском кремле: голубой купол и четыре тонких минарета
function drawSight_kulsharif(ctx, x, base, dayF) {
  const { d, u, lit, blk, dome } = kit(ctx, x, base, dayF);
  const wall = d('#f2f2f6', '#3c4056'), sh = d('#cfd2de', '#2a2e42'), blue = d('#3a8ad0', '#1c3e68'), blueHi = d('#8ac8f0', '#2c5a88'), ring = d('#a8b0c4', '#2a3046');
  blk(-19, 0, 38, 14, wall, sh); for (const wx of [-15, -9, -3, 3, 9, 14]) lit(wx, 3, 2, 7);
  blk(-8, 14, 16, 6, wall, sh); lit(-5, 15, 2, 4); lit(3, 15, 2, 4);
  dome(blue, blueHi, 0, 20, 8, 10);
  u(d('#e8c84a', '#8a6a28'), 0, 30, 1, 6); u(d('#e8c84a', '#8a6a28'), -1, 33, 3, 1);
  for (const mx of [-26, -19, 16, 23]) {
    u(wall, mx, 0, 3, 40); u(sh, mx + 2, 0, 1, 40); u(ring, mx, 28, 3, 1); u(ring, mx, 34, 3, 1);
    u(blue, mx - 1, 40, 5, 2); u(blue, mx, 42, 3, 4); u(blueHi, mx, 42, 1, 4); u(blue, mx + 1, 46, 1, 6);
    lit(mx + 1, 12, 1, 3);
  }
}

// Нижегородский кремль: красная стена с башнями на холме над слиянием рек
function drawSight_kremlin_nn(ctx, x, base, dayF) {
  const { d, u, lit, blk, onion, cross, gold, goldHi, merlons } = kit(ctx, x, base, dayF);
  const red = d('#b04a38', '#3c2226'), sh = d('#8a3428', '#2a181c'), hill = d('#5a7a48', '#10180f'), slope = d('#8a7a5a', '#1a1c22'), roofG = d('#4a8a62', '#1a3a2a'), roofR = d('#7a3a2c', '#2a181c');
  for (let i = 0; i < 12; i++) { u(hill, -48 + i * 2, i, 96 - i * 4, 1); u(slope, -48 + i * 2, i, 2, 1); u(slope, 46 - i * 2, i, 2, 1); }
  blk(-44, 12, 88, 10, red, sh); merlons(red, -44, 22, 88);
  for (let wx = -40; wx < 40; wx += 8) lit(wx, 15, 1, 3);
  blk(-4, 22, 8, 6, d('#f2eee0', '#383c4e'), d('#d0ccc0', '#282c3c')); onion(gold, goldHi, 0, 28, 2); cross(0, 35); // собор за стеной
  for (const [tx, tw, th, rc2] of [[-46, 9, 18, roofR], [-22, 9, 22, roofR], [2, 9, 17, roofR], [30, 11, 28, roofG]]) {
    blk(tx, 12, tw, th, red, sh); lit(tx + 3, 12 + th - 7, 2, 3); merlons(red, tx - 1, 12 + th, tw + 2, 3);
    for (let i = 0; i < 9; i++) { const hw = Math.round(((tw + 2) / 2) * (1 - i / 9)); u(rc2, tx + (tw >> 1) - hw, 14 + th + i, hw * 2 + 1, 1); }
  }
}

// Золотые ворота во Владимире: белая башня-арка с золотым куполом, валы по бокам
function drawSight_goldgates(ctx, x, base, dayF) {
  const { d, u, lit, blk, onion, cross, gold, goldHi, merlons } = kit(ctx, x, base, dayF);
  const wall = d('#f2eee2', '#3a3e50'), sh = d('#d2ccba', '#2a2e3e'), earth = d('#6a8a50', '#10180f'), dark = d('#2c2824', '#08080c');
  for (let i = 0; i < 10; i++) { u(earth, -50 + Math.floor(i * 0.7), i, 15, 1); u(earth, 35 - Math.floor(i * 0.7), i, 15, 1); }
  blk(-35, 0, 24, 13, wall, sh); merlons(wall, -35, 13, 24); blk(11, 0, 24, 13, wall, sh); merlons(wall, 11, 13, 24);
  blk(-11, 0, 22, 26, wall, sh);
  u(dark, -4, 0, 8, 12); u(dark, -3, 12, 6, 1); u(dark, -2, 13, 4, 1);
  lit(-9, 17, 2, 4); lit(7, 17, 2, 4);
  blk(-8, 26, 16, 7, wall, sh); lit(-5, 28, 2, 3); lit(2, 28, 2, 3);
  onion(gold, goldHi, 0, 33, 4); cross(0, 44);
}

// Космодром «Восточный» у Циолковского: «Союз» на стартовом столе, башня обслуживания, молниеотводы; ночью — прожекторы
function drawSight_vostochny(ctx, x, base, dayF) {
  const { on, d, u } = kit(ctx, x, base, dayF);
  const steel = d('#8a909a', '#1e222c'), steelSh = d('#5a606a', '#14161e'), white = on ? '#e8ecf4' : d('#eef0f4', '#4a4e5c');
  const whiteSh = on ? '#b8bcc8' : d('#c4c8d0', '#30323e'), grey = d('#6a707a', '#22242e'), conc = d('#a8a49a', '#2a2a32');
  // бетонный стартовый стол
  u(conc, -30, 0, 60, 4); u(steelSh, -30, 0, 60, 1); u(steel, -8, 4, 16, 3);
  // молниеотводы — тонкие мачты с красными огнями
  for (const mx of [-38, 37]) { u(steel, mx, 0, 1, 58); for (let y = 4; y < 56; y += 6) u(steelSh, mx - 1, y, 3, 1); u(on ? '#ff4a3a' : '#c83a2a', mx, 58, 1, 1); }
  // башня обслуживания — решётка справа от ракеты
  u(steel, 8, 4, 10, 50); u(steelSh, 16, 4, 2, 50);
  for (let y = 8; y < 54; y += 5) { u(steelSh, 8, y, 10, 1); u(grey, 9, y + 1, 1, 3); u(grey, 14, y + 2, 1, 2); }
  for (const y of [18, 30, 42]) u(steel, 4, y, 4, 1); // фермы к ракете
  // «Союз»: центральный блок, четыре боковых «конуса», головной обтекатель
  u(white, -2, 7, 5, 40); u(whiteSh, 2, 7, 1, 40);
  for (let i = 0; i < 18; i++) { const w = Math.max(1, Math.round(4 - i * 0.2)); u(white, -2 - w, 7 + i, w, 1); u(whiteSh, 3, 7 + i, w, 1); } // боковые блоки сужаются кверху
  u(grey, -6, 7, 13, 1); u(grey, -2, 26, 5, 1); u(grey, -2, 38, 5, 1); // сопла и стыки ступеней
  u(white, -3, 47, 7, 8); u(whiteSh, 2, 47, 2, 8);                    // обтекатель
  for (let i = 0; i < 5; i++) { const hw = Math.max(0, 3 - i); u(white, -hw, 55 + i, hw * 2 + 1, 1); }
  u(d('#c8423a', '#3a1c1c'), -2, 34, 5, 1);                            // полоса
  // тайга вокруг
  const fir = d('#2c5a3a', '#0c1c14');
  for (const [fx, fh] of [[-26, 12], [-21, 9], [24, 11], [29, 8], [-33, 7], [33, 10]]) for (let i = 0; i < fh; i++) u(fir, fx - Math.round((fh - i) * 0.3), i, Math.round((fh - i) * 0.6) + 1, 1);
  if (on) { // прожекторы на ракету и огни башни
    u('#ffd27a', -20, 3, 2, 1); u('#ffd27a', 18, 3, 2, 1);
    for (let y = 10; y < 54; y += 8) u('#ffd27a', 12, y, 1, 1);
    const g = ctx.createRadialGradient(x, base - 30, 2, x, base - 30, 34);
    g.addColorStop(0, 'rgba(220,235,255,0.22)'); g.addColorStop(1, 'rgba(220,235,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 34, base - 64, 68, 66);
  }
}

// Спасская башня Кремля: красная шатровая башня с часами и рубиновой звездой
function drawSight_spasskaya(ctx, x, base, dayF) {
  const { on, d, u, lit, blk, merlons } = kit(ctx, x, base, dayF);
  const red = d('#b8382c', '#3a1c20'), sh = d('#8a2820', '#281418'), stone = d('#e8e0cc', '#4a4c5c'), green = d('#3a8a5a', '#1a3a2a'), greenHi = d('#6ac08a', '#2a5a40');
  blk(-40, 0, 32, 11, red, sh); merlons(red, -40, 11, 32); blk(8, 0, 32, 11, red, sh); merlons(red, 8, 11, 32);
  for (let wx = -36; wx < -10; wx += 7) lit(wx, 4, 1, 3);
  for (let wx = 12; wx < 38; wx += 7) lit(wx, 4, 1, 3);
  blk(-7, 0, 14, 26, red, sh); u(stone, -7, 24, 14, 2); lit(-4, 8, 2, 5); lit(2, 8, 2, 5); lit(-4, 16, 2, 4); lit(2, 16, 2, 4);
  blk(-8, 26, 16, 12, red, sh); u(stone, -8, 36, 16, 2);
  // циферблат
  const face = on ? '#ffe9b0' : '#f4f0e0';
  for (let yy = -3; yy <= 3; yy++) { const hw = Math.round(Math.sqrt(10.5 - yy * yy)); u(face, -hw, 32 + yy, hw * 2 + 1, 1); }
  u('#2a2a30', 0, 32, 1, 3); u('#2a2a30', 0, 32, 3, 1);
  for (const px of [-8, 6]) u(red, px, 38, 2, 5);                      // башенки на углах
  u(red, -6, 38, 12, 4);
  for (let i = 0; i < 13; i++) { const hw = Math.round(6 * (1 - i / 13)); u(i % 3 === 2 ? greenHi : green, -hw, 42 + i, hw * 2 + 1, 1); }
  // рубиновая звезда
  const ruby = on ? '#ff4a38' : '#d82828';
  u(ruby, 0, 55, 1, 6); u(ruby, -2, 57, 5, 1); u(ruby, -1, 56, 3, 3); if (on) u('#ffb0a0', 0, 57, 1, 1);
}

const SIGHTS = {
  goldbridge: [drawSight_goldbridge, 50], spaso: [drawSight_spaso, 38], kazansky: [drawSight_kazansky, 36], lenin: [drawSight_lenin, 30],
  baikal: [drawSight_baikal, 64], znamensky: [drawSight_znamensky, 44], paraskeva: [drawSight_paraskeva, 32], opera: [drawSight_opera, 48],
  uspensky: [drawSight_uspensky, 32], lovers: [drawSight_lovers, 58], hram: [drawSight_hram, 36], kulsharif: [drawSight_kulsharif, 32],
  kremlin_nn: [drawSight_kremlin_nn, 52], goldgates: [drawSight_goldgates, 52], spasskaya: [drawSight_spasskaya, 44],
  vostochny: [drawSight_vostochny, 44],
};
// Что показывать на стоянке: достопримечательность ({id, half}) или стелу региона ({region}); null, пока машина едет
function stopScene(car) {
  if (!car.parked) return null;
  const sn = sightNear(car.km);
  return sn && SIGHTS[sn.sight.id] ? { id: sn.sight.id, half: SIGHTS[sn.sight.id][1] } : { region: regionAt(car.km) };
}

// Придорожная стела региона: бетонные опоры и синий щит с названием пиксельным шрифтом
function drawStela(ctx, x, base, dayF, region) {
  const { on, d, u } = kit(ctx, x, base, dayF);
  ctx.font = '7px Lofi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = []; let cur = '';
  for (const w of region.split(' ')) {
    if (cur && ctx.measureText(`${cur} ${w}`).width > 54) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  const bw = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + 8, bh = lines.length * 8 + 4, h0 = 14, left = -(bw >> 1);
  const conc = d('#b8b8b0', '#3a3c44'), concSh = d('#8e8e88', '#2a2c34'), concHi = d('#d4d4cc', '#4a4c56');
  u(conc, left - 5, 0, 5, h0 + bh + 6); u(concSh, left - 2, 0, 2, h0 + bh + 6); u(concHi, left - 6, h0 + bh + 6, 7, 2);     // левая опора с оголовком
  u(conc, left + bw, 0, 5, h0 + bh + 6); u(concSh, left + bw + 3, 0, 2, h0 + bh + 6); u(concHi, left + bw - 1, h0 + bh + 6, 7, 2);
  u(concSh, left - 7, 0, bw + 14, 3);                                                                                      // плинтус
  u(conc, left, 0, bw, h0); u(concSh, left, h0 - 1, bw, 1);                                                                // бетонная стенка под щитом
  u(d('#f2f0e8', '#6a6a72'), left, h0, bw, bh); u(d('#2f6aa0', '#16304a'), left + 1, h0 + 1, bw - 2, bh - 2);
  const mid = base - h0 - bh / 2;
  ctx.fillStyle = on ? '#f4f0e0' : d('#f4f0e4', '#8a8a90');
  lines.forEach((l, i) => ctx.fillText(l, x + 0.5, Math.round(mid + (i - (lines.length - 1) / 2) * 8)));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}


// Достопримечательность ближайшего города — впереди-слева у горизонта; ночью тёплая подсветка, как у иллюминации
function drawSight(ctx, scene, dayF) {
  SIGHTS[scene.id][0](ctx, SX, SIGHT_BASE, dayF);
  if (1 - dayF > 0.15) {
    const R = scene.half + 14, g = ctx.createRadialGradient(SX, SIGHT_BASE - 20, 0, SX, SIGHT_BASE - 20, R);
    g.addColorStop(0, `rgba(255,210,140,${0.2 * (1 - dayF)})`); g.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = g; ctx.fillRect(SX - R, SIGHT_BASE - 70, R * 2, 90);
  }
}

// ---------- проём лобового стекла ----------
// Верх y=14 (углы скруглены радиусом 26), стойки A наклонены внутрь: вверху проём уже, внизу шире.
// Низ — торпеда, y=205. Всё построчно, чтобы края были пиксельными, без сглаживания.
export const NO_GARLAND = true;   // в машине гирлянды нет
export const NO_CURTAINS = true;  // и штор тоже
export const NO_GERANIUM = true;  // и герани
// Места, которые движок по умолчанию рисует на столе: в машине — кот и пар на торпеде слева у стекла, свет фонарика на консоли
export const CAT_AT = [16, 217];
export const YARN_AT = [-60, 262]; // клубка в машине нет: за краем кадра
export const STEAM_AT = [270, 215];
export const LAMP_AT = [318, 232];
const WT = 14, RC = 26, DASH_Y = 205;
const lineL = (y) => 64 - (y - WT) * 0.28, lineR = (y) => 416 + (y - WT) * 0.28;
const roundIn = (y) => (y < WT + RC ? Math.round(RC - Math.sqrt(Math.max(0, RC * RC - (WT + RC - y - 0.5) ** 2))) : 0);
const spanOpen = (y) => [Math.round(lineL(y)) + roundIn(y), Math.round(lineR(y)) - roundIn(y)];

// Иней по краям стекла, если мороз: кеш в отдельном холсте, пересобирается при смене силы
let frost = { key: -1, cv: null };
function frostCanvas(k) {
  const key = Math.round(k * 8);
  if (frost.key === key && frost.cv) return frost.cv;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = DASH_Y;
  const g = cv.getContext('2d');
  for (let y = WT; y < DASH_Y; y++) {
    const [xl, xr] = spanOpen(y);
    for (let x = xl; x < xr; x++) {
      const d = Math.min(x - xl, xr - 1 - x, y - WT, DASH_Y - 1 - y);
      if (d > 32) continue;
      const depth = (6 + 20 * k) * (0.5 + noise(x * 0.09 + y * 0.13, 71));
      if (d >= depth) continue;
      const a = (1 - d / depth) ** 1.3;
      if (hash(x * 131 + y, 72) > a * 0.9 + 0.05) continue;
      g.globalAlpha = 0.35 + 0.55 * a; g.fillStyle = hash(x + y * 7, 73) > 0.88 ? '#ffffff' : '#d4e6f4';
      g.fillRect(x, y, 1, 1);
    }
  }
  frost = { key, cv };
  return cv;
}
export function drawCover(ctx, env, dayF) {
  const temp = env.weather?.temp;
  if (!(env.car?.parked && env.car.night) || typeof temp !== 'number' || temp >= -5) return;
  try {
    const cv = frostCanvas(clamp((-5 - temp) / 20));
    ctx.globalAlpha = 0.6 + 0.3 * dayF; ctx.drawImage(cv, 0, 0); ctx.globalAlpha = 1;
  } catch { /* без холста (тесты) — просто без инея */ }
}

// Дрожь кузова: на ходу вид вздрагивает на пиксель на стыках плит, примерно раз в 25 м
export function sway(env) {
  const c = env.car;
  if (!c || !c.speed || c.parked) return 0;
  const m = c.km * 1000, p = (m % 25) / 25;
  return p < 0.05 && hash(Math.floor(m / 25), 66) < 0.7 ? 1 : 0;
}

// ---------- салон ----------
// Цвета комнаты умножаются на тот же тон, что движок кладёт на интерьер (день — холодный, ночь — тёплый)
const mul = (c, tint) => { const a = parseInt(c.slice(1), 16), b = parseInt(tint.slice(1), 16); const ch = (s) => Math.round(((a >> s) & 255) * ((b >> s) & 255) / 255); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
const roomTint = (dayF) => mixHex('#9a7866', '#a4a2b4', dayF);
const painter = (ctx, tn) => (c, x, y, w, h) => { ctx.fillStyle = mul(c, tn); ctx.fillRect(x, y, w, h); };
// Диск по строкам: центр, полуоси
function disc(fill, cx, cy, rx, ry) {
  for (let yy = -ry; yy <= ry; yy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / (ry + 0.5)) ** 2)));
    fill(cx - hw, cy + yy, hw * 2 + 1, 1);
  }
}
// Толстый отрезок: квадратики th×th вдоль линии
function thick(fill, x0, y0, x1, y1, th) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) fill(Math.round(x0 + (x1 - x0) * i / n - th / 2), Math.round(y0 + (y1 - y0) * i / n - th / 2), th, th);
}

// Кресла в машине снаружи кадра: сиденье Давида рисует drawFrame
export function drawSeat() {}

// Щиток приборов и верх торпеды. Рисуется дважды: целиком в drawDesk и поверх Давида справа в drawFrame
function dashBase(ctx, env, dayF, t) {
  const tn = roomTint(dayF), R = painter(ctx, tn), L = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const nightF = 1 - dayF, car = env.car || {};
  R('#0c0d10', 0, DASH_Y - 3, W, 3);                                            // уплотнитель низа стекла
  for (let y = DASH_Y; y < 228; y++) R(mixHex('#454851', '#26282e', (y - DASH_Y) / 23), 0, y, W, 1); // верх торпеды отражает небо
  R('#555963', 0, DASH_Y, W, 1);
  for (let x = 62; x < 350; x += 5) { R('#14151a', x, 208, 3, 1); R('#1a1b20', x, 211, 3, 1); } // решётка обдува стекла
  R('#1f2126', 0, 228, W, 42); R('#3a3d45', 0, 228, W, 1); R('#16171b', 0, 229, W, 1);
  R('#17181c', 0, 258, W, 12);                                                  // низ панели
  // козырёк щитка: выступает над торпедой
  for (let y = 194; y < 229; y++) {
    const inset = y === 194 ? 10 : y === 195 ? 6 : y === 196 ? 3 : y === 197 ? 1 : 0;
    R(y === 194 ? '#3a3d45' : '#14151a', 374 + inset, y, 84 - inset * 2, 1);
  }
  R('#0b0c0f', 378, 199, 76, 28);                                               // окно щитка
  // шкалы: спидометр (скорость машины) и тахометр
  const dials = [[434, 211, 10, 'spd'], [398, 213, 8, 'tach']];
  for (const [cx, cy, r, kind] of dials) {
    disc((x, y, w, h) => R('#101216', x, y, w, h), cx, cy, r, r);
    for (let a = 0; a < 6.3; a += 0.2) { const px = Math.round(cx + Math.cos(a) * (r + 0.5)), py = Math.round(cy + Math.sin(a) * (r + 0.5)); R('#2a2d33', px, py, 1, 1); }
    const tick = mixHex('#c4c8d0', '#ffb347', nightF);
    for (let i = 0; i <= 9; i++) {
      const a = (225 - i * 30) * Math.PI / 180, px = Math.round(cx + Math.cos(a) * (r - 1.5)), py = Math.round(cy - Math.sin(a) * (r - 1.5));
      L(tick, px, py, 1, 1);
    }
    const val = kind === 'spd' ? clamp((car.speed || 0) / 180) * 270 : clamp(((car.speed || 0) > 0 ? 2.1 + 0.08 * Math.sin(t * 7) : 0.8) / 8) * 270;
    const a = (225 - val) * Math.PI / 180, len = r - 2;
    for (let i = 0; i <= len; i++) L('#ff5a2a', Math.round(cx + Math.cos(a) * i), Math.round(cy - Math.sin(a) * i), 1, 1);
    L('#2a2d33', cx, cy, 1, 1);
  }
  L('#58d86a', 415, 203, 2, 1); L(nightF > 0.3 ? '#ffb347' : '#8a6a30', 419, 203, 2, 1);   // контрольные лампы
  if (nightF > 0.15) {                                                          // подсветка шкал ночью
    for (const [cx, cy, r] of dials) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
      g.addColorStop(0, `rgba(255,170,70,${0.3 * nightF})`); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
    }
  }
  // круглый дефлектор справа от щитка
  disc((x, y, w, h) => R('#101114', x, y, w, h), 468, 238, 6, 6); disc((x, y, w, h) => R('#26282e', x, y, w, h), 468, 238, 5, 5);
  for (let y = 235; y < 242; y += 2) R('#101114', 463, y, 11, 1);
}

// Торпеда: бардачок слева, консоль с магнитолой, термосом и фонариком, щиток приборов справа.
// Рисуется до кота, пара и света фонарика (их кладёт движок), поэтому предметы стоят перед стеклом.
export function drawDesk(ctx, env, dayF, t) {
  const tn = roomTint(dayF), R = painter(ctx, tn);
  const L = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };   // самосветящееся — без тона комнаты
  dashBase(ctx, env, dayF, t);

  // бардачок (books) перед пассажиром: крышка с ручкой и торчащие карты
  R('#15161a', 6, 232, 150, 32); R('#2b2d34', 8, 234, 146, 28); R('#3e414a', 8, 234, 146, 1); R('#22242a', 8, 261, 146, 1);
  R('#14151a', 60, 239, 42, 5); R('#3e414a', 60, 244, 42, 1);                      // ручка-углубление
  R('#34373e', 134, 237, 3, 3);                                                     // кнопка-замок
  R('#c8b878', 118, 229, 12, 6); R('#a89858', 124, 229, 1, 6); R('#8aa8c0', 108, 230, 9, 5); R('#e8e0cc', 112, 231, 3, 3); // карты зажаты в крышке
  R('#15161a', 106, 234, 26, 1);

  // центральная консоль
  R('#24262c', 164, 229, 192, 41); R('#3a3d45', 164, 229, 192, 1); R('#16171b', 164, 229, 1, 41); R('#16171b', 355, 229, 1, 41);
  // магнитола 1-DIN (player): дисплей светится, пока идёт эфир
  const px = 186, oy = 15, play = !!env.playing;
  R('#15171b', px, 217 + oy, 66, 27); R('#2a2d33', px, 217 + oy, 66, 1);
  R('#08090b', px + 6, 220 + oy, 56, 21); R('#2b2e35', px + 6, 220 + oy, 56, 1);
  if (play) {
    L('#2a1604', px + 9, 223 + oy, 28, 11);
    for (let i = 0; i < 8; i++) {                                                  // «точки»: бегущий эквалайзер
      const h = 1 + Math.round((Math.sin(t * 5 + i * 1.7) * 0.5 + 0.5) * 6);
      L('#ffb347', px + 11 + i * 3, 232 + oy - h, 2, h);
    }
    for (let i = 0; i < 6; i++) { L('#a86a24', px + 11 + ((i * 5 + Math.floor(t * 8)) % 26), 225 + oy, 1, 1); }
    L('#ffb347', px + 3, 219 + oy, 2, 2);                                          // светодиод питания
  } else {
    L('#10161a', px + 9, 223 + oy, 28, 11); L('#1c2a2c', px + 11, 228 + oy, 24, 1);
    L('#3a2616', px + 3, 219 + oy, 2, 2);
  }
  for (const kx of [px + 43, px + 54]) { R('#8a8e98', kx, 224 + oy, 5, 5); R('#c8ccd4', kx, 224 + oy, 5, 1); R('#3a3d45', kx + 4, 225 + oy, 1, 4); }
  for (let i = 0; i < 6; i++) R('#3a3d45', px + 10 + i * 5, 236 + oy, 3, 2);
  R('#000000', px + 43, 236 + oy, 16, 1); R('#4a4e58', px + 43, 238 + oy, 16, 1);
  // ручки климата под магнитолой
  for (const kx of [194, 214, 234]) { disc((x, y, w, h) => R('#3a3d45', x, y, w, h), kx, 264, 3, 3); R('#8a8e98', kx, 262, 1, 2); }

  // полка консоли справа
  R('#15161a', 258, 246, 96, 6); R('#41444c', 258, 246, 96, 1);

  // термос-кружка (tea) в подстаканнике; пар над ней рисует движок
  const tx = 268, ty = 8;
  R('#0a0b0d', tx - 4, 232 + ty - 2, 20, 8);
  R('#1e2024', tx + 1, 209 + ty, 11, 3); R('#3a3d45', tx + 1, 209 + ty, 11, 1); R('#ffb347', tx + 4, 209 + ty, 4, 1);
  R('#aeb2ba', tx, 212 + ty, 13, 24); R('#d8dce2', tx + 1, 212 + ty, 3, 24); R('#8a8e98', tx + 10, 212 + ty, 3, 24);
  R('#2a3a6a', tx, 218 + ty, 13, 3); R('#e8d8a8', tx + 4, 219 + ty, 5, 1);
  R('#8a8e98', tx, 236 + ty, 13, 1);
  R('#3a3d45', tx - 4, 235 + ty, 20, 1); R('#1a1c20', tx - 4, 236 + ty, 20, 1);

  // фонарик-лампа (lamp): кемпинговый, на полке консоли; светится, когда лампа включена
  const lx = 318, ly = 6, on = !!env.lampOn;
  R('#14161a', lx - 12, 240 + ly, 24, 1);
  R('#1e2024', lx - 10, 234 + ly, 20, 6); R('#34373e', lx - 10, 234 + ly, 20, 1);
  if (on) { L('#ffd890', lx - 8, 211 + ly, 16, 23); L('#fff0b8', lx - 4, 213 + ly, 8, 19); L('#ffe9a8', lx - 8, 211 + ly, 16, 1); }
  else { R('#5a5e68', lx - 8, 211 + ly, 16, 23); R('#7e828c', lx - 8, 211 + ly, 3, 23); R('#464a54', lx + 3, 211 + ly, 5, 23); }
  R('#1e2024', lx - 8, 211 + ly, 1, 23); R('#1e2024', lx + 7, 211 + ly, 1, 23); R('#1e2024', lx - 1, 211 + ly, 2, 23);
  R('#1e2024', lx - 10, 205 + ly, 20, 5); R('#3a3d45', lx - 10, 205 + ly, 20, 1);
  R('#1e2024', lx - 6, 201 + ly, 12, 1); R('#1e2024', lx - 6, 202 + ly, 1, 3); R('#1e2024', lx + 5, 202 + ly, 1, 3);
}

// Дорожный атлас в рамке на торпеде у стекла (подставка), пройденная часть красная, участок дня подсвечен
let atlasPts = null;
function atlasPoints() {
  if (atlasPts) return atlasPts;
  const S = (STOPS || []).filter((s) => typeof s.lat === 'number' && typeof s.lon === 'number');
  atlasPts = [];
  if (S.length < 2) return atlasPts;
  let i = 0;
  for (let km = 0; km <= KM1; km += 20) {
    while (i < S.length - 2 && km > S[i + 1].km) i++;
    const a = S[i], b = S[i + 1], u = clamp((km - a.km) / ((b.km - a.km) || 1));
    atlasPts.push({ km, lat: a.lat + (b.lat - a.lat) * u, lon: a.lon + (b.lon - a.lon) * u });
  }
  return atlasPts;
}
const ATLAS = [100, 189];
function drawRouteCard(ctx, env, dayF) {
  const tn = roomTint(dayF), R = painter(ctx, tn);
  const [x0, y0] = ATLAS, car = env.car, mx = x0 + 3, my = y0 + 8, mw = 38, mh = 21;
  R('#15171b', x0 + 2, y0 + 40, 42, 1);                      // тень на торпеде
  R('#26344e', x0, y0, 44, 38);                              // рамка
  R('#efe6cf', x0 + 2, y0 + 2, 40, 34);                      // бумага
  R('#2f5a8a', x0 + 2, y0 + 2, 40, 4); R('#e8d8a8', x0 + 4, y0 + 3, 12, 1); R('#e8d8a8', x0 + 18, y0 + 3, 8, 1);
  R('#a8c4dc', x0 + 30, y0 + 12, 2, 6);                      // Байкал
  R('#a8c4dc', x0 + 39, y0 + 26, 2, 2);                      // Японское море у угла
  // проекция: долготы 37–135, широты 43–58
  const P = (lon, lat) => [Math.round(mx + (lon - 37) / 98 * mw), Math.round(my + (58 - lat) / 15 * mh)];
  const pts = atlasPoints(), km = car?.km ?? 0;
  // участок дня — между ближайшими крупными городами
  const big = (STOPS || []).filter((s) => s.big);
  let lo = 0, hi = KM1;
  for (const s of big) { if (s.km <= km) lo = Math.max(lo, s.km); }
  for (const s of big) { if (s.km > km) { hi = s.km; break; } }
  for (const p of pts) {
    const [x, y] = P(p.lon, p.lat), done = p.km <= km, seg = p.km >= lo && p.km <= hi;
    R(done ? '#c8423a' : seg ? '#e0a020' : '#6a7a90', x, y, 1, 1);
    if (seg && !done) R('#e0a020', x, y + 1, 1, 1);
  }
  for (const s of STOPS || []) {
    if (typeof s.lat !== 'number') continue;
    const [x, y] = P(s.lon, s.lat); R('#26344e', x, y - 1, 1, 1);
  }
  const cur = pts.length ? pts.reduce((m, p) => (Math.abs(p.km - km) < Math.abs(m.km - km) ? p : m), pts[0]) : null;
  if (cur) { const [cx, cy] = P(cur.lon, cur.lat); R('#fff8e0', cx - 1, cy - 1, 3, 3); R('#c8302a', cx, cy, 1, 1); }   // машина — без мигания
  ctx.font = '7px Lofi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = mul('#2f5a8a', tn); ctx.fillText('9280 км', x0 + 22, y0 + 34);
  ctx.textAlign = 'left';
  R('#1a2438', x0 + 8, y0 + 38, 3, 2); R('#1a2438', x0 + 33, y0 + 38, 3, 2); // ножки-подставка
}

// Стикеры-весточки на торпеде у стекла: чем больше отправлено за поездку, тем больше записок (1, 5, 20, 50, 100+)
// слот: [x, y, цвет, наклон 0/1/-1]; новые слоты ложатся поверх старых
const STICKER_SLOTS = [
  [152, 209, '#f2d45a', 0], [190, 214, '#ff9ab0', 1], [168, 216, '#8fd0ff', -1], [214, 208, '#a8e08a', 0],
  [232, 215, '#ffb070', 1], [158, 220, '#d4a8ff', 0], [204, 218, '#f2d45a', -1], [242, 209, '#8fd0ff', 1],
  [180, 207, '#ffb070', -1], [222, 221, '#ff9ab0', 0], [168, 212, '#a8e08a', 1], [196, 210, '#d4a8ff', 0],
  [250, 218, '#f2d45a', 0], [176, 222, '#a8e08a', -1],
];
export const stickerCount = (n) => (n >= 100 ? 14 : n >= 50 ? 11 : n >= 20 ? 8 : n >= 5 ? 5 : n >= 2 ? 3 : n >= 1 ? 1 : 0);
function drawStickers(ctx, env, dayF) {
  const n = stickerCount(env.notes || 0); if (!n) return;
  const tn = roomTint(dayF), R = painter(ctx, tn);
  for (let i = 0; i < n; i++) {
    const [x, y, c, tilt] = STICKER_SLOTS[i];
    R('#15171b', x + 1, y + 6, 6, 1);                       // тень на торпеде
    R(c, x, y + (tilt > 0 ? 1 : 0), 7, 6);                  // записка
    R(mixHex(c, '#000000', 0.22), x + 1, y + 2 + (tilt > 0 ? 1 : 0), 4, 1); R(mixHex(c, '#000000', 0.22), x + 1, y + 4 - (tilt < 0 ? 1 : 0), 3, 1); // строчки
    R(mixHex(c, '#ffffff', 0.55), x + 5, y + (tilt > 0 ? 1 : 0), 2, 1); // загнутый уголок
  }
}

// Японская наклейка новичка «вакаба»: зелёно-жёлтый шеврон 8×10
const WAKABA = ['.GG..YY.', 'GGGGYYYY', 'GGGGYYYY', 'GGGGYYYY', 'GGGGYYYY', '.GGGYYY.', '.GGGYYY.', '..GGYY..', '...GY...', '....Y...'];
function drawWakaba(ctx, dayF, x0, y0) {
  const k = 0.55 + 0.45 * dayF;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 8; c++) {
    const ch = WAKABA[r][c]; if (ch === '.') continue;
    ctx.fillStyle = mixHex('#0a0e1a', ch === 'G' ? '#3a9a3c' : '#f2c418', k);
    ctx.fillRect(x0 + c, y0 + r, 1, 1);
  }
}

// Фирменный знак Давида — канал «Грузин на Марсе»: оранжевый квадрат с чёрной грузинской «ა» (как на аватарке)
const LOGO = ['oooooooooo', 'oooooooooo', 'oooo##oooo', 'ooo#oo#ooo', 'oooo#o#ooo', 'ooo#oo#ooo', 'ooo#oo#ooo', 'oooo##oooo', 'oooooooooo', 'oooooooooo'];
function drawLogo(ctx, dayF, x0, y0) {
  const k = 0.55 + 0.45 * dayF;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    ctx.fillStyle = mixHex('#0a0e1a', LOGO[r][c] === '#' ? '#141414' : '#ff692a', k);
    ctx.fillRect(x0 + c, y0 + r, 1, 1);
  }
}

// Наклейки на лобовом стекле в нижнем левом углу и затемнённая полоса сверху (до рамки)
export function drawRoom(ctx, env, dayF) {
  for (let y = WT; y < WT + 30; y++) {
    const [xl, xr] = spanOpen(y);
    ctx.fillStyle = `rgba(30,60,110,${0.34 * (1 - (y - WT) / 30)})`; ctx.fillRect(xl, y, xr - xl, 1);
  }
  drawWakaba(ctx, dayF, 40, 176);
  drawLogo(ctx, dayF, 52, 178);
}

// ---------- Давид за рулём ----------
const SKIN = '#c48c68', SKIN_D = '#a8704c', SKIN_L = '#d49c78', HAIR = '#28221e', BEARD = '#3b332f';
const SHIRT = '#d2c4a0', SHIRT_D = '#aa9e7e', SHIRT_L = '#e6dabc', SHIRT_F = '#b8aa88', FRAME = '#a08f5c';
// Форма линзы авиатора по строкам: шире сверху, внизу округлая
const LENS = [1, 1, 1, 0.96, 0.88, 0.75, 0.55, 0.3];
// Голова: turn 0 — смотрит вперёд (три четверти, нос налево), 1 — повернул к нам лицом
function drawHead(ctx, tn, hx, hy, o) {
  const R = painter(ctx, tn), turn = o.turn, front = turn > 0.5, fx = Math.round(-5 * (1 - turn)), cx = hx + fx;
  const hwAt = (yy) => { let hw = Math.round(16 * Math.sqrt(Math.max(0, 1 - (yy / 22.5) ** 2))); if (yy > 10) hw = Math.round(hw * (1 - 0.1 * (yy - 10) / 12)); return hw; };
  // лицо: загар, свет слева, тень на затылочной стороне
  for (let yy = -21; yy <= 22; yy++) {
    const hw = hwAt(yy); if (hw <= 0) continue;
    R(SKIN, hx - hw, hy + yy, hw * 2 + 1, 1);
    if (yy > -15 && yy < 12) R(SKIN_L, hx - hw + 1, hy + yy, front ? 3 : 4, 1);
    R(SKIN_D, hx + hw - (front ? 1 : 3), hy + yy, front ? 2 : 4, 1);
  }
  R(SKIN_L, cx - 6, hy - 14, 9, 2);                                                       // блик на лбу
  // борода: от баков по диагонали к губам, скулы открыты; тёмно-серая с белыми прядями, гуще к подбородку
  for (let yy = 1; yy <= 22; yy++) {
    const hw = hwAt(yy); if (hw <= 0) continue;
    const skip = yy >= 9 ? 0 : Math.max(0, Math.round(hw - (2 + (yy - 1) * 1.6)));
    const gray = (yy > 13 ? 0.28 : 0.13) + (yy > 17 ? 0.08 : 0);
    for (let xx = -hw; xx <= hw; xx++) {
      if (Math.abs(xx) < skip) continue;
      const q = hash(xx * 7 + yy * 13 + 5, 8);
      R(q < gray * 0.18 ? '#d6d2c8' : q < gray * 0.75 ? '#8e8a84' : q > 0.93 ? '#2a2320' : (yy > 19 || Math.abs(xx) > hw - 2) ? '#322b27' : BEARD, hx + xx, hy + yy, 1, 1);
    }
  }
  // усы с опущенными концами
  R('#2c2522', cx - 8, hy + 4, 17, 3); R('#2c2522', cx - 9, hy + 6, 2, 2); R('#2c2522', cx + 8, hy + 6, 2, 2);
  for (let i = 0; i < 6; i++) R(i % 2 ? '#c8c4ba' : '#8e8a84', cx - 7 + ((i * 29 + 3) % 15), hy + 4 + (i % 3), 1, 1);
  // рот
  const smile = o.mouth === 'smile', open = o.mouth === 'open';
  if (open) { R('#2a1210', cx - 3, hy + 8, 7, 3); R('#8a4c3e', cx - 3, hy + 8, 7, 1); }
  else if (smile) {
    R('#7a3c30', cx - 5, hy + 7, 1, 1); R('#7a3c30', cx + 5, hy + 7, 1, 1);
    R('#7a3c30', cx - 4, hy + 8, 9, 1); R('#eee6d6', cx - 3, hy + 9, 7, 2); R('#9a5444', cx - 3, hy + 11, 7, 1);
    R(SKIN_L, cx - 10, hy + 2, 3, 2); R(SKIN_L, cx + 8, hy + 2, 3, 2);                    // щёки приподняты улыбкой
  } else { R('#7a3c30', cx - 4, hy + 8, 9, 1); R('#9a5444', cx - 3, hy + 9, 7, 1); }
  // волосы: короткие тёмные, на висках седина
  for (let yy = -23; yy <= -12; yy++) {
    const hw = Math.round(17.5 * Math.sqrt(Math.max(0, 1 - ((yy + 1) / 23.5) ** 2)));
    if (hw <= 0) continue;
    R(HAIR, hx - hw, hy + yy, hw * 2 + 1, 1);
    if (yy < -16 && hash(yy, 3) > 0.4) R('#3c332c', hx - hw + 3, hy + yy, 5, 1);
    for (let xx = -hw; xx <= hw; xx++) { const q = hash(xx * 3 + yy * 11, 12); if (q > 0.93) R('#46403a', hx + xx, hy + yy, 1, 1); else if (yy > -16 && (xx < -hw + 4 || xx > hw - 4) && q < 0.22) R('#8e8a84', hx + xx, hy + yy, 1, 1); }
  }
  for (let yy = -11; yy <= -3; yy++) {                                                    // виски: тёмные с проседью
    const hw = hwAt(yy), sw = yy < -8 ? 7 : 5;
    for (let k = 0; k < sw; k++) R(hash(k * 5 + yy, 13) < 0.42 ? '#9a968e' : HAIR, hx + hw - sw + 1 + k, hy + yy, 1, 1);
    if (front) for (let k = 0; k < sw - 2; k++) R(hash(k * 5 + yy, 14) < 0.42 ? '#9a968e' : HAIR, hx - hw + k, hy + yy, 1, 1);
    else R(HAIR, hx - hw, hy + yy, 2, 1);
  }
  for (let xx = -14; xx <= 14; xx++) if (hash(xx, 15) > 0.55) R(HAIR, hx + xx, hy - 11, 1, 1);   // неровная линия роста
  // ухо
  const ex = hx + 9 + Math.round(turn * 7);
  R(SKIN_D, ex, hy - 3, 5, 8); R(SKIN, ex + 1, hy - 3, 3, 1); R('#8a5238', ex + 1, hy - 1, 2, 4);
  if (front) { R(SKIN_D, hx - 18, hy - 3, 3, 8); R('#8a5238', hx - 17, hy - 1, 1, 4); }
  // нос: светлая спинка, тень справа, кончик и ноздри
  const nx = cx - 1 - Math.round((1 - turn) * 3);
  R(SKIN_D, nx + 1, hy - 3, 3, 8); R(SKIN_L, nx, hy - 3, 2, 7); R('#e0ac86', nx, hy - 1, 1, 4);
  R('#b87c58', nx - 1, hy + 3, 5, 2); R('#7a4630', nx, hy + 4, 1, 1); R('#7a4630', nx + 3 - (front ? 0 : 1), hy + 4, 1, 1);
  // очки-авиаторы с бликом (или глаза без них)
  if (o.glasses) {
    const farW = Math.round(11 - 3 * (1 - turn)), lenses = [[cx - 2 - farW, farW], [cx + 2, 12]];
    R('#201a17', lenses[0][0], hy - 8, farW, 1); R('#201a17', lenses[1][0], hy - 8, 12, 1); R('#201a17', lenses[0][0] + 1, hy - 9, farW - 2, 1); R('#201a17', lenses[1][0] + 1, hy - 9, 10, 1); // брови
    R(FRAME, lenses[0][0] + farW, hy - 6, lenses[1][0] - lenses[0][0] - farW, 1); R(FRAME, cx - 1, hy - 4, 3, 1);                 // двойная перемычка
    for (const [x, w] of lenses) {
      for (let r = 0; r < 8; r++) {
        const ww = Math.max(2, Math.round(w * LENS[r])), xs = x + ((w - ww) >> 1), y = hy - 6 + r;
        if (r === 0 || r === 7) R(FRAME, xs, y, ww, 1);
        else { R(FRAME, xs, y, 1, 1); R(FRAME, xs + ww - 1, y, 1, 1); R(r < 4 ? '#14171c' : '#232a33', xs + 1, y, ww - 2, 1); }
      }
      R('#9fb4cc', x + 2, hy - 5, 4, 1); R('#6f86a2', x + 2, hy - 4, 2, 1); R('#f2f6fb', x + 3, hy - 5, 2, 1);               // блик
    }
    const nr = lenses[1], ex2 = nr[0] + nr[1];
    R('#6a5e3a', ex2, hy - 6, Math.max(1, ex - ex2 + 1), 1);                              // дужка до уха
  } else {
    const closed = o.eyes === 'closed';
    R(HAIR, cx - 11 + (turn < 0.5 ? 2 : 0), hy - 8, 8, 2); R(HAIR, cx + 3, hy - 8, 9, 2);       // брови
    for (const ex2 of [cx - 9 + (turn < 0.5 ? 2 : 0), cx + 5]) {
      if (closed) { R('#2a1c14', ex2, hy - 3, 5, 1); R(SKIN_D, ex2, hy - 2, 5, 1); }
      else { R('#e8e0d0', ex2, hy - 4, 5, 2); R('#2a1c14', ex2 + (turn < 0.5 ? 0 : 1), hy - 4, 2, 2); }
    }
  }
}

function drawDavid(ctx, env, dayF, t) {
  const tn = roomTint(dayF), R = painter(ctx, tn), car = env.car || {};
  const sleeping = !!(car.parked && car.night), moving = !!car.speed && !car.parked;
  const turn = sleeping ? 0.6 : smooth(30, 30.8, t % 40) * (1 - smooth(33.4, 34.2, t % 40));    // раз в 40 с на пару секунд смотрит на нас
  const glasses = !sleeping && dayF > 0.45;
  const bob = moving ? Math.round(Math.sin(t * 2.3) * 0.5 + Math.sin(t * 0.8) * 0.5) : 0;
  const breath = sleeping ? Math.round(Math.sin(t * 0.9) * 0.5 + 0.5) : 0;
  const bx = sleeping ? 5 : 0, by = bob + breath;
  // сиденье: тёмно-серая ткань с прострочкой. Подголовник со скруглёнными углами и шов по центру
  for (let y = 52; y < 104; y++) {
    const c = y < 54 || y > 101 ? 3 : y < 56 || y > 99 ? 1 : 0;
    R('#25272d', 438 + c, y, 42 - c, 1); R('#3a3d45', 440 + c, y, 38 - c, 1);
    R('#4a4e58', 440 + c, y, 3, 1); R('#2c2e34', 472, y, 6, 1);
    if (y % 4 < 2) { R('#555a65', 444, y, 1, 1); R('#555a65', 474, y, 1, 1); }
  }
  R('#2a2c32', 459, 56, 1, 44); R('#4a4e58', 460, 56, 1, 44); R('#555a65', 441, 55, 36, 1);
  // спинка: боковые валики, средняя панель с горизонтальной прострочкой
  R('#25272d', 424, 100, 56, 106); R('#363941', 426, 102, 54, 102);
  R('#444853', 426, 102, 6, 102); R('#2a2c32', 474, 102, 6, 102); R('#2a2c32', 433, 102, 1, 102);
  for (let y = 108; y < 204; y += 8) { R('#2c2e34', 435, y, 39, 1); R('#4a4e58', 435, y + 1, 39, 1); }
  for (let y = 102; y < 204; y += 4) { R('#555a65', 429, y, 1, 2); R('#4a4e58', 477, y, 1, 2); }
  // торс в бежевой рубашке: плечи скруглены, свет слева, тень справа
  for (let y = 122; y < 214; y++) {
    const l = y < 134 ? 404 - (y - 124) : y < 148 ? 394 - (y - 134) * 0.5 : 387, r = y < 134 ? 462 + (y - 124) * 0.8 : y < 148 ? 470 + (y - 134) * 0.5 : 477;
    let L0 = Math.round(l) + bx, R0 = Math.round(r) + bx;
    if (y < 126) { L0 += (126 - y) * 3; R0 -= (126 - y) * 3; }                              // скос плеч у шеи
    if (R0 <= L0) continue;
    R(SHIRT, L0, y + by, R0 - L0, 1); R(SHIRT_L, L0, y + by, 4, 1); R(SHIRT_D, R0 - 12, y + by, 12, 1);
    if (y > 150) R(SHIRT_F, R0 - 17 + (y % 5 === 0 ? 1 : 0), y + by, 1, 1);               // шов рукава: рука отдельно от груди
  }
  // складки: от пояса и подмышки веером к груди, с бликом по краю
  for (const [x0, y0, x1, y1] of [[392, 176, 418, 160], [394, 192, 424, 176], [470, 178, 452, 166], [468, 196, 444, 184], [404, 150, 412, 166], [446, 150, 440, 170]]) {
    thick((x, y, w, h) => R(SHIRT_F, x, y, w, h), x0 + bx, y0 + by, x1 + bx, y1 + by, 1);
    thick((x, y, w, h) => R(SHIRT_L, x, y, w, h), x0 + bx, y0 + by - 1, x1 + bx, y1 + by - 1, 1);
  }
  R('#b8aa88', 430 + bx, 140 + by, 1, 68);                                              // планка
  R('#e6dabc', 431 + bx, 140 + by, 1, 68);
  for (let y = 148; y < 206; y += 12) { R('#8a7e60', 428 + bx, y + by, 3, 3); R('#cfc4a4', 428 + bx, y + by, 1, 1); }
  R('#c8baa0', 452 + bx, 158 + by, 14, 13); R('#a89c7c', 452 + bx, 158 + by, 14, 1); R('#a89c7c', 452 + bx, 170 + by, 14, 1); R('#d6caa8', 453 + bx, 159 + by, 12, 2); // карман с клапаном
  // шея и воротник-«акула»: два крыла с острыми концами, в вырезе загорелая шея
  R(SKIN_D, 420 + bx, 116 + by, 17, 14); R('#8a5238', 420 + bx, 122 + by, 17, 4);          // шея в тени бороды
  for (let k = 0; k < 14; k++) {
    const w = Math.max(2, Math.round(11 - k * 0.65));
    R('#f0e6ca', 410 + k + bx, 126 + k + by, w, 1); R('#9a8c6c', 410 + k + bx, 126 + k + by, 1, 1); R('#9a8c6c', 410 + k + bx + w - 1, 126 + k + by, 1, 1);
    R('#f0e6ca', 447 - k - w + 1 + bx, 126 + k + by, w, 1); R('#9a8c6c', 447 - k + bx, 126 + k + by, 1, 1); R('#9a8c6c', 447 - k - w + 1 + bx, 126 + k + by, 1, 1);
  }
  for (let k = 0; k < 10; k++) R(k < 3 ? SKIN_D : SKIN, 424 + Math.floor(k / 2) + bx, 126 + k + by, Math.max(1, 9 - k), 1);
  // ремень безопасности наискось через грудь
  thick((x, y, w, h) => R('#23262e', x, y, w, h), 452 + bx, 124 + by, 408 + bx, 200, 5);
  thick((x, y, w, h) => R('#3a3d46', x, y, w, h), 451 + bx, 124 + by, 407 + bx, 200, 1);
  // голова
  const hx = 428 + bx + (sleeping ? 6 : 0), hy = 97 + by + (sleeping ? 2 : 0);
  drawHead(ctx, tn, hx, hy, { turn, glasses, eyes: sleeping ? 'closed' : 'open', mouth: sleeping ? 'open' : turn > 0.5 ? 'smile' : 'closed' });
  // левая рука: плечо — локоть (складки) — запястье на руле; правая висит вдоль тела и уходит на колено за торпеду
  if (!sleeping) {
    thick((x, y, w, h) => R(SHIRT, x, y, w, h), 396 + bx, 140 + by, 388, 177, 15);
    thick((x, y, w, h) => R(SHIRT_D, x, y, w, h), 400 + bx, 142 + by, 392, 178, 4);
    thick((x, y, w, h) => R(SHIRT, x, y, w, h), 388, 177, 378, 199, 11);
    thick((x, y, w, h) => R(SHIRT_L, x, y, w, h), 384, 178, 376, 196, 3);
    for (const k of [0, 3, 6]) R(SHIRT_F, 380 + bx - k, 180 + k * 2, 8, 1);               // складки у локтя
    R('#e6dabc', 371, 192, 12, 4); R('#b8aa88', 371, 195, 12, 1);
  } else {
    thick((x, y, w, h) => R(SHIRT, x, y, w, h), 398 + bx, 140 + by, 396 + bx, 190, 15);
    thick((x, y, w, h) => R(SHIRT_D, x, y, w, h), 403 + bx, 142 + by, 401 + bx, 190, 4);
  }
  if (sleeping) { // «z»
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.35 + i / 3) % 1, x = Math.round(448 + ph * 14), y = Math.round(82 - ph * 26), s = 3 + i;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.85; ctx.fillStyle = '#d6def4';
      ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y + s - 1, s, 1);
      for (let q = 1; q < s - 1; q++) ctx.fillRect(x + s - 1 - q, y + q, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

// Руль: наклонный овал, спицы и ступица. Левая ладонь Давида лежит на ободе слева сверху
function drawWheel(ctx, env, dayF) {
  const tn = roomTint(dayF), R = painter(ctx, tn), cx = 416, cy = 232, RX = 55, RY = 40, th = 7, car = env.car || {};
  const sleeping = !!(car.parked && car.night);
  for (let yy = -RY; yy <= RY; yy++) {
    const o = Math.round(RX * Math.sqrt(Math.max(0, 1 - (yy / (RY + 0.5)) ** 2)));
    const inner = Math.abs(yy) < RY - th + 1 ? Math.round((RX - th) * Math.sqrt(Math.max(0, 1 - (yy / (RY - th + 0.5)) ** 2))) : -1;
    const col = yy < -RY + 3 ? '#34373e' : '#1c1d21';
    if (inner < 0) R(col, cx - o, cy + yy, o * 2 + 1, 1);
    else { R(col, cx - o, cy + yy, o - inner + 1, 1); R(col, cx + inner, cy + yy, o - inner + 1, 1); }
    R('#3a3d45', cx - o, cy + yy, 1, 1);                                                // блик слева
    if (yy % 4 === 0) R('#2c2e34', cx - o + 2, cy + yy, 1, 1);                          // прострочка
  }
  // спицы и ступица
  R('#1c1d21', cx - 48, cy - 1, 36, 6); R('#1c1d21', cx + 12, cy - 1, 36, 6); R('#1c1d21', cx - 4, cy + 8, 9, 26);
  R('#34373e', cx - 48, cy - 1, 36, 1); R('#34373e', cx + 12, cy - 1, 36, 1);
  disc((x, y, w, h) => R('#17181b', x, y, w, h), cx, cy + 2, 15, 11);
  disc((x, y, w, h) => R('#26282d', x, y, w, h), cx, cy + 1, 13, 9);
  R('#9ea2aa', cx - 4, cy - 2, 9, 6); R('#17181b', cx - 3, cy - 1, 1, 4); R('#17181b', cx + 3, cy - 1, 1, 4); R('#17181b', cx - 2, cy + 1, 5, 1);   // эмблема
  if (!sleeping) { // ладонь на ободе (10 часов): кулак и пальцы поверх обода
    R(SKIN, 371, 199, 13, 9); R(SKIN_D, 371, 206, 13, 2); R('#a87050', 375, 201, 1, 5); R('#a87050', 379, 201, 1, 5);
    R(SKIN, 368, 203, 4, 5); R('#e2d6b6', 376, 196, 8, 3);
    R('#1a1c20', 378, 194, 7, 3); R('#9aa4b4', 380, 194, 3, 2); R('#e8eef4', 380, 194, 1, 1);  // часы на запястье
  }
}

// ---------- рамка лобового стекла ----------
export function drawFrame(ctx, env, dayF, t) {
  const tn = roomTint(dayF), R = painter(ctx, tn), moving = !!(env.car?.speed) && !env.car.parked;
  // потолок, обитый тканью, и верхний кант
  R('#a9a699', 0, 0, W, 13);
  for (let x = 1; x < W; x += 5) R('#a09d91', x, 0, 1, 13);
  R('#8a877b', 0, 12, W, 1); R('#2b2d33', 0, 13, W, 1);
  // плафон с лампами для чтения над зеркалом
  R('#8f8c80', 196, 0, 98, 11); R('#76736a', 196, 10, 98, 1); R('#c8c4b4', 210, 4, 8, 4); R('#c8c4b4', 272, 4, 8, 4);
  // стойки A (наклонены внутрь) и рамка проёма
  for (let y = WT; y < DASH_Y; y++) {
    const [xl, xr] = spanOpen(y), l0 = spanOpen(y - 1)[0], l1 = spanOpen(y + 1)[0], r0 = spanOpen(y - 1)[1], r1 = spanOpen(y + 1)[1];
    const up = y < 90, pil = up ? '#2a2c32' : '#32353c';
    R(pil, 0, y, xl, 1); R(pil, xr, y, W - xr, 1);
    if (xl > 6) { R(up ? '#3d4048' : '#454953', Math.max(0, xl - 3), y, 2, 1); if (y % 6 === 0 && xl > 14) R('#3a3d45', 3, y, xl - 8, 1); }
    R(up ? '#3d4048' : '#454953', xr + 1, y, 2, 1);
    const sl = Math.max(3, Math.abs(xl - l0), Math.abs(xl - l1)), sr = Math.max(3, Math.abs(xr - r0), Math.abs(xr - r1));
    if (y < WT + 3) R('#0c0d10', xl, y, xr - xl, 1);                                   // верхний уплотнитель
    R('#0c0d10', xl, y, sl, 1); R('#0c0d10', xr - sr, y, sr, 1);                       // боковые
    if (y >= WT + 3 && y < WT + 11) {                                                  // керамическая рамка стекла: точки гуще у края
      const dens = 1 - (y - WT - 3) / 8;
      for (let x = xl + sl; x < xr - sr; x++) if (((x * 3 + y * 5) % 8) < dens * 8) R('#0c0d10', x, y, 1, 1);
    }
  }
  // потолочные ручки на левой стойке: ручка для пассажира
  R('#3a3c42', 8, 52, 4, 8); R('#7a7c84', 8, 54, 16, 4); R('#9a9ca4', 8, 54, 16, 1);
  // козырёк пассажира (слева) и водителя (справа)
  const visor = (x, y, w, h) => {
    R('#b4b0a2', x, y, w, h); R('#8f8b7e', x, y + h - 2, w, 2); R('#cfcbbc', x, y, w, 1);
    R('#b4b0a2', x + 1, y + h, w - 2, 1); R('#8f8b7e', x + 1, y + h, w - 2, 1);
    R('#9c988a', x + 3, y + 3, w - 6, 1); R('#9c988a', x + 3, y + h - 5, w - 6, 1);
  };
  visor(74, 14, 112, 24); R('#4a4c52', 72, 11, 8, 4); R('#a39f91', 106, 19, 48, 13); R('#8a867a', 106, 19, 48, 1);
  visor(300, 14, 100, 20); R('#4a4c52', 396, 11, 8, 4);
  // зеркало заднего вида по центру: кронштейн, корпус, отражение салона; на шнурке брелок канала
  R('#1c1d21', 241, 13, 7, 6);
  R('#15161a', 219, 19, 52, 13); R('#15161a', 221, 18, 48, 1); R('#15161a', 221, 32, 48, 1);
  for (let y = 21; y < 30; y++) R(mixHex(mixHex('#1c2438', '#9ab4d0', dayF), mixHex('#14161c', '#5a5048', dayF), (y - 21) / 8), 222, y, 46, 1);
  R('#3a3d45', 219, 19, 52, 1);
  const kx = 262 + (moving ? Math.round(Math.sin(t * 1.9) * 1.4) : 0);
  R('#2a2018', 264, 32, 1, 5); R('#2a2018', kx + 4, 37, 1, 12);
  drawLogo(ctx, dayF, kx, 49);
  // атлас на торпеде
  drawRouteCard(ctx, env, dayF);
  drawStickers(ctx, env, dayF);
  // Давид на сиденье справа; торпеда справа снова поверх него — он сидит за приборной панелью
  drawDavid(ctx, env, dayF, t);
  ctx.save(); ctx.beginPath(); ctx.rect(366, 190, W - 366, 80); ctx.clip();
  dashBase(ctx, env, dayF, t);
  ctx.restore();
  drawWheel(ctx, env, dayF);
}

// ---------- секреты ----------
// Предмет у дороги: рисуем старый пиксельный спрайт w×h с масштабом k, ставим основанием на дорогу на расстоянии z
function roadside(env, p, X, sw, sh, per, near = 6, far = 200) {
  const V = lview(env), z = env.forced ? 30 : p - V.cam;
  if (!env.forced && (z < near || z > far)) return null;
  const k = (F / z) / per, cx = Math.round(pxAt(V, X, z)), base = Math.round(pyAt(z)), w = Math.max(6, Math.round(sw * k)), h = Math.max(6, Math.round(sh * k));
  return { x: cx - (w >> 1), y: base - h, w, h, k, cx, base };
}

export const SECRETS = [
  {
    id: 'obelisk', name: 'Обелиск Европа — Азия', layer: 'street',
    hint: 'На трассе у Екатеринбурга, у самой обочины, мелькает каменная стела — граница двух частей света.',
    found: 'Граница Европы и Азии на Урале отмечена обелисками; самый известный стоит на Московском тракте у Екатеринбурга. Проезжаешь стелу — и ты уже в другой части света.',
    state(env) {
      if (!env.forced && !(env.car.km > 7455 && env.car.km < 7480)) return null;
      return roadside(env, 7475 * 1000, 5.8, 10, 22, 6.1);
    },
    draw(ctx, env, st, dayF) {
      const c = mixHex('#8a8a86', '#3a3a40', dayF), d = mixHex('#6e6e6a', '#2c2c32', dayF);
      ctx.save(); ctx.translate(st.cx - 5 * st.k, st.base - 22 * st.k); ctx.scale(st.k, st.k);
      ctx.fillStyle = d; ctx.fillRect(0, 19, 10, 3);          // постамент
      ctx.fillStyle = c; ctx.fillRect(2, 4, 6, 16);           // стела
      ctx.fillStyle = d; ctx.fillRect(4, 0, 2, 4);            // шпиль
      ctx.fillStyle = mixHex('#d8d4c8', '#55555c', dayF); ctx.fillRect(3, 9, 4, 3); // табличка
      ctx.restore();
    },
  },
  {
    id: 'baikal_sign', name: 'Табличка «Байкал»', layer: 'street',
    hint: 'У Култука, где трасса выходит к южной оконечности озера, у дороги стоит синяя табличка.',
    found: 'У Култука Байкал впервые открывается с трассы: здесь южный край озера. Оно самое глубокое на планете — больше 1600 метров.',
    state(env) {
      if (!env.forced && !(env.car.km > 3910 && env.car.km < 3950)) return null;
      return roadside(env, 3935 * 1000, 6.0, 28, 24, 14);
    },
    draw(ctx, env, st, dayF) {
      ctx.save(); ctx.translate(st.cx - 14 * st.k, st.base - 24 * st.k); ctx.scale(st.k, st.k);
      ctx.fillStyle = mixHex('#4a4e56', '#1c1e24', dayF); ctx.fillRect(13, 10, 2, 14);   // столб
      ctx.fillStyle = mixHex('#f2f0e8', '#6a6a72', dayF); ctx.fillRect(0, 0, 28, 11);    // белая кайма
      ctx.fillStyle = mixHex('#2f6aa0', '#16304a', dayF); ctx.fillRect(1, 1, 26, 9);     // синее поле
      ctx.font = '7px Lofi, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = mixHex('#f4f0e4', '#8a8a90', dayF); ctx.fillText('Байкал', 14, 6);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.restore();
    },
  },
  {
    id: 'dalnoboy', name: 'Дальнобой мигает фарами', layer: 'street',
    hint: 'Ночью, на встречной полосе, иногда проезжает фура, которая трижды моргает дальним светом.',
    found: 'Встречные дальнобойщики приветствуют друг друга морганием фар — и предупреждают о посте или аварии впереди. Здесь это просто «привет, Давид».',
    state(env) {
      const V = lview(env);
      let v;
      if (env.forced) v = { type: 'truck', z: 30, ci: 2, flash: true };
      else {
        if (!env.car?.night || env.car.parked) return null;
        v = vehicles(env).find((q) => q.flash && q.z > 8 && q.z < 180);
        if (!v) return null;
      }
      const b = vehBox(V, v);
      return { x: b.cx - (b.w >> 1), y: b.base - b.h, w: b.w, h: b.h, v, b, forced: !!env.forced };
    },
    draw(ctx, env, st, dayF) {
      const V = lview(env), { b } = st;
      if (st.forced) drawVehicle(ctx, V, st.v, dayF);
      const on = ((env.ms / 1000) * 2.6) % 1 < 0.5; // три-четыре вспышки за проезд
      if (!on) return;
      const hy = b.base - Math.round(1.35 * b.s), R = Math.max(14, Math.round(4 * b.s));
      for (const lx of [b.cx - (b.w >> 2), b.cx + (b.w >> 2)]) {
        const g = ctx.createRadialGradient(lx, hy, 0, lx, hy, R);
        g.addColorStop(0, 'rgba(255,255,235,0.9)'); g.addColorStop(1, 'rgba(255,255,235,0)');
        ctx.fillStyle = g; ctx.fillRect(lx - R, hy - R, R * 2, R * 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(lx - 1, hy - 1, 3, 2);
      }
      const c = ctx.createRadialGradient(b.cx, b.base, 0, b.cx, b.base, R * 3);
      c.addColorStop(0, 'rgba(255,250,220,0.5)'); c.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = c; ctx.fillRect(b.cx - R * 3, b.base - 6, R * 6, 12);
    },
  },
];
