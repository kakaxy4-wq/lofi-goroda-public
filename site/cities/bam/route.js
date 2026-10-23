// Лофи-поезд по БАМу: весь маршрут Тайшет — Советская Гавань, 4287 км. Один общий поезд
// для всех слушателей: где он сейчас, считается от unix-времени. Туда и обратно (~неделя на круг),
// с остановками и медленным проходом тоннелей. Километры станций — от Тайшета, по Википедии.
// Координаты станций — по населённым пунктам, с точностью до десятков км (для солнца и погоды).

export const KM0 = 0, KM1 = 4287;
const V = 55, V_TUNNEL = 37, RAMP = 150; // км/ч на перегоне, км/ч в тоннеле, секунды разгона и торможения

// dwell — стоянка, минут. gen/loc — для строк «от …», «в …»
export const STOPS = [
  { km: 0, name: 'Тайшет', gen: 'Тайшета', loc: 'в Тайшете', dwell: 40, lat: 55.94, lon: 98.0 },
  { km: 269, name: 'Вихоревка', gen: 'Вихоревки', loc: 'в Вихоревке', dwell: 3, lat: 56.12, lon: 101.17 },
  { km: 326, name: 'Падунские Пороги', gen: 'Падунских Порогов', loc: 'на Падунских Порогах', dwell: 10, lat: 56.3, lon: 101.73 },
  { km: 713, name: 'Усть-Кут', gen: 'Усть-Кута', loc: 'в Усть-Куте', dwell: 20, lat: 56.79, lon: 105.76 },
  { km: 784, name: 'Звёздная', gen: 'Звёздной', loc: 'на Звёздной', dwell: 2, lat: 56.74, lon: 106.5 },
  { km: 889, name: 'Киренга', gen: 'Киренги', loc: 'на Киренге', dwell: 3, lat: 56.17, lon: 107.45 },
  { km: 1063, name: 'Северобайкальск', gen: 'Северобайкальска', loc: 'в Северобайкальске', dwell: 30, lat: 55.64, lon: 109.32 },
  { km: 1090, name: 'Нижнеангарск', gen: 'Нижнеангарска', loc: 'в Нижнеангарске', dwell: 2, lat: 55.79, lon: 109.55 },
  { km: 1242, name: 'Новый Уоян', gen: 'Нового Уояна', loc: 'в Новом Уояне', dwell: 5, lat: 56.13, lon: 111.73 },
  { km: 1385, name: 'Северомуйск', gen: 'Северомуйска', loc: 'в Северомуйске', dwell: 3, lat: 56.15, lon: 113.43 },
  { km: 1469, name: 'Таксимо', gen: 'Таксимо', loc: 'в Таксимо', dwell: 25, lat: 56.34, lon: 114.88 },
  { km: 1719, name: 'Новая Чара', gen: 'Новой Чары', loc: 'в Новой Чаре', dwell: 10, lat: 56.81, lon: 118.29 },
  { km: 1864, name: 'Хани', gen: 'Хани', loc: 'в Хани', dwell: 3, lat: 56.92, lon: 119.97 },
  { km: 2348, name: 'Тында', gen: 'Тынды', loc: 'в Тынде', dwell: 40, lat: 55.15, lon: 124.72 },
  { km: 2690, name: 'Верхнезейск', gen: 'Верхнезейска', loc: 'в Верхнезейске', dwell: 5, lat: 54.9, lon: 126.4 },
  { km: 3017, name: 'Февральск', gen: 'Февральска', loc: 'в Февральске', dwell: 10, lat: 52.5, lon: 131.15 },
  { km: 3298, name: 'Новый Ургал', gen: 'Нового Ургала', loc: 'в Новом Ургале', dwell: 25, lat: 51.07, lon: 132.56 },
  { km: 3819, name: 'Комсомольск-на-Амуре', gen: 'Комсомольска-на-Амуре', loc: 'в Комсомольске-на-Амуре', dwell: 30, lat: 50.58, lon: 137.0 },
  { km: 3871, name: 'Селихин', gen: 'Селихина', loc: 'в Селихине', dwell: 3, lat: 50.37, lon: 137.5 },
  { km: 4253, name: 'Ванино', gen: 'Ванино', loc: 'в Ванино', dwell: 10, lat: 49.09, lon: 140.25 },
  { km: 4287, name: 'Советская Гавань', gen: 'Советской Гавани', loc: 'в Советской Гавани', dwell: 40, lat: 48.97, lon: 140.29 },
];

// Длины тоннелей настоящие, положение — приблизительное (по англоязычной Википедии, «~км»)
export const TUNNELS = [
  { id: 'baikalsky', km0: 1007, len: 6.685, name: 'Байкальский тоннель', about: 'Байкальский тоннель: 6,7 километра сквозь Байкальский хребет, за ним — спуск к Байкалу.' },
  { id: 'severomuysky', km0: 1354, len: 15.343, name: 'Северомуйский тоннель', about: 'Северомуйский тоннель: 15 километров под Северо-Муйским хребтом, самый длинный в России. Поезд идёт медленно, около 25 минут.' },
  { id: 'kodarsky', km0: 1645, len: 1.981, name: 'Кодарский тоннель', about: 'Кодарский тоннель: почти 2 километра сквозь хребет Кодар.' },
  { id: 'dussealinsky', km0: 3382, len: 1.852, name: 'Дуссе-Алинский тоннель', about: 'Дуссе-Алинский тоннель: 1,9 километра под хребтом Дуссе-Алинь. Его начали строить ещё в 1930-х, а достроили уже при БАМе.' },
].map((t) => ({ ...t, km1: t.km0 + t.len }));

// Мосты через большие реки: положение приблизительное
export const BRIDGES = [
  { km0: 721.2, km1: 721.7, name: 'мост через Лену' },
  { km0: 2684.4, km1: 2685.6, name: 'мост через Зею' },
  { km0: 3829, km1: 3830.4, name: 'мост через Амур' },
];

// Электрифицирован участок от Тайшета до Таксимо, дальше на восток — тепловозы
export const ELECTRIC_TO = 1469;

// Часовые пояса по регионам: Иркутская область и Бурятия UTC+8, Забайкалье, Якутия и Приамурье UTC+9,
// Хабаровский край UTC+10. Границы регионов на линии — приблизительные
const tzAt = (km) => (km < 1530 ? 8 : km < 3150 ? 9 : 10);

// Где поезд на карте: линейно между соседними станциями
export function placeAt(km) {
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1].km < km) i++;
  const a = STOPS[i], b = STOPS[i + 1], u = Math.min(1, Math.max(0, (km - a.km) / (b.km - a.km)));
  return { lat: a.lat + (b.lat - a.lat) * u, lon: a.lon + (b.lon - a.lon) * u, utcOffset: tzAt(km) };
}

// «Виртуальные» км: в тоннеле поезд идёт медленнее, км там «длиннее»
const SLOW = V / V_TUNNEL - 1;
function virt(km) {
  let v = km;
  for (const t of TUNNELS) v += (Math.min(Math.max(km, t.km0), t.km1) - t.km0) * SLOW;
  return v;
}
function unvirt(v) {
  let shift = 0; // сколько лишних «виртуальных» км набрано в тоннелях до этой точки
  for (const t of TUNNELS) {
    const a = virt(t.km0), b = virt(t.km1);
    if (v <= a) break;
    if (v < b) return t.km0 + (v - a) / (1 + SLOW);
    shift = b - t.km1;
  }
  return v - shift;
}

// Расписание: туда (по возрастанию км), потом обратно. Отрезки — стоянка или перегон
const LEGS = [];
let T = 0;
for (const dir of [1, -1]) {
  const order = dir > 0 ? STOPS : [...STOPS].reverse();
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i], b = order[i + 1];
    if (i > 0 || dir > 0) { LEGS.push({ kind: 'stop', at: a, dir, t0: T, t1: T + a.dwell * 60 }); T += a.dwell * 60; }
    const d = Math.abs(virt(b.km) - virt(a.km)), run = (d / V) * 3600 + RAMP;
    LEGS.push({ kind: 'run', from: a, to: b, dir, t0: T, t1: T + run, v0: virt(a.km), v1: virt(b.km) });
    T += run;
  }
  // разворот в Советской Гавани: стоянка на конечной; в Тайшете стоянка одна — в начале круга
  const last = order[order.length - 1];
  if (dir > 0) { LEGS.push({ kind: 'stop', at: last, dir, t0: T, t1: T + last.dwell * 60 }); T += last.dwell * 60; }
}
export const CYCLE = T; // секунд на круг туда-обратно (~неделя)
const EPOCH = Date.UTC(2026, 9, 1); // от этого момента отсчитывается расписание

// Трапеция скорости: доля пройденного за время tau из run
function travelled(leg, tau) {
  const run = leg.t1 - leg.t0, a = RAMP / 2, cruise = run - 2 * a;
  const vm = 1 / (cruise + a); // доля пути в секунду на крейсерской скорости
  if (tau < a) return { f: 0.5 * vm * tau * tau / a, k: tau / a };
  if (tau < a + cruise) return { f: vm * (a / 2 + tau - a), k: 1 };
  const r = run - tau;
  return { f: 1 - 0.5 * vm * r * r / a, k: r / a };
}

export function trainAt(ms) {
  const s = ((((ms - EPOCH) / 1000) % CYCLE) + CYCLE) % CYCLE;
  let lo = 0, hi = LEGS.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (LEGS[m].t0 <= s) lo = m; else hi = m - 1; }
  const leg = LEGS[lo];
  if (leg.kind === 'stop') {
    const next = nextStop(leg.at, leg.dir);
    return { km: leg.at.km, speed: 0, dir: leg.dir, at: leg.at, prev: leg.at, next, departIn: leg.t1 - s, tunnel: null, bridge: null, dark: 0 };
  }
  const { f, k } = travelled(leg, s - leg.t0);
  const km = unvirt(leg.v0 + (leg.v1 - leg.v0) * f);
  const tn = TUNNELS.find((t) => km > t.km0 && km < t.km1) || null;
  const edge = tn ? Math.min(km - tn.km0, tn.km1 - km) : 0;
  return {
    km, dir: leg.dir, at: null, prev: leg.from, next: leg.to,
    speed: (tn ? V_TUNNEL : V) * k,
    eta: leg.t1 - s,
    tunnel: tn, dark: tn ? Math.min(1, edge / 0.12) : 0, // в первые 120 м темнеет
    bridge: BRIDGES.find((b) => km > b.km0 && km < b.km1) || null,
  };
}

// На конечной поезд разворачивается: следующая станция — в обратную сторону
function nextStop(st, dir) {
  const i = STOPS.indexOf(st);
  return STOPS[i + dir] || STOPS[i - dir];
}

// Где мы: «от Нового Уояна к Северомуйску, 1310 км от Тайшета»
export function whereLine(tr) {
  const km = Math.round(tr.km);
  if (tr.at) return `Стоянка ${tr.at.loc}, ${km} км от Тайшета. Отправление через ${mins(tr.departIn)}, дальше — ${tr.next.name}.`;
  if (tr.tunnel) return tr.tunnel.about;
  if (tr.bridge) return `Поезд идёт по мосту ${tr.bridge.name.replace('мост ', '')}.`;
  return `Поезд идёт от ${tr.prev.gen} к станции ${tr.next.name}, ${km} км от Тайшета. До прибытия ${mins(tr.eta)}.`;
}
function mins(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} мин`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
}

// Ближайшие остановки: [{ st, at (ms прибытия), dwell }] — по расписанию вперёд от момента ms
export function upcoming(ms, n = 4) {
  const s = ((((ms - EPOCH) / 1000) % CYCLE) + CYCLE) % CYCLE;
  let i = LEGS.findIndex((l) => l.t0 <= s && s < l.t1);
  const out = [];
  for (let k = 1; out.length < n && k < LEGS.length * 2; k++) {
    const j = (i + k) % LEGS.length, leg = LEGS[j];
    if (leg.kind !== 'stop') continue;
    let dt = leg.t0 - s; if (dt <= 0) dt += CYCLE;
    out.push({ st: leg.at, at: ms + dt * 1000, dwell: leg.at.dwell });
  }
  return out;
}
export { tzAt };
