// «Марсоход проезжает мимо вашего окна»: белый минивэн Honda Stepwgn (Давид, канал «Грузин на Марсе»)
// едет по улице окна, когда настоящая машина из окна «Дорога» (/doroga/) в пределах ±80 км от города.
// Работает только у городов из WINDOWS и только если модуль города задал places.VAN — линию движения:
//   VAN = { x0, x1, y, dir, scale?, park? }
//   x0..x1 — отрезок дороги в буфере над горизонтом (как LANES у машин), y — нижний ряд колёс
//   (число или функция x → y для наклонного полотна), dir: 1 — слева направо, −1 — справа налево,
//   scale — целый множитель пикселя (по умолчанию 1), park — x, где минивэн стоит у обочины.
// Состояние поездки берём из cities/doroga/route.js (ленивым import() — только для этих окон)
// и обновляем раз в 5 минут. ?van=1 — минивэн едет прямо сейчас, ?van=park — стоит; без состояния сервера.

import { rng, mixHex } from './util.js';

export const WINDOWS = ['vladivostok', 'irkutsk', 'ekaterinburg', 'kazan', 'nnovgorod', 'vladimir', 'moskva'];
export const RADIUS = 80;   // км: в этих пределах Марсоход «рядом с окном» на ходу
export const PARK_R = 30;   // км: стоит/ночует так близко к городу — минивэн у обочины в самом окне
const PERIOD = 210;         // секунд между проездами (~3,5 минуты), старт внутри слота — от времени, одинаково для всех
const SPEED = 12;           // пикселей в секунду
const SW = 8, SH = 5;       // размер спрайта

const M = { route: null, state: null, started: false, pinned: false, stop: null, cache: { k: -1, v: null } };

// Для окна из списка: подгрузить маршрут и состояние поездки, обновлять раз в 5 минут
export function init(cityId) {
  if (!WINDOWS.includes(cityId) || M.started) return false;
  M.started = true;
  import('../cities/doroga/route.js').then(async (route) => {
    M.route = route;
    M.stop = route.STOPS.find((s) => s.win === cityId) || null;
    M.state = await route.loadState();
    setInterval(async () => { if (!M.pinned) M.state = await route.loadState(); }, 300e3);
  }).catch(() => {});
  return true;
}
// Для проверки из консоли: подменить состояние поездки (дальше сервер не опрашивается)
export function setState(s) { M.state = s; M.pinned = true; M.cache.k = -1; }
export const getRoute = () => M.route;

// Что с Марсоходом относительно этого окна в момент ms: { near, parked, status } (кэш на 10 секунд)
export function active(ms) {
  if (!M.route || !M.stop || !M.state) return null; // состояние приходит с сервера до 3 секунд
  const k = Math.floor(ms / 10e3);
  if (M.cache.k === k && M.cache.state === M.state) return M.cache.v;
  const car = M.route.carAt(ms, M.state), d = Math.abs(car.km - M.stop.km);
  let v = { near: false };
  if (!car.staleH && car.status !== 'done') {
    const moving = car.status === 'run' && !car.parked;
    if (moving && d <= RADIUS) v = { near: true, parked: false, status: car.status };
    else if (!moving && d <= PARK_R) v = { near: true, parked: true, status: car.status }; // ночёвка, пауза или «скоро старт» (Владивосток)
  }
  M.cache = { k, v, state: M.state };
  return v;
}

const yAt = (spec, x) => (typeof spec.y === 'function' ? spec.y(x) : spec.y);

// Где минивэн в кадре: { x, y (нижний ряд колёс), dir, parked, fade, w, h } или null
export function vanState(spec, ms, force) {
  if (!spec) return null;
  const a = force ? { near: true, parked: force === 'park' } : active(ms);
  if (!a?.near) return null;
  const s = spec.scale || 1, w = SW * s, h = SH * s, len = spec.x1 - spec.x0, dir = spec.dir || 1;
  if (a.parked) {
    const x = Math.round(spec.park ?? spec.x0 + len * 0.7);
    return { x, y: Math.round(yAt(spec, x + w / 2)), dir, parked: true, fade: 1, w, h, s };
  }
  const dur = Math.max(1, (len - w) / SPEED), sec = ms / 1000;
  let p;
  if (force) p = (sec % (dur + 6)) / dur; // ?van=1 — по кругу с короткой паузой
  else {
    const slot = Math.floor(sec / PERIOD), off = rng(slot * 7919 + 11)() * Math.max(1, PERIOD - dur - 4);
    p = (sec - slot * PERIOD - off) / dur;
  }
  if (p < 0 || p >= 1) return null;
  const x = Math.round(dir > 0 ? spec.x0 + p * (len - w) : spec.x1 - w - p * (len - w));
  const fade = Math.min(1, p * dur / 1.2, (1 - p) * dur / 1.2); // появляется и исчезает плавно (концы дороги — за берегом)
  return { x, y: Math.round(yAt(spec, x + w / 2)), dir, parked: false, fade, w, h, s };
}

// Прямоугольник для клика (в координатах сцены), с запасом: цель маленькая
export const vanRect = (v) => [v.x - 4, v.y - v.h - 4, v.w + 8, v.h + 8];

// Строка «Что сейчас» и тексты; city — { name, nameGen }
export function vanMoment(city, ms, force) {
  const a = force ? { near: true, parked: force === 'park', status: 'run' } : active(ms);
  if (!a?.near) return null;
  const title = a.parked
    ? (a.status === 'soon' ? `Марсоход ждёт старта: стоит у ${city.nameGen}` : `Марсоход стоит у ${city.nameGen}`)
    : `Сегодня через ${city.name} едет Марсоход`;
  return { title, href: '/doroga/', plain: true };
}
export function vanToast(city, ms, force) {
  const a = force ? { parked: force === 'park' } : active(ms) || {};
  const who = 'Это Марсоход: Давид из канала «Грузин на Марсе»';
  return `${who} ${a.parked ? `остановился у ${city.nameGen}` : `проезжает ${city.name}`}. Открыть его окно — внизу в «Что сейчас».`;
}

// ---------- рисование ----------
// Спрайт смотрит вправо: W — кузов, S — тень кромки, G — тёмные боковые стёкла, V — большое лобовое,
// O — оранжевая наклейка канала, T — колёса, H — фара, R — задний габарит
const ROWS = [
  '.SWWWWW.',
  'WGGWGGVV',
  'WWOOWWWW',
  'RWOOWWSH',
  '.TT..TT.',
];
const COL = { W: '#f4f2ec', S: '#a6adb8', G: '#1b2230', V: '#34506f', O: '#ff8c1a', T: '#16161b', H: '#fff4c8', R: '#7a2420' };

export function drawVan(b, env, dayF, t) {
  const v = env.van; if (!v) return;
  const nightF = 1 - dayF, s = v.s, x0 = v.x, top = v.y - v.h + s, glowK = Math.max(0, nightF - 0.15);
  b.globalAlpha = v.fade;
  for (let r = 0; r < SH; r++) {
    for (let c = 0; c < SW; c++) {
      const ch = ROWS[r][c]; if (ch === '.') continue;
      const cx = v.dir > 0 ? c : SW - 1 - c;
      let col = COL[ch];
      if (ch === 'H' || ch === 'R') continue; // фары и габариты — отдельно, ниже
      col = ch === 'O' ? mixHex('#3a2410', col, Math.max(0.7, dayF)) : mixHex('#15151c', col, Math.max(0.4, dayF));
      b.fillStyle = col; b.fillRect(x0 + cx * s, top + r * s, s, s);
    }
  }
  // фары спереди и габариты сзади: на ходу ночью — свет и красные огни; у обочины — только габариты
  const front = v.dir > 0 ? x0 + (SW - 1) * s : x0, rear = v.dir > 0 ? x0 : x0 + (SW - 1) * s, ly = top + 3 * s;
  const lights = v.parked ? 0.45 + glowK * 0.5 : glowK;
  b.fillStyle = '#fff4c8'; b.globalAlpha = v.fade * (v.parked ? lights : 0.5 + nightF * 0.5); b.fillRect(front, ly, s, s);
  b.fillStyle = '#ff3a2a'; b.globalAlpha = v.fade * (v.parked ? lights : 0.45 + nightF * 0.55); b.fillRect(rear, ly, s, s);
  if (!v.parked && glowK > 0.05) { // ближний свет ложится на дорогу перед машиной
    b.fillStyle = '#fff0b8';
    for (let i = 1; i <= 4; i++) { b.globalAlpha = v.fade * glowK * (0.4 - i * 0.07); b.fillRect(v.dir > 0 ? front + s * i : front - s * i, ly, s, s); }
  }
  if (v.parked && glowK > 0.05) { // тёплое пятно габаритов
    const gr = b.createRadialGradient(rear + 0.5, ly + 0.5, 0, rear + 0.5, ly + 0.5, 6 * s);
    gr.addColorStop(0, `rgba(255,70,50,${0.32 * glowK})`); gr.addColorStop(1, 'rgba(255,70,50,0)');
    b.globalAlpha = v.fade; b.fillStyle = gr; b.fillRect(rear - 6 * s, ly - 6 * s, 12 * s, 12 * s);
  }
  b.globalAlpha = 1;
}
