// «Окно дня»: комната с задёрнутыми шторами, за окном — один город на день для всех. Его надо угадать
// по подсказкам (свет сквозь штору, звуки, погода, часы, градусник, щёлочка); угадали — шторы разъезжаются.
// Это обёртка над модулем настоящего города: всё, что выдаёт его до ответа (название, тосты, сувенир на
// подоконнике, бой курантов, названия треков), спрятано. Логика игры — engine/day.js, движок видит CITYMOD.day.

const CITIES = await (await fetch('cities/index.json', { cache: 'no-store' })).json();
// Кандидаты: настоящие города (не скрытые и не «движущиеся» окна — поезда и машина)
const MOVING = new Set(['bam', 'transsib', 'doroga', 'samolet']);
export const POOL = CITIES.filter((c) => c.enabled && !c.hidden && !MOVING.has(c.id) && !c.of && c.lat != null); // второе окно города (of) — не отдельный ответ

// Номер дня по Москве: одинаковый для всех слушателей; первый выпуск — 20.10.2026
const DAY0 = Date.UTC(2026, 9, 20);
export const dayIndex = (ms = Date.now()) => Math.floor((ms + 3 * 3600e3 - DAY0) / 864e5);
export const dayDate = (ms = Date.now()) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

// Порядок городов — перестановка по кругу: без повторов, пока не пройдёт весь список
function order(n, seed) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function cityOfDay(ms = Date.now()) {
  const d = dayIndex(ms), n = POOL.length, round = Math.floor(d / n);
  const ids = [...POOL].sort((a, b) => (a.id < b.id ? -1 : 1)); // от порядка в реестре не зависит
  return ids[order(n, 7919 * (round + 1))[((d % n) + n) % n]];
}

const pick = new URLSearchParams(location.search).get('day'); // ?day=kazan — проверить конкретный город
const entry = POOL.find((c) => c.id === pick) || cityOfDay();
const real = (await import(`../${entry.id}/index.js`)).default;
const state = { solved: false };

// Звуки, которые выдают город сразу (куранты, пушка, колокола), — только после ответа
const LOUD_TELLS = new Set(['chime', 'hours', 'cannon', 'bells', 'loco', 'snowmobile']);
// Названия звуков в панели тоже подсказки («Казанка», «Ветер с Волги») — до ответа общие слова
const GENERIC = { rain: 'Дождь', water: 'Вода за окном', wind: 'Ветер', city: 'Город вдали', gulls: 'Птицы', birds: 'Птицы', cat: 'Кот', tea: 'Ложечка в стакане' };
const hiddenList = real.sounds.list.filter((s) => GENERIC[s.id]).map((s) => ({ ...s, name: GENERIC[s.id], hint: s.id === 'cat' ? s.hint : 'узнаете после ответа' }));
const sounds = {
  ...real.sounds,
  genTitles: undefined,
  get list() { return state.solved ? real.sounds.list : hiddenList; },
  get tryButtons() { return state.solved ? real.sounds.tryButtons : []; },
  intro: 'Звуки за окном приглушены шторой — с подсказками их станет слышнее.',
  tick(e, api) {
    if (state.solved) return real.sounds.tick?.(e, api);
    const sfx = new Proxy(api.sfx, { get: (o, k) => (LOUD_TELLS.has(k) ? () => {} : o[k]) });
    return real.sounds.tick?.(e, { ...api, sfx });
  },
};

const skyline = { ...real.skyline };
delete skyline.drawSill; delete skyline.GUITAR; // сувенир на подоконнике и укулеле выдают город

export default {
  ...real,
  config: { ...real.config, id: 'okno-dnya', name: 'Окно дня', nameGen: 'дня', subtitle: 'угадайте город за шторой', radioName: 'Радио «Окно дня»', greet: 'Привет из окна дня', timePresets: [] },
  skyline,
  sounds,
  ticker: (e) => (state.solved ? real.ticker?.(e) || [] : []),
  places: { ...real.places, VAN: undefined, ROOM_HOTSPOTS: [] },
  labels: {},
  toasts: {},
  labelAt: undefined,
  onHotspot(id, api) {
    if (!state.solved && id === 'books') { api.toast('Путеводитель откроется, когда угадаете город.'); return true; }
    return real.onHotspot?.(id, api) || false;
  },
  playlistFor: undefined,
  get timeIntro() { return state.solved ? real.timeIntro : 'Время и погода у окна дня — настоящие. Какие именно — подскажут часы и градусник.'; },
  about: '<p>Окно дня: каждый день за шторой — один из городов Лофи-городов, один и тот же для всех. Угадайте его по подсказкам — свет, звуки, погода, часы, — и шторы откроются.</p>',
  day: { real: { ...entry, config: real.config }, state, pool: POOL, number: dayIndex() + 1, date: dayDate() },
};
