// Поездка: схема маршрута (панель «Маршрут» и карточка на столе), личный пробег и значки.
// Пробег и значки — удобство одного зрителя: хранятся в его браузере (store движка, lg:*).

import { trainAt, placeAt, upcoming, whereLine, STOPS, TUNNELS, BRIDGES, KM1, tzAt } from './route.js';

export const BADGES = [
  { id: 'km100', name: 'Первые 100 км', hint: 'проехать с поездом 100 км' },
  { id: 'km1000', name: 'Тысяча километров', hint: 'проехать 1000 км' },
  { id: 'kmall', name: 'Весь БАМ', hint: 'проехать 4287 км — длину всей магистрали' },
  { id: 'tunnel', name: 'В темноте тоннеля', hint: 'быть в поезде, пока он идёт тоннелем' },
  { id: 'severomuysky', name: 'Под Северо-Муйским хребтом', hint: 'проехать Северомуйский тоннель — самый длинный в России' },
  { id: 'baikal', name: 'Байкал за окном', hint: 'увидеть Байкал у Северобайкальска' },
  { id: 'bridge', name: 'Над большой рекой', hint: 'проехать по мосту через Лену, Зею или Амур' },
  { id: 'night', name: 'Ночной поезд', hint: 'ехать глубокой ночью, с часу до четырёх' },
  { id: 'zones', name: 'Три часовых пояса', hint: 'побывать в поясах UTC+8, +9 и +10' },
  { id: 'terminus', name: 'Конечная', hint: 'застать поезд в Тайшете или в Советской Гавани' },
];

// ---------- проекция для схемы: долгота/широта → x/y ----------
const LON0 = 96.5, LAT0 = 57.8, KX = 0.6 * 20, KY = 20; // cos(53°) ≈ 0.6; север обрезан по самой северной станции
const px = (lon) => (lon - LON0) * KX, py = (lat) => (LAT0 - lat) * KY;
export const MAP_W = 558, MAP_H = 196; // до 143° в. д., чтобы пролив было видно
// Очертания — схематичные, для узнаваемости, не для навигации
const BAIKAL = [[51.72, 103.7], [51.5, 104.3], [51.85, 105.6], [52.3, 106.4], [52.6, 106.9], [53.1, 107.7], [53.6, 108.6], [54.4, 109.2], [55.1, 109.4], [55.75, 109.6], [55.7, 109.05], [55.0, 108.4], [54.4, 108.0], [53.6, 107.2], [53.0, 106.4], [52.4, 105.6], [51.9, 104.6]];
const COAST = [[58.5, 141.6], [53.3, 141.4], [52.0, 141.2], [51.0, 140.7], [50.0, 140.5], [49.0, 140.35], [48.0, 139.9], [47.5, 139.5]];
// Подписи крупных станций: [текст, dx, dy, выравнивание] — разнесены, чтобы не налезали
const LABELED = {
  0: ['Тайшет', -4, -9, 'start'], 326: ['Братск', 0, 16, 'middle'], 713: ['Усть-Кут', 0, -9, 'middle'],
  1063: ['Северобайкальск', 4, 17, 'middle'], 1469: ['Таксимо', 0, -9, 'middle'], 2348: ['Тында', -8, 5, 'end'],
  3298: ['Новый Ургал', 0, -9, 'middle'], 3819: ['Комсомольск-на-Амуре', -6, 17, 'middle'], 4287: ['Советская Гавань', -8, 5, 'end'],
};

// Точка на линии по километру (между станциями — по прямой, как в placeAt)
const xyKm = (km) => { const p = placeAt(km); return [px(p.lon), py(p.lat)]; };

function mapSvg(tr) {
  const pts = (arr) => arr.map(([la, lo]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(' ');
  const line = (k0, k1) => STOPS.filter((s) => s.km > k0 && s.km < k1).map((s) => s.km);
  const path = (k0, k1) => [k0, ...line(k0, k1), k1].map((k) => xyKm(k).map((v) => v.toFixed(1)).join(',')).join(' ');
  // пройдено — с той стороны, откуда поезд едет
  const [a, b] = tr.dir > 0 ? [0, tr.km] : [tr.km, KM1];
  const [cx, cy] = xyKm(tr.km);
  let s = `<svg class="bam-svg" viewBox="-10 -6 ${MAP_W + 20} ${MAP_H + 12}" role="img" aria-label="Схема БАМа: поезд у ${tr.next.gen}">`;
  s += `<polygon class="sea" points="${pts(COAST)} ${MAP_W + 10},${MAP_H + 6} ${MAP_W + 10},-6"/>`;
  s += `<polygon class="lake" points="${pts(BAIKAL)}"/>`;
  s += `<text class="water" x="${px(106.3)}" y="${py(52.2)}">Байкал</text><text class="water" transform="translate(${px(142.4)} ${py(54.2)}) rotate(90)" text-anchor="middle">Татарский пролив</text>`;
  s += `<polyline class="rest" points="${path(0, KM1)}"/>`;
  s += `<polyline class="done" points="${path(a, b)}"/>`;
  for (const t of TUNNELS) { const [x, y] = xyKm((t.km0 + t.km1) / 2); s += `<rect class="tun" x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6"><title>${t.name}</title></rect>`; }
  for (const r of BRIDGES) { const [x, y] = xyKm(r.km0); s += `<path class="brg" d="M${(x - 4).toFixed(1)} ${(y + 5).toFixed(1)}h8"><title>${r.name}</title></path>`; }
  for (const st of STOPS) {
    const [x, y] = xyKm(st.km), lab = LABELED[st.km];
    s += `<circle class="st${lab ? ' big' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${lab ? 3.4 : 2.2}"><title>${st.name}, ${st.km} км</title></circle>`;
    if (lab) s += `<text x="${(x + lab[1]).toFixed(1)}" y="${(y + lab[2]).toFixed(1)}" text-anchor="${lab[3]}">${lab[0]}</text>`;
  }
  s += `<circle class="train-halo" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="10"/><circle class="train" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5"/>`;
  return s + '</svg>';
}

const hhmm = (ms, off) => { const d = new Date(ms + off * 3600e3); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
function inTime(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `через ${m} мин`;
  const h = Math.floor(m / 60);
  return h < 24 ? `через ${h} ч ${m % 60} мин` : `через ${Math.floor(h / 24)} д ${h % 24} ч`;
}

// ---------- личный пробег и значки ----------
const KEY = 'bam:ride';
let api = null;
const load = () => ({ km: 0, badges: [], zones: [], lastKm: null, lastAt: 0, ...(api?.().store.get(KEY, {}) || {}) });

function tick() {
  const a = api?.();
  if (!a || !a.live) return; // в машине времени не считаем
  const now = Date.now(), tr = trainAt(now), r = load();
  if (r.lastKm != null && now - r.lastAt < 120e3) r.km += Math.abs(tr.km - r.lastKm);
  r.lastKm = tr.km; r.lastAt = now;
  const off = tzAt(tr.km);
  if (!r.zones.includes(off)) r.zones.push(off);
  const h = new Date(now + off * 3600e3).getUTCHours();
  const earn = [];
  if (r.km >= 100) earn.push('km100');
  if (r.km >= 1000) earn.push('km1000');
  if (r.km >= KM1) earn.push('kmall');
  if (tr.tunnel) earn.push('tunnel');
  if (tr.tunnel?.id === 'severomuysky' && tr.km > tr.tunnel.km0 + 7 && tr.km < tr.tunnel.km1 - 7) earn.push('severomuysky'); // середина тоннеля
  if (tr.km > 1056 && tr.km < 1100) earn.push('baikal');
  if (tr.bridge) earn.push('bridge');
  if (h >= 1 && h < 4 && tr.speed > 0) earn.push('night');
  if ([8, 9, 10].every((z) => r.zones.includes(z))) earn.push('zones');
  if (tr.at && (tr.at.km === 0 || tr.at.km === KM1)) earn.push('terminus');
  for (const id of earn) {
    if (r.badges.includes(id)) continue;
    r.badges.push(id);
    const b = BADGES.find((x) => x.id === id);
    a.toast(`Новый значок поездки: «${b.name}». Все значки — на схеме маршрута на столе.`);
  }
  a.store.set(KEY, r);
}

export function init(getApi) {
  api = getApi;
  tick();
  setInterval(tick, 5000);
}

// ---------- расписание движения: как листок в рамке у купе проводника ----------
function timetable(ms, tr) {
  const order = tr.dir > 0 ? STOPS : [...STOPS].reverse(), end = order[order.length - 1];
  const fut = [];
  for (const u of upcoming(ms, STOPS.length * 2)) { fut.push(u); if (u.st === end) break; }
  const futMap = new Map(fut.map((u) => [u.st, u]));
  const rows = order.map((st, i) => {
    const off = tzAt(st.km), u = futMap.get(st), first = i === 0, last = st === end;
    if (tr.at === st) {
      const dep = ms + tr.departIn * 1000;
      return `<tr class="now"><td>${st.name} <small>стоим</small></td><td>${tr.dir > 0 ? st.km : KM1 - st.km}</td><td>—</td><td>${st.dwell}</td><td>${last ? '—' : hhmm(dep, off)}</td></tr>`;
    }
    if (!u) return `<tr class="past"><td>${st.name}</td><td>${tr.dir > 0 ? st.km : KM1 - st.km}</td><td colspan="3">проследовали</td></tr>`;
    return `<tr${u === fut[0] ? ' class="next"' : ''}><td>${st.name}</td><td>${tr.dir > 0 ? st.km : KM1 - st.km}</td><td>${first ? '—' : hhmm(u.at, off)}</td><td>${last || first ? '' : st.dwell}</td><td>${last ? '—' : hhmm(u.at + st.dwell * 60e3, off)}</td></tr>`;
  });
  // пройденные свернуть: начальная станция, «…», две последние перед текущей
  const firstLive = rows.findIndex((r) => !r.startsWith('<tr class="past"'));
  if (firstLive > 4) rows.splice(1, firstLive - 3, `<tr class="past"><td colspan="5">… ещё ${firstLive - 3} ${firstLive - 3 < 5 ? 'станции' : 'станций'} проследовали</td></tr>`);
  return `<div class="tt-sheet"><p class="tt-h">Расписание движения поезда</p><p class="tt-route">${order[0].name} — ${end.name}</p>
    <table class="tt"><thead><tr><th>Станция</th><th>км</th><th>Приб.</th><th>Стоянка, мин</th><th>Отпр.</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="tt-note">Время местное. Проводник предупредит о станции за полчаса.</p></div>`;
}

// ---------- панель «Маршрут» ----------
export function routeHtml(a) {
  const ms = a.nowMs(), tr = trainAt(ms), off = tzAt(tr.km), r = load();
  const done = tr.dir > 0 ? tr.km : KM1 - tr.km;
  const next = upcoming(ms, 5).map(({ st, at }) => `<tr><td>${st.name}</td><td>${hhmm(at, tzAt(st.km))}</td><td class="label">${inTime(at - ms)}</td></tr>`).join('');
  const badges = BADGES.map((b) => {
    const has = r.badges.includes(b.id);
    return `<div class="bam-badge${has ? ' on' : ''}"><i></i><span><b>${b.name}</b><small>${has ? 'получен' : b.hint}</small></span></div>`;
  }).join('');
  return `<div class="card tt-frame">${timetable(ms, tr)}</div>
    <div class="card bam-map">${mapSvg(tr)}</div>
    <div class="card"><h3>${tr.at ? `Стоянка: ${tr.at.name}` : `${tr.prev.name} → ${tr.next.name}`}</h3>
      <p>${whereLine(tr)}</p>
      <div class="bam-bar"><i style="width:${(done / KM1 * 100).toFixed(1)}%"></i></div>
      <p class="label">${Math.round(done)} из ${KM1} км · ${tr.dir > 0 ? 'на восток, к Советской Гавани' : 'на запад, к Тайшету'} · местное время ${hhmm(ms, off)} (UTC+${off})</p></div>
    <div class="card"><h3>Ближайшие станции</h3><table class="bam-tt">${next}</table>
      <p class="label">Время прибытия — местное для каждой станции.</p></div>
    <div class="card"><h3>Ваша поездка: ${Math.round(r.km)} км</h3>
      <p class="label">Километры копятся, пока окно открыто и эфир идёт в реальном времени. Хранятся только в этом браузере.</p>
      <div class="bam-badges">${badges}</div></div>`;
}

// Для карточки на столе: та же проекция, вписанная в маленький прямоугольник
export function miniPoints(x0, y0, w, h) {
  const sx = w / MAP_W, sy = h / MAP_H;
  return { at: (km) => { const [x, y] = xyKm(km); return [x0 + x * sx, y0 + y * sy]; } };
}
