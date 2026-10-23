// Лофи-поезд по Транссибу: весь маршрут Москва (Ярославский вокзал) — Владивосток, 9288 км.
// Один общий поезд для всех слушателей: где он сейчас, считается от unix-времени. Туда и
// обратно (~13 суток на круг), с остановками как у поезда «Россия». Километры станций —
// главного хода, по Википедии. Координаты станций — по населённым пунктам, с точностью до
// десятков км (для солнца и погоды).

export const KM0 = 0, KM1 = 9288;
const V = 62, V_TUNNEL = 45, RAMP = 150; // км/ч на перегоне, км/ч (резерв, тоннелей нет), секунды разгона и торможения

// dwell — стоянка, минут (≈ как у «России», не сверено: расписание меняется каждое полугодие).
// gen/loc — для строк «от …», «в …»
export const STOPS = [
  { km: 0, name: 'Москва', gen: 'Москвы', loc: 'в Москве', dwell: 25, lat: 55.78, lon: 37.66 },   // Ярославский вокзал
  { km: 112, name: 'Александров', gen: 'Александрова', loc: 'в Александрове', dwell: 2, lat: 56.15, lon: 38.72 },
  { km: 282, name: 'Ярославль', gen: 'Ярославля', loc: 'в Ярославле', dwell: 13, lat: 57.61, lon: 39.85 }, // Ярославль-Главный
  { km: 373, name: 'Кострома', gen: 'Костромы', loc: 'в Костроме', dwell: 10, lat: 57.72, lon: 40.97 },  // Кострома-Новая; км ветки, не сверено
  { km: 500, name: 'Галич', gen: 'Галича', loc: 'в Галиче', dwell: 5, lat: 58.38, lon: 42.35 },
  { km: 699, name: 'Шарья', gen: 'Шарьи', loc: 'в Шарье', dwell: 3, lat: 58.38, lon: 45.51 },
  { km: 869, name: 'Котельнич', gen: 'Котельнича', loc: 'в Котельниче', dwell: 5, lat: 58.3, lon: 48.34 },
  { km: 956, name: 'Киров', gen: 'Кирова', loc: 'в Кирове', dwell: 15, lat: 58.6, lon: 49.66 },
  { km: 1163, name: 'Глазов', gen: 'Глазова', loc: 'в Глазове', dwell: 2, lat: 58.14, lon: 52.66 },
  { km: 1192, name: 'Балезино', gen: 'Балезино', loc: 'в Балезино', dwell: 25, lat: 57.98, lon: 53.0 },  // смена локомотива
  { km: 1314, name: 'Верещагино', gen: 'Верещагино', loc: 'в Верещагино', dwell: 2, lat: 58.07, lon: 54.66 },
  { km: 1434, name: 'Пермь', gen: 'Перми', loc: 'в Перми', dwell: 23, lat: 58.01, lon: 56.22 },   // Пермь II
  { km: 1535, name: 'Кунгур', gen: 'Кунгура', loc: 'в Кунгуре', dwell: 2, lat: 57.43, lon: 56.95 },
  { km: 1814, name: 'Екатеринбург', gen: 'Екатеринбурга', loc: 'в Екатеринбурге', dwell: 30, lat: 56.83, lon: 60.6 }, // смена локомотива
  { km: 2139, name: 'Тюмень', gen: 'Тюмени', loc: 'в Тюмени', dwell: 13, lat: 57.15, lon: 65.53 },
  { km: 2428, name: 'Ишим', gen: 'Ишима', loc: 'в Ишиме', dwell: 5, lat: 56.11, lon: 69.49 },
  { km: 2711, name: 'Омск', gen: 'Омска', loc: 'в Омске', dwell: 20, lat: 54.96, lon: 73.38 },    // Омск-Пассажирский
  { km: 3034, name: 'Барабинск', gen: 'Барабинска', loc: 'в Барабинске', dwell: 14, lat: 55.35, lon: 78.35 }, // смена локомотива
  { km: 3336, name: 'Новосибирск', gen: 'Новосибирска', loc: 'в Новосибирске', dwell: 25, lat: 55.03, lon: 82.92 }, // Новосибирск-Главный
  { km: 3455, name: 'Тайга', gen: 'Тайги', loc: 'в Тайге', dwell: 2, lat: 56.0, lon: 85.63 },
  { km: 3913, name: 'Ачинск', gen: 'Ачинска', loc: 'в Ачинске', dwell: 5, lat: 56.27, lon: 90.5 },
  { km: 4098, name: 'Красноярск', gen: 'Красноярска', loc: 'в Красноярске', dwell: 25, lat: 56.03, lon: 92.87 }, // Красноярск-Пассажирский
  { km: 4376, name: 'Иланская', gen: 'Иланской', loc: 'на Иланской', dwell: 5, lat: 55.95, lon: 95.7 }, // координаты не сверены
  { km: 4515, name: 'Тайшет', gen: 'Тайшета', loc: 'в Тайшете', dwell: 5, lat: 55.94, lon: 98.0 },
  { km: 4934, name: 'Зима', gen: 'Зимы', loc: 'в Зиме', dwell: 20, lat: 53.92, lon: 102.04 },     // смена локомотива
  { km: 5050, name: 'Черемхово', gen: 'Черемхово', loc: 'в Черемхово', dwell: 2, lat: 53.15, lon: 103.07 }, // км не сверено
  { km: 5185, name: 'Иркутск', gen: 'Иркутска', loc: 'в Иркутске', dwell: 30, lat: 52.28, lon: 104.33 }, // Иркутск-Пассажирский, смена локомотива
  { km: 5311, name: 'Слюдянка', gen: 'Слюдянки', loc: 'в Слюдянке', dwell: 5, lat: 51.65, lon: 103.71 },
  { km: 5641, name: 'Улан-Удэ', gen: 'Улан-Удэ', loc: 'в Улан-Удэ', dwell: 13, lat: 51.83, lon: 107.61 },
  { km: 5784, name: 'Петровский Завод', gen: 'Петровского Завода', loc: 'на Петровском Заводе', dwell: 18, lat: 51.29, lon: 108.83 }, // Петровск-Забайкальский, смена локомотива
  { km: 6198, name: 'Чита', gen: 'Читы', loc: 'в Чите', dwell: 15, lat: 52.03, lon: 113.49 },     // Чита II
  { km: 6906, name: 'Могоча', gen: 'Могочи', loc: 'в Могоче', dwell: 10, lat: 53.74, lon: 119.77 },
  { km: 7865, name: 'Белогорск', gen: 'Белогорска', loc: 'в Белогорске', dwell: 20, lat: 50.92, lon: 127.61 }, // смена локомотива
  { km: 8351, name: 'Биробиджан', gen: 'Биробиджана', loc: 'в Биробиджане', dwell: 3, lat: 48.6, lon: 132.93 },
  { km: 8523, name: 'Хабаровск', gen: 'Хабаровска', loc: 'в Хабаровске', dwell: 30, lat: 48.52, lon: 135.09 }, // смена локомотива
  { km: 9175, name: 'Уссурийск', gen: 'Уссурийска', loc: 'в Уссурийске', dwell: 2, lat: 43.8, lon: 131.95 },
  { km: 9288, name: 'Владивосток', gen: 'Владивостока', loc: 'во Владивостоке', dwell: 40, lat: 43.11, lon: 131.89 },
];

// Длинных тоннелей на главном ходу Транссиба нет — массив пуст (механика virt/unvirt
// оставлена как в bam: с пустым массивом это тождество)
export const TUNNELS = [];

// Мосты через большие реки: положение приблизительное, границы ±0,6 км (Кама — особенно, не сверено).
// Моста через Волгу на маршруте нет: линия идёт севернее реки (Ярославль и Кострома — на левом
// берегу); Волга показана широкой водой на стоянке в Ярославле
export const BRIDGES = [
  { km0: 1443.4, km1: 1444.6, name: 'мост через Каму' },      // юг Перми, не сверено точно
  { km0: 3333.2, km1: 3334.4, name: 'мост через Обь' },       // перед Новосибирском
  { km0: 4100.4, km1: 4101.6, name: 'мост через Енисей' },    // за Красноярском (схема ВП: Енисей 4101)
  { km0: 8514.4, km1: 8515.6, name: 'мост через Амур' },      // перед Хабаровском (схема ВП: Амур 8515)
];

// Весь Транссиб электрифицирован: контактная сеть на всём пути от Москвы до Владивостока
export const ELECTRIC_TO = KM1;

// Часовые пояса: UTC+3 Москва—Киров, +4 Удмуртия (Глазов—Балезино), +5 Пермь—Тюмень,
// +6 Омская обл., +7 Новосибирск—Красноярск, +8 Иркутская обл. и Бурятия (с Тайшета),
// +9 Забайкалье и Амурская обл., +10 Хабаровский край и Приморье. Границы по км условные
const tzAt = (km) => (km < 1150 ? 3 : km < 1290 ? 4 : km < 2520 ? 5 : km < 3260 ? 6 : km < 4460 ? 7 : km < 5800 ? 8 : km < 8200 ? 9 : 10);

// Где поезд на карте: линейно между соседними станциями
export function placeAt(km) {
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1].km < km) i++;
  const a = STOPS[i], b = STOPS[i + 1], u = Math.min(1, Math.max(0, (km - a.km) / (b.km - a.km)));
  return { lat: a.lat + (b.lat - a.lat) * u, lon: a.lon + (b.lon - a.lon) * u, utcOffset: tzAt(km) };
}

// «Виртуальные» км: в тоннеле поезд идёт медленнее, км там «длиннее» (тоннелей нет — тождество)
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
  // разворот во Владивостоке: стоянка на конечной; в Москве стоянка одна — в начале круга
  const last = order[order.length - 1];
  if (dir > 0) { LEGS.push({ kind: 'stop', at: last, dir, t0: T, t1: T + last.dwell * 60 }); T += last.dwell * 60; }
}
export const CYCLE = T; // секунд на круг туда-обратно (~13 суток)
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
    tunnel: tn, dark: tn ? Math.min(1, edge / 0.12) : 0,
    bridge: BRIDGES.find((b) => km > b.km0 && km < b.km1) || null,
  };
}

// На конечной поезд разворачивается: следующая станция — в обратную сторону
function nextStop(st, dir) {
  const i = STOPS.indexOf(st);
  return STOPS[i + dir] || STOPS[i - dir];
}

// Где мы: «от Кирова к Глазову, 1163 км от Москвы»
export function whereLine(tr) {
  const km = Math.round(tr.km);
  if (tr.at) return `Стоянка ${tr.at.loc}, ${km} км от Москвы. Отправление через ${mins(tr.departIn)}, дальше — ${tr.next.name}.`;
  if (tr.tunnel) return tr.tunnel.about;
  if (tr.bridge) return `Поезд идёт по мосту ${tr.bridge.name.replace('мост ', '')}.`;
  return `Поезд идёт от ${tr.prev.gen} к станции ${tr.next.name}, ${km} км от Москвы. До прибытия ${mins(tr.eta)}.`;
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
