// Приложение: интерфейс, время, эфир, панели. Город приходит модулем (cities/<id>/index.js):
// start(city, cities) — всё городское берётся из city, здесь нет ни одного названия города.
import { sunPosition, moonPosition, moonPhase, nextSunCross } from './astro.js';
import { weather, refreshWeather, setManual, configureWeather, WEATHER_WORDS, WEATHER_KINDS } from './weather.js';
import { createScene, W, H } from './scene.js';
import { createAudio } from './audio.js';
import { openCoinGame } from './games.js';
import { icon, mountIcons } from './icons.js';
import { connectLive, plural } from './live.js';
import { secretAt } from './street.js';

// Предметы комнаты — общие для всех городов
const ROOM_HOTSPOTS = [
  { id: 'chair', rects: [[0, 140, 92, 130]] },
  { id: 'cat', rects: [[356, 206, 50, 32]] },
  { id: 'player', rects: [[166, 219, 56, 23]] },
  { id: 'lamp', rects: [[104, 198, 36, 44]] },
  { id: 'tea', rects: [[304, 196, 20, 40]] },
  { id: 'books', rects: [[322, 222, 32, 18]] },
];
const GARLAND_HOTSPOT = { id: 'garland', rects: [[30, 4, 422, 18]] };

export function start(CITYMOD, CITIES = []) {
const CITY = CITYMOD.config;
const cityClock = (ms) => new Date(ms + CITY.utcOffset * 3600e3); // UTC-поля = местное время города
const hhmm = (d) => String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
const HOTSPOTS = [...CITYMOD.places.HOTSPOTS, ...ROOM_HOTSPOTS, ...(CITYMOD.places.ROOM_HOTSPOTS || []), GARLAND_HOTSPOT];
const { PLACES, PLACE_ORDER } = CITYMOD.places;
const CITY_SOUNDS = CITYMOD.sounds.list;
configureWeather(CITY.lat, CITY.lon);
// События по новостям: cities/<id>/data/events.json — [{ id, kind, date, from, to, title, text, source, url }]
let EVENTS = [];
fetch(`cities/${CITY.id}/data/events.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).then((d) => (EVENTS = Array.isArray(d) ? d : [])).catch(() => {});
const SECRETS = CITYMOD.skyline.SECRETS || [];
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
$('#scene').setAttribute('aria-label', `${CITY.name}: ${CITY.subtitle}`);
{ // выбор города: название — кнопка, по клику список всех городов (текущий отмечен)
  const all = CITIES.filter((c) => c.enabled);
  if (all.length > 1) {
    const h1 = $('h1');
    h1.innerHTML = `<button class="city-pick" type="button" aria-haspopup="true" aria-expanded="false" title="Другие города">${CITY.name}<span class="caret">▼</span></button>`;
    const btn = h1.firstChild, menu = document.createElement('nav');
    menu.className = 'city-menu px'; menu.hidden = true; menu.setAttribute('aria-label', 'Города');
    menu.innerHTML = all.map((c) => c.id === CITY.id
      ? `<a href="/${c.id}/" aria-current="page">${c.name}<small>вы здесь</small></a>`
      : `<a href="/${c.id}/">${c.name}<small>→</small></a>`).join('');
    document.body.appendChild(menu);
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menu.hidden) return close();
      const r = btn.getBoundingClientRect();
      menu.style.left = `${Math.max(8, r.left - 6)}px`; menu.style.top = `${r.bottom + 6}px`;
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      menu.querySelector('a:not([aria-current])')?.focus({ preventScroll: true });
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
  clock.base = Date.UTC(y, m - 1, dd) - CITY.utcOffset * 3600e3 + minutes * 60e3;
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
const room = { lamp: store.get('lamp', null), garland: store.get('garland', true), rockUntil: 0 };
const mem = { mix: store.get('mix', {}), voted: store.get('voted', null), voting: false };
const lampAuto = (sun) => sun.alt < 4 || ['rain', 'storm', 'fog', 'snow'].includes(weather.kind);
let audio = null, dial = 0.3, track = null, catPetAt = -99;
function buildEnv(ms) {
  const local = cityClock(ms);
  return {
    ms, local, weather,
    sun: sunPosition(ms, CITY.lat, CITY.lon),
    moon: moonPosition(ms, CITY.lat, CITY.lon),
    phase: moonPhase(ms),
    ...CITYMOD.env(ms, local), // мост, сезоны, лёд, матчи — у города
    torch: Date.now() < torchUntil,
    garland: room.garland,
    rock: Math.min(1, Math.max(0, (room.rockUntil - Date.now()) / 8000)) + (audio?.playing ? 0.12 : 0),
    playing: audio?.playing ?? false,
    dial: dial,
    catPetAt: catPetAt,
    event: activeEvent(local),
    forceSecret: params.get('secret'),
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
const playlistReady = fetch(CITY.playlist, { cache: 'no-store' }).then((r) => r.json()).catch(() => []);
let playlistLoaded = null; playlistReady.then((p) => (playlistLoaded = p));
function ensureAudioSync() { // синхронно: вызывается прямо в жесте пользователя
  if (audio) return audio;
  audio = createAudio(CITYMOD.sounds);
  audio.setSchedule(playlistLoaded || []);
  if (!playlistLoaded) playlistReady.then((p) => audio.setSchedule(p));
  wireAudio();
  return audio;
}
async function ensureAudio() { return ensureAudioSync(); }
function wireAudio() {
  audio.onTrack = (t) => {
    track = t;
    dial = t.count > 1 ? 0.1 + (t.index / (t.count - 1)) * 0.8 : 0.5;
    $('#npTitle').textContent = t.kind === 'gen' ? `«${t.title}»` : t.title;
    $('#npSub').textContent = t.kind === 'gen' ? 'живая вставка · сочиняется в браузере прямо сейчас' : `${CITY.radioName} · эфир синхронный для всех`;
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: CITY.radioName, album: 'Лофи-города' });
  };
  audio.setMix(mem.mix);
  audio.setMusicVol(+$('#volMusic').value);
  audio.setCityVol(+$('#volCity').value);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => { if (!audio.playing) togglePlay(); });
    navigator.mediaSession.setActionHandler('pause', () => { if (audio.playing) togglePlay(); });
  }
}
function togglePlay() {
  const a = ensureAudioSync();
  if (a.playing) a.pause(); else { a.setCityVol(+$('#volCity').value); a.play(); }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = a.playing ? 'playing' : 'paused';
  $('#play').innerHTML = icon(a.playing ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', a.playing ? 'Пауза' : 'Включить эфир');
}
$('#play').onclick = togglePlay;
$('#volMusic').oninput = (e) => { audio?.setMusicVol(+e.target.value); store.set('volMusic', +e.target.value); };
$('#volCity').oninput = (e) => { audio?.setCityVol(+e.target.value); store.set('volCity', +e.target.value); };
$('#volMusic').value = store.get('volMusic', 0.8);
$('#volCity').value = store.get('volCity', 0.7);
// Нота и город у ползунков: без звука и обратно, прежняя громкость запоминается
function setupMute(btnId, sliderId, apply) {
  const btn = $(btnId), sl = $(sliderId);
  let before = +sl.value || 0.7;
  const sync = () => btn.setAttribute('aria-pressed', String(+sl.value === 0));
  btn.onclick = async () => {
    await ensureAudio();
    if (+sl.value > 0) { before = +sl.value; sl.value = 0; } else sl.value = before || 0.7;
    apply(+sl.value); sync();
    toast(+sl.value === 0 ? (btnId === '#muteMusic' ? 'Музыка без звука' : 'Город без звука') : 'Звук вернулся');
  };
  sl.addEventListener('input', sync); sync();
}
setupMute('#muteMusic', '#volMusic', (v) => { audio?.setMusicVol(v); store.set('volMusic', v); });
setupMute('#muteCity', '#volCity', (v) => { audio?.setCityVol(v); store.set('volCity', v); });
// Горячие клавиши: по e.code, поэтому работают и в русской раскладке.
const KEY_NAMES = { Space: 'пробел', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4' };
const keyName = (code) => KEY_NAMES[code] || code.replace('Key', '');
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.code === 'Escape') { const m = document.querySelector('.modal .x'); if (m) m.click(); else panel.hidden = true; e.target.blur?.(); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (document.querySelector('.modal')) return; // в мини-игре горячие клавиши молчат
  if ((e.code === 'Space' || e.code === 'Enter') && e.target.tagName === 'BUTTON') return; // кнопка в фокусе нажимается сама
  const b = document.querySelector(`[data-key="${e.code}"]`);
  if (!b) return;
  e.preventDefault();
  wake();
  b.click();
});
// Подсказки на кнопках: название и клавиша
document.querySelectorAll('[data-tip]').forEach((b) => {
  const text = () => `${b.dataset.tip}${b.dataset.key ? ` · ${keyName(b.dataset.key)}` : ''}`;
  b.setAttribute('aria-keyshortcuts', b.dataset.key ? keyName(b.dataset.key) : '');
  b.addEventListener('mouseenter', () => {
    const tip = $('#tip'), r = b.getBoundingClientRect();
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
  lines.push(`${CITY.name}, ${hhmm(l)}. ${temp > 0 ? '+' : ''}${temp}°, ${WEATHER_WORDS[weather.kind]}${weather.wind >= 7 ? `, ветер ${Math.round(weather.wind)} м/с ${CITY.windFrom || ''}`.trimEnd() : ''}.`);
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

function updateHud() {
  $('#clock').textContent = hhmm(cityClock(nowMs())); // не зависит от кадров: в фоне rAF спит
  const temp = Math.round(weather.temp);
  $('#wx').textContent = `${temp > 0 ? '+' : ''}${temp}° ${WEATHER_WORDS[weather.kind]}`;
}
setInterval(updateHud, 1000);
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
function hotspotAt(x, y) {
  return HOTSPOTS.find((h) => h.rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh));
}
const LABELS = { cat: 'Кот — погладить', player: 'Проигрыватель — эфир вкл/выкл', lamp: 'Лампа', chair: 'Кресло-качалка', garland: 'Гирлянда', tea: 'Чай', books: 'Путеводитель', ...CITYMOD.labels };
el.addEventListener('mousemove', (e) => {
  const [x, y] = toScene(e.clientX, e.clientY);
  const h = hotspotAt(x, y);
  el.classList.toggle('hot', !!h);
  const tip = $('#tip');
  if (!h) { tip.hidden = true; return; }
  tip.hidden = false; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
  tip.textContent = LABELS[h.id] || PLACES[h.id]?.name || '';
});
el.addEventListener('mouseleave', () => ($('#tip').hidden = true));

let drag = null;
el.addEventListener('pointerdown', (e) => {
  if (drag && drag.id !== e.pointerId) return; // второй палец не перехватывает
  drag = { id: e.pointerId, x: e.clientX, pan, moved: false, wasIdle: e.pointerType !== 'mouse' && document.body.classList.contains('idle') };
});
el.addEventListener('pointercancel', () => (drag = null));
el.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId || e.pointerType === 'mouse') return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 6) drag.moved = true;
  const extra = el.getBoundingClientRect().width - innerWidth;
  if (extra > 0) { userPan = Math.min(1, Math.max(0, drag.pan - dx / extra)); layout(); }
});
el.addEventListener('pointerup', (e) => {
  if (drag && drag.id !== e.pointerId) return;
  const wasDrag = drag?.moved, wasIdle = drag?.wasIdle; drag = null;
  if (wasDrag && userPan != null) { store.set(`pan:${CITY.id}`, userPan); store.set('panHint', true); }
  if (wasDrag || wasIdle) return;
  const [x, y] = toScene(e.clientX, e.clientY);
  ensureAudioSync(); audio.ctx.resume();
  const sec = secretAt(x, y, env, SECRETS);
  if (sec) { trackEv('secret:' + sec.id); findSecret(sec); return; }
  const h = hotspotAt(x, y);
  if (!h) return;
  trackEv('spot:' + h.id);
  if (h.id === 'cat') { catPetAt = nowMs() / 1000; audio.sfx('purr'); hearts(e.clientX, e.clientY); toast(CITYMOD.toasts?.cat || 'Кот мурчит.'); return; }
  if (h.id === 'player') { togglePlay(); return; }
  if (h.id === 'lamp') { toggleLamp(); return; }
  if (h.id === 'garland') { toggleGarland(); return; }
  if (h.id === 'chair') { room.rockUntil = Date.now() + 12000; audio.sfx('creak'); toast(CITYMOD.toasts?.chair || 'Кресло-качалка поскрипывает.'); return; }
  if (h.id === 'tea') { audio.sfx('clink'); toast(CITYMOD.toasts?.tea || 'Горячий чай.', DONATE); return; }
  if (CITYMOD.onHotspot?.(h.id, { toast, env, openGame: (k) => openCoinGame(k, { sfx: audio.sfx, live: window.__live, targets: CITYMOD.places.games }) })) return;
  if (h.id === 'books') { openPanel('places'); return; }
  openPanel('place', h.id);
});
// Найденные секреты города — в localStorage (и в памяти для приватного режима)
const foundKey = `secrets:${CITY.id}`;
const found = new Set(store.get(foundKey, []));
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
function toast(text, link) { // link: { href, label } — тихая ссылка под текстом (собираем через DOM, без innerHTML)
  const t = $('#toast'); t.textContent = text; t.hidden = false;
  if (link) {
    const a = document.createElement('a');
    a.href = link.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = link.label; a.className = 'toast-link';
    t.append(document.createElement('br'), a);
  }
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), link ? 6000 : 3500);
}

// ---------- панели ----------
const panel = $('#panel');
$('#panelClose').onclick = () => (panel.hidden = true);
mountIcons();
function toggleLamp() { // совпало с автоматикой — снова «авто»
  const next = !(room.lamp ?? lampAuto(env.sun));
  room.lamp = next === lampAuto(env.sun) ? null : next; store.set('lamp', room.lamp); audio?.sfx('click');
}
function syncRain() { $('#qRain').classList.toggle('on', weather.source === 'manual' && weather.kind === 'rain'); }
function toggleGarland() { room.garland = !room.garland; store.set('garland', room.garland); $('#qGarland').classList.toggle('on', room.garland); audio?.sfx('click'); }
$('#qLamp').onclick = async () => { await ensureAudio(); toggleLamp(); };
$('#qGarland').onclick = async () => { await ensureAudio(); toggleGarland(); };
$('#qGarland').classList.toggle('on', room.garland);
$('#qRain').onclick = () => {
  const on = !(weather.source === 'manual' && weather.kind === 'rain');
  setManual(on ? 'rain' : null);
  syncRain();
  toast(on ? 'Включили дождь. Выключить — ещё раз.' : 'Погода снова настоящая.');
};
$('#badgeNow').onclick = () => { backToNow(); };

// ---------- таймеры: фокус и сон ----------
const timer = { kind: null, end: 0, phase: 'focus', work: 25, rest: 5 };
function startFocus(work, rest) { Object.assign(timer, { kind: 'focus', phase: 'focus', work, rest, end: Date.now() + work * 60e3 }); toast(`Фокус ${work} минут. Куранты позовут на перерыв.`); }
function startSleep(min) { Object.assign(timer, { kind: 'sleep', end: Date.now() + min * 60e3 }); toast(`Эфир тихо уснёт через ${min} минут.`); }
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
  const tag = p.inScene ? '<span class="tag live">в кадре</span>' : p.soon ? `<span class="tag">${p.soon}</span>` : '<span class="tag">мини-игра</span>';
  let btn = '';
  if (p.action) btn = `<button class="btn primary" data-act="${id}">${p.action.label}</button>`;
  if (p.game && CITYMOD.places.games?.[p.game]) btn = `<button class="btn primary" data-game="${p.game}">Бросить монетку</button>`;
  if (p.game === 'cat') btn = '<button class="btn primary" data-pet="1">Погладить Елисея</button>';
  return `<div class="card"><h3>${p.name}${tag}</h3><p>${p.fact}</p>${btn}</div>`;
}

function openPanel(kind, arg) {
  panel.hidden = false; panel.dataset.kind = kind;
  const body = $('#panelBody');
  if (kind === 'place') {
    $('#panelTitle').textContent = 'В кадре';
    body.innerHTML = placeCard(arg) + `<div class="card"><button class="btn" data-open="places">Все места ${CITY.nameGen} →</button></div>`;
  } else if (kind === 'places') {
    $('#panelTitle').textContent = `Места ${CITY.nameGen}`;
    const secretsHtml = SECRETS.length ? `<div class="card"><h3>Секреты города: найдено ${[...found].filter((id) => SECRETS.some((s) => s.id === id)).length} из ${SECRETS.length}</h3>` +
      SECRETS.map((s) => (found.has(s.id) ? `<p>✓ <b>${s.name}</b> — ${s.found}</p>` : `<p>? ${s.hint}</p>`)).join('') + '</div>' : '';
    body.innerHTML = `<p class="label">${CITYMOD.placesIntro || ''}</p>` + secretsHtml + PLACE_ORDER.map(placeCard).join('');
  } else if (kind === 'sounds') {
    $('#panelTitle').textContent = 'Звуки города';
    const mix = mem.mix;
    body.innerHTML = `<p class="label">${CITYMOD.sounds.intro || ''}</p>` +
      CITY_SOUNDS.map((s) => `<div class="row"><div class="name">${s.name}<small>${s.hint}</small></div>
        <input type="range" min="0" max="2" step="0.05" value="${mix[s.id] ?? 1}" data-snd="${s.id}"><output>${Math.round((mix[s.id] ?? 1) * 100)}%</output></div>`).join('') +
      `<div class="chips">${(CITYMOD.sounds.tryButtons || []).map(([k, n]) => `<button class="btn" data-try="${k}">${n}</button>`).join('')}</div>`;
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
    $('#panelTitle').textContent = 'Фокус и сон';
    body.innerHTML = `<div class="big" id="timerBig">--:--</div>
      <div class="label">Фокус — работа и перерывы по кругу, сигнал — куранты</div>
      <div class="chips"><button class="chip" data-focus="25,5">25 / 5</button><button class="chip" data-focus="50,10">50 / 10</button><button class="chip" data-focus="90,15">90 / 15</button></div>
      <div class="label">Сон — эфир плавно затихнет</div>
      <div class="chips"><button class="chip" data-sleep="15">15 мин</button><button class="chip" data-sleep="30">30 мин</button><button class="chip" data-sleep="60">60 мин</button><button class="chip" data-sleep="90">90 мин</button></div>
      <button class="btn" id="timerStop">Остановить таймер</button>`;
    body.querySelectorAll('[data-focus]').forEach((b) => (b.onclick = async () => { await ensureAudio(); if (!audio.playing) togglePlay(); const [w, r] = b.dataset.focus.split(',').map(Number); startFocus(w, r); }));
    body.querySelectorAll('[data-sleep]').forEach((b) => (b.onclick = async () => { await ensureAudio(); if (!audio.playing) togglePlay(); startSleep(+b.dataset.sleep); }));
    $('#timerStop').onclick = () => { stopTimer(); $('#timerBig').textContent = '--:--'; };
  } else if (kind === 'share') {
    const { png, url, text } = arg;
    $('#panelTitle').textContent = 'Поделиться окном';
    const q = encodeURIComponent;
    body.innerHTML = `<div class="card"><img class="share-preview" src="${png}" alt="Кадр окна: ${CITY.name}">
      <div class="share-row">
        <a class="btn primary" data-share="tg" href="https://t.me/share/url?url=${q(url)}&text=${q(text)}" target="_blank" rel="noopener">Telegram</a>
        <a class="btn" data-share="vk" href="https://vk.com/share.php?url=${q(url)}&title=${q(text)}" target="_blank" rel="noopener">ВКонтакте</a>
        <a class="btn" data-share="download" href="${png}" download="lofi-${CITY.id}.png">Скачать картинку</a>
        <button class="btn" data-share="copy" id="shareCopy">Скопировать ссылку</button>
      </div><p class="label">Картинку можно приложить к посту — в ней время и погода прямо сейчас.</p></div>`;
    $('#shareCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); } catch { toast(url); }
    };
  } else if (kind === 'about') {
    $('#panelTitle').textContent = 'О проекте';
    const cities = ['Москва', 'Выборг', 'Псков', 'Кострома', 'Томск', 'Пермь', 'Новосибирск', 'Байкал', 'Тобольск', 'Транссиб']; // кандидаты: городов из списка на сайте пока нет
    const cityChips = CITIES.filter((c) => c.enabled).map((c) => `<a class="chip ${c.id === CITY.id ? 'on' : ''}" href="/${c.id}/">${c.name}</a>`).join('');
    body.innerHTML = `<div class="card">${CITYMOD.about || ''}
      <p>Для стрима добавьте к адресу <b>?obs</b>.</p></div>

      <div class="card"><h3>Поддержать проект</h3>
      <p>Сайт бесплатный и без рекламы. Если окно помогает работать или отдыхать — можно угостить автора чаем: донаты идут на сервер, видеокарту для новой музыки и новые города.</p>
      <div class="row"><a class="btn primary" href="${DONATE.href}" target="_blank" rel="noopener">Поддержать ☕</a></div></div>
      ${cityChips ? `<div class="card"><h3>Города</h3><div class="chips">${cityChips}</div></div>` : ''}
      <div class="card"><h3>Горячие клавиши</h3><p>Пробел — эфир · L — лампа · G — гирлянда · R — дождь · T — таймер · S — звуки · P — места · W — время · F — экран · H — о проекте · X — поделиться окном · 1–4 — реакции · Esc — закрыть</p></div>

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
      <p>Шрифты Pangolin, Handjet и Press Start 2P — SIL Open Font License 1.1, <a href="/fonts/OFL.txt" target="_blank" rel="noopener">текст лицензии и авторские права</a>.</p>
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
    await ensureAudio(); const k = b.dataset.try; audio.sfx(k, ...({ chime: [4, 60], hours: [3, 60] }[k] || []));
  }));
}

$('#fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

// ---------- поделиться окном ----------
// Картинка 1200×630 из текущего кадра (пиксели без размытия) с подписью: город, время, погода, адрес.
async function shareImage() {
  scene.render(env);
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(el, 0, 0, W, 252, 0, 0, 1200, 630);
  const grad = g.createLinearGradient(0, 430, 0, 630);
  grad.addColorStop(0, 'rgba(20,14,18,0)'); grad.addColorStop(1, 'rgba(20,14,18,0.92)');
  g.fillStyle = grad; g.fillRect(0, 430, 1200, 200);
  try { await document.fonts.load('64px Lofi', CITY.name); } catch {}
  g.fillStyle = '#f3e6c8'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowOffsetX = g.shadowOffsetY = 3;
  g.font = '64px Lofi, sans-serif'; g.fillText(CITY.name, 48, 548);
  g.font = '32px Lofi, sans-serif';
  const temp = Math.round(weather.temp);
  g.fillText(`${hhmm(cityClock(nowMs()))} · ${temp > 0 ? '+' : ''}${temp}° ${WEATHER_WORDS[weather.kind]} · lofi-goroda.ru`, 50, 596);
  return c;
}
async function shareWindow() {
  trackEv('share:open');
  const url = `https://lofi-goroda.ru/${CITY.id === 'piter' ? '' : CITY.id + '/'}?from=share`;
  const temp = Math.round(weather.temp);
  const text = `Сейчас в окне ${CITY.name}: ${hhmm(cityClock(nowMs()))}, ${temp > 0 ? '+' : ''}${temp}° ${WEATHER_WORDS[weather.kind]}. Лофи-радио с живым окном в город:`;
  const c = await shareImage();
  // на телефоне — системное меню «Поделиться» с картинкой; на компьютере — своя панель
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare) {
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], `lofi-${CITY.id}.png`, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `${text} ${url}` }); trackEv('share:native'); } catch {}
      return;
    }
  }
  openPanel('share', { png: c.toDataURL('image/png'), url, text });
}
$('#shareBtn').onclick = shareWindow;

// ---------- старт ----------
setTimeout(() => {
  if (store.get('panHint', false) || !matchMedia('(pointer: coarse)').matches || panExtra < innerWidth * 0.25) return;
  if (!$('#toast').hidden || !panel.hidden) return;
  store.set('panHint', true);
  toast('Проведите пальцем по окну ← → — за краями ещё полгорода.');
}, 6000);
refreshWeather().then(() => { updateHud(); rotateTicker(); });
setInterval(refreshWeather, 10 * 60e3);
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
const live = connectLive({
  city: CITY.id,
  onStats(m) {
    const el = $('#live'); el.hidden = false;
    el.innerHTML = `<i></i><b>${m.here}</b> ${plural(m.here, 'слушает', 'слушают', 'слушают')} сейчас · ${m.today} сегодня`;
  },
  onReact: floatReaction,
});
window.__live = live;
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
