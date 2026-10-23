// Санкт-Петербург, Фонтанка — второе окно Санкт-Петербурга. Вид через Фонтанку на Михайловский замок,
// Летний сад и Чижика-Пыжика. Эфир — общий с основным окном (cities/piter/music), мини-игра «монетка Чижику» — оттуда же.

import * as skyline from './skyline.js';
import { stalls } from './skyline.js';
import { TARGETS } from '../piter/games.js';

const CITY = {
  id: 'fontanka',
  name: 'Фонтанка',
  nameGen: 'Фонтанки',
  subtitle: 'Санкт-Петербург: Михайловский замок и Летний сад',
  radioName: 'Радио Санкт-Петербург',
  greet: 'Привет с Фонтанки',
  windFrom: 'с Невы',
  playlist: 'cities/piter/music/playlist.json',
  lat: 59.94,
  lon: 30.34,
  utcOffset: 3,
  viewAzimuth: 270, // с восточного берега Фонтанки на запад
  fov: 110,
  timePresets: [['06-22', 'белые ночи'], ['10-05', 'золотая осень'], ['01-15', 'Фонтанка подо льдом']],
};
const cityClock = (ms) => new Date(ms + CITY.utcOffset * 3600e3);

function env(ms, local) {
  const mo = local.getUTCMonth() + 1, day = local.getUTCDate();
  return {
    winter: mo === 12 || mo <= 3 || (mo === 11 && day >= 25),
    frozen: mo === 1 || mo === 2 || (mo === 3 && day <= 25) || (mo === 12 && day >= 15),
    autumn: (mo === 9 && day >= 10) || mo === 10 || (mo === 11 && day < 25),
    navigation: (mo >= 5 && mo <= 9) || (mo === 4 && day >= 25) || (mo === 10 && day <= 15),
  };
}
// полуденная пушка с Нарышкина бастиона слышна и здесь
function audioEvents(e, prevMs) {
  const noon = (m) => { const l = cityClock(m); return l.getUTCHours() * 3600 + l.getUTCMinutes() * 60 + l.getUTCSeconds(); };
  return { cannonNow: noon(prevMs) < 43200 && noon(e.ms) >= 43200 && e.ms - prevMs < 5000 };
}

function ticker(e) {
  const lines = [], h = e.local.getUTCHours(), mo = e.local.getUTCMonth() + 1;
  if (e.frozen) lines.push('Фонтанка подо льдом — кораблики ждут весны.');
  else if (e.navigation && h >= 10 && h <= 23) lines.push('По Фонтанке идут прогулочные катера — под мостами гид просит пригнуться.');
  if (mo >= 5 && mo <= 7 && e.sun.alt < 0 && e.sun.alt > -10) lines.push('Белые ночи: над Михайловским замком светлое небо.');
  if (h === 11) lines.push('В полдень с Петропавловской крепости стреляет пушка — слышно и здесь.');
  lines.push('У Первого Инженерного моста сидит Чижик-Пыжик — попробуйте попасть в него монеткой.');
  const st = stalls(e);
  if (st.includes('boats')) lines.push('На набережной зазывают на кораблики: «Реки и каналы, отправление через пять минут!»');
  return lines;
}

const sounds = {
  genTitles: { places: [['Фонтанка', 'на Фонтанке'], ['Летний сад', 'в Летнем саду'], ['Инженерная', 'на Инженерной'], ['Марсово поле', 'на Марсовом поле'], ['Мойка', 'на Мойке'], ['Пантелеймоновская', 'на Пантелеймоновской'], ['Литейный', 'на Литейном']],
    things: ['чижик', 'кораблик', 'пышки', 'белые ночи', 'гранит', 'ограда Летнего сада', 'жёлтые окна', 'кот на подоконнике'] },
  list: [
    { id: 'rain', name: 'Дождь', hint: 'по реальной погоде' },
    { id: 'water', name: 'Фонтанка', hint: 'зимой подо льдом' },
    { id: 'wind', name: 'Ветер с Невы', hint: 'по скорости ветра' },
    { id: 'city', name: 'Город вдали', hint: 'тише ночью' },
    { id: 'gulls', name: 'Чайки', hint: 'днём' },
    { id: 'cannon', name: 'Полуденная пушка', hint: '12:00, с Петропавловки' },
    { id: 'ships', name: 'Катера', hint: 'в навигацию' },
    { id: 'cat', name: 'Кот', hint: 'погладьте его' },
    { id: 'tea', name: 'Ложечка в стакане', hint: 'чай с пышками' },
  ],
  intro: 'Звуки синтезируются в браузере и следуют за погодой и временем.',
  tryButtons: [['cannon', 'Пушка'], ['horn', 'Катер'], ['gull', 'Чайки']],
  tick(e, { t, h, day, chance, sfx }) {
    if (day && !e.frozen && chance(0.8)) sfx.gull(t);
    if (e.navigation && h >= 10 && h <= 23 && chance(0.12)) sfx.horn(t);
    if (e.cannonNow) sfx.cannon(t);
  },
};

const HOTSPOTS = [
  { id: 'chizhik', rects: [[258, 156, 16, 12]] },
  { id: 'spire', rects: [[154, 30, 18, 42]] },
  { id: 'castle', rects: [[70, 72, 180, 86]] },
  { id: 'ingbridge', rects: [[248, 140, 36, 16]] },
  { id: 'garden', rects: [[284, 104, 152, 50]] },
  { id: 'pantbridge', rects: [[436, 134, 44, 22]] },
  { id: 'coffee', rects: [[232, 190, 20, 20]] },
  { id: 'pyshki', rects: [[318, 190, 20, 20]] },
];

const PLACES = {
  chizhik: { name: 'Чижик-Пыжик', fact: 'Крошечный бронзовый чижик на уступе гранитной стены у Первого Инженерного моста, появился в 1994 году. Монетку бросают с парапета: попасть на уступ — к удаче. Нажмите — попробуйте.', inScene: true },
  castle: { name: 'Михайловский замок', fact: 'Построен в 1797–1801 годах для Павла I, который прожил в нём всего сорок дней и здесь же погиб. Его ещё называют Инженерным: в XIX веке в нём было Инженерное училище. Сейчас — часть Русского музея.', inScene: true },
  spire: { name: 'Шпиль замка', fact: 'Золочёный шпиль над церковью Михаила Архангела — его видно и с Невского, и с Фонтанки.', inScene: true },
  ingbridge: { name: 'Первый Инженерный мост', fact: 'Чугунный мост первой половины XIX века у Михайловского замка — рядом с ним и живёт Чижик-Пыжик.', inScene: true },
  garden: { name: 'Летний сад', fact: 'Сад Петра I, заложен в 1704 году. Его ограду со стороны Невы, работы Юрия Фельтена, называют одной из самых красивых в мире.', inScene: true },
  pantbridge: { name: 'Пантелеймоновский мост', fact: 'Мост через Фонтанку у Летнего сада — с фонарями и золочёными гербами.', inScene: true },
  fontanka: { name: 'Река Фонтанка', fact: 'Название — от фонтанов Летнего сада: в XVIII веке отсюда брали для них воду.', soon: 'Вы сейчас здесь' },
  piterwin: { name: 'Нева и Петропавловка', fact: 'Основное окно Санкт-Петербурга — вид на Неву, Петропавловскую крепость и развод мостов.', soon: 'Окно «Санкт-Петербург»' },
};
const PLACE_ORDER = ['castle', 'chizhik', 'spire', 'ingbridge', 'garden', 'pantbridge', 'fontanka', 'piterwin'];
const STALL_IDS = ['coffee', 'pyshki'];

export default {
  config: CITY,
  skyline,
  sounds,
  env,
  audioEvents,
  ticker,
  places: { HOTSPOTS, ROOM_HOTSPOTS: [{ id: 'pyshkibag', rects: [[354, 198, 16, 18]] }], PLACES, PLACE_ORDER, games: { chizhik: TARGETS.chizhik } },
  labels: { cat: 'Кот — погладить', chizhik: 'Чижик-Пыжик — бросить монетку', pyshkibag: 'Кулёк пышек', books: 'Путеводитель по Санкт-Петербургу', coffee: 'Кофе с собой', pyshki: 'Пышки' },
  toasts: { cat: 'Кот мурчит на подоконнике над Фонтанкой.', tea: 'Чай с пышками.', chair: 'Кресло-качалка поскрипывает.' },
  labelAt: (id, env) => (STALL_IDS.includes(id) && env && !stalls(env).includes(id) ? 'Ларёк закрыт' : ''),
  onHotspot(id, api) {
    if (id === 'chizhik') { api.openGame('chizhik'); return true; }
    if (id === 'pyshkibag') { api.toast('Пышки — петербургские пончики с сахарной пудрой. Самая известная пышечная — на Большой Конюшенной, с 1958 года.'); return true; }
    const STALLS = { coffee: 'Кофе с собой — и на парапет, смотреть на кораблики.', pyshki: 'Горячие пышки с сахарной пудрой — к ним кофе с молоком.' };
    if (STALL_IDS.includes(id)) { api.toast(stalls(api.env).includes(id) ? STALLS[id] : 'Ларёк сейчас закрыт — откроется утром.'); return true; }
    return false;
  },
  placesIntro: 'Нажмите на здание в кадре или выберите здесь. Чижику — монетку.',
  about: `<p>Лофи-города — живые окна в города России. Это второе окно Санкт-Петербурга: вид через Фонтанку на Михайловский замок и Летний сад, у воды — Чижик-Пыжик. Время и погода настоящие, в навигацию по реке ходят катера, в полдень слышна пушка с Петропавловки.</p>
      <p>Радио Санкт-Петербург — общий эфир с основным окном: все слушатели слышат одно и то же в один момент.</p>`,
  timeIntro: 'По умолчанию всё настоящее: время Санкт-Петербурга и погода с Open-Meteo. Здесь можно заглянуть в другое время.',
};
