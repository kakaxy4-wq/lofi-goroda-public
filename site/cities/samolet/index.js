// Окно самолёта: рейс Москва — Владивосток и обратно, общий для всех по расписанию (route.js). Солнце, звёзды
// и погода — по месту самолёта; рассвет на восточном рейсе догоняет быстрее. Звук — гул салона, «динь-дон»
// на взлёте и посадке. Эфир — треки окон, над которыми пролетаем (Казань, Екатеринбург, Иркутск, Владивосток, Транссиб).

import * as skyline from './skyline.js';
import { flightAt, placeAt, cityBelow, TOTAL } from './route.js';

const CITY = {
  id: 'samolet',
  name: 'Самолёт',
  nameGen: 'Самолёта',
  greet: 'Привет с борта',
  subtitle: 'Рейс Москва — Владивосток',
  radioName: 'Радио на борту',
  windFrom: 'за бортом',
  playlist: 'cities/samolet/music/playlist.json',
  ...placeAt(Date.now()),
  fov: 110,
  timePresets: [['06-22', 'белые ночи над Уралом'], ['10-05', 'осень под крылом'], ['01-15', 'Сибирь в снегу']],
};

function env(ms, local) {
  const mo = local.getUTCMonth() + 1, day = local.getUTCDate();
  return {
    flight: flightAt(ms),
    covered: true, // за иллюминатором выше облаков дождя нет
    winter: mo >= 11 || mo <= 3 || (mo === 4 && day < 20),
    autumn: (mo === 9 && day >= 5) || mo === 10,
  };
}
// где самолёт: солнце, звёзды, погода; окно левого борта смотрит вбок и чуть вперёд
const locate = (ms) => { const p = placeAt(ms); CITY.viewAzimuth = p.viewAzimuth; return p; };

const km = (v) => Math.round(v).toLocaleString('ru');
function subtitleAt(ms) {
  const fl = flightAt(ms);
  if (fl.kind === 'gate') return `Стоянка: ${fl.at.name} · вылет через ${fl.leftMin >= 60 ? `${Math.floor(fl.leftMin / 60)} ч ${fl.leftMin % 60} мин` : `${fl.leftMin} мин`}`;
  const below = cityBelow(fl), left = fl.dir > 0 ? TOTAL - fl.km : fl.km;
  const where = below ? `над ${below.ins}` : `${fl.from.name} → ${fl.to.name}`;
  const altM = Math.round(fl.alt * 10600 / 100) * 100;
  return `${where} · ${km(left)} км до ${fl.to.gen}${altM > 300 ? ` · ${km(altM)} м` : ' · взлёт и посадка'}`;
}

function ticker(e) {
  const fl = e.flight, lines = [];
  if (fl.kind === 'gate') { lines.push(`Самолёт на стоянке: ${fl.at.name}. Заправка, уборка салона — и снова в путь.`); return lines; }
  if (fl.alt < 0.95) lines.push(fl.into < 30 * 60e3 ? 'Набираем высоту — табло «Пристегните ремни» горит.' : 'Снижаемся — скоро посадка, пристегните ремни.');
  else lines.push(`Высота 10 600 м, скорость около ${km(fl.speed)} км/ч.`);
  if (fl.into > 50 * 60e3 && fl.into < 110 * 60e3) lines.push('Бортпроводники разносят чай и обед.');
  if (fl.dir > 0 && e.sun.alt < 0 && e.sun.alt > -12) lines.push('Летим на восток навстречу рассвету — ночь на этом рейсе короткая.');
  const below = cityBelow(fl, 80);
  if (below) lines.push(`Под крылом — ${below.name}.`);
  return lines;
}

const sounds = {
  genTitles: { places: [['Урал', 'над Уралом'], ['Обь', 'над Обью'], ['Енисей', 'над Енисеем'], ['Байкал', 'над Байкалом'], ['Амур', 'над Амуром'], ['облака', 'над облаками']],
    things: ['иллюминатор', 'чай в подстаканнике', 'гул двигателей', 'рассвет на крыле', 'огни внизу', 'кот на соседнем кресле'] },
  list: [
    { id: 'city', name: 'Гул салона', hint: 'двигатели и воздух за бортом' },
    { id: 'wind', name: 'Вентиляция', hint: 'тихий шорох над креслом' },
    { id: 'bells', name: 'Сигнал в салоне', hint: 'на взлёте и посадке' },
    { id: 'cat', name: 'Кот', hint: 'погладьте его' },
    { id: 'tea', name: 'Ложечка в стакане', hint: 'чай от бортпроводников' },
  ],
  intro: 'Звуки синтезируются в браузере. На взлёте гул сильнее, на высоте — ровный.',
  tryButtons: [['ding', 'Сигнал «ремни»'], ['clink', 'Ложечка']],
  bedScale: { rain: 0, water: 0 },
  auto: { rain: () => 0, water: () => 0, wind: () => 0.35, city: (e) => (e.flight.kind === 'gate' ? 0.7 : 1.5 + (1 - e.flight.alt) * 0.6) },
  tick(e, { t, crossed, sfx }) {
    const fl = e.flight;
    // «динь-дон»: перед взлётом, после набора высоты, перед снижением
    if (crossed(60) && fl.kind === 'fly' && [2, 26, Math.round((fl.into + fl.leftMin * 60e3) / 60e3) - 36].includes(Math.round(fl.into / 60e3))) sfx.ding(t);
  },
};

const PLACES = {
  wing: { name: 'Крыло', fact: 'На конце левого крыла — красный аэронавигационный огонь, на правом — зелёный: так ночью видно, куда летит самолёт.', inScene: true },
  window: { name: 'Иллюминатор', fact: 'Иллюминаторы самолётов делают со скруглёнными углами: на них не собирается напряжение от перепада давления.', inScene: true },
  route: { name: 'Маршрут', fact: 'Рейс Москва — Владивосток идёт над Казанью, Уралом, Сибирью, Байкалом и Амуром — около девяти тысяч километров по дорогам, а по воздуху заметно короче.', soon: 'Карта на спинке кресла' },
};
const PLACE_ORDER = ['wing', 'window', 'route'];
const HOTSPOTS = [
  { id: 'wing', rects: [[150, 166, 116, 46]] },
  { id: 'window', rects: [[158, 26, 160, 40]] },
];

export default {
  config: CITY,
  skyline,
  sounds,
  env,
  locate,
  subtitleAt,
  ticker,
  places: { HOTSPOTS, ROOM_HOTSPOTS: [], PLACES, PLACE_ORDER, games: {}, ROOM_RECTS: { lamp: [[386, 190, 28, 16]], tea: [[388, 206, 18, 18]], books: [[0, 0, 0, 0]], player: [[0, 0, 0, 0]], geranium: [[0, 0, 0, 0]], yarn: [[0, 0, 0, 0]], chair: [[0, 196, 92, 74]], cat: [[14, 230, 60, 22]] } },
  labels: { cat: 'Кот — спит на соседнем кресле', tea: 'Чай от бортпроводников', lamp: 'Лампочка для чтения', chair: 'Соседнее кресло' },
  toasts: { cat: 'Кот летит с вами — спит на соседнем кресле и мурчит под гул двигателей.', tea: 'Бортпроводник подлил чаю — в подстаканнике, как в поезде.', chair: 'Кресло откидывается — но сосед сзади спит.' },
  placesIntro: 'Нажмите на крыло или иллюминатор.',
  about: `<p>Лофи-города — живые окна в города России. Это окно самолёта: рейс Москва — Владивосток и обратно, общий для всех по расписанию — вылет каждый день в 19:00 по Москве. Солнце, звёзды и погода — там, где самолёт сейчас: на восточном рейсе рассвет наступает быстро, ночью под крылом огни городов.</p>
      <p>Радио на борту — треки окон, над которыми пролетаем: Казань, Екатеринбург, Иркутск, Владивосток и Транссиб.</p>`,
  timeIntro: 'По умолчанию всё настоящее: самолёт там, где он по расписанию сейчас. Здесь можно заглянуть в другое время рейса.',
};
