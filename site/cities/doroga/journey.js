// Панель «Маршрут»: схема Владивосток — Москва, участок, где сейчас Давид, и ближайшие города.
// Точку не рисуем: публично показываем только участок между соседними крупными городами.

import { carAt, live, placeAt, whereLine, STOPS, KM1, tzAt } from './route.js';

// ---------- проекция для схемы: долгота/широта → x/y (как у схемы Транссиба) ----------
const LON0 = 37.3, LAT0 = 58.8, KX = 5.7, KY = 12.6;
const px = (lon) => (lon - LON0) * KX, py = (lat) => (LAT0 - lat) * KY;
export const MAP_W = 558, MAP_H = 197;
// Очертания — схематичные, для узнаваемости, не для навигации
const BAIKAL = [[51.72, 103.7], [51.5, 104.3], [51.85, 105.6], [52.3, 106.4], [52.6, 106.9], [53.1, 107.7], [53.6, 108.6], [54.4, 109.2], [55.1, 109.4], [55.75, 109.6], [55.7, 109.05], [55.0, 108.4], [54.4, 108.0], [53.6, 107.2], [53.0, 106.4], [52.4, 105.6], [51.9, 104.6]];
const COAST = [[43.6, 132.75], [43.2, 132.05], [42.6, 131.35]];
// Подписи крупных городов: [текст, dx, dy, выравнивание] — разнесены, чтобы не налезали
const LABELED = {
  0: ['Владивосток', -6, -8, 'end'], 760: ['Хабаровск', 6, 8, 'end'], 1510: ['Белогорск', 0, 17, 'middle'],
  2925: ['Чита', 0, -9, 'middle'], 3570: ['Улан-Удэ', 0, 17, 'middle'], 4020: ['Иркутск', 0, -9, 'middle'],
  5085: ['Красноярск', 0, -9, 'middle'], 5885: ['Новосибирск', 0, -9, 'middle'], 6535: ['Омск', 0, 17, 'middle'],
  7165: ['Тюмень', 0, 17, 'middle'], 7495: ['Екатеринбург', 0, -9, 'middle'], 8475: ['Казань', 4, 17, 'middle'],
  8875: ['Н. Новгород', 2, -9, 'middle'], 9280: ['Москва', -3, 17, 'start'],
};

// Точка на линии по километру (между остановками — по прямой, как в placeAt)
const xyKm = (km) => { const p = placeAt(km); return [px(p.lon), py(p.lat)]; };

function mapSvg(car) {
  const pts = (arr) => arr.map(([la, lo]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(' ');
  const path = (k0, k1) => [k0, ...STOPS.filter((s) => s.km > k0 && s.km < k1).map((s) => s.km), k1].map((k) => xyKm(k).map((v) => v.toFixed(1)).join(',')).join(' ');
  // пройдено — до начала участка дня; сам участок — жёлтым
  const { segFrom, segTo } = car;
  let s = `<svg class="bam-svg" viewBox="-10 -6 ${MAP_W + 20} ${MAP_H + 12}" role="img" aria-label="Схема дороги: Давид между ${segFrom.ins} и ${segTo.ins}">`;
  s += `<polygon class="sea" points="${pts(COAST)} ${MAP_W + 10},${MAP_H + 6}"/>`;
  s += `<polygon class="lake" points="${pts(BAIKAL)}"/>`;
  s += `<text class="water" x="${px(106.7).toFixed(1)}" y="${py(53.9).toFixed(1)}" text-anchor="middle">Байкал</text><text class="water" text-anchor="end" x="${px(134.9).toFixed(1)}" y="${py(42.8).toFixed(1)}">Японское море</text>`;
  s += `<polyline class="rest" points="${path(0, KM1)}"/>`;
  s += `<polyline class="done" points="${path(0, car.status === 'done' ? KM1 : segFrom.km)}"/>`;
  if (car.status !== 'soon' && car.status !== 'done') {
    s += `<polyline points="${path(segFrom.km, segTo.km)}" fill="none" stroke="#f2b94a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
    s += `<polyline class="done" points="${path(segFrom.km, segTo.km)}" style="stroke-width:2"/>`;
  }
  for (const st of STOPS) {
    const [x, y] = xyKm(st.km), lab = LABELED[st.km];
    s += `<circle class="st${lab ? ' big' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${lab ? 3.4 : 2.2}"><title>${st.name}</title></circle>`;
    if (lab) s += `<text x="${(x + lab[1]).toFixed(1)}" y="${(y + lab[2]).toFixed(1)}" text-anchor="${lab[3]}">${lab[0]}</text>`;
  }
  return s + '</svg>';
}

const hhmm = (ms, off) => { const d = new Date(ms + off * 3600e3); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

// ---------- панель «Маршрут» ----------
export function routeHtml(a) {
  const ms = a.nowMs(), car = carAt(ms, live.state), off = tzAt(car.km);
  // ближайшие города впереди: расстояние грубо, до 50 км — точного места не выдаём
  const next = car.status === 'done' ? [] : STOPS.filter((s) => s.km > car.km).slice(0, 4);
  const rows = next.map((s) => `<tr><td>${s.name}</td><td>≈ ${Math.max(50, Math.round((s.km - car.km) / 50) * 50)} км</td></tr>`).join('');
  const title = car.status === 'soon' ? 'Старт скоро' : car.status === 'done' ? 'Доехали!' : `${car.segFrom.name} → ${car.segTo.name}`;
  return `<div class="card bam-map">${mapSvg(car)}</div>
    <div class="card"><h3>${title}</h3>
      <p>${whereLine(car)}</p>
      <p class="label">Местное время у Давида ${hhmm(ms, off)} (UTC+${off}). Показываем участок между крупными городами, с задержкой: днём ~70 км/ч, ночью машина стоит.</p></div>
    ${rows ? `<div class="card"><h3>Ближайшие города</h3><table class="bam-tt">${rows}</table>
      <p class="label">Расстояние — примерное, по модели движения.</p></div>` : ''}`;
}

// Для карточки на столе: та же проекция, вписанная в маленький прямоугольник
export function miniPoints(x0, y0, w, h) {
  const sx = w / MAP_W, sy = h / MAP_H;
  return { at: (km) => { const [x, y] = xyKm(km); return [x0 + x * sx, y0 + y * sy]; } };
}
