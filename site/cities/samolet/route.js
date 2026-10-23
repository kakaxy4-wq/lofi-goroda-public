// Рейс Москва — Владивосток: где самолёт сейчас, считается от времени — один и тот же для всех.
// Расписание (UTC, каждый день): вылет из Шереметьева 16:00 (19:00 мск) → Владивосток 00:30, стоянка 2 ч,
// обратно 02:30 → Москва 12:00 (против ветра дольше), стоянка до 16:00. Путь — по городам под трассой.

const RAD = Math.PI / 180;
export const POINTS = [
  { name: 'Москва', ins: 'Москвой', gen: 'Москвы', lat: 55.97, lon: 37.41, tz: 3 },
  { name: 'Казань', ins: 'Казанью', gen: 'Казани', lat: 55.80, lon: 49.11, tz: 3 },
  { name: 'Екатеринбург', ins: 'Екатеринбургом', gen: 'Екатеринбурга', lat: 56.84, lon: 60.60, tz: 5 },
  { name: 'Омск', ins: 'Омском', gen: 'Омска', lat: 54.99, lon: 73.37, tz: 6 },
  { name: 'Новосибирск', ins: 'Новосибирском', gen: 'Новосибирска', lat: 55.03, lon: 82.92, tz: 7 },
  { name: 'Красноярск', ins: 'Красноярском', gen: 'Красноярска', lat: 56.01, lon: 92.87, tz: 7 },
  { name: 'Иркутск', ins: 'Иркутском', gen: 'Иркутска', lat: 52.29, lon: 104.28, tz: 8 },
  { name: 'Чита', ins: 'Читой', gen: 'Читы', lat: 52.03, lon: 113.50, tz: 9 },
  { name: 'Благовещенск', ins: 'Благовещенском', gen: 'Благовещенска', lat: 50.26, lon: 127.53, tz: 9 },
  { name: 'Хабаровск', ins: 'Хабаровском', gen: 'Хабаровска', lat: 48.48, lon: 135.07, tz: 10 },
  { name: 'Владивосток', ins: 'Владивостоком', gen: 'Владивостока', lat: 43.40, lon: 132.15, tz: 10 },
];
function dist(a, b) {
  const [la1, lo1, la2, lo2] = [a.lat, a.lon, b.lat, b.lon].map((v) => v * RAD);
  return 2 * 6371 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
}
const CUM = POINTS.reduce((acc, p, i) => (acc.push(i ? acc[i - 1] + dist(POINTS[i - 1], p) : 0), acc), []);
export const TOTAL = CUM[CUM.length - 1]; // ≈ 6 500 км по прямым между городами

const H = 3600e3, DAY = 24 * H;
// фазы суток (от 16:00 UTC): [начало, длительность, вид, направление]
const PHASES = [[0, 8.5 * H, 'fly', 1], [8.5 * H, 2 * H, 'gate', 1], [10.5 * H, 9.5 * H, 'fly', -1], [20 * H, 4 * H, 'gate', -1]];
const CLIMB = 25 * 60e3, DESCENT = 35 * 60e3;
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// Точка на пути по пройденным км: lat, lon, пояс, курс (в градусах), ближайшие города
export function pointAt(km) {
  let i = 0;
  while (i < POINTS.length - 2 && CUM[i + 1] <= km) i++;
  const a = POINTS[i], b = POINTS[i + 1], f = Math.max(0, Math.min(1, (km - CUM[i]) / (CUM[i + 1] - CUM[i])));
  const lat = a.lat + (b.lat - a.lat) * f, lon = a.lon + (b.lon - a.lon) * f;
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD), x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return { lat, lon, tz: f < 0.5 ? a.tz : b.tz, course: (Math.atan2(y, x) / RAD + 360) % 360, prev: a, next: b, f };
}

// Состояние рейса в момент ms
export function flightAt(ms) {
  const t = ((ms - 16 * H) % DAY + DAY) % DAY;
  const [t0, dur, kind, dir] = PHASES.find(([s, d]) => t >= s && t < s + d);
  const into = t - t0;
  if (kind === 'gate') {
    const at = dir > 0 ? POINTS[POINTS.length - 1] : POINTS[0];
    const nextDep = t0 + dur; // до вылета
    return { kind, dir, km: dir > 0 ? TOTAL : 0, alt: 0, speed: 0, at, leftMin: Math.round((nextDep - into - t0) / 60e3), ...pointAt(dir > 0 ? TOTAL : 0), course: dir > 0 ? 270 : 90 };
  }
  const f = into / dur, km = dir > 0 ? f * TOTAL : (1 - f) * TOTAL;
  const alt = Math.min(smooth(into / CLIMB), smooth((dur - into) / DESCENT));
  const p = pointAt(km), course = dir > 0 ? p.course : (p.course + 180) % 360;
  return { kind, dir, km, alt, speed: Math.round(TOTAL / (dur / H)), into, leftMin: Math.round((dur - into) / 60e3), ...p, course,
    from: dir > 0 ? POINTS[0] : POINTS[POINTS.length - 1], to: dir > 0 ? POINTS[POINTS.length - 1] : POINTS[0] };
}
// Ближайший город под крылом (в пределах r км) или null
export function cityBelow(fl, r = 120) {
  let best = null;
  POINTS.forEach((p, i) => { const d = Math.abs(CUM[i] - fl.km); if (d < r && (!best || d < best.d)) best = { ...p, d }; });
  return best;
}
// Для движка: где окно сейчас (солнце, звёзды, погода) и куда оно смотрит (левый борт, чуть вперёд)
export function placeAt(ms) {
  const fl = flightAt(ms);
  return { lat: fl.lat, lon: fl.lon, utcOffset: fl.tz, viewAzimuth: ((fl.course - 90 + 35) % 360 + 360) % 360 };
}
