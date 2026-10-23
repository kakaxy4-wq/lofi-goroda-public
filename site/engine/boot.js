// Загрузчик: город по адресу (/piter/, /kazan/…); корень — «Окно дня» (для стрима ?obs/?tour — последний город или Петербург).
// Переход в другой город — без перезагрузки страницы: старый город аккуратно снимается
// (обработчики, таймеры, звук, соединение), разметка возвращается к исходной, стартует новый.
// Так не слетает полноэкранный режим и эфир продолжает играть. При любой ошибке — обычный переход.
const CITIES = await (await fetch('cities/index.json', { cache: 'no-store' })).json();
const SHELL = document.body.innerHTML; // чистая разметка до старта города
const HEAD0 = document.title;

// ---------- учёт всего, что заводит город, чтобы потом снять ----------
let gen = 0;
const reg = [];
const track = (kind, a, b, c, d) => reg.push({ gen, kind, a, b, c, d });
const ET = EventTarget.prototype, addEL = ET.addEventListener;
ET.addEventListener = function (type, fn, opts) { if (recording) track('ev', this, type, fn, opts); return addEL.call(this, type, fn, opts); };
const sT = window.setTimeout.bind(window), sI = window.setInterval.bind(window), rAF = window.requestAnimationFrame.bind(window);
window.setTimeout = (fn, ms, ...a) => { const id = sT(fn, ms, ...a); if (recording) track('to', id); return id; };
window.setInterval = (fn, ms, ...a) => { const id = sI(fn, ms, ...a); if (recording) track('iv', id); return id; };
window.requestAnimationFrame = (cb) => { const g = gen; return rAF((t) => { if (g === gen) cb(t); }); }; // кадры старого города просто перестают идти
const wrapCtor = (name, kind) => {
  const C = window[name];
  if (!C) return;
  const W = function (...a) { const o = new C(...a); if (recording) track(kind, o); return o; };
  W.prototype = C.prototype; Object.setPrototypeOf(W, C);
  window[name] = W;
};
wrapCtor('WebSocket', 'ws'); wrapCtor('AudioContext', 'ac'); wrapCtor('webkitAudioContext', 'ac'); wrapCtor('ResizeObserver', 'ro'); wrapCtor('Audio', 'au');
let recording = true; // всё, что заводится после загрузчика, принадлежит текущему городу (свои обработчики загрузчик ставит в обход)

function dispose() {
  const mine = reg.filter((r) => r.gen === gen);
  for (const r of mine) {
    try {
      if (r.kind === 'ws') { r.a.onclose = r.a.onerror = r.a.onmessage = r.a.onopen = null; r.a.close(); } // без переподключения
      else if (r.kind === 'ac') r.a.close();
      else if (r.kind === 'ro') r.a.disconnect();
      else if (r.kind === 'au') { r.a.pause(); r.a.removeAttribute('src'); r.a.load(); }
    } catch {}
  }
  for (const r of mine) {
    try {
      if (r.kind === 'ev') r.a.removeEventListener(r.b, r.c, r.d);
      else if (r.kind === 'to') clearTimeout(r.a);
      else if (r.kind === 'iv') clearInterval(r.a);
    } catch {}
  }
  reg.splice(0, reg.length, ...reg.filter((r) => r.gen !== gen));
  gen++;
}

// Mini App: бот открывает сайт как /?tg=1 (или Telegram кладёт tgWebAppData в #). Только тогда подгружаем SDK (js/tg.js)
const IS_TG = new URLSearchParams(location.search).get('tg') === '1' || location.hash.includes('tgWebAppData');
if (IS_TG) document.documentElement.classList.add('tg');

const ROOT_ID = 'okno-dnya'; // главная (/) — «Окно дня»: город за шторой, один на день
const Q0 = new URLSearchParams(location.search), STREAM = Q0.has('obs') || Q0.has('tour'); // стриму игра не нужна
const entryFor = (path) => {
  const seg = path.split('/').filter(Boolean)[0];
  if (!seg && !STREAM) { const r = CITIES.find((c) => c.id === ROOT_ID && c.enabled); if (r) return r; }
  return CITIES.find((c) => c.id === seg && c.enabled) || CITIES.find((c) => c.enabled && !c.hidden);
};

async function launch(entry) {
  const [{ default: city }, { start }] = await Promise.all([import(`../cities/${entry.id}/index.js`), import('./app.js')]);
  start(city, CITIES);
}

// Подменить «шапку» страницы: заголовок, описание, превью, канонический адрес
function setHead(entry) {
  document.title = entry.title || HEAD0;
  const set = (sel, attr, v) => { const m = document.querySelector(sel); if (m && v) m.setAttribute(attr, v); };
  set('meta[name="description"]', 'content', entry.description);
  set('meta[property="og:title"]', 'content', entry.title);
  set('meta[property="og:description"]', 'content', entry.description);
  set('meta[property="og:url"]', 'content', `https://lofi-goroda.ru/${entry.id}/`);
  set('meta[property="og:image"]', 'content', `https://lofi-goroda.ru/${entry.og}`);
  set('link[rel="canonical"]', 'href', `https://lofi-goroda.ru/${entry.id}/`);
}

let switching = false;
async function switchTo(id, push = true) {
  const entry = CITIES.find((c) => c.id === id && c.enabled);
  if (!entry || switching) return false;
  switching = true;
  const wasPlaying = document.querySelector('#play')?.getAttribute('aria-label') === 'Пауза';
  try {
    await import(`../cities/${entry.id}/index.js`); // сначала загрузить новый город — пока грузится, старый ещё играет
    dispose();
    document.body.innerHTML = SHELL;
    document.body.className = '';
    scrollTo(0, 0);
    const q0 = new URLSearchParams(location.search), q1 = new URLSearchParams(); // стриму важно пережить перезагрузку: ?obs, ?tour и ?tg остаются
    for (const k of ['obs', 'tour', 'tg']) if (q0.has(k)) q1.set(k, q0.get(k));
    if (IS_TG) q1.set('tg', '1'); // признак мог прийти только в #tgWebAppData — дальше держим его в адресе
    const keep = q1.toString() ? '?' + q1.toString().replace(/=(&|$)/g, '$1') : '';
    if (push) history.pushState({ city: id }, '', `/${id}/${keep}`);
    setHead(entry);
    await launch(entry);
    if (wasPlaying) setTimeout(() => (window.__lofiAutoPlay ? window.__lofiAutoPlay() : document.querySelector('#play')?.click()), 50); // эфир продолжается уже в новом городе
    return true;
  } catch (e) {
    console.error(e);
    location.href = `/${id}/`; // не получилось на месте — обычный переход
    return false;
  } finally { switching = false; }
}

// Ссылки на города внутри сайта (меню городов, «О проекте») — без перезагрузки
addEL.call(document, 'click', (e) => {
  const a = e.target.closest?.('a[href]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin) return;
  const seg = u.pathname.split('/').filter(Boolean);
  if (seg.length !== 1 || !CITIES.some((c) => c.id === seg[0] && c.enabled)) return;
  e.preventDefault();
  if (seg[0] !== entryFor(location.pathname).id) switchTo(seg[0]);
});
addEL.call(window, 'popstate', () => { const en = entryFor(location.pathname); switchTo(en.id, false); });

// ---------- тур по городам: каждые N минут — следующий город, эфир не прерывается ----------
// Включается в меню городов (запоминается) или адресом ?tour=15 (для стрима, не запоминается)
const TOUR_KEY = 'lg:tour';
const tourLoad = () => { try { return JSON.parse(localStorage.getItem(TOUR_KEY)) || null; } catch { return null; } };
const urlTour = Number(new URLSearchParams(location.search).get('tour'));
let tour = urlTour >= 1 && urlTour <= 240 ? { on: true, min: urlTour, temp: true } : tourLoad() || { on: false, min: 15 };
let tourNext = Date.now() + tour.min * 60e3;
const tourSave = () => { if (!tour.temp) try { localStorage.setItem(TOUR_KEY, JSON.stringify({ on: tour.on, min: tour.min })); } catch {} };
const nextCity = () => {
  const list = CITIES.filter((c) => c.enabled && !c.hidden), cur = entryFor(location.pathname).id;
  return list[(list.findIndex((c) => c.id === cur) + 1) % list.length];
};
const say = (text) => window.__lofiToast?.(text);
// Листать города как станции: свайп по плееру на телефоне, клавиши [ и ] на компьютере
window.__lofiStep = (d) => {
  const list = CITIES.filter((c) => c.enabled && !c.hidden), cur = entryFor(location.pathname).id;
  const nx = list[(list.findIndex((c) => c.id === cur) + d + list.length) % list.length];
  tourNext = Date.now() + tour.min * 60e3;
  return switchTo(nx.id); // название города и так видно в шапке — без лишнего сообщения
};
window.__lofiTour = {
  get on() { return tour.on; }, get min() { return tour.min; },
  get next() { return nextCity().name; }, get leftMin() { return Math.max(1, Math.round((tourNext - Date.now()) / 60e3)); },
  start(min) { tour = { on: true, min }; tourNext = Date.now() + min * 60e3; tourSave(); say(`Тур по городам: каждые ${min} мин. Следующий — ${nextCity().name}.`); },
  stop() { tour = { ...tour, on: false, temp: false }; tourSave(); say('Тур по городам остановлен.'); },
};
sI(async () => {
  if (!tour.on || switching || Date.now() < tourNext) return;
  if (document.querySelector('#panel:not([hidden])') || document.querySelector('.modal')) { tourNext = Date.now() + 60e3; return; } // человек что-то читает — подождать минуту
  const nx = nextCity();
  tourNext = Date.now() + tour.min * 60e3;
  if (await switchTo(nx.id)) sT(() => say(`Тур: ${nx.name}. Следующий город — ${nextCity().name}, через ${tour.min} мин.`), 1200);
}, 5000);
addEL.call(document, 'click', (e) => { if (e.target.closest?.('.city-menu a')) tourNext = Date.now() + tour.min * 60e3; }, true); // выбрали город сами — отсчёт заново

// Главная (/) — «Окно дня». Для стрима (?obs, ?tour) — последний город, где человек был; новичку — Санкт-Петербург
let first = entryFor(location.pathname);
if (!location.pathname.split('/').filter(Boolean).length && first.id !== ROOT_ID) {
  let last = null; try { last = JSON.parse(localStorage.getItem('lg:lastCity')); } catch {}
  const en = CITIES.find((c) => c.id === last && c.enabled && !c.hidden);
  if (en) {
    window.__lofiWelcome = true;
    if (en.id !== first.id) { first = en; history.replaceState({ city: en.id }, '', `/${en.id}/${location.search}`); setHead(en); }
  }
}
if (IS_TG) { // SDK ставит свои обработчики на window — они не должны попасть в учёт города и сняться при смене города
  recording = false;
  try { await Promise.race([import('/js/tg.js').then((m) => m.init({ addEL, sI })), new Promise((ok) => sT(ok, 4000))]); } catch (e) { console.error(e); }
  recording = true;
}
await launch(first);
