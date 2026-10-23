// Дорога: окно из машины Давида, который едет из Владивостока в Москву по трассам
// А-370, Р-297 «Амур», Р-258, Р-255, М-12. Где он сейчас, берётся из его же вестей (/live/road,
// route.js): между точками машина едет по модели — днём 70 км/ч, ночью стоит. Солнце, погода
// и часовой пояс — по месту машины. Эфир — музыка Транссиба (своей пока нет).

import * as skyline from './skyline.js';
import { carAt, placeAt, loadState, live, whereLine, sightNear, regionAt, STOPS, eveningInfo, eveningWord, tempText, nextMorning } from './route.js';
import { routeHtml } from './journey.js';
import { playlistFor, radioLine } from './radio.js';
import { weather } from '../../engine/weather.js';

live.state = await loadState();
live.notes = live.state.notes || 0; // весточек в дорогу за поездку (сервер считает, /live/road отдаёт)

// Дорожные весточки: готовые тёплые фразы, номер уходит на сервер как у всех городов (до NOTES=24).
// Движок пока берёт общий набор — см. отчёт: нужен хук CITYMOD.notes в site/engine/app.js
const NOTES = ['Тёплой дороги!', 'Осторожно на перевале', 'Ждём в Москве', 'Хорошего привала', 'Байкал передаёт привет',
  'Не гони — красота же', 'Чай не остыл?', 'Сибирь большая, но вы справитесь', 'Гудим вместе — би-би!',
  'Пусть трасса будет сухой', 'Удачи на М-12', 'Мягкой стоянки и тихой ночи'];

const CITY = {
  id: 'doroga',
  name: 'Марсоход',
  nameGen: 'Марсохода',
  greet: 'Привет с Марсохода',
  subtitle: 'Давид, «Грузин на Марсе»: Владивосток — Москва',
  radioName: 'Радио Марсохода',
  windFrom: 'над трассой',
  playlist: 'cities/transsib/music/playlist.json',
  ...placeAt(carAt(Date.now(), live.state).km), // lat, lon, utcOffset — где машина сейчас; дальше их обновляет locate
  viewAzimuth: 270, // смотрим вперёд через лобовое стекло: машина едет на запад, закаты по курсу
  fov: 100,
  timePresets: [['06-21', 'лето, Байкал без льда'], ['09-25', 'золотая тайга'], ['01-15', 'сибирский мороз']],
};

const carNow = (ms) => carAt(ms, live.state);

// Снег на земле — по настоящей погоде там, где машина (снежный покров Open-Meteo), а не по календарю:
// поездка идёт в октябре–ноябре, и в один день в Забайкалье уже снег, а на Амуре сухая трава.
// Без данных о покрове — по календарю (ноябрь–март).
function snowCover(mo, day) {
  if (weather.kind === 'snow' && weather.temp < 1) return true;
  if (weather.snowDepth != null) return weather.snowDepth >= 0.01;
  return mo >= 11 || mo <= 3 || (mo === 4 && day < 25);
}

function env(ms, local) {
  const mo = local.getUTCMonth() + 1, day = local.getUTCDate();
  const car = carNow(ms);
  return {
    car,
    notes: live.notes, // стикеры весточек на торпеде
    train: { km: car.rail, speed: car.speed, dir: -1, at: null }, // для совместимости со скайлайном Транссиба
    covered: false,
    winter: snowCover(mo, day),
    autumn: !snowCover(mo, day) && ((mo === 9 && day >= 5) || mo === 10 || mo === 11),
  };
}

const locate = (ms) => placeAt(carNow(ms).km);

// Дата старта «19.10» — по Владивостоку
const dm = (ms) => { const d = new Date(ms + 10 * 3600e3); return `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

// Подзаголовок: участок между крупными городами и что делает машина
function subtitleAt(ms) {
  const c = carNow(ms), seg = `${c.segFrom.name} → ${c.segTo.name}`;
  if (c.status === 'soon') return c.startMs > ms ? `старт ${dm(c.startMs)}` : 'скоро старт';
  if (c.status === 'done') return 'Доехали до Москвы';
  if (c.status === 'pause') return `${seg} · пауза`;
  if (c.staleH) return `${seg} · давно нет вестей`;
  return `${seg} · ${c.parked ? (c.night ? 'стоянка: ночь' : 'стоянка') : 'Давид в пути'}`;
}

// Ближайшие события для строки «Что сейчас»: старт или ближайший крупный город впереди
function moments(e) {
  const c = e.car || carNow(e.ms);
  if (c.status === 'soon') return c.startMs > e.ms ? [{ title: 'старт из Владивостока', atMs: c.startMs }] : [];
  if (c.status !== 'run' || c.staleH) return [];
  const out = [];
  if (c.parked && c.night) out.push({ title: 'выезд после привала', atMs: nextMorning(e.ms, c.km) }); // привал до 08:00, утром дальше
  const target = STOPS.find((s) => s.big && s.km > c.km + 5);
  if (!target) return out;
  // когда доедет по модели: шагаем вперёд по получасу, пока км не дойдёт до города (в пределах 36 часов)
  for (let t = e.ms + 1800e3; t < e.ms + 36 * 3600e3; t += 1800e3) {
    if (carNow(t).km >= target.km) return [...out, { title: `впереди: ${target.name}`, atMs: t }];
  }
  return out;
}

// Приметы участков по километрам дороги: [от км, до км, строка]
const ALONG = [
  [0, 330, 'Уссурийская тайга: кедр, дуб и маньчжурский орех, сопки до горизонта.'],
  [700, 830, 'Хабаровск стоит на Амуре: река здесь широкая, как море.'],
  [1510, 2925, 'Амурская трасса — зимник и мерзлота: дорога идёт по тайге, где зима долгая, а лето короткое.'],
  [2925, 3300, 'Яблоновый хребет за Читой: перевалы и степные увалы Даурии.'],
  [3900, 3960, 'Байкал у Култука: южная оконечность озера, дорога идёт совсем рядом с водой.'],
  [5050, 5120, 'Красноярск на Енисее: за городом заповедные Столбы.'],
  [5860, 5910, 'Новосибирск стоит на Оби — одной из самых больших рек страны.'],
  [6100, 6500, 'Барабинская степь: поля, берёзовые колки и солёные озёра.'],
  [7500, 7800, 'За Екатеринбургом начинается Урал — невысокие лесистые увалы.'],
  [8400, 8540, 'Казань стоит на Волге, в неё здесь впадает Казанка; ниже по течению к Волге выходит Кама.'],
  [8850, 8900, 'Нижний Новгород стоит на слиянии Оки и Волги.'],
];

// «Вечерний привал»: с 20:00 до 23:00 местного первыми строками — сводка дня, погода у Давида, что завтра
function eveningLines(e) {
  const ev = eveningInfo(e.ms, live.state);
  if (!ev) return [];
  if (ev.kind === 'soon') return [ev.text];
  const t = e.weather && Number.isFinite(e.weather.temp) ? e.weather.temp : null;
  return [ev.summary, ...(t == null ? [] : [`Сейчас у Давида ${tempText(t)} — ${eveningWord(t)} вечер.`]), ...(ev.tomorrow ? [ev.tomorrow] : [])];
}

function ticker(e) {
  const c = e.car, lines = [...eveningLines(e), whereLine(c)];
  for (const [a, b, line] of ALONG) if (c.km >= a && c.km <= b) lines.push(line);
  if (c.parked) { // на стоянке: что рядом интересного — достопримечательность или стела региона
    const sn = sightNear(c.km);
    if (sn) lines.push(sn.sight.line[0].toUpperCase() + sn.sight.line.slice(1) + (/[.!]$/.test(sn.sight.line) ? '' : '.'));
    else if (regionAt(c.km)) lines.push(`У дороги стоит стела «${regionAt(c.km)}».`);
  }
  if (c.parked && c.night && c.status === 'run') lines.push('Ночью машина стоит: Давид отдыхает, утром дальше.');
  if (e.autumn) lines.push('Осень: берёзы вдоль трассы золотые, лиственницы роняют хвою.');
  if (e.winter) lines.push('На обочинах снег: на мостах и перевалах скользко.');
  else if (weather.temp <= 0) lines.push('Подмораживает: на обочинах иней, на мостах скользко.');
  lines.push(radioLine(e) + '.'); // эфир меняется по участку — как FM в машине
  lines.push('Чай из термоса — единственный горячий уголок на трассе.');
  return lines;
}

const GEN_TITLES = {
  places: [['Владивосток', 'во Владивостоке'], ['Хабаровск', 'в Хабаровске'], ['Чита', 'в Чите'], ['Улан-Удэ', 'в Улан-Удэ'], ['Иркутск', 'в Иркутске'], ['Красноярск', 'в Красноярске'], ['Новосибирск', 'в Новосибирске'], ['Омск', 'в Омске'], ['Екатеринбург', 'в Екатеринбурге'], ['Казань', 'в Казани'], ['Москва', 'в Москве'], ['трасса', 'на трассе']],
  things: ['дорожный атлас', 'термос с чаем', 'ремень безопасности', 'километровые столбики', 'встречные фуры', 'заправка', 'ночная стоянка', 'навигатор', 'асфальт', 'обочина'],
};

const sounds = {
  genTitles: GEN_TITLES,
  list: [
    { id: 'rain', name: 'Дождь', hint: 'по реальной погоде' },
    { id: 'wind', name: 'Ветер', hint: 'по скорости ветра' },
    { id: 'city', name: 'Гул дороги', hint: 'шины и мотор вдалеке' },
    { id: 'birds', name: 'Птицы', hint: 'летом на стоянках' },
  ],
  bedScale: { water: 0 }, // реки слышны только с мостов — постоянный плеск не нужен
  intro: 'Звуки синтезируются в браузере и следуют за погодой там, где сейчас Давид: дождь, ветер, ровный гул дороги.',
  tryButtons: [['swift', 'Птицы']],
  tick(e, { t, day, chance, sfx }) {
    const c = e.car, mo = e.local.getUTCMonth() + 1;
    if (c.parked && day && mo >= 5 && mo <= 8 && chance(1)) sfx.swift(t);
  },
};

// Пейзаж движется, поэтому места — крупные зоны кадра; Байкал (слева у горизонта, на юге) и Амур (мост) — только на своих участках (см. hotspotOn)
const HOTSPOTS = [
  { id: 'atlas', rects: [[100, 189, 44, 40]], front: true }, // дорожный атлас на торпеде слева у стекла
  { id: 'stickers', rects: [[148, 205, 112, 20]] },        // стикеры весточек на торпеде у стекла
  { id: 'baikal', rects: [[0, 130, 230, 44]] },
  { id: 'amur', rects: [[0, 168, 480, 36]] },
  { id: 'sight', rects: [[100, 104, 100, 72]] }, // достопримечательность на стоянке — впереди-слева у горизонта
];

const PLACES = {
  doroga: { name: 'Дорога Владивосток — Москва', fact: 'Примерно 9300 километров по автодорогам: А-370 «Уссури», Р-297 «Амур» (её открыли целиком в 2010 году), Р-258 «Байкал», Р-255 «Сибирь», Р-254 «Иртыш», а от Казани — М-12. Через весь материк на машине, с ночёвками.' },
  baikal: { inScene: true, name: 'Байкал', fact: 'Самое глубокое озеро мира — 1642 метра. Трасса Р-258 носит его имя и проходит рядом с южной оконечностью озера, у Култука.' },
  amur: { inScene: true, name: 'Амур', fact: 'Одна из великих рек Дальнего Востока. Федеральная трасса Р-297 названа в его честь; её открыли для сквозного проезда целиком в 2010 году.' },
};
const PLACE_ORDER = ['doroga', 'baikal', 'amur'];

// Давид — Давид Расоев, автор канала «Грузин на Марсе» (согласие владелец получил устно, 16.10)
const LINKS = [
  ['Telegram', 'https://t.me/Gruzin_and_Mars'],
  ['YouTube', 'https://www.youtube.com/@Gruzin_na_Marse'],
  ['VK', 'https://vk.com/gruzin_na_marse'],
];
const LOGO_URL = new URL('./gruzin.png', import.meta.url).href;

// Плашка «Едет: Грузин на Марсе» под подзаголовком и оранжевые акценты страницы (body сбрасывается при смене города)
function brand() {
  document.body.classList.add('city-doroga');
  const sub = document.querySelector('.sub');
  if (!sub || document.querySelector('.poputchik')) return;
  const el = document.createElement('div');
  el.className = 'poputchik';
  el.innerHTML = `<img src="${LOGO_URL}" alt="" width="20" height="20"><span>Едет: <b>Грузин на Марсе</b></span>`
    + LINKS.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('');
  sub.insertAdjacentElement('afterend', el);
}

export default {
  config: CITY,
  locate,
  subtitleAt,
  skyline,
  sounds,
  env,
  ticker,
  playlistFor, // волна эфира по участку дороги (radio.js)
  moments,
  places: { HOTSPOTS, ROOM_HOTSPOTS: [{ id: 'david', rects: [[388, 54, 92, 150]] }], // Давид за рулём справа
    // предметы комнаты на торпеде: кот у стекла слева, бардачок с картами, консоль с магнитолой, термосом и фонариком
    ROOM_RECTS: { cat: [[16, 197, 62, 21]], books: [[6, 232, 150, 32]], player: [[186, 232, 66, 26]], tea: [[262, 214, 28, 36]], lamp: [[304, 206, 30, 44]], chair: [[-20, 0, 1, 1]], yarn: [[-20, 0, 1, 1]] }, PLACES, PLACE_ORDER, games: {} },
  hotspotOn: (id, env) => {
    if (id === 'stickers') return live.notes > 0; // стикеры видны только когда весточки были
    const c = env?.car;
    if (id === 'baikal') return !!c && c.km > 3880 && c.km < 3980; // южная оконечность Байкала
    if (id === 'amur') return !!c && !c.parked && c.km > 720 && c.km < 840; // Амур у Хабаровска — на ходу, по мосту; на стоянке воды в кадре нет
    if (id === 'sight') return !!c && c.parked && !!sightNear(c.km);
    if (id === 'garland' || id === 'geranium' || id === 'curtain' || id === 'chair' || id === 'yarn') return false; // в машине их нет
    return true;
  },
  // Раз в пять минут перечитываем вести Давида
  init() {
    brand();
    // каждая проплывшая карточка-весточка (своя или чужая) сразу добавляет стикер; опрос сервера потом выравнивает счёт
    const mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n.classList && n.classList.contains('note-card')) live.notes++;
    });
    mo.observe(document.body, { childList: true });
    // раз в минуту перечитываем вести Давида и счётчик весточек (ответ кэшируется на минуту)
    const iv = setInterval(async () => {
      if (!document.body.classList.contains('city-doroga')) { clearInterval(iv); mo.disconnect(); return; } // ушли в другой город
      live.state = await loadState();
      live.notes = Math.max(live.notes, live.state.notes || 0);
    }, 60e3);
  },
  notes: NOTES, // набор фраз для весточек окна (нужен хук в движке)
  labelAt: (id, env) => (id === 'stickers' ? `Весточки в дорогу: ${live.notes}` : id === 'sight' && env?.car ? (sightNear(env.car.km)?.sight.name || '') : ''),
  panels: { route: { title: 'Маршрут', live: true, html: routeHtml } },
  labels: { player: 'Магнитола — эфир вкл/выкл', lamp: 'Фонарик', books: 'Дорожные карты', cat: 'Кот — погладить', david: 'Давид, «Грузин на Марсе»', chair: 'Сиденье', atlas: 'Дорожный атлас: где Давид', stickers: 'Весточки в дорогу', tea: 'Термос с чаем' },
  toasts: { chair: 'Сиденье с ремнём: в этой машине едут не торопясь.', cat: 'Кот едет с Давидом: свернулся на торпеде у стекла и мурчит под гул дороги.', tea: 'Чай из термоса: ещё горячий.' },
  onHotspot(id, api) {
    if (id === 'sight') { const sn = api.env?.car && sightNear(api.env.car.km); if (sn) { api.toast(`${sn.stop.name}: ${sn.sight.line}.`); return true; } }
    if (id === 'atlas') { api.openPanel('route'); return true; }
    if (id === 'stickers') { api.toast(`Весточки в дорогу: ${live.notes}. Их оставили те, кто заходил к окну этой поездки.`); return true; }
    if (id === 'david') { api.toast('Давид — автор канала «Грузин на Марсе»: машины и дороги. Ссылки на его каналы — под названием окна.'); return true; }
    return false;
  },
  placesIntro: 'Нажмите на пейзаж за окном или выберите здесь.',
  about: `<p>«Марсоход» — окно из машины Давида: автор канала «Грузин на Марсе» едет на праворульном Honda Stepwgn из Владивостока в Москву: около 9300 километров по настоящим трассам, через весь материк. Окно показывает, где он сейчас, по его собственным вестям: чуть с задержкой и без точного места — только участок между крупными городами. Ночёвки не показываем, ночью машина стоит.</p>
      <p>Каналы Давида: <a href="https://t.me/Gruzin_and_Mars" target="_blank" rel="noopener">Telegram</a> · <a href="https://www.youtube.com/@Gruzin_na_Marse" target="_blank" rel="noopener">YouTube</a> · <a href="https://vk.com/gruzin_na_marse" target="_blank" rel="noopener">VK</a>.</p>
      <p>Время, солнце и погода — там, где сейчас Давид. Пока вестей нет, окно просто ждёт старта; радио в машине ловит местные волны — на каждом участке своя музыка, а между треками звучат живые вставки, которые сочиняются прямо в браузере.</p>`,
  timeIntro: 'По умолчанию всё настоящее: местное время там, где сейчас Давид, и погода с Open-Meteo. Здесь можно заглянуть в другое время — машина тоже переедет.',
};
