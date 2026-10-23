// Приложение: интерфейс, время, эфир, панели. Город приходит модулем (cities/<id>/index.js):
// start(city, cities) — всё городское берётся из city, здесь нет ни одного названия города.
import { sunPosition, moonPosition, moonPhase, nextSunCross } from './astro.js';
import { weather, refreshWeather, setManual, configureWeather, WEATHER_WORDS, WEATHER_KINDS, fogK } from './weather.js';
import { createScene, W, H, SILL as SILL_Y } from './scene.js';
import { createAudio } from './audio.js';
import { openCoinGame } from './games.js';
import { openTeaGame } from './tea.js';
import { icon, mountIcons } from './icons.js';
import { connectLive, plural } from './live.js';
import { secretAt } from './street.js';
import * as marsokhod from './marsokhod.js';
import { createHints } from './hints.js';
import { createGuitar, guitarKind, guitarRect } from './guitar.js';
import { createDay } from './day.js';
import * as souvenirs from './souvenirs.js';
import { guestAt, birdInfo } from './guests.js';

let ttfsSent = false; // время до первого звука — раз за загрузку страницы (она и есть сессия); вне start(): переживает смену города без перезагрузки

// Предметы комнаты — общие для всех городов
const ROOM_HOTSPOTS = [
  { id: 'chair', rects: [[0, 148, 34, 122], [12, 194, 72, 76]] }, // спинка с пледом; сиденье, подлокотник, полозья
  { id: 'yarn', rects: [[423, 228, 16, 12]] },
  { id: 'cat', rects: [[356, 218, 66, 20]] }, // только силуэт кота: выше на подоконнике — фигурки (Чижик),
  { id: 'player', rects: [[166, 219, 56, 23]] },
  { id: 'lamp', rects: [[104, 198, 36, 44]] },
  { id: 'tea', rects: [[304, 196, 20, 40]] },
  { id: 'books', rects: [[322, 222, 32, 18]] },
  { id: 'geranium', rects: [[396, 170, 30, 46]] },
];
const GARLAND_HOTSPOT = { id: 'garland', rects: [[30, 4, 422, 18]] };
const CURTAIN_HOTSPOT = { id: 'curtain', rects: [[0, 22, 30, 170], [450, 22, 30, 170]] }; // края штор; кресло и предметы — раньше в списке

export function start(CITYMOD, CITIES = []) {
const CITY = CITYMOD.config;
if (!CITYMOD.day) try { localStorage.setItem('lg:lastCity', JSON.stringify(CITYMOD.config.id)); } catch {} // «Просто слушать» из «Окна дня» откроет его
const cityClock = (ms) => new Date(ms + CITY.utcOffset * 3600e3); // UTC-поля = местное время города
const cityClockAt = (ms, off) => new Date(ms + off * 3600e3);
const hhmm = (d) => String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
// город может поменять очертания предметов комнаты (у поезда вместо кресла — полка)
const ROOM_RECTS = CITYMOD.places.ROOM_RECTS || {};
// гитара у окна стоит перед шторой и видом — её клик раньше мест города
const GUITAR_KIND = guitarKind(CITYMOD.skyline), GUITAR_HOTSPOT = GUITAR_KIND && { id: 'guitar', rects: [guitarRect(GUITAR_KIND)] };
const HOTSPOTS = [...(GUITAR_HOTSPOT ? [GUITAR_HOTSPOT] : []), ...CITYMOD.places.HOTSPOTS, ...ROOM_HOTSPOTS.map((h) => (ROOM_RECTS[h.id] ? { ...h, rects: ROOM_RECTS[h.id] } : h)), ...(CITYMOD.places.ROOM_HOTSPOTS || []), GARLAND_HOTSPOT, CURTAIN_HOTSPOT];
const { PLACES, PLACE_ORDER } = CITYMOD.places;
// Голос ведущего — только когда есть записанные фразы (tools/voice/recorder.py); синтез убран
const VOICE_ROW = { id: 'voice', name: 'Голос ведущего', hint: 'в начале часа: время и погода; в ноль — выключить' };
const VOICE_READY = false; // голос ведущего убран из эфира (22.10.2026, audio.js VOICE_ON) — строки и кнопки «Голос ведущего» не показываем
const CITY_SOUNDS = CITYMOD.sounds.list;
configureWeather(CITY.lat, CITY.lon);
// События по новостям: cities/<id>/data/events.json — [{ id, kind, date, from, to, title, text, source, url }]
let EVENTS = [];
fetch(`cities/${CITY.id}/data/events.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).then((d) => (EVENTS = Array.isArray(d) ? d : [])).catch(() => {});
const SECRETS = CITYMOD.skyline.SECRETS || [];
const VAN = CITYMOD.places.VAN || null; // линия, по которой в этом окне ездит Марсоход (engine/marsokhod.js); нет — окно его не знает
if (VAN) marsokhod.init(CITY.id);
const VAN_HOTSPOT = { id: 'marsokhod', rects: [[0, 0, 0, 0]] };
function activeEvent(local) {
  const force = new URLSearchParams(location.search).get('event');
  if (force) return { kind: force, title: 'Демонстрация события', text: '', source: '' };
  const day = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  const hm = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toMin = (s) => { const [h, m] = (s || '00:00').split(':').map(Number); return h * 60 + m; };
  return EVENTS.find((e) => e.date === day && hm >= toMin(e.from) && hm < toMin(e.to || '23:59')) || null;
}

const $ = (s) => document.querySelector(s);
// Контакты автора для «О проекте». Заполняет владелец.
const DONATE = { href: 'https://boosty.to/lofigoroda/donate', label: 'Угостить автора чаем ☕' }; // неявно: под чаем на столе
const CONTACTS = 'Автор в Телеграме: <a href="https://t.me/av_vor" target="_blank" rel="noopener">@av_vor</a>. Или через форму выше — отзывы читаем все.';
const trackEv = (name) => window.__live?.ev(name); // анонимная статистика нажатий (live.js)
const liveHttp = (path) => (['localhost', '127.0.0.1'].includes(location.hostname) ? `http://${location.hostname}:8766` : '') + path;
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('lg:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lg:' + k, JSON.stringify(v)); } catch {} },
};
if (params.has('obs')) document.body.classList.add('obs');
$('[data-panel="places"]').dataset.tip = `Места ${CITY.nameGen}`; // подсказка у кнопки — под текущий город
$('h1').textContent = CITY.name; $('#subtitle').textContent = CITY.subtitle; $('#npTitle').textContent = CITY.radioName;
if ($('#aboutLine')) { // «что за окном» — описание из реестра городов и ссылка на историю
  const meta = CITIES.find((c) => c.id === CITY.id);
  $('#aboutText').textContent = meta?.description || `Лофи-радио ${CITY.nameGen}.`;
  $('#aboutLink').href = `/${CITY.id}/o-gorode/`;
  $('#aboutLink').textContent = `Всё об окне ${meta?.nameGen || CITY.nameGen} →`;
}
$('#scene').setAttribute('aria-label', `${CITY.name}: ${CITY.subtitle}`);
{ // выбор города: название — кнопка, по клику список всех городов (текущий отмечен)
  const all = CITIES.filter((c) => c.enabled && (!c.hidden || c.id === CITY.id));
  if (all.length > 1) {
    const h1 = $('h1');
    h1.innerHTML = `<button class="city-pick" type="button" aria-haspopup="true" aria-expanded="false" title="Другие города">${CITY.name}<span class="caret" aria-hidden="true"></span></button>`;
    // соседние города одной кнопкой (то же, что [ и ] или свайп по плееру)
    const at = all.findIndex((c) => c.id === CITY.id), nb = (d) => all[(at + d + all.length) % all.length];
    h1.insertAdjacentHTML('beforeend', `<span class="city-step"><button type="button" data-step="-1" aria-label="Предыдущий город: ${nb(-1).name}" title="${nb(-1).name} ( [ )">‹</button><button type="button" data-step="1" aria-label="Следующий город: ${nb(1).name}" title="${nb(1).name} ( ] )">›</button></span>`);
    h1.querySelectorAll('[data-step]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); trackEv('step:' + b.dataset.step); if (window.__lofiStep) window.__lofiStep(+b.dataset.step); else location.href = `/${nb(+b.dataset.step).id}/`; }));
    const btn = h1.firstChild, menu = document.createElement('nav');
    menu.className = 'city-menu px'; menu.hidden = true; menu.setAttribute('aria-label', 'Города');
    // поиск по названию: городов много — сверху поле, список фильтруется по мере ввода, Enter — первый найденный
    // у каждого города — время там и пояс относительно Москвы; поезд едет через пояса — «в пути»
    const msk = (u) => (u === 3 ? 'МСК' : `МСК${u > 3 ? '+' : '−'}${Math.abs(u - 3)}`);
    const tzLine = (c) => (c.utc == null ? 'в пути' : `${hhmm(cityClockAt(Date.now(), c.utc))} · ${msk(c.utc)}`);
    menu.innerHTML = `<input class="city-search" type="search" placeholder="Найти город" aria-label="Найти город" autocomplete="off"><p class="city-you"></p>` + all.map((c) => c.id === CITY.id
      ? `<a href="/${c.id}/" data-n="${c.name}" aria-current="page">${c.name}<span class="ct" data-utc="${c.utc ?? ''}">${tzLine(c)}</span><small>вы здесь</small></a>`
      : `<a href="/${c.id}/" data-n="${c.name}">${c.name}<span class="ct" data-utc="${c.utc ?? ''}">${tzLine(c)}</span><small>→</small></a>`).join('') + '<div class="city-tour"></div>';
    const youLine = () => { // время там, где открыт браузер, — чтобы сравнить с городами
      const off = -new Date().getTimezoneOffset() / 60;
      menu.querySelector('.city-you').textContent = `У вас ${hhmm(cityClockAt(Date.now(), off))}` + (Number.isInteger(off) ? ` · ${msk(off)}` : '');
      menu.querySelectorAll('.ct[data-utc]').forEach((el) => { if (el.dataset.utc !== '') el.textContent = tzLine({ utc: +el.dataset.utc }); });
    };
    document.body.appendChild(menu);
    // тур по городам: города сменяют друг друга сами, эфир не прерывается
    const tourBox = menu.querySelector('.city-tour'), T = window.__lofiTour;
    const drawTour = () => {
      if (!T) { tourBox.hidden = true; return; }
      tourBox.innerHTML = T.on
        ? `<span>Тур: ${T.next} через ${T.leftMin} мин</span><button type="button" data-tour="stop">Стоп</button>`
        : '<span>Тур по городам, каждые</span>' + [10, 15, 30].map((m) => `<button type="button" data-tour="${m}">${m} мин</button>`).join('');
    };
    tourBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]'); if (!b) return;
      e.stopPropagation();
      if (b.dataset.tour === 'stop') T.stop(); else T.start(Number(b.dataset.tour));
      drawTour();
    });
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    const ALIASES = { piter: 'питер спб петербург ленинград', nnovgorod: 'нижний нн горький', ekaterinburg: 'екб екат свердловск', bam: 'поезд байкал тында', vnovgorod: 'новгород', vladivostok: 'влад', krasnodar: 'кубань' };
    const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');
    const filter = (v) => {
      const k = norm(v);
      menu.querySelectorAll('a').forEach((a) => (a.hidden = !!k && !norm((a.dataset.n || '') + ' ' + (ALIASES[a.getAttribute('href').replace(/\//g, '')] || '')).includes(k)));
    };
    menu.addEventListener('input', (e) => { if (e.target.classList.contains('city-search')) filter(e.target.value); });
    menu.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('city-search')) return;
      if (e.key === 'Enter') { const a = menu.querySelector('a:not([hidden])'); if (a) { e.preventDefault(); a.click(); } }
      if (e.key === 'ArrowDown') { e.preventDefault(); menu.querySelector('a:not([hidden])')?.focus(); }
      if (e.key === 'Escape') { close(); btn.focus(); }
      e.stopPropagation(); // буквы в поле — не горячие клавиши сайта
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menu.hidden) return close();
      const r = btn.getBoundingClientRect();
      menu.style.left = `${Math.max(8, r.left - 6)}px`; menu.style.top = `${r.bottom + 6}px`; menu.style.maxHeight = `${innerHeight - r.bottom - 24}px`; // низкий экран — список прокручивается
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); youLine();
      const q = menu.querySelector('.city-search');
      q.value = ''; filter(''); drawTour();
      if (matchMedia('(hover: hover)').matches) q.focus({ preventScroll: true }); // на телефоне клавиатура сама не выскакивает
      else menu.querySelector('a:not([aria-current])')?.focus({ preventScroll: true });
    });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
  } else $('h1').textContent = CITY.name;
}

// ---------- время: реальное или «машина времени» ----------
const clock = { base: null, setAt: 0, rate: 1, rateUntil: 0 };
const FREEZE = params.has('freeze'); // стоп-кадр для визуальных тестов: время не идёт
function nowMs() {
  if (clock.base == null) return Date.now();
  if (FREEZE) return clock.base;
  if (clock.rate !== 1 && Date.now() > clock.rateUntil) { clock.base += (clock.rateUntil - clock.setAt) * clock.rate; clock.setAt = clock.rateUntil; clock.rate = 1; } // ускорение закончилось
  return clock.base + (Date.now() - clock.setAt) * clock.rate;
}
function timelapse(rate, seconds) { const now = nowMs(); clock.base = now; clock.setAt = Date.now(); clock.rate = rate; clock.rateUntil = Date.now() + seconds * 1000; }
function jumpTo(dateStr, minutes) {
  // dateStr 'YYYY-MM-DD' по времени города, minutes — от полуночи города
  const d = dateStr ? dateStr.split('-').map(Number) : null;
  const loc = cityClock(Date.now());
  const [y, m, dd] = d || [loc.getUTCFullYear(), loc.getUTCMonth() + 1, loc.getUTCDate()];
  const at = (off) => Date.UTC(y, m - 1, dd) - off * 3600e3 + minutes * 60e3;
  clock.base = at(CITY.utcOffset);
  // у поезда часовой пояс зависит от момента: пересчитываем по поясу в целевой точке
  const off = CITYMOD.locate?.(clock.base)?.utcOffset;
  if (off != null) clock.base = at(CITYMOD.locate(at(off)).utcOffset);
  clock.setAt = Date.now(); clock.rate = 1;
  $('#timeBadge').hidden = false;
}
function backToNow() { clock.base = null; clock.rate = 1; $('#timeBadge').hidden = true; if (!panel.hidden && panel.dataset.kind === 'time') openPanel('time'); }
const parseHM = (s) => { const [h, m, sec] = s.split(':').map(Number); return h * 60 + m + (sec || 0) / 60; };
const isoDate = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
{ // параметры адреса — только корректные значения
  const t = params.get('t'), d = params.get('d'), wx = params.get('wx');
  const okT = t && /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t), okD = d && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d);
  if (okT || okD) jumpTo(okD ? d : '', okT ? parseHM(t) : 12 * 60);
  else if (params.has('freeze')) jumpTo('', 12 * 60); // стоп-кадру нужна точка отсчёта
  if (wx && WEATHER_KINDS.includes(wx)) setManual(wx);
}

// ---------- окружение кадра ----------
let torchUntil = 0;
const peek = { id: null, until: 0 }; // «Подсмотреть» секрет: показать его в окне на 30 с
const foundKey = `secrets:${CITY.id}`;
const found = new Set(store.get(foundKey, []));
const room = { lamp: store.get('lamp', null), garland: store.get('garland', true), rockUntil: 0, curtain: store.get('curtain', false), curtainK: store.get('curtain', false) ? 1 : 0 };
const mem = { mix: store.get('mix', {}), voted: store.get('voted', null), voting: false, mood: store.get('mood', null) };
const lampAuto = (sun) => sun.alt < 4 || ['rain', 'storm', 'fog', 'snow'].includes(weather.kind);
let audio = null, dial = 0.3, track = null, catPetAt = -99, waterAt = -99, waterCount = null, yarnAt = -99, teaAt = -99;
// гитара у окна (engine/guitar.js): звук — через эфир (тональность, доли), аккорд — соседям по live-каналу
const guitar = GUITAR_KIND && createGuitar({
  getAudio: () => audio, kind: GUITAR_KIND,
  onJam: (d) => window.__live?.jam(d),
  onEgg: () => { trackEv('guitar:egg'); toast('Три аккорда — и весь двор подпевает. Елисей на всякий случай ушёл на кухню.'); },
});
window.__lofiGuitar = guitar; // тестам (tests/ui_test.js)
// Полка сувениров (engine/souvenirs.js): вещица города — за 10 минут эфира в нём или за угаданное «Окно дня»
const capFirst = (x) => x[0].toUpperCase() + x.slice(1);
function giveSouvenir(id) {
  if (!souvenirs.collect(id)) return;
  const c = CITIES.find((e) => e.id === id);
  trackEv('souvenir:' + id);
  setTimeout(() => toast(`На подоконник — ${souvenirs.SOUVENIRS[id].name} из ${c?.nameGen || c?.name}. Собрано ${souvenirs.count()} из ${souvenirs.total()}: за каждое окно, где вы послушали эфир, — своя вещица.`), 2500);
}
{ // 10 минут эфира в окне (вкладка на экране) — его сувенир на полку
  let heard = 0;
  setInterval(() => { if (audio?.playing && !document.hidden && !CITYMOD.day && (heard += 15) >= 600) giveSouvenir(CITY.id); }, 15000);
}
// «Окно дня» (cities/okno-dnya): город за шторой надо угадать; до ответа шторы задёрнуты, звуки приглушены
const DAY = CITYMOD.day ? createDay({
  CITYMOD, store, toast, trackEv, getAudio: () => audio, cityClock, hhmm,
  onSolve(ok) {
    if (ok) giveSouvenir(CITYMOD.day.real.id);
    const R = CITYMOD.day.real.config, pick = document.querySelector('h1 .city-pick');
    if (pick?.firstChild) pick.firstChild.textContent = R.name; else $('h1').textContent = R.name;
    $('#subtitle').textContent = R.subtitle;
    const meta = CITIES.find((c) => c.id === R.id);
    if ($('#aboutLine') && meta) { $('#aboutText').textContent = meta.description; $('#aboutLink').href = `/${R.id}/o-gorode/`; $('#aboutLink').textContent = `Всё об окне ${meta.nameGen} →`; }
    if (track) $('#npTitle').textContent = track.kind === 'gen' ? `«${track.title}»` : track.title;
  },
}) : null;
if (DAY && !DAY.solved) room.curtainK = 1; // задёрнуты с первого кадра, без «закрывания» при загрузке
window.__lofiDay = DAY; // тестам
// Корги в гостях: приходит посидеть в кресле-качалке на несколько минут. Впервые — вскоре после открытия окна
const corgi = { visit: null, petAt: -99, next: nowMs() / 1000 + 15 + Math.random() * 15 }; // в каждый заход — в первые полминуты
const onCorgi = (x, y) => x >= 16 && x < 70 && y >= 188 && y < 230; // сама корги на подушке; спинка и полозья — качать
const corgiHere = () => { const s = nowMs() / 1000; return !!corgi.visit && s >= corgi.visit.arrive + 1.2 && s <= corgi.visit.leave; };
// Движущийся «город» (поезд): координаты и часовой пояс меняются со временем; погоду — по новому месту
let wxAt = { lat: CITY.lat, lon: CITY.lon, t: 0 };
function locate(ms) {
  const p = CITYMOD.locate?.(ms);
  if (!p) return;
  CITY.lat = p.lat; CITY.lon = p.lon; CITY.utcOffset = p.utcOffset;
  const far = Math.abs(p.lat - wxAt.lat) + Math.abs(p.lon - wxAt.lon) > 0.4, now = Date.now();
  if (far && now - wxAt.t > 60e3) { wxAt = { lat: p.lat, lon: p.lon, t: now }; configureWeather(p.lat.toFixed(2), p.lon.toFixed(2)); refreshWeather(); }
}
// Радуга после дождя: живая погода, дождь кончился, солнце невысоко, облака разошлись.
// Разгорается к 6-й минуте, держится до 18-й, тает к 25-й. ?rainbow=1 — форс для проверки.
function rainbowK(sun) {
  if (params.has('rainbow')) return 0.8;
  if (weather.source !== 'live' || !weather.afterRain) return 0;
  const min = (Date.now() - weather.afterRain) / 60000;
  if (min < 0 || min > 25 || sun.alt < 5 || sun.alt > 35 || weather.cloud > 70 || !['clear', 'cloudy'].includes(weather.kind)) return 0;
  if (min < 6) return min / 6;
  if (min < 18) return 1;
  return 1 - (min - 18) / 7;
}
// Ссылка на страницу «Всё об окне»: в «Окне дня» — только после ответа и на настоящий город
function storyLink(card = true) {
  const id = CITYMOD.day ? (DAY?.solved ? CITYMOD.day.real.id : null) : CITY.id;
  if (!id) return '';
  const gen = CITYMOD.day ? CITYMOD.day.real.nameGen : CITY.nameGen, p = `<p><a href="/${id}/o-gorode/" target="_blank" rel="noopener">Всё об окне ${gen} на одной странице →</a></p>`;
  return card ? `<div class="card">${p}</div>` : p;
}
const curtainTarget = () => (DAY ? DAY.curtain() : room.curtain ? 1 : 0);
function buildEnv(ms) {
  locate(ms);
  const local = cityClock(ms);
  const sun = sunPosition(ms, CITY.lat, CITY.lon);
  return {
    ms, local, weather,
    lat: CITY.lat, lon: CITY.lon, // звёздам нужен текущий пункт (у поезда он едет)
    sun,
    moon: moonPosition(ms, CITY.lat, CITY.lon),
    phase: moonPhase(ms),
    rainbow: rainbowK(sun),
    ...CITYMOD.env(ms, local), // мост, сезоны, лёд, матчи — у города
    torch: Date.now() < torchUntil,
    curtain: (room.curtainK += Math.sign(curtainTarget() - room.curtainK) * Math.min(0.04, Math.abs(curtainTarget() - room.curtainK))), // шторы едут ~1 с
    curtainClosed: DAY?.closedPx(),
    garland: room.garland,
    rock: Math.min(1, Math.max(0, (room.rockUntil - Date.now()) / 8000)) + (audio?.playing ? 0.12 : 0),
    playing: audio?.playing ?? false,
    dial: dial,
    catPetAt: catPetAt,
    yarnAt, teaAt, corgi: corgi.visit, corgiPetAt: corgi.petAt,
    waterAt: waterAt,
    bloom: waterCount == null ? null : Math.min(1, 0.15 + waterCount / 14), // общий полив за день → соцветия
    event: activeEvent(local),
    van: VAN ? marsokhod.vanState(VAN, ms, params.get('van')) : null, // Марсоход в кадре: ?van=1 — ехать сейчас, ?van=park — стоять
    rocket: params.has('rocket'), // ?rocket=1 — показать пуск ракеты сейчас (сумерки см. engine/rocket.js)
    forceSecret: Date.now() < peek.until ? peek.id : params.get('secret'),
    foundSecrets: found,
  };
}

// ---------- сцена ----------
const el = $('#scene');
const scene = createScene(el, CITYMOD);
// Сцена стоит над полкой управления. Масштаб — «заполнить», но так, чтобы строки 0…244
// (гирлянда и стол) всегда были видны; лишняя ширина — шторы по бокам.
// На узком экране окно шире телефона: по умолчанию в центр ставим главное место города
// (центр зоны первого места из PLACE_ORDER или CITY.focusX), а сдвиг пальцем запоминаем для каждого города.
const FOCUS_X = CITY.focusX ?? (() => {
  const { HOTSPOTS: hs = [], PLACE_ORDER: order = [] } = CITYMOD.places;
  const h = order.map((id) => hs.find((x) => x.id === id)).find(Boolean);
  return h ? h.rects[0][0] + h.rects[0][2] / 2 : W / 2;
})();
let pan = 0.5, userPan = store.get(`pan:${CITY.id}`, null), panExtra = 0;
function layout() {
  const dockH = document.querySelector('.dock').offsetHeight;
  document.documentElement.style.setProperty('--dock', dockH + 'px');
  const bw = innerWidth, bh = Math.max(120, innerHeight - dockH);
  const s = Math.min(Math.max(bw / W, bh / H), bh / 244);
  const w = W * s, h = H * s;
  panExtra = w - bw;
  if (userPan == null && panExtra > 0) pan = Math.min(1, Math.max(0, (FOCUS_X * s - bw / 2) / panExtra));
  else if (userPan != null) pan = userPan;
  el.style.width = w + 'px'; el.style.height = h + 'px';
  el.style.left = (w > bw ? -(w - bw) * pan : (bw - w) / 2) + 'px';
  el.style.top = (h > bh ? 0 : (bh - h) / 2) + 'px';
}
addEventListener('resize', layout);
new ResizeObserver(layout).observe(document.querySelector('.dock'));
layout();
let env = buildEnv(nowMs());
let lastFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (now - lastFrame < 1000 / 30) return; // 30 кадров хватает пиксель-арту и бережёт батарею
  lastFrame = now;
  env = buildEnv(nowMs());
  env.lampOn = room.lamp ?? lampAuto(env.sun);
  scene.render(env);
  $('#qLamp').classList.toggle('on', env.lampOn);
}
// ?record — покадровая отрисовка для промо-роликов: кадр на любой момент времени, без requestAnimationFrame
if (params.has('record')) {
  window.__lofiNow = nowMs;
  window.__lofiFrame = (ms) => { const e = buildEnv(ms); e.lampOn = room.lamp ?? lampAuto(e.sun); scene.render(e); return el; };
}

// ---------- эфир ----------
// Необязательно: модуль города может менять плейлист по ходу (Марсоход ловит местные волны) — CITYMOD.playlistFor(env)
let playlistPath = CITYMOD.playlistFor?.(env) || CITY.playlist, playlistPending = null;
const playlistReady = fetch(playlistPath, { cache: 'no-store' }).then((r) => r.json()).catch(() => []);
let playlistLoaded = null; playlistReady.then((p) => (playlistLoaded = p));
if (CITYMOD.playlistFor) setInterval(async () => {
  const path = CITYMOD.playlistFor(env);
  if (path === playlistPath) return;
  try {
    const p = await (await fetch(path, { cache: 'no-store' })).json();
    if (!Array.isArray(p) || !p.length) return;
    playlistPath = path;
    if (audio) playlistPending = p; // применим на ближайшей границе трека, чтобы не обрывать играющий
    else playlistLoaded = p;
  } catch {} // нет сети — остаёмся на прежней волне, повторим через минуту
}, 60e3);
function ensureAudioSync() { // синхронно: вызывается прямо в жесте пользователя
  if (audio) return audio;
  audio = createAudio(CITYMOD.sounds, { cityId: CITY.id, localHour: (ms) => cityClock(ms).getUTCHours() });
  audio.setSchedule(playlistLoaded || []);
  if (!playlistLoaded) playlistReady.then((p) => audio.setSchedule(p));
  wireAudio();
  return audio;
}
async function ensureAudio() { return ensureAudioSync(); }
function wireAudio() {
  audio.onTrack = (t) => {
    track = t;
    if (playlistPending) { const p = playlistPending; playlistPending = null; playlistLoaded = p; setTimeout(() => audio.setSchedule(p), 0); } // новая волна — с границы трека
    dial = t.count > 1 ? 0.1 + (t.index / (t.count - 1)) * 0.8 : 0.5;
    $('#npTitle').textContent = DAY?.maskTitle(t) ?? (t.kind === 'gen' ? `«${t.title}»` : t.title); // в «Окне дня» название трека выдало бы город
    $('#npSub').textContent = t.kind === 'gen' ? 'живая вставка · сочиняется в браузере прямо сейчас' : `${CITY.radioName} · ${t.night ? 'ночной эфир — до шести утра' : 'эфир синхронный для всех'}`;
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: DAY?.maskTitle(t) ?? t.title, artist: CITY.radioName, album: 'Лофи-города' });
  };
  audio.onSystemPause = () => { if (audio.playing) togglePlay(); }; // выдернули наушники — эфир на паузе, кнопка тоже
  audio.setMix(mem.mix);
  audio.setMusicVol(+$('#volMusic').value);
  audio.setCityVol(+$('#volCity').value);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => { if (!audio.playing) togglePlay(); });
    navigator.mediaSession.setActionHandler('pause', () => { if (audio.playing) togglePlay(); });
  }
}
let kickedAt = 0;
function togglePlay() {
  if (Date.now() - kickedAt < 800) return;
  const a = ensureAudioSync();
  if (a.playing) a.pause();
  else {
    // ▶ при выключенной музыке — человек хочет слушать: возвращаем прежнюю громкость, без второго подтверждения
    if (+$('#volMusic').value === 0) { musicMute.unmute(); toast('Звук включён'); }
    a.setCityVol(+$('#volCity').value); a.play();
    if (!ttfsSent) { // время до первого звука: от открытия страницы до первого включения, бакетом
      ttfsSent = true;
      const s = (Date.now() - performance.timeOrigin) / 1000;
      // последний бакет «300» (открытый сверху): «+» в именах событий запрещён (EV_NAME на сервере)
      trackEv('ttfs:' + (s < 5 ? '0-5' : s < 15 ? '5-15' : s < 60 ? '15-60' : s < 300 ? '60-300' : '300'));
    }
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = a.playing ? 'playing' : 'paused';
  $('#play').innerHTML = icon(a.playing ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', a.playing ? 'Пауза' : 'Включить эфир');
}
$('#play').onclick = togglePlay;
{ // обрезанное название трека: наведение или нажатие (телефон) — целиком в подсказке над строкой, высота полки не меняется
  let hideT = 0;
  const show = (n) => {
    if (n.scrollWidth <= n.clientWidth + 1) return false; // влезает — подсказка не нужна
    const tip = $('#tip'), r = n.getBoundingClientRect();
    tip.textContent = n.textContent; tip.classList.add('np-tip'); tip.hidden = false;
    tip.style.left = Math.max(12, Math.min(r.left, innerWidth - tip.offsetWidth - 12)) + 'px'; tip.style.top = r.top - 6 + 'px';
    return true;
  };
  const hide = () => { const tip = $('#tip'); if (tip.classList.contains('np-tip')) { tip.hidden = true; tip.classList.remove('np-tip'); } };
  for (const id of ['#npTitle', '#npSub']) {
    const n = $(id);
    n.addEventListener('mouseenter', () => show(n));
    n.addEventListener('mouseleave', hide);
    n.addEventListener('click', () => { clearTimeout(hideT); if (show(n)) hideT = setTimeout(hide, 4000); });
  }
}
// Эфир продолжается после перехода в другой город: запуск уже без жеста, и браузер может его не пустить.
// Тогда честно просим коснуться окна — первое же касание включит звук
window.__lofiAudioState = () => ({ playing: !!audio?.playing, blocked: !!audio?.blocked, ctx: audio?.ctx.state || null, pulse: audio?.pulse?.() || null }); // для tests/ui_test.js
let askingTouch = false;
function askTouch(text) { // звук не пустили без жеста — первое касание окна (или ▶, пробел) продолжит эфир
  if (askingTouch) return; askingTouch = true;
  toast(text);
  // касание ▶ или пробел/Enter — это «продолжить», а не «пауза»: иначе следом сработает togglePlay и эфир встанет
  const kick = (e) => { askingTouch = false; audio.kick(); if (e.target?.closest?.('#play') || (e.type === 'keydown' && ['Space', 'Enter', 'MediaPlayPause'].includes(e.code))) kickedAt = Date.now();
    for (const t of ['pointerdown', 'keydown']) document.removeEventListener(t, kick, true); };
  for (const t of ['pointerdown', 'keydown']) document.addEventListener(t, kick, true);
}
window.__lofiAutoPlay = () => {
  togglePlay();
  setTimeout(() => { if (audio?.blocked) askTouch('Браузер приостановил звук при переходе — коснитесь окна, и эфир продолжится.'); }, 1200);
};
// Вернулись на сайт после кружочка, голосового или звонка: audio.js продолжает эфир сам; если телефон не пустил — просим коснуться
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  setTimeout(() => { if (!document.hidden && audio?.blocked) askTouch('Телефон приостановил звук — коснитесь окна, и эфир продолжится.'); }, 3000);
});
$('#volMusic').oninput = (e) => { audio?.setMusicVol(+e.target.value); store.set('volMusic', +e.target.value); };
$('#volCity').oninput = (e) => { audio?.setCityVol(+e.target.value); store.set('volCity', +e.target.value); };
$('#volMusic').value = store.get('volMusic', 0.8);
$('#volCity').value = store.get('volCity', 0.7);
// Нота и город у ползунков: без звука и обратно, прежняя громкость запоминается
function setupMute(btnId, sliderId, apply) {
  const btn = $(btnId), sl = $(sliderId);
  let before = +sl.value || (sliderId === '#volMusic' ? 0.8 : 0.7);
  const sync = () => btn.setAttribute('aria-pressed', String(+sl.value === 0));
  btn.onclick = async () => {
    await ensureAudio();
    if (+sl.value > 0) { before = +sl.value; sl.value = 0; } else sl.value = before || 0.7;
    apply(+sl.value); sync();
    toast(+sl.value === 0 ? (btnId === '#muteMusic' ? 'Музыка без звука' : 'Город без звука') : 'Звук вернулся');
  };
  sl.addEventListener('input', sync); sync();
  return { unmute() { if (+sl.value === 0) { sl.value = before || 0.7; apply(+sl.value); sync(); } } };
}
const musicMute = setupMute('#muteMusic', '#volMusic', (v) => { audio?.setMusicVol(v); store.set('volMusic', v); });
setupMute('#muteCity', '#volCity', (v) => { audio?.setCityVol(v); store.set('volCity', v); });
// Горячие клавиши: по e.code, поэтому работают и в русской раскладке.
const KEY_NAMES = { Space: 'пробел', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5' };
const keyName = (code) => KEY_NAMES[code] || code.replace('Key', '');
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.code === 'Escape') { const m = document.querySelector('.modal .x'); if (m) m.click(); else panel.hidden = true; e.target.blur?.(); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if ((e.code === 'BracketLeft' || e.code === 'BracketRight') && window.__lofiStep) { window.__lofiStep(e.code === 'BracketRight' ? 1 : -1); return; } // [ и ] — соседний город
  if (document.querySelector('.modal')) return; // в мини-игре горячие клавиши молчат
  if ((e.code === 'Space' || e.code === 'Enter') && e.target.tagName === 'BUTTON') return; // кнопка в фокусе нажимается сама
  const b = document.querySelector(`[data-key="${e.code}"]`);
  if (!b || getComputedStyle(b).display === 'none') return; // спрятанная кнопка (в «Окне дня» до ответа) клавишей тоже не жмётся
  e.preventDefault();
  wake();
  b.click();
});
// Подсказки на кнопках: название и клавиша
document.querySelectorAll('[data-tip]').forEach((b) => {
  const text = () => `${b.dataset.tip}${b.dataset.key ? ` · ${keyName(b.dataset.key)}` : ''}`;
  b.setAttribute('aria-keyshortcuts', b.dataset.key ? keyName(b.dataset.key) : '');
  b.addEventListener('mouseenter', () => {
    const tip = $('#tip'), r = b.getBoundingClientRect(); tip.classList.remove('np-tip');
    tip.textContent = text(); tip.hidden = false;
    tip.style.left = r.left + r.width / 2 + 'px'; tip.style.top = r.top - 4 + 'px';
  });
  b.addEventListener('mouseleave', () => ($('#tip').hidden = true));
  b.addEventListener('click', () => ($('#tip').hidden = true));
});

// Звуки города идут и без музыки (после первого клика), события — по времени сцены
let prevMs = nowMs();
setInterval(() => {
  if (!audio) return;
  const e = buildEnv(nowMs());
  Object.assign(e, CITYMOD.audioEvents?.(e, prevMs) || {}); // разовые события города (пушка, гудок…)
  prevMs = e.ms;
  audio.update(e);
}, 250);

// ---------- бегущая строка «ведущего» ----------
let sunCache = { at: 0 };
function djLines() {
  const e = buildEnv(nowMs()), l = e.local, lines = []; // своё окружение: в фоне rAF спит
  const temp = Math.round(weather.temp);
  const gust = weather.gust ?? weather.wind * 1.5;
  let windTxt = weather.wind >= 7 ? `, ветер ${Math.round(weather.wind)} м/с ${CITY.windFrom || ''}` : '';
  if (gust >= 12) windTxt += `, порывы до ${Math.round(gust)}`;
  lines.push(`${CITY.name}, ${hhmm(l)}. ${temp > 0 ? '+' : ''}${temp}°, ${WEATHER_WORDS[weather.kind]}${windTxt.trimEnd()}.`);
  const bliz = weather.kind === 'snow' && (gust >= 10 || weather.wind >= 8), drift = weather.kind === 'snow' && !bliz && gust >= 6;
  if (weather.kind === 'storm') lines.push('Гроза над городом: сверкает за горизонтом, гром раскатами.');
  if (bliz) lines.push(`Метель: ветер ${Math.round(weather.wind)} м/с, порывы до ${Math.round(gust)}.`);
  else if (drift) lines.push('Позёмка: снег стелется по земле.');
  if (weather.kind === 'snow' && weather.temp > 0 && weather.temp < 3) lines.push('Мокрый снег: тает, не долетая до земли.');
  if (fogK(weather.kind, weather.vis) > 0.3) lines.push(`Туман: видимость ~${Math.round(weather.vis / 100) * 100} м.`);
  if (weather.freezing) lines.push('Гололёд: ледяная корка на тротуарах, осторожно на ступеньках.');
  lines.push(...CITYMOD.ticker(e));
  if (e.event?.text) lines.push(`${e.event.text}${e.event.source ? ` (${e.event.source})` : ''}`);
  if (Math.abs(e.ms - sunCache.at) > 60e3) {
    sunCache = { at: e.ms, set: nextSunCross(e.ms, CITY.lat, CITY.lon, -0.833, false), rise: nextSunCross(e.ms, CITY.lat, CITY.lon, -0.833, true) };
  }
  if (e.sun.alt > 0 && sunCache.set) lines.push(`Закат в ${hhmm(cityClock(sunCache.set))}.`);
  else if (sunCache.rise) lines.push(`Рассвет в ${hhmm(cityClock(sunCache.rise))}.`);
  if (track) lines.push(`В эфире: «${track.title}».`);
  lines.push('Нажмите на шпиль, мост или кота — в кадре много живого.');
  return lines;
}
let tickerI = 0;
function rotateTicker() {
  const lines = djLines();
  const t = $('#ticker');
  t.style.opacity = 0;
  setTimeout(() => { t.textContent = lines[tickerI++ % lines.length]; t.style.opacity = 1; }, 450);
}
setInterval(rotateTicker, 9000);

// ---------- «Что сейчас»: ближайшие события окна ----------
// { title, atMs }: закат/рассвет и будущие events.json — движок, остальное — хук города
// moments(e). Кнопка прыгает машиной времени к ближайшему событию за 2 минуты до начала.
let sunLineCache = { at: 0 };
function nowMoments(e) {
  const out = [], ms = e.ms, l = e.local;
  if (Math.abs(ms - sunLineCache.at) > 60e3)
    sunLineCache = { at: ms, set: nextSunCross(ms, CITY.lat, CITY.lon, -0.833, false), rise: nextSunCross(ms, CITY.lat, CITY.lon, -0.833, true) };
  if (e.sun.alt > 0 && sunLineCache.set) out.push({ title: 'закат', atMs: sunLineCache.set });
  else if (sunLineCache.rise) out.push({ title: 'рассвет', atMs: sunLineCache.rise });
  const day = isoDate(l), hm = l.getUTCHours() * 60 + l.getUTCMinutes();
  const dayStart = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - CITY.utcOffset * 3600e3;
  for (const ev of EVENTS) {
    const [h, m] = (ev.from || '00:00').split(':').map(Number);
    if (ev.date === day && h * 60 + m > hm) out.push({ title: ev.title || ev.kind, atMs: dayStart + (h * 60 + m) * 60e3 });
  }
  out.push(...(CITYMOD.moments?.(e) || []));
  out.sort((a, b) => a.atMs - b.atMs);
  const list = out.filter((m) => m.atMs > ms + 30e3).slice(0, 2);
  const vm = VAN && marsokhod.vanMoment(CITY, ms, params.get('van')); // Марсоход рядом — строка первой, с переходом в /doroga/
  if (vm) list.unshift({ ...vm, atMs: ms + 60e3 });
  return list.slice(0, 2);
}
let nowMomentsList = [];
function updateNowLine() {
  nowMomentsList = nowMoments(buildEnv(nowMs()));
  const line = $('#nowLine');
  if (!nowMomentsList.length) { line.hidden = true; return; }
  const ms = nowMs(), today = isoDate(cityClock(ms));
  line.hidden = false;
  $('#nowText').textContent = 'дальше: ' + nowMomentsList.map((m) => {
    const t = hhmm(cityClock(m.atMs)), d = Math.round((m.atMs - ms) / 60e3);
    const when = d < 60 ? `через ${d} мин` : isoDate(cityClock(m.atMs)) === today ? `в ${t}` : `завтра в ${t}`;
    return m.plain ? m.title : `${m.title} ${when}`;
  }).join(' · ');
  $('#nowGo').textContent = nowMomentsList[0].href ? 'в окно Марсохода →' : 'показать момент';
}
$('#nowGo').onclick = () => {
  const m = nowMomentsList[0]; if (!m) return;
  if (m.href) { trackEv('now_marsokhod'); location.assign(m.href); return; } // Марсоход рядом — в его окно
  const lt = cityClock(m.atMs - 120e3); // за 2 минуты до начала
  jumpTo(isoDate(lt), lt.getUTCHours() * 60 + lt.getUTCMinutes());
  trackEv('now_moment');
};
setInterval(updateNowLine, 1000); // своим интервалом: в фоне вкладки rAF спит, а строка идёт
updateNowLine();

function updateHud() {
  audio?.setCalm?.(timer.kind ? 0.3 : 1); // фокус и сон: пушка, гудки, куранты на 70% тише
  document.body.classList.toggle('calm', !!timer.kind); // и без реакций и самовсплывающих подсказок
  $('#clock').textContent = hhmm(cityClock(nowMs())); // не зависит от кадров: в фоне rAF спит
  if (CITYMOD.subtitleAt) $('#subtitle').textContent = CITYMOD.subtitleAt(nowMs()); // у поезда подзаголовок — куда едем
  document.body.classList.toggle('night', sunPosition(nowMs(), CITY.lat, CITY.lon).alt < -2); // свечение названия города
  const temp = Math.round(weather.temp);
  $('#wx').textContent = `${temp > 0 ? '+' : ''}${temp}° ${WEATHER_WORDS[weather.kind]}`;
  DAY?.update(env);
}
setInterval(updateHud, 1000);
if (window.__lofiWelcome) { // вернулся на главную — открыли его город; тихо поздороваться
  window.__lofiWelcome = false;
  setTimeout(() => toast(`С возвращением к окну ${CITY.nameGen}.` + (audio?.playing ? '' : ' Эфир — по кнопке ▶.')), 1200);
}
if (!CITYMOD.skyline.drawSeat) setInterval(() => { // у поезда кресла нет — корги не приходит
  const s = nowMs() / 1000;
  if (params.has('corgi') && !corgi.forced) { corgi.forced = true; corgi.visit = { arrive: s - (+params.get('corgi') || 30), leave: s + 600 }; } // визуальные тесты: ?corgi=секунд с прихода
  if (!corgi.visit && s >= corgi.next) {
    corgi.visit = { arrive: s, leave: s + 360 + Math.random() * 360 }; // сидит 6–12 мин
    if (!store.get('corgiMet', false)) { store.set('corgiMet', true); toast('В гости заглянула корги — устроилась в кресле-качалке. Её можно погладить.'); }
  } else if (corgi.visit && s > corgi.visit.leave + 2) { corgi.visit = null; corgi.next = s + 180 + Math.random() * 300; } // пауза 3–8 мин
  if (corgi.visit && s < corgi.visit.arrive - 5) { corgi.visit = null; corgi.next = s + 60; } // машина времени: часы прыгнули назад
  if (!corgi.visit && corgi.next - s > 2400) corgi.next = s + 300;
}, 1000);
let timePanel = null; // открытая панель «Время»: ползунок и чипы идут за часами сцены
setInterval(() => {
  if (panel.hidden || panel.dataset.kind !== 'time' || !timePanel) return;
  const tm = document.getElementById('tm'); if (!tm || document.activeElement === tm) return;
  const l = cityClock(nowMs()), v = l.getUTCHours() * 60 + l.getUTCMinutes();
  tm.value = v; document.getElementById('tmVal').textContent = hhmm(l); timePanel.markDates();
}, 1000);

// ---------- клики по сцене ----------
function toScene(cx, cy) {
  const r = el.getBoundingClientRect(), s = r.width / W;
  return [(cx - r.left) / s, (cy - r.top) / s];
}
function highlight(ids, ms = 3500) {
  document.querySelectorAll('.spot-hl').forEach((n) => n.remove());
  const spots = HOTSPOTS.filter((h) => ids.includes(h.id) && (!CITYMOD.hotspotOn || CITYMOD.hotspotOn(h.id, env)));
  if (!spots.length) return false;
  if (ids.length === 1 && panExtra > 0) { // одно место — показать его, даже если оно за краем окна
    const xs = spots.flatMap((h) => h.rects.map(([x, , w]) => x + w / 2)), cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const s = el.getBoundingClientRect().width / W;
    pan = Math.min(1, Math.max(0, (cx * s - innerWidth / 2) / panExtra)); el.style.left = -panExtra * pan + 'px';
  }
  const r = el.getBoundingClientRect(), s = r.width / W;
  for (const h of spots) for (const [x, y, w, hh] of h.rects) {
    const d = document.createElement('div'); d.className = 'spot-hl';
    Object.assign(d.style, { left: r.left + x * s + 'px', top: r.top + y * s + 'px', width: w * s + 'px', height: hh * s + 'px' });
    document.body.appendChild(d); setTimeout(() => d.remove(), ms);
  }
  return true;
}
// Задёрнутые шторы закрывают окно: там, где ткань, клик и подсказка — про шторы, а не про город за ними.
// Предметы перед шторами (комната, гирлянда, у города — помеченные front) остаются доступными.
const FRONT = new Set(['guitar', ...ROOM_HOTSPOTS.map((h) => h.id), ...(CITYMOD.places.ROOM_HOTSPOTS || []).map((h) => h.id), 'garland', ...CITYMOD.places.HOTSPOTS.filter((h) => h.front).map((h) => h.id)]);
function curtainCovers(x, y) {
  if (CITYMOD.skyline.NO_CURTAINS) return false;
  const k = room.curtainK; if (k < 0.3 || y >= SILL_Y + 8 || y < 4) return false;
  const e = k * k * (3 - 2 * k), tied = y < 130 ? 38 - (y - 4) / 126 * 20 : 18 + (y - 130) / 92 * 10, w = tied + ((DAY ? DAY.closedPx() : 205) - tied) * e;
  return x < w || x > W - w;
}
function hotspotAt(x, y) {
  if (curtainCovers(x, y)) {
    const front = HOTSPOTS.find((h) => FRONT.has(h.id) && (!CITYMOD.hotspotOn || CITYMOD.hotspotOn(h.id, env)) && h.rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh));
    return front || CURTAIN_HOTSPOT;
  }
  if (env.van) { const [rx, ry, rw, rh] = marsokhod.vanRect(env.van); if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return VAN_HOTSPOT; }
  return HOTSPOTS.find((h) => (!CITYMOD.hotspotOn || CITYMOD.hotspotOn(h.id, env)) && h.rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh));
}
const LABELS = { marsokhod: 'Марсоход — Давид, «Грузин на Марсе»', yarn: 'Клубок — покатить', cat: 'Кот — погладить', player: 'Проигрыватель — эфир вкл/выкл', lamp: 'Лампа', chair: 'Кресло-качалка', garland: 'Гирлянда', geranium: 'Герань — полить', curtain: 'Шторы — задёрнуть или раздвинуть', tea: 'Чай — подлить кипятка', books: 'Путеводитель', guitar: { room: 'Гитара — аккорд; провести по струнам — перебор', uke: 'Укулеле — аккорд; провести по струнам — перебор', train: 'Гитара на крючке — сыграть (чуть расстроена)' }[GUITAR_KIND], ...CITYMOD.labels };
let tipMuteUntil = 0; // после клика подсказка молчит — не закрывает сердечки кота и тосты
el.addEventListener('mousemove', (e) => {
  const [x, y] = toScene(e.clientX, e.clientY);
  const sv = !CITYMOD.skyline.drawDesk && souvenirs.souvenirAt(x, y);
  const h = sv || guestAt(x, y) ? { id: 'souvenir' } : hotspotAt(x, y);
  el.classList.toggle('hot', !!h);
  const tip = $('#tip'); tip.classList.remove('np-tip');
  if (!h || Date.now() < tipMuteUntil) { tip.hidden = true; return; }
  const gu = guestAt(x, y);
  if (sv || gu) { tip.hidden = false; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.textContent = gu ? `В гостях: ${birdInfo(gu.kind).name}` : sv.season ? capFirst(sv.name) : `Сувенир: ${souvenirs.SOUVENIRS[sv.id].name}`; return; }
  tip.hidden = false; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
  tip.textContent = CITYMOD.labelAt?.(h.id, env) || (h.id === 'chair' && corgiHere() ? (onCorgi(x, y) ? 'Корги в гостях — погладить' : 'Кресло-качалка — качнуть вместе с корги') : '') || LABELS[h.id] || PLACES[h.id]?.name || '';
});
el.addEventListener('mouseleave', () => ($('#tip').hidden = true));

let drag = null;
el.addEventListener('pointerdown', (e) => {
  if (drag && drag.id !== e.pointerId) return; // второй палец не перехватывает
  drag = { id: e.pointerId, x: e.clientX, pan, moved: false, wasIdle: e.pointerType !== 'mouse' && document.body.classList.contains('idle') };
  const [x, y] = toScene(e.clientX, e.clientY);
  if (guitar && !drag.wasIdle && hotspotAt(x, y)?.id === 'guitar') { // по гитаре палец не листает вид, а проводит по струнам
    drag.guitar = true; ensureAudioSync(); audio.ctx.resume(); guitar.down(x);
    try { el.setPointerCapture(e.pointerId); } catch {}
  }
});
el.addEventListener('pointercancel', () => (drag = null));
el.addEventListener('pointermove', (e) => {
  if (drag?.guitar && drag.id === e.pointerId) { const [x, y] = toScene(e.clientX, e.clientY); if (guitar.move(x, y, env) && !drag.moved) { drag.moved = true; trackEv('guitar:strings'); } return; }
  if (!drag || drag.id !== e.pointerId || e.pointerType === 'mouse') return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 6) drag.moved = true;
  const extra = el.getBoundingClientRect().width - innerWidth;
  if (extra > 0) { userPan = Math.min(1, Math.max(0, drag.pan - dx / extra)); layout(); }
});
el.addEventListener('pointerup', (e) => {
  if (drag && drag.id !== e.pointerId) return;
  const wasDrag = drag?.moved, wasIdle = drag?.wasIdle;
  if (drag?.guitar) guitar.up();
  drag = null;
  tipMuteUntil = Date.now() + 2500; $('#tip').hidden = true;
  if (wasDrag && userPan != null) { store.set(`pan:${CITY.id}`, userPan); store.set('panHint', true); }
  if (wasDrag || wasIdle) return;
  const [x, y] = toScene(e.clientX, e.clientY);
  ensureAudioSync(); audio.ctx.resume();
  if (DAY && !DAY.solved && !curtainCovers(x, y) && y < SILL_Y) { // в щёлочку видно, но что это — до ответа не говорим
    const hh = hotspotAt(x, y);
    if (!hh || !FRONT.has(hh.id)) { toast('Что там за окном — узнаете, когда угадаете город.'); return; }
  }
  const gu = guestAt(x, y);
  if (gu) { const b = birdInfo(gu.kind); toast(`${capFirst(b.name)} в гостях на карнизе. ${b.fact}`); trackEv('spot:guest'); return; }
  const sv = !CITYMOD.skyline.drawDesk && souvenirs.souvenirAt(x, y);
  if (sv?.season) { toast({ tree: 'Новогодняя ёлочка — стоит на полке до 10 января.', tulips: 'Тюльпаны к 8 Марта — до конца праздников.', fan: 'За окном жара — вентилятор крутится, пока не станет прохладнее.' }[sv.id] || capFirst(sv.name)); return; }
  if (sv) { const c = CITIES.find((e) => e.id === sv.id); toast(`${capFirst(souvenirs.SOUVENIRS[sv.id].name)} — из ${c?.nameGen || c?.name || 'другого окна'}, на полке с ${sv.date}. Собрано ${souvenirs.count()} из ${souvenirs.total()}.`); trackEv('spot:souvenir'); return; }
  const sec = curtainCovers(x, y) ? null : secretAt(x, y, env, SECRETS);
  if (sec) { trackEv('secret:' + sec.id); findSecret(sec); return; }
  const h = hotspotAt(x, y);
  if (!h) { if (!panel.hidden && panel.dataset.kind === 'place') panel.hidden = true; return; } // клик мимо — карточка места закрывается
  trackEv('spot:' + h.id);
  hints.act(h.id); // подсказки по расписанию: клик по месту — событие («кликнул лампу — потом подсказка про кота»)
  if (h.id === 'guitar') { guitar.click(x, y, env); return; }
  if (h.id === 'marsokhod') { toast(marsokhod.vanToast(CITY, nowMs(), params.get('van')), { href: '/doroga/', label: 'Окно Марсохода →' }); return; }
  if (h.id === 'cat') { catPetAt = nowMs() / 1000; audio.sfx('purr'); hearts(e.clientX, e.clientY); toast(CITYMOD.toasts?.cat || 'Кот мурчит.'); return; }
  if (h.id === 'player') { togglePlay(); return; }
  if (h.id === 'lamp') { toggleLamp(); return; }
  if (h.id === 'garland') { toggleGarland(); return; }
  if (h.id === 'geranium') { // общая герань города: полить раз в 10 минут, цветёт от поливов всех слушателей за день
    const left = 600 - (Date.now() - store.get('wateredAt', 0)) / 1000;
    if (left > 0) { toast(`Герань ещё влажная — полить снова можно через ${Math.ceil(left / 60)} мин.`); return; }
    store.set('wateredAt', Date.now()); waterAt = nowMs() / 1000; audio.sfx('pour');
    window.__live?.water(); waterCount = (waterCount ?? 0) + 1;
    toast(`Полили герань. Сегодня у окна ${CITY.nameGen} её поливали ${waterCount} ${plural(waterCount, 'раз', 'раза', 'раз')} — чем чаще, тем пышнее цветёт.`);
    return;
  }
  if (h.id === 'curtain' && DAY && !DAY.solved) { toast('Шторы откроются, когда угадаете город.'); return; }
  if (h.id === 'curtain') { room.curtain = !room.curtain; store.set('curtain', room.curtain); audio?.sfx('click'); toast(room.curtain ? 'Шторы задёрнуты — уютно. Раздвинуть — клик по шторе.' : 'Шторы раздвинуты.'); return; }
  if (h.id === 'yarn') { yarnAt = nowMs() / 1000; audio?.sfx('rustle'); if (Math.random() < 0.5) toast('Клубок покатился — Елисей следит и бьёт хвостом.'); return; }
  if (h.id === 'chair' && corgiHere() && onCorgi(x, y)) { corgi.petAt = nowMs() / 1000; corgi.visit.leave = Math.max(corgi.visit.leave, corgi.petAt + 90); hearts(e.clientX, e.clientY); toast(['Корги подставляет ухо — гладьте ещё.', 'Хвостика нет, зато как виляют пушистые штаны!', 'Корги довольна и решила посидеть подольше.'][Math.floor(Math.random() * 3)]); return; }
  if (h.id === 'chair' && !CITYMOD.skyline.drawSeat && !corgi.visit && Math.random() < 0.6) { // позвать корги: прибегает через пару секунд
    corgi.next = nowMs() / 1000 + 2 + Math.random() * 3; room.rockUntil = Date.now() + 6000; audio?.sfx('creak');
    toast('Слышно цоканье когтей по полу — кто-то спешит в кресло…'); return;
  }
  if (h.id === 'chair') { // у поезда вместо кресла — полка: шорох одеяла, а не скрип
    if (CITYMOD.skyline.drawSeat) audio.sfx('rustle'); else { room.rockUntil = Date.now() + 12000; audio.sfx('creak'); }
    toast(corgiHere() ? 'Кресло качается — корги покачивается вместе с ним и жмурится.' : CITYMOD.toasts?.chair || 'Кресло-качалка поскрипывает.'); return;
  }
  if (h.id === 'tea') { // подлить кипятка и помешать ложечкой — идея слушателя; пар над стаканом гуще
    teaAt = nowMs() / 1000; audio.sfx('pour'); setTimeout(() => audio?.sfx('clink'), 1500);
    toast(CITYMOD.toasts?.tea || 'Подлили кипятка, помешали — чай горячий.', DONATE); return;
  }
  if (CITYMOD.onHotspot?.(h.id, { toast, env, sfx: (n, ok) => audio?.sfx(n, ok), openPanel, openTea: () => openTeaGame({ sfx: (n) => audio?.sfx(n), toast }), openGame: (k) => openCoinGame(k, { sfx: audio.sfx, live: window.__live, targets: CITYMOD.places.games }) })) return;
  if (h.id === 'books') { openPanel('places'); return; }
  if (!panel.hidden && panel.dataset.kind === 'place' && panel.dataset.arg === h.id) { panel.hidden = true; return; } // повторное нажатие на то же место — закрыть
  openPanel('place', h.id);
});
// Найденные секреты города — в localStorage (и в памяти для приватного режима)
function findSecret(s) {
  const first = !found.has(s.id);
  found.add(s.id); store.set(foundKey, [...found]);
  audio?.sfx('coin', true);
  toast(`${first ? 'Секрет найден' : 'Снова'}: ${s.name}! ${s.found} (${found.size} из ${SECRETS.length})`);
}
function hearts(x, y) {
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span'); s.className = 'heart'; s.textContent = '♥';
    s.style.left = x + (Math.random() - 0.5) * 40 + 'px'; s.style.top = y - 10 + 'px'; s.style.animationDelay = i * 0.15 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 2200);
  }
}
let toastT;
window.__lofiToast = (text) => toast(text); // загрузчику (тур по городам) — показать подсказку
let userActAt = 0; // подсказки в спокойном режиме — только в ответ на действие человека
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => (userActAt = Date.now()), true);
function toast(text, link) {
  if (document.body.classList.contains('calm') && Date.now() - userActAt > 2500) return; // link: { href, label } — тихая ссылка под текстом (собираем через DOM, без innerHTML)
  const t = $('#toast'); t.textContent = text; t.hidden = false;
  if (link) {
    const a = document.createElement('a');
    a.href = link.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = link.label; a.className = 'toast-link';
    t.append(document.createElement('br'), a);
  }
  // держится столько, сколько нужно прочитать (~14 знаков в секунду), под мышью не исчезает, нажатие — закрыть
  const ms = Math.min(14000, Math.max(4500, 2000 + text.length * 70)) + (link ? 2500 : 0);
  const hide = () => { if (t.matches(':hover')) { toastT = setTimeout(hide, 1500); return; } t.hidden = true; };
  clearTimeout(toastT); toastT = setTimeout(hide, ms);
  t.onclick = (e) => { if (e.target.tagName !== 'A') { clearTimeout(toastT); t.hidden = true; } };
}

// ---------- панели ----------
const panel = $('#panel');
$('#panelClose').onclick = () => (panel.hidden = true);
mountIcons();
// ---------- подсказки по расписанию ----------
// Расписание, тексты и правила шлюза — в hints.js; здесь только зависимости города и страницы
const hints = createHints({
  store, toast, highlight, params,
  busy: () => !$('#toast').hidden || !panel.hidden || !!$('#onboard') || (DAY && !DAY.solved), // знакомство «Включить окно» — сначала оно; в «Окне дня» до ответа подсказки про здания за окном выдали бы город
  isTouch: () => matchMedia('(pointer: coarse)').matches,
  canPan: () => panExtra > innerWidth * 0.25,
  secretsPending: () => SECRETS.length > 0 && found.size < SECRETS.length / 2,
  placeSpots: CITYMOD.places.HOTSPOTS.map((h) => h.id),
  skip: [CITYMOD.skyline.NO_CURTAINS && 'curtain', CITYMOD.skyline.NO_GERANIUM && 'geranium'].filter(Boolean), // подсказки про то, чего в городе нет
});
window.__lofiHints = hints; // для tests/ui_test.js
function toggleLamp() { // совпало с автоматикой — снова «авто»
  const next = !(room.lamp ?? lampAuto(env.sun));
  room.lamp = next === lampAuto(env.sun) ? null : next; store.set('lamp', room.lamp); audio?.sfx('click');
}
function syncRain() { $('#qRain').classList.toggle('on', weather.source === 'manual' && weather.kind === 'rain'); }
function toggleGarland() { room.garland = !room.garland; store.set('garland', room.garland); $('#qGarland').classList.toggle('on', room.garland); audio?.sfx('click'); }
$('#qLamp').onclick = async () => { await ensureAudio(); toggleLamp(); };
if (CITYMOD.skyline.NO_GARLAND) $('#qGarland').style.display = 'none'; // в машине гирлянды нет
$('#qGarland').onclick = async () => { await ensureAudio(); toggleGarland(); };
$('#qGarland').classList.toggle('on', room.garland);
$('#qRain').onclick = () => {
  const on = !(weather.source === 'manual' && weather.kind === 'rain');
  setManual(on ? 'rain' : null); store.set('rain', on); // включённый вручную дождь запоминается
  syncRain();
  toast(on ? 'Включили дождь. Выключить — ещё раз.' : 'Погода снова настоящая.');
};
$('#badgeNow').onclick = () => { backToNow(); };
if (store.get('rain', false) && !params.get('wx')) setTimeout(() => { setManual('rain'); syncRain(); }, 2500); // после первой загрузки настоящей погоды

// ---------- таймеры: фокус и сон ----------
const timer = { kind: null, end: 0, phase: 'focus', work: 25, rest: 5 };
function startFocus(work, rest) { Object.assign(timer, { kind: 'focus', phase: 'focus', work, rest, end: Date.now() + work * 60e3 }); toast(`Фокус ${work} минут. Куранты позовут на перерыв.`); }
function startSleep(min) { Object.assign(timer, { kind: 'sleep', end: Date.now() + min * 60e3 }); toast(`Эфир тихо уснёт через ${min} минут.`); }
// ---------- настроения: готовые наборы звука и комнаты одной кнопкой ----------
const MOODS = {
  focus: { name: 'Фокус', hint: 'город тише, лампа, таймер 25/5', music: 0.75, city: 0.35, lamp: true, garland: false, rain: false, timer: ['focus', 25, 5] },
  chill: { name: 'Чилл', hint: 'лампа и гирлянда, город как есть', music: 0.8, city: 0.85, lamp: true, garland: true, rain: false },
  sleep: { name: 'Сон', hint: 'без лампы, тихо, уснуть за 30 минут', music: 0.55, city: 0.5, lamp: false, garland: true, rain: false, timer: ['sleep', 30] },
  rain: { name: 'Дождь', hint: 'дождь за окном, лампа и гирлянда', music: 0.7, city: 0.95, lamp: true, garland: true, rain: true },
};
function applyMood(id, { withTimer = true } = {}) {
  const m = MOODS[id];
  if (!m) return false;
  mem.mood = id; store.set('mood', id);
  for (const [k, v] of [['volMusic', m.music], ['volCity', m.city]]) { $('#' + k).value = v; store.set(k, v); }
  audio?.setMusicVol(m.music); audio?.setCityVol(m.city);
  room.lamp = m.lamp === lampAuto(env.sun) ? null : m.lamp; store.set('lamp', room.lamp);
  room.garland = m.garland; store.set('garland', m.garland); $('#qGarland').classList.toggle('on', m.garland);
  setManual(m.rain ? 'rain' : null); syncRain();
  if (!withTimer) return true;
  if (m.timer?.[0] === 'focus') startFocus(m.timer[1], m.timer[2]);
  else if (m.timer?.[0] === 'sleep') startSleep(m.timer[1]);
  else { if (timer.kind) stopTimer(); toast(`Настроение: ${m.name}.`); }
  return true;
}
function stopTimer() { timer.kind = null; $('#timerBadge').hidden = true; if (audio) { audio.setMusicVol(+$('#volMusic').value); audio.setCityVol(+$('#volCity').value); } }
setInterval(() => {
  if (!timer.kind) return;
  const left = timer.end - Date.now();
  const mm = Math.max(0, Math.ceil(left / 1000));
  const txt = `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
  const b = $('#timerBadge'); b.hidden = false;
  b.textContent = timer.kind === 'sleep' ? `сон · ${txt}` : `${timer.phase === 'focus' ? 'фокус' : 'перерыв'} · ${txt}`;
  const big = document.getElementById('timerBig'); if (big) big.textContent = txt;
  if (timer.kind === 'sleep') {
    if (left < 30000 && audio) { const k = Math.max(0, left / 30000); audio.setMusicVol(+$('#volMusic').value * k); audio.setCityVol(+$('#volCity').value * k); }
    if (left <= 0) {
      audio?.pause(); timer.kind = null; $('#timerBadge').hidden = true;
      audio?.setMusicVol(+$('#volMusic').value); audio?.setCityVol(0); // город молчит до следующего «плей»
      $('#play').innerHTML = icon('play'); $('#play').setAttribute('aria-label', 'Включить эфир');
    }
  } else if (left <= 0) {
    audio?.sfx('chime', timer.phase === 'focus' ? 2 : 1, 60);
    timer.phase = timer.phase === 'focus' ? 'rest' : 'focus';
    timer.end = Date.now() + (timer.phase === 'focus' ? timer.work : timer.rest) * 60e3;
    toast(timer.phase === 'rest' ? 'Перерыв: налейте чаю, погладьте кота.' : 'Снова за работу.');
  }
}, 500);
document.querySelectorAll('[data-panel]').forEach((b) => (b.onclick = () => {
  if (!panel.hidden && panel.dataset.kind === b.dataset.panel) { panel.hidden = true; return; }
  openPanel(b.dataset.panel);
}));

function placeCard(id) {
  const p = PLACES[id];
  const tag = p.inScene ? '<span class="tag live">в кадре</span>' : p.soon ? `<span class="tag">${p.soon}</span>` : p.game ? '<span class="tag">мини-игра</span>' : '';
  let btn = '';
  if (p.action) btn = `<button class="btn primary" data-act="${id}">${p.action.label}</button>`;
  if (p.game && CITYMOD.places.games?.[p.game]) btn = `<button class="btn primary" data-game="${p.game}">Бросить монетку</button>`;
  if (p.game === 'cat') btn = '<button class="btn primary" data-pet="1">Погладить Елисея</button>';
  const spot = HOTSPOTS.some((h) => h.id === id) ? ` data-spot="${id}" title="Показать в окне"` : '';
  return `<div class="card${spot ? ' spot-card' : ''}"${spot}><h3>${p.name}${tag}</h3><p>${p.fact}</p>${btn}</div>`;
}

function openPanel(kind, arg) {
  panel.hidden = false; panel.dataset.kind = kind; panel.dataset.arg = arg ?? '';
  const body = $('#panelBody');
  if (kind === 'place') {
    $('#panelTitle').textContent = 'В кадре';
    body.innerHTML = placeCard(arg) + `<div class="card"><button class="btn" data-open="places">Все места ${CITY.nameGen} →</button></div>`;
  } else if (kind === 'places') {
    $('#panelTitle').textContent = `Места ${CITY.nameGen}`;
    const secretsHtml = SECRETS.length ? `<div class="card"><h3>Секреты города: найдено ${[...found].filter((id) => SECRETS.some((s) => s.id === id)).length} из ${SECRETS.length}</h3>` +
      SECRETS.map((s) => {
        if (found.has(s.id)) return `<p class="secret found"><i></i><span><b>${s.name}</b> — ${s.found}</span></p>`;
        const now = !!s.state(env); // сейчас в кадре — подсказать, что стоит посмотреть в окно
        return `<p class="secret${now ? ' now' : ''}"><i></i><span>${s.hint}${now ? ' <b class="now-tag">✨ сейчас в кадре</b>' : ''}<button class="peek" type="button" data-peek="${s.id}">Подсмотреть</button></span></p>`;
      }).join('') + '<p class="label">Найденный секрет надо кликнуть в окне. «Подсмотреть» покажет его на полминуты.</p></div>' : '';
    body.innerHTML = `<p class="label">${CITYMOD.placesIntro || ''}</p>` + secretsHtml + PLACE_ORDER.map(placeCard).join('') + storyLink();
  } else if (kind === 'sounds') {
    $('#panelTitle').textContent = 'Звуки города';
    const mix = mem.mix;
    body.innerHTML = `<p class="label">${CITYMOD.sounds.intro || ''}</p>` +
      [...CITYMOD.sounds.list, ...(VOICE_READY ? [VOICE_ROW] : [])].map((s) => `<div class="row"><div class="name">${s.name}<small>${s.hint}</small></div>
        <input type="range" min="0" max="2" step="0.05" value="${mix[s.id] ?? 1}" data-snd="${s.id}"><output>${Math.round((mix[s.id] ?? 1) * 100)}%</output></div>`).join('') +
      `<div class="chips">${[...(CITYMOD.sounds.tryButtons || []), ...(VOICE_READY ? [['announce', 'Голос ведущего']] : [])].map(([k, n]) => `<button class="btn" data-try="${k}">${n}</button>`).join('')}</div>`;
    body.querySelectorAll('[data-snd]').forEach((inp) => (inp.oninput = () => {
      const m = mem.mix; m[inp.dataset.snd] = +inp.value; store.set('mix', m);
      inp.nextElementSibling.textContent = Math.round(inp.value * 100) + '%';
      audio?.setMix(m);
    }));
  } else if (kind === 'time') {
    $('#panelTitle').textContent = 'Время и погода';
    const l = env.local, mins = l.getUTCHours() * 60 + l.getUTCMinutes();
    const wxs = [['', 'как сейчас'], ['clear', 'ясно'], ['cloudy', 'облачно'], ['rain', 'дождь'], ['snow', 'снег'], ['fog', 'туман'], ['storm', 'гроза']];
    const y = cityClock(Date.now()).getUTCFullYear();
    const dates = [['now', 'сейчас'], ...(CITY.timePresets || []).map(([md, n]) => [`${y}-${md}`, n])];
    const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    let date = clock.base == null ? '' : iso(l); // день, внутри которого двигает ползунок
    if (weather.source !== 'manual') setTimeout(() => body.querySelector('[data-wx=""]')?.classList.add('on'));
    const activeKey = () => (clock.base == null ? 'now' : date);
    body.innerHTML = `<p class="label">${CITYMOD.timeIntro || ''}</p>
      <div class="label">Время: <b id="tmVal">${hhmm(l)}</b></div>
      <input class="wide" type="range" id="tm" min="0" max="1439" value="${mins}" aria-label="Время суток">
      <div class="label">День</div><div class="chips" id="dateChips">${dates.map(([d, n]) => `<button class="chip" data-date="${d}">${n}</button>`).join('')}</div>
      <div class="label">Погода</div><div class="chips">${wxs.map(([k, n]) => `<button class="chip ${(weather.source === 'manual' ? weather.kind : '') === k ? 'on' : ''}" data-wx="${k}">${n}</button>`).join('')}</div>
      <button class="btn primary" id="now">Вернуться в сейчас</button>`;
    const markDates = () => body.querySelectorAll('[data-date]').forEach((x) => x.classList.toggle('on', x.dataset.date === activeKey()));
    markDates();
    const apply = () => { jumpTo(date, +$('#tm').value); markDates(); };
    $('#tm').oninput = (e) => { const v = +e.target.value; $('#tmVal').textContent = `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; apply(); };
    body.querySelectorAll('[data-date]').forEach((b) => (b.onclick = () => {
      if (b.dataset.date === 'now') { backToNow(); openPanel('time'); return; }
      date = b.dataset.date; apply();
    }));
    body.querySelectorAll('[data-wx]').forEach((b) => (b.onclick = () => {
      setManual(b.dataset.wx || null); syncRain();
      body.querySelectorAll('[data-wx]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    $('#now').onclick = () => { setManual(null); syncRain(); backToNow(); openPanel('time'); };
    timePanel = { markDates, getDate: () => date };
  } else if (kind === 'timer') {
    $('#panelTitle').textContent = 'Настроение, фокус и сон';
    body.innerHTML = `<div class="label">Настроение — звук, свет и погода за окном одной кнопкой</div>
      <div class="chips moods">${Object.entries(MOODS).map(([id, m]) => `<button class="chip${mem.mood === id ? ' on' : ''}" data-mood="${id}" title="${m.hint}">${m.name}</button>`).join('')}</div>
      <div class="big" id="timerBig">--:--</div>
      <div class="label">Фокус — работа и перерывы по кругу, сигнал — куранты</div>
      <div class="chips"><button class="chip" data-focus="25,5">25 / 5</button><button class="chip" data-focus="50,10">50 / 10</button><button class="chip" data-focus="90,15">90 / 15</button></div>
      <div class="label">Сон — эфир плавно затихнет</div>
      <div class="chips"><button class="chip" data-sleep="15">15 мин</button><button class="chip" data-sleep="30">30 мин</button><button class="chip" data-sleep="60">60 мин</button><button class="chip" data-sleep="90">90 мин</button></div>
      <button class="btn" id="timerStop">Остановить таймер</button>`;
    body.querySelectorAll('[data-focus]').forEach((b) => (b.onclick = async () => { await ensureAudio(); if (!audio.playing) togglePlay(); const [w, r] = b.dataset.focus.split(',').map(Number); startFocus(w, r); }));
    body.querySelectorAll('[data-sleep]').forEach((b) => (b.onclick = async () => { await ensureAudio(); if (!audio.playing) togglePlay(); startSleep(+b.dataset.sleep); }));
    $('#timerStop').onclick = () => { stopTimer(); $('#timerBig').textContent = '--:--'; };
    body.querySelectorAll('[data-mood]').forEach((b) => (b.onclick = async () => {
      await ensureAudio();
      applyMood(b.dataset.mood);
      if (!audio.playing) togglePlay();
      body.querySelectorAll('[data-mood]').forEach((x) => x.classList.toggle('on', x === b));
    }));
  } else if (kind === 'share') {
    const { png, url } = arg;
    let sign = arg.sign || '', blob = null;
    $('#panelTitle').textContent = 'Открытка другу';
    const q = encodeURIComponent;
    const cap = (x) => x[0].toUpperCase() + x.slice(1);
    const text = () => { const t = Math.round(weather.temp);
      return `${greetLine()}! Сейчас ${hhmm(cityClock(nowMs()))}, ${t > 0 ? '+' : ''}${t}°, ${WEATHER_WORDS[weather.kind]}.${sign ? ' ' + cap(sign) + (/[.!?…)]$/.test(sign) ? '' : '.') : ''} Лофи-радио с живым окном в город:`; };
    // системное меню «Поделиться» с картинкой — на телефоне, если браузер умеет файлы
    const native = matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
    body.innerHTML = `<div class="card"><img class="share-preview" id="sharePic" src="${png}" alt="Открытка: ${greetLine()}">
      <label class="share-sign"><span class="label">Подпись</span><input id="shareSign" maxlength="32" placeholder="например: обнимаю, Маша" autocomplete="off"></label>
      <div class="share-row">
        ${native ? '<button class="btn primary" data-share="native" id="shareNative">Отправить</button>' : ''}
        <a class="btn ${native ? '' : 'primary'}" data-share="tg" id="shareTg" target="_blank" rel="noopener">Telegram</a>
        <a class="btn" data-share="vk" id="shareVk" target="_blank" rel="noopener">ВКонтакте</a>
        <a class="btn" data-share="download" id="shareDl" href="${png}" download="lofi-${CITY.id}.png">Скачать открытку</a>
        <button class="btn" data-share="copy" id="shareCopy">Скопировать ссылку</button>
      </div><p class="label">На открытке время и погода прямо сейчас — и ваша подпись, если её написать.${MOODS[mem.mood] ? ` Ссылка откроет окно с вашим настроением: «${MOODS[mem.mood].name}».` : ''}</p></div>`;
    const links = () => {
      $('#shareTg').href = `https://t.me/share/url?url=${q(url)}&text=${q(text())}`;
      $('#shareVk').href = `https://vk.com/share.php?url=${q(url)}&title=${q(text())}`;
    };
    const makeBlob = (c) => { if (native) c.toBlob((b) => (blob = b), 'image/png'); };
    links();
    if (native) fetch(png).then((r) => r.blob()).then((b) => (blob = blob || b)).catch(() => {});
    const inp = $('#shareSign'); inp.value = sign;
    let redraw = 0;
    inp.oninput = () => {
      clearTimeout(redraw);
      redraw = setTimeout(async () => {
        sign = inp.value.trim().replace(/\s+/g, ' ');
        store.set('sign', sign);
        const c = await shareImage(sign), data = c.toDataURL('image/png');
        $('#sharePic').src = data; $('#shareDl').href = data; makeBlob(c); links();
      }, 300);
    };
    if (native) $('#shareNative').onclick = async () => {
      if (!blob) return;
      const file = new File([blob], `lofi-${CITY.id}.png`, { type: 'image/png' });
      try { await navigator.share({ files: [file], text: `${text()} ${url}` }); trackEv('share:native'); } catch {}
    };
    $('#shareCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); } catch { toast(url); }
    };
  } else if (CITYMOD.panels?.[kind]) {
    const p = CITYMOD.panels[kind];
    $('#panelTitle').textContent = p.title;
    body.innerHTML = p.html(cityApi());
  } else if (kind === 'about') {
    $('#panelTitle').textContent = 'О проекте';
    const cities = ['Новосибирск', 'Ростов-на-Дону', 'Уфа']; // кандидаты плана новых окон: docs/plans/okna-next.md
    const cityChips = CITIES.filter((c) => c.enabled && (!c.hidden || c.id === CITY.id)).map((c) => `<a class="chip ${c.id === CITY.id ? 'on' : ''}" href="/${c.id}/">${c.name}</a>`).join('');
    body.innerHTML = `<div class="card">${CITYMOD.about || ''}${storyLink(false)}
      <p>Для стрима добавьте к адресу <b>?obs</b>.</p></div>

      <div class="card"><h3>Поддержать проект</h3>
      <p>Сайт бесплатный и без рекламы. Если окно помогает работать или отдыхать — можно угостить автора чаем: донаты идут на сервер, видеокарту для новой музыки и новые города.</p>
      <div class="row"><a class="btn primary" href="${DONATE.href}" target="_blank" rel="noopener">Поддержать ☕</a></div></div>
      ${cityChips ? `<div class="card"><h3>Города</h3><div class="chips">${cityChips}</div></div>` : ''}
      <div class="card"><h3>Горячие клавиши</h3><p>Пробел — эфир · L — лампа · G — гирлянда · R — дождь · T — таймер · S — звуки · P — места · W — время · F — экран · H — о проекте · X — поделиться окном · [ ] — соседний город (на телефоне — свайп по плееру) · 1–4 — реакции · 5 — весточка · Esc — закрыть</p></div>

      <div class="card"><h3>Какой город следующий?</h3>
      <div class="chips" id="cityVote">${cities.map((c) => `<button class="chip" data-city="${c}">${c}</button>`).join('')}</div></div>

      <div class="card"><h3>Идея, город или ошибка</h3>
      <div class="chips" id="fbKind"><button class="chip on" data-kind="idea">идея</button><button class="chip" data-kind="city">город</button><button class="chip" data-kind="bug">ошибка</button><button class="chip" data-kind="other">другое</button></div>
      <textarea id="fbText" class="field" rows="4" maxlength="1000" placeholder="Что добавить, какой город нарисовать, что сломалось…"></textarea>
      <input id="fbContact" class="field" maxlength="120" placeholder="Как с вами связаться (необязательно): Telegram или почта">
      <div class="row"><button class="btn primary" id="fbSend">Отправить</button><span class="label" id="fbMsg"></span></div>
      <p class="label">Оставляя контакт, вы соглашаетесь с <a href="/privacy/" target="_blank" rel="noopener">политикой обработки данных</a>. Он нужен только чтобы ответить.</p></div>

      <div class="card"><h3>Контакты</h3><p>${CONTACTS}</p></div>

      <div class="card"><h3>Права и лицензии</h3>
      <p>© 2026 Лофи-города. Иллюстрации, код и звуковой движок — оригинальная работа проекта, все права защищены. Пиксельные сцены нарисованы кодом.</p>
      <p>Музыка эфира сгенерирована нейросетью <a href="https://github.com/ace-step/ACE-Step-1.5" target="_blank" rel="noopener">ACE-Step 1.5</a> (лицензия MIT) по заказу автора; живые вставки между треками сочиняет браузер в реальном времени.</p>
      <p>Шрифты Pangolin, Caveat, Handjet и Press Start 2P — SIL Open Font License 1.1, <a href="/fonts/OFL.txt" target="_blank" rel="noopener">текст лицензии и авторские права</a>.</p>
      <p>Погода: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>, данные по лицензии CC BY 4.0.</p>
      <p>Звуки города синтезируются кодом, записи не используются. Факты о местах — из открытых источников.</p>
      <p>Проект не связан с упомянутыми организациями, стадионами и клубами; названия принадлежат их правообладателям.</p>
      <p>Возрастная маркировка: 0+. <a href="/privacy/" target="_blank" rel="noopener">Политика конфиденциальности</a>.</p></div>`;
    let fbKind = 'idea';
    body.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => { fbKind = b.dataset.kind; body.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('on', x === b)); }));
    const msgEl = $('#fbMsg'), textEl = $('#fbText'), contactEl = $('#fbContact'), sendBtn = $('#fbSend'); // держим ссылки: панель могут закрыть во время отправки
    const sendFb = async (kind, text, contact) => {
      try {
        const r = await fetch(liveHttp('/live/feedback'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, text, contact, city: CITY.id }) });
        const j = await r.json();
        msgEl.textContent = j.ok ? 'Спасибо! Записали.' : (j.error || 'Не получилось, попробуйте позже');
        if (j.ok) trackEv('feedback:' + kind);
        return j.ok;
      } catch { msgEl.textContent = 'Нет связи с сервером, попробуйте позже'; return false; }
    };
    sendBtn.onclick = async () => {
      const t = textEl.value.trim();
      if (t.length < 2) { msgEl.textContent = 'Напишите пару слов'; return; }
      sendBtn.disabled = true;
      const sent = t;
      if (await sendFb(fbKind, t, contactEl.value) && textEl.value.trim() === sent) textEl.value = '';
      sendBtn.disabled = false;
    };
    body.querySelectorAll('[data-city]').forEach((b) => (b.onclick = async () => {
      if (mem.voted || mem.voting) { if (mem.voted) toast('Вы уже проголосовали — спасибо!'); return; }
      mem.voting = true;
      if (await sendFb('city', `Голос за город: ${b.dataset.city}`, '')) { mem.voted = b.dataset.city; store.set('voted', b.dataset.city); b.classList.add('on'); toast(`Голос за «${b.dataset.city}» принят`); }
      mem.voting = false;
    }));
    const voted = mem.voted;
    if (voted) body.querySelectorAll('[data-city]').forEach((b) => b.classList.toggle('on', b.dataset.city === voted));
  }
  body.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openPanel(b.dataset.open)));
  body.querySelectorAll('[data-peek]').forEach((b) => (b.onclick = () => {
    Object.assign(peek, { id: b.dataset.peek, until: Date.now() + 30000 }); trackEv('peek:' + b.dataset.peek);
    panel.hidden = true; toast('Смотрите в окно — секрет мерцает звёздочкой. Кликните по нему.');
  }));
  body.querySelectorAll('[data-spot]').forEach((c) => { // место из списка — подсветить в окне
    c.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const pr = panel.getBoundingClientRect(), sr = el.getBoundingClientRect();
      if (pr.width * pr.height > 0.5 * Math.min(innerWidth, sr.width) * Math.min(innerHeight, sr.height)) panel.hidden = true; // панель закрывает окно — убрать, чтобы место было видно
      highlight([c.dataset.spot], 4000);
    });
    c.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) highlight([c.dataset.spot], 1600); });
  });
  body.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
    const a = PLACES[b.dataset.act].action;
    ensureAudioSync(); audio.ctx.resume();
    if (a.jump) {
      let day = clock.base == null ? '' : isoDate(cityClock(nowMs())); // день сцены, а не реальный
      if (a.needSeason) { const y = cityClock(nowMs()).getUTCFullYear(); jumpTo(day, parseHM(a.jump)); if (CITYMOD.bridgeState && !CITYMOD.bridgeState(nowMs()).season) day = `${y}-09-20`; }
      jumpTo(day, parseHM(a.jump));
      if (a.timelapse) { timelapse(a.timelapse, a.seconds); toast(`${a.label}: время ×${a.timelapse}, ${a.seconds} с. Вернуться — «вернуться» вверху.`); }
      else toast('Машина времени: ' + a.jump.slice(0, 5) + '. Вернуться — «вернуться» вверху.');
    }
    if (a.torch) { torchUntil = Date.now() + 30000; audio.sfx('torch'); toast('Факелы горят 30 секунд — как по праздникам.'); }
  }));
  body.querySelectorAll('[data-game]').forEach((b) => (b.onclick = async () => {
    await ensureAudio(); audio.ctx.resume();
    openCoinGame(b.dataset.game, { sfx: audio.sfx, live, targets: CITYMOD.places.games });
  }));
  body.querySelectorAll('[data-pet]').forEach((b) => (b.onclick = async () => {
    await ensureAudio(); catPetAt = nowMs() / 1000; audio.sfx('purr'); const r = b.getBoundingClientRect(); hearts(r.left + r.width / 2, r.top);
  }));
  body.querySelectorAll('[data-try]').forEach((b) => (b.onclick = async () => {
    await ensureAudio(); const k = b.dataset.try;
    if (k === 'announce') { audio.announce(env); return; }
    audio.sfx(k, ...({ chime: [4, 60], hours: [3, 60] }[k] || []));
  }));
}

$('#fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

// ---------- поделиться окном: открытка ----------
// Картинка 1200×630 из текущего кадра (пиксели без размытия): «Привет из …», время, погода, подпись отправителя, адрес.
const greetLine = () => CITY.greet || `Привет из ${CITY.nameGen}`;
const nowLine = () => { const t = Math.round(weather.temp); return `сейчас ${hhmm(cityClock(nowMs()))} · ${t > 0 ? '+' : ''}${t}° ${WEATHER_WORDS[weather.kind]}`; };
async function shareImage(sign = '', head = greetLine() + '!', line = nowLine()) {
  scene.render(env);
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(el, 0, 0, W, 252, 0, 0, 1200, 630);
  const grad = g.createLinearGradient(0, 380, 0, 630);
  grad.addColorStop(0, 'rgba(20,14,18,0)'); grad.addColorStop(1, 'rgba(20,14,18,0.94)');
  g.fillStyle = grad; g.fillRect(0, 380, 1200, 250);
  try { await Promise.all([document.fonts.load('700 72px Title', head), document.fonts.load('32px Lofi', '0123')]); } catch {}
  const night = document.body.classList.contains('night');
  let size = 72; // длинные названия («Великого Новгорода») ужимаем по ширине
  do { g.font = `700 ${size}px Title, Lofi, sans-serif`; } while (g.measureText(head).width > 1104 && (size -= 4) > 36);
  if (night) { g.fillStyle = '#ffe2b0'; g.shadowColor = '#ffb84d'; g.shadowBlur = 18; g.fillText(head, 48, 512); }
  g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowOffsetX = g.shadowOffsetY = 3;
  g.fillStyle = night ? '#ffe2b0' : '#f3e6c8'; g.fillText(head, 48, 512);
  g.fillStyle = '#f3e6c8'; g.font = '34px Lofi, sans-serif';
  g.fillText(line, 50, 562);
  g.font = '28px Lofi, sans-serif'; g.textAlign = 'right'; g.fillStyle = '#c9b48f';
  g.fillText('lofi-goroda.ru', 1150, 606);
  if (sign) { g.textAlign = 'left'; g.fillStyle = '#e8b83a'; g.font = '32px Lofi, sans-serif'; g.fillText('— ' + sign, 50, 606); }
  return c;
}
async function shareWindow() {
  trackEv('share:open');
  const url = `https://lofi-goroda.ru/${CITY.id === 'piter' ? '' : CITY.id + '/'}?from=share${MOODS[mem.mood] ? '&mood=' + mem.mood : ''}`;
  const sign = store.get('sign', '');
  openPanel('share', { png: (await shareImage(sign)).toDataURL('image/png'), url, sign });
}
$('#shareBtn').onclick = shareWindow;
// кадр для канала «Окно дня» (бот снимает его headless-браузером): название города крупно, время и погода, адрес
window.__lofiPostcard = async () => {
  const t = Math.round(weather.temp);
  return (await shareImage('', CITY.name, `${hhmm(cityClock(nowMs()))} · ${t > 0 ? '+' : ''}${t}° ${WEATHER_WORDS[weather.kind]}`)).toDataURL('image/png');
};
$('#sendBtn').onclick = shareWindow;
{ // города как станции: свайп по плееру (не по окну — там сдвиг панорамы)
  const bar = document.querySelector('.bar');
  let sx = null, sy = 0;
  bar?.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } }, { passive: true });
  bar?.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40 && window.__lofiStep) { trackEv(dx < 0 ? 'swipe:next' : 'swipe:prev'); window.__lofiStep(dx < 0 ? 1 : -1); }
  });
  bar?.addEventListener('pointercancel', () => (sx = null));
}
{ // полка на телефоне сворачивается до одной строки; выбор запоминается
  const tg = $('#dockToggle');
  const apply = (min) => { document.body.classList.toggle('dock-min', min); tg.setAttribute('aria-expanded', String(!min)); tg.setAttribute('aria-label', min ? 'Развернуть полку' : 'Свернуть полку'); layout(); };
  if (tg) { apply(store.get('dockMin', false)); tg.onclick = () => { const min = !document.body.classList.contains('dock-min'); store.set('dockMin', min); apply(min); }; }
}
document.addEventListener('click', (e) => { // уходим в другой город из полного экрана — запомнить
  if (document.fullscreenElement && e.target.closest('a[href^="/"]')) { try { sessionStorage.setItem('lg:fs', '1'); } catch {} }
}, true);
try {
  if (sessionStorage.getItem('lg:fs')) {
    sessionStorage.removeItem('lg:fs');
    const back = () => { document.documentElement.requestFullscreen?.().catch(() => {}); };
    document.addEventListener('pointerdown', back, { once: true, capture: true });
    document.addEventListener('keydown', back, { once: true, capture: true });
    setTimeout(() => { if (!document.fullscreenElement) toast('Коснитесь окна — вернём полноэкранный режим.'); }, 300);
  }
} catch {}

// ---------- старт ----------
// первый запуск: большая спокойная кнопка «Включить окно» (это жест для звука), затем по желанию Работа / Отдых / Сон
function showOnboarding() {
  const el = document.createElement('div');
  el.id = 'onboard';
  el.className = 'onboard';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Знакомство с окном');
  el.innerHTML = `<p class="ob-hi">Это окно ${CITY.nameGen}. Включите — и эфир заиграет, синхронно у всех.</p>
    <button class="ob-go" data-ob="start" type="button">${icon('play')}Включить окно</button>
    <div class="ob-row" hidden>
      <button class="ob-opt" data-ob="work" type="button" title="Фокус 25 минут, потом 5 перерыв">Работа</button>
      <button class="ob-opt" data-ob="rest" type="button" title="Просто слушать">Отдых</button>
      <button class="ob-opt" data-ob="sleep" type="button" title="Эфир тихо уснёт через 30 минут">Сон</button>
    </div>
    <button class="ob-skip" data-ob="skip" type="button">пропустить</button>`;
  document.body.appendChild(el);
  el.querySelector('.ob-go').focus({ preventScroll: true });
  const play = async () => { await ensureAudio(); if (!audio.playing) togglePlay(); };
  const done = () => { // карточка уходит по любой кнопке, Esc или касанию мимо — больше не показывается
    if (!el.parentNode) return;
    el.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    store.set('introSeen', true); // дальше подсказки ведёт расписание hints.js (оно ждёт, пока открыта эта карточка)
  };
  const onKey = (e) => { if (e.key === 'Escape') done(); };
  const onOutside = (e) => { if (!el.contains(e.target)) done(); };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onOutside, true);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ob]');
    if (!b) return;
    const act = b.dataset.ob;
    if (act === 'start') { // эфир включён — предлагаем готовые режимы
      trackEv('onboard:start');
      await play();
      el.querySelector('.ob-hi').textContent = 'Эфир играет. Чем займёмся?';
      el.querySelector('.ob-go').hidden = true;
      el.querySelector('.ob-row').hidden = false;
      el.querySelector('.ob-skip').hidden = true; // «Отдых» — это и есть просто слушать
      el.querySelector('.ob-opt').focus({ preventScroll: true });
    } else {
      if (act === 'work') { trackEv('onboard:work'); await play(); startFocus(25, 5); }
      else if (act === 'sleep') { trackEv('onboard:sleep'); await play(); startSleep(30); }
      else if (act === 'rest') { trackEv('onboard:rest'); await play(); }
      else trackEv('onboard:skip');
      done();
    }
  });
}
setTimeout(() => { // новичку (нет lg:introSeen); стриму (?obs), подарку (?mood), тестам (?test, ?freeze) — не мешать
  if (store.get('introSeen', false) || params.has('obs') || params.has('mood') || params.has('test') || FREEZE) return;
  showOnboarding();
}, 1500);
refreshWeather().then(() => { updateHud(); rotateTicker(); if (MOODS[params.get('mood')] && !FREEZE) syncRain(); });
setInterval(refreshWeather, 10 * 60e3);
if (MOODS[params.get('mood')] && !FREEZE) {
  applyMood(params.get('mood'), { withTimer: false });
  setTimeout(() => toast(`Вам подарили окно ${CITY.nameGen} с настроением «${MOODS[params.get('mood')].name}». Нажмите ▶ — и эфир зазвучит.`), 600);
  hints.markSeen('intro'); // подарок важнее общей подсказки
}
// Город со своей жизнью вне кадра (поезд: личный пробег и значки) и своими живыми панелями
function cityApi() { return { toast, openPanel, store, env, nowMs, live: clock.base == null }; }
CITYMOD.init?.(cityApi);
setInterval(() => {
  const p = CITYMOD.panels?.[panel.dataset.kind];
  if (panel.hidden || !p?.live) return;
  const body = $('#panelBody'), top = body.scrollTop;
  body.innerHTML = p.html(cityApi()); body.scrollTop = top;
}, 2000);
updateHud();
rotateTicker();
requestAnimationFrame(frame);
if (FREEZE) setInterval(() => { env = buildEnv(nowMs()); env.lampOn = room.lamp ?? lampAuto(env.sun); scene.render(env); }, 200); // рисуем и в фоновой вкладке
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
if (params.has('obs')) document.addEventListener('click', () => { if (!audio || !audio.playing) togglePlay(); }, { once: true });

// ---------- живой слой ----------
const REACT_COLORS = { heart: '#ff9ab0', note: '#f2b94a', star: '#ffe27a', moon: '#b8c8ff' };
function floatReaction(k) {
  if (document.querySelectorAll('.floaty').length >= 30) return;
  const s = document.createElement('div'); s.className = 'floaty'; s.style.color = REACT_COLORS[k];
  s.innerHTML = icon(k);
  s.style.left = 15 + Math.random() * 70 + 'vw'; s.style.top = 45 + Math.random() * 20 + 'vh';
  document.body.appendChild(s); setTimeout(() => s.remove(), 4200);
}
// Весточки вместо чата: готовые тёплые фразы, проплывают у всех, кто сейчас в этом городе.
// Свободного текста нет — модерировать нечего; сервер пропускает только номер фразы и не чаще раза в 30 с
const DEFAULT_NOTES = ['Привет из соседнего окна!', 'Тёплого вечера всем', 'Доброе утро!', 'Хорошего дня', 'Спокойной ночи',
  'Удачи на работе', 'Лёгкой учёбы', 'Пусть всё получится', 'Отдохните немного', 'Берегите себя', 'Спасибо за компанию',
  'Чай как раз заварился', 'Кот передаёт привет', 'Отличная музыка', 'Красиво сейчас за окном', 'Я тоже не сплю',
  'Хорошей дороги', 'Сегодня всё будет хорошо', 'Без спешки', 'Обнимаю', 'Работается отлично', 'Под дождь самое то',
  'Уютно здесь', 'До завтра!'];
const NOTES = CITYMOD.notes || DEFAULT_NOTES; // у окна может быть свой набор весточек (Марсоход — дорожные)
function floatNote(k, mine) {
  if (!NOTES[k] || document.querySelectorAll('.note-card').length >= 4) return;
  const d = document.createElement('div'); d.className = 'note-card px' + (mine ? ' mine' : '');
  d.innerHTML = `<small>${mine ? 'Вы' : `Кто-то у окна ${CITY.nameGen.replace(/[<>&]/g, '')}`}</small>`;
  d.append(document.createTextNode(`«${NOTES[k]}»`));
  d.style.left = 8 + Math.random() * 48 + 'vw';
  document.body.appendChild(d); setTimeout(() => d.remove(), 7500);
}
const live = connectLive({
  city: CITY.id,
  onNote: (k) => floatNote(k, false),
  onStats(m) {
    DAY?.onStats(m);
    const w = m.coins?.water?.[CITY.id];
    if (typeof w === 'number') waterCount = Math.max(waterCount ?? 0, w);
    else if (waterCount == null) waterCount = 0;
    const el = $('#live'); el.hidden = false;
    el.innerHTML = `<i></i><b>${m.here}</b> ${plural(m.here, 'слушает', 'слушают', 'слушают')} сейчас · ${m.today} сегодня`;
  },
  onReact: floatReaction,
  onJam(d) { // соседний слушатель сыграл на гитаре: тот же аккорд тише — если у нас уже есть звук
    if (!guitar || !audio || audio.ctx.state !== 'running' || document.body.classList.contains('calm')) return;
    guitar.jam(d, env);
    if (Date.now() - jamToastAt > 120000) { jamToastAt = Date.now(); toast(`Кто-то у окна ${CITY.nameGen} подыграл на гитаре.`); }
  },
});
window.__live = live;
let jamToastAt = 0;
{ // кнопка ✉: список фраз над полкой
  const btn = $('#noteBtn');
  let pop = null, lastNote = 0;
  const close = () => { pop?.remove(); pop = null; btn?.setAttribute('aria-expanded', 'false'); };
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop) return close();
    pop = document.createElement('div'); pop.className = 'note-pop px'; pop.setAttribute('role', 'menu');
    pop.innerHTML = `<div class="label">Весточка всем, кто сейчас у окна ${CITY.nameGen}:</div>` + NOTES.map((n, i) => `<button type="button" role="menuitem" data-note="${i}">${n}</button>`).join('');
    const dr = document.querySelector('.dock').getBoundingClientRect();
    pop.style.bottom = innerHeight - dr.top + 10 + 'px';
    document.body.appendChild(pop); btn.setAttribute('aria-expanded', 'true');
    pop.querySelector('button')?.focus({ preventScroll: true });
    pop.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-note]'); if (!b) return;
      ev.stopPropagation();
      const left = 30 - (Date.now() - lastNote) / 1000;
      if (left > 0) { toast(`Следующую весточку — через ${Math.ceil(left)} с.`); return; }
      lastNote = Date.now();
      live.note(+b.dataset.note); floatNote(+b.dataset.note, true); trackEv('note:send');
      close();
    });
  });
  document.addEventListener('click', (e) => { if (pop && !pop.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (pop && e.key === 'Escape') { close(); btn.focus(); } });
}
// Анонимная статистика нажатий: какие кнопки жмут (без IP и без привязки к человеку) — см. /privacy/
document.addEventListener('click', (e) => {
  const b = e.target.closest('button, a');
  if (!b) return;
  const d = b.dataset;
  const name = b.closest('.city-menu') && b.tagName === 'A' ? 'city:' + (b.getAttribute('href') || '').replace(/\//g, '')
    : b.classList.contains('city-pick') ? 'citymenu'
    : d.panel ? 'btn:' + d.panel
    : d.react ? 'react:' + d.react
    : d.act ? 'act:' + d.act
    : d.game ? 'game:' + d.game
    : d.try ? 'try:' + d.try
    : d.open ? 'open:' + d.open
    : d.share ? 'share:' + d.share
    : d.kind ? 'fbkind:' + d.kind
    : d.city ? 'vote'
    : d.pet !== undefined ? 'pet'
    : b.id ? 'btn:' + b.id
    : b.tagName === 'A' ? 'link:' + (b.hostname === location.hostname ? b.pathname.replace(/\//g, '') || 'home' : b.hostname)
    : 'btn:' + (d.icon || 'other');
  trackEv(name);
}, true);
let lastReact = 0;
document.querySelectorAll('[data-react]').forEach((b) => (b.onclick = () => {
  if (Date.now() - lastReact < 700) return;
  lastReact = Date.now();
  floatReaction(b.dataset.react); live.react(b.dataset.react);
}));

// Интерфейс прячется, когда пользователь не двигает мышь: остаётся только окно.
let idleT;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => { if (panel.hidden && !document.querySelector('.modal')) document.body.classList.add('idle'); }, 6000);
}
['mousemove', 'pointerdown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, wake, { passive: true }));
wake();
}
