// Дополнительные секреты окон (23.10.2026): у каждого окна их стало не меньше шести.
// Подмешиваются к skyline.SECRETS города при старте (app.js). Заготовки — engine/secretkit.js.
// Факты — общеизвестные, без цифр, которые нельзя проверить; формулировки осторожные.

import { mover, still, perseids, when, all } from './secretkit.js';

// ---------- общие спрайты ----------
const P_PEOPLE = { a: '#e0b090', r: '#c8423a', b: '#3a6ab0', y: '#e8c040', k: '#2a2a30', w: '#f4f2ea', g: '#4a8a5a' };
const ICE = { rows: ['..wwwww....wwww.....www..', '.wwwwwwww.wwwwww..wwwww.', 'ssssssss..ssssss..sssss.'], pal: { w: '#f2f6fa', s: '#b8c8d8' } };
const BARGE = { rows: ['......................k..', '....yyyyyyyyyyyyyy....kk.', '...ssssssssssssssss..kkkk', '..rrrrrrrrrrrrrrrrr.rrrrr', '...rrrrrrrrrrrrrrrrrrrrr.'], pal: { y: '#d8b878', s: '#8a7a5a', r: '#6a3a2a', k: '#e8e4dc' } };
const SAIL = { rows: ['...w...', '..ww...', '.www...', 'wwww...', 'wwwww..', '..k....', 'bbbbbb.', '.bbbb..'], pal: { w: '#f4f2ea', k: '#5a4a3a', b: '#2a4a6a' } };
const HELI = { rows: ['kkkkkkkkkkk...', '.....k.......', '...gggggg...k', '..gwwggggggkk', '..gggggggg...', '...k....k....', '..kkkkkkkk...'], rows2: ['...kkkkk.....', '.....k.......', '...gggggg...k', '..gwwggggggkk', '..gggggggg...', '...k....k....', '..kkkkkkkk...'], pal: { k: '#2a2a30', g: '#4a6a4a', w: '#a8c8e8' } };
const KITE = { rows: ['..kk....', 'kkkkkkk.', '..kk..kk', '.......k'], rows2: ['........', 'kkkkkkkk', '..kk....', '........'], pal: { k: '#2a2420' } }; // коршун
const DUCKS = { rows: ['.gh.............', 'bbbb...c...c...c', '.bbbb.cc..cc..cc'], pal: { g: '#2a6a3a', h: '#e8a030', b: '#6a5030', c: '#d8c060' } };
const SWAN_BOAT = SAIL;

const X = {
  piter: [
    mover({ id: 'ladoga', name: 'Ладожский лёд', layer: 'street', ...ICE, period: 700, dur: 120, shift: 50, x0: -30, x1: 500, y: 176,
      hint: 'Поздней весной по Неве плывут белые острова — хотя уже тепло.',
      found: 'В конце апреля и в мае по Неве идёт ладожский лёд: льдины выносит из Ладожского озера к заливу, и на пару дней снова холодает.',
      when: all(when.day, when.dates(4, 20, 5, 15)) }),
    still({ id: 'morzhi', name: 'Моржи у Петропавловки', x: 276, y: 156, rows: ['.a..a..a.', '.r..b..y.', '.a..a..a.', 'wwwwwwwww'], pal: { ...P_PEOPLE, w: '#9ab8d8' },
      hint: 'Зимой днём у стен Петропавловской крепости кто-то стоит у самой воды — без шапок.',
      found: 'Зимой у стен Петропавловской крепости купаются моржи — в проруби у Невского пляжа.',
      when: all(when.day, when.winter, when.hours(10, 15)) }),
  ],
  moskva: [
    mover({ id: 'begemot', name: 'Кот Бегемот', layer: 'street', rows: ['k...k.', 'kk.kk.', 'kykykk', 'kkkkk.', '.kkkk.', '.k..k.'], rows2: ['k...k.', 'kk.kk.', 'kykykk', 'kkkkk.', '.kkkk.', 'k....k'], pal: { k: '#14121a', y: '#f0d040' },
      period: 1500, dur: 40, shift: 200, x0: 100, x1: 400, y: 148,
      hint: 'Глубокой ночью по Кремлёвской набережной иногда идёт кто-то очень большой — на задних лапах.',
      found: 'Кот Бегемот — огромный чёрный кот из «Мастера и Маргариты»: ходил на задних лапах, носил примус и говорил человеческим голосом.',
      when: all(when.night, when.hours(0, 4)) }),
    still({ id: 'yolka', name: 'Ёлка в Кремле', layer: 'sky', glow: true, x: 296, y: 106, rows: ['...y...', '..ggg..', '..grg..', '.ggggg.', '.gbgyg.', 'ggggggg', '...t...'], pal: { y: '#ffe060', g: '#2f8a4a', r: '#ff4a4a', b: '#6ab0ff', t: '#8a5a2a' },
      hint: 'В новогодние ночи между соборами Кремля что-то светится разноцветными огнями.',
      found: 'Главную новогоднюю ёлку страны ставят в Кремле, на Соборной площади.',
      when: all(when.night, when.dates(12, 25, 1, 10)) }),
  ],
  kazan: [
    mover({ id: 'koty', name: 'Казанские коты', layer: 'sky', rows: ['k...k.....k...k.....k...k', 'kkkkkt....kkkkkt....kkkkkt', '.kkkk......kkkk......kkkk.', '.k..k......k..k......k..k.'], pal: { k: '#3a3230', t: '#3a3230' },
      period: 1300, dur: 50, shift: 300, x0: 100, x1: 300, y: 125,
      hint: 'В сумерках по стене Кремля гуськом идут маленькие тени с хвостами.',
      found: 'В 1745 году императрица Елизавета велела привезти в Зимний дворец тридцать казанских котов — ловить мышей. С тех пор у Эрмитажа живут свои коты.',
      when: when.dusk }),
    still({ id: 'sabantuy', name: 'Сабантуй', layer: 'sky', x: 46, y: 120, rows: ['r.y.g.b.r.y.g.b.r.y.g.b.r', 'kkkkkkkkkkkkkkkkkkkkkkkkk', '............k............', '............k............', '............k............', '............k............', '............k............', '............k............'], pal: { r: '#e04a3a', y: '#f0c040', g: '#4a9a5a', b: '#3a6ab0', k: '#5a4a3a' },
      hint: 'В июньские выходные на дамбе поднимают высокий столб и развешивают флажки.',
      found: 'Сабантуй — татарский праздник плуга: в июне после весенних полевых работ устраивают скачки, бег в мешках и лазанье на высокий столб за призом.',
      when: all(when.day, when.months(6), when.weekend) }),
  ],
  anadyr: [
    mover({ id: 'vertolet', name: 'Вертолёт в аэропорт', ...HELI, period: 1600, dur: 30, shift: 400, x0: -30, x1: 500, y: 54,
      hint: 'Весной и осенью над городом то и дело тарахтит вертолёт — в одну и ту же сторону.',
      found: 'Аэропорт Анадыря — на другом берегу лимана, в посёлке Угольные Копи. Летом туда ходит паром, зимой ездят по льду, а в межсезонье, когда лёд ненадёжен, летают на вертолёте.',
      when: all(when.day, when.months(5, 6, 10, 11, 12)) }),
    mover({ id: 'reindeer', name: 'Оленья упряжка', layer: 'street', rows: ['b.b...b.b........', 'bb....bb.........', 'bbbbb.bbbbb..kkkk', '.b.b...b.b..kkkkk', '...............k.'], pal: { b: '#8a6a4a', k: '#3a3a40' },
      period: 1800, dur: 60, shift: 700, x0: -30, x1: 500, y: 205,
      hint: 'Зимой по городу иногда проносится что-то рогатое — и сани за ним.',
      found: 'На Чукотке до сих пор пасут северных оленей: оленеводство — одно из главных традиционных занятий её народов.',
      when: all(when.day, when.winter) }),
  ],
  bam: [
    mover({ id: 'heli', name: 'Вертолёт над тайгой', ...HELI, period: 1500, dur: 30, shift: 100, x0: 500, x1: -30, y: 60,
      hint: 'Днём над тайгой иногда тарахтит что-то зелёное с винтом.',
      found: 'Многие посёлки вдоль БАМа связаны с большой землёй железной дорогой и вертолётами — автодорог здесь мало.',
      when: when.day }),
    mover({ id: 'korshun', name: 'Чёрный коршун', ...KITE, period: 900, dur: 40, shift: 300, x0: 60, x1: 420, y: (p) => 50 + Math.sin(p * 9) * 10,
      hint: 'Над тайгой кругами ходит тёмная птица с вилкой на хвосте.',
      found: 'Чёрный коршун — самая частая хищная птица над сибирскими посёлками и дорогами; узнать его можно по раздвоенному хвосту.',
      when: all(when.day, when.months(5, 6, 7, 8, 9)) }),
    mover({ id: 'olen', name: 'Эвенк с оленями', layer: 'street', rows: ['.a.....b.b..b.b', '.r.....bb...bb.', '.r....bbbb.bbbb', '.k.....b.b..b.b'], pal: { ...P_PEOPLE, b: '#8a6a4a' },
      period: 2100, dur: 40, shift: 900, x0: -20, x1: 480, y: 170,
      hint: 'Иногда у насыпи кто-то ведёт за собой рогатых.',
      found: 'Вдоль северных участков БАМа живут эвенки — оленеводы и охотники тайги.',
      when: when.day }),
    perseids(),
  ],
  transsib: [
    mover({ id: 'korovy', name: 'Коровы у переезда', layer: 'street', rows: ['w.....w.....', 'wbbww.wbbww.', '.wwww..wwww.', '.k..k..k..k.'], pal: { w: '#f2f0ea', b: '#3a3030', k: '#2a2a30' },
      period: 1700, dur: 30, shift: 500, x0: 500, x1: -20, y: 172,
      hint: 'Летом у деревенского переезда кто-то пятнистый спокойно ждёт, пока пройдёт поезд.',
      found: 'В сибирских деревнях коровы гуляют сами и к поездам привыкли — ждут у переезда, как пешеходы.',
      when: all(when.day, when.months(6, 7, 8, 9)) }),
    still({ id: 'pirozhki', name: 'Пирожки на перроне', x: 380, y: 176, rows: ['.a.', '.r.', 'yyy', 'yyy', '.k.'], pal: P_PEOPLE,
      hint: 'На долгой стоянке к вагонам выходит кто-то с корзинкой.',
      found: 'На долгих стоянках к поездам выходят продавцы: пирожки, варёная картошка, а у Байкала — копчёный омуль.',
      when: (e) => !!e.train?.at && e.sun.alt > -4 }),
    perseids(),
  ],
  doroga: [
    still({ id: 'los', name: 'Лось у трассы', layer: 'sky', x: 96, y: 152, rows: ['bb..bb..', '.bbbb...', '..bbbbbb', '..bbbbbb', '..b...b.', '..b...b.'], pal: { b: '#4a3424' },
      period: 1800, dur: 60, shift: 300,
      hint: 'В сумерках у кромки леса стоит кто-то огромный и смотрит на дорогу.',
      found: 'Лоси выходят к трассам в сумерках — поэтому вдоль сибирских дорог столько знаков «Дикие животные».',
      when: when.dusk }),
    still({ id: 'lisa', name: 'Лиса на обочине', layer: 'sky', x: 354, y: 161, rows: ['o...o..', 'oooo...', 'owooooo', '.oo..ow', '.k..k..'], pal: { o: '#d8702a', w: '#f4f2ea', k: '#2a2020' },
      period: 1500, dur: 50, shift: 800,
      hint: 'Днём на обочине сидит рыжая и внимательно смотрит на машины.',
      found: 'На сибирских трассах лисы привыкли к людям и выходят к обочинам — выпрашивать еду у дальнобойщиков. Кормить их не стоит.',
      when: when.day }),
    still({ id: 'mlechny', name: 'Млечный Путь над тайгой', layer: 'sky', glow: true, x: 60, y: 14, rows: ['....w...w.....w....w..w...w.....w.', '..w..ww...w.ww..ww...ww..w..w.....', '.w..w..w.ww..ww..www..w..ww.w..w..', '..w...ww..w..w..ww...w...w....w...'], pal: { w: '#d8e0f8' },
      hint: 'Ночью вдали от городов небо над тайгой затягивает светлая полоса из звёзд.',
      found: 'Вдали от городов, где нет засветки, хорошо виден Млечный Путь — диск нашей Галактики с ребра.',
      when: (e) => e.sun.alt < -15 }),
  ],
  samolet: [
    still({ id: 'gloria', name: 'Глория', layer: 'street', glow: true, x: 292, y: 188, rows: ['..rrrrr..', '.yyyyyyy.', 'bbb...bbb', 'b..kkk..b', 'bbb...bbb', '.yyyyyyy.', '..rrrrr..'], pal: { r: '#ff8a70', y: '#ffe08a', b: '#8ab8ff', k: '#5a6070' },
      hint: 'Днём над облаками под крылом иногда бежит маленькая тень в радужном кольце.',
      found: 'Глория — радужный круг вокруг тени самолёта на облаках: свет отражается от капель назад, к солнцу.',
      when: (e) => e.flight?.kind === 'fly' && e.flight.alt > 0.95 && e.sun.alt > 8 && e.weather.cloud > 40 }),
    mover({ id: 'mks', name: 'Пролёт МКС', glow: true, rows: ['w'], pal: { w: '#ffffff' }, period: 1500, dur: 60, shift: 300, x0: 170, x1: 310, y: (p) => 80 - p * 40,
      hint: 'В сумерках по небу ровно и быстро плывёт яркая звезда — без мигания.',
      found: 'Международная космическая станция облетает Землю за полтора часа; в сумерках её видно как яркую звезду, которая плывёт по небу.',
      when: (e) => e.flight?.kind === 'fly' && e.sun.alt < -6 && e.sun.alt > -18 }),
    perseids({ area: [170, 40, 140, 60] }),
  ],
  fontanka: [
    mover({ id: 'utki', name: 'Утки на Фонтанке', layer: 'street', ...DUCKS, period: 1200, dur: 70, shift: 100, x0: 480, x1: -20, y: 180,
      hint: 'Летом по Фонтанке плывёт кто-то гуськом, не обращая внимания на катера.',
      found: 'На реках и каналах Санкт-Петербурга живут кряквы — утята плавают за мамой прямо в центре города.',
      when: all(when.day, when.months(5, 6, 7, 8), when.open) }),
    still({ id: 'futlyary', name: 'Статуи в футлярах', layer: 'sky', x: 298, y: 126, rows: ['.ddd.......ddd.......ddd.......ddd.', 'dwwwd.....dwwwd.....dwwwd.....dwwwd', 'dwwwd.....dwwwd.....dwwwd.....dwwwd', 'dwwwd.....dwwwd.....dwwwd.....dwwwd', 'dwwwd.....dwwwd.....dwwwd.....dwwwd', 'dwwwd.....dwwwd.....dwwwd.....dwwwd', 'ddddd.....ddddd.....ddddd.....ddddd'], pal: { w: '#f4efe4', d: '#a89a84' },
      hint: 'Зимой между деревьями Летнего сада стоят светлые ящики — летом их нет.',
      found: 'На зиму мраморные статуи Летнего сада закрывают деревянными футлярами — от мороза и сырости.',
      when: (e) => { const m = e.local.getUTCMonth() + 1; return m >= 11 || m <= 4; } }),
    still({ id: 'kot_okno', name: 'Кот в окне напротив', x: 46, y: 128, glow: true, rows: ['yyyyy', 'ykyky', 'ykkky', 'ykkky', 'yyyyy'], pal: { y: '#ffcf7a', k: '#2a2020' },
      hint: 'Вечером в одном окне дома на том берегу кто-то сидит и смотрит на вас.',
      found: 'В Санкт-Петербурге коты на подоконниках — почти примета города. Соседский смотрит прямо в наше окно.',
      when: (e) => e.sun.alt < -4 && e.local.getUTCHours() >= 18 }),
  ],
  irkutsk: [
    mover({ id: 'raketa', name: '«Метеор» до Листвянки', layer: 'street', rows: ['......wwwwwwww....', '...wwwwbbbbbbwwwww', 'wwwwwwwwwwwwwwwwww', '..k.........k.....'], pal: { w: '#f2f2ee', b: '#3a5a8a', k: '#5a5a60' },
      period: 1800, dur: 18, shift: 600, x0: -30, x1: 500, y: 182,
      hint: 'Летом по Ангаре проносится быстрое судно — будто приподнятое над водой.',
      found: 'Летом из Иркутска по Ангаре до Листвянки на Байкале ходят суда на подводных крыльях.',
      when: all(when.day, when.months(6, 7, 8, 9)) }),
    still({ id: 'ledgorodok', name: 'Ледовый городок', layer: 'sky', glow: true, x: 64, y: 150, rows: ['..b...c...b..', '.bbb.ccc.bbb.', '.bbb.ccc.bbb.', 'bbbbbcccbbbbb'], pal: { b: '#8ad0ff', c: '#d8a0ff' },
      hint: 'Зимними вечерами на том берегу светятся голубые фигуры.',
      found: 'Зимой в Иркутске строят ледовые городки — с горками и подсвеченными фигурами изо льда.',
      when: all(when.night, when.months(12, 1, 2)) }),
  ],
  izhevsk: [
    still({ id: 'gerber', name: 'Гербер', layer: 'sky', x: 214, y: 140, rows: ['.a..a..a..a.', 'wrw.wrw.wrw.', 'www.www.www.', 'w.w.w.w.w.w.'], pal: { ...P_PEOPLE, w: '#f4f2ea', r: '#c8423a' },
      hint: 'В летние выходные у Арсенала водят хоровод люди в белых нарядах с красной вышивкой.',
      found: 'Гербер — удмуртский летний праздник окончания полевых работ: хороводы, песни и общее угощение.',
      when: all(when.day, when.months(6, 7), when.weekend) }),
    perseids(),
  ],
  kaliningrad: [
    mover({ id: 'kant', name: 'Кант на прогулке', layer: 'street', rows: ['.kk.', 'kkkk', '.aa.', '.kk.', '.kk.', '.k.k'], pal: { k: '#2a2a30', a: '#e0b090' },
      period: 900, dur: 900, x0: 20, x1: 440, y: 199,
      hint: 'Ровно в половине четвёртого дня по набережной проходит невысокий господин в треуголке.',
      found: 'Иммануил Кант всю жизнь прожил в Кёнигсберге — нынешнем Калининграде — и гулял так пунктуально, что по нему, говорят, сверяли часы.',
      when: (e) => { const l = e.local, m = l.getUTCHours() * 60 + l.getUTCMinutes(); return m >= 930 && m < 945; } }),
  ],
  krasnodar: [
    mover({ id: 'nutria', name: 'Нутрия', layer: 'street', rows: ['..bbbb...', '.bbbbbbt.', 'kbbbbbbbt', '.o.......'], pal: { b: '#7a5a3a', t: '#5a4a3a', k: '#1a1410', o: '#e88a2a' },
      period: 1300, dur: 60, shift: 400, x0: 470, x1: 40, y: 184,
      hint: 'Днём у берега плывёт кто-то усатый с оранжевыми зубами.',
      found: 'В водоёмах Краснодара живут нутрии — их часто видят у берега; передние зубы у них ярко-оранжевые.',
      when: when.day }),
    perseids(),
  ],
  murmansk: [
    mover({ id: 'atomflot', name: 'Атомный ледокол', layer: 'street', rows: ['.......kk..........', '......wwww.........', '....wwwwwwww.......', 'rrrrrrrrrrrrrrrrrr.', '.kkkkkkkkkkkkkkkk..'], pal: { k: '#2a2a30', w: '#f2f2ee', r: '#c8302a' },
      period: 3000, dur: 120, shift: 1200, x0: 480, x1: -60, y: 178,
      hint: 'Иногда по заливу медленно проходит большое красно-чёрное судно.',
      found: 'В Мурманске базируется атомный ледокольный флот — единственный в мире.',
      when: when.day }),
  ],
  nnovgorod: [
    mover({ id: 'barzha', name: 'Баржа с песком', layer: 'street', ...BARGE, period: 2000, dur: 110, shift: 500, x0: 480, x1: -40, y: 182,
      hint: 'По Волге медленно-медленно ползёт что-то длинное и гружёное.',
      found: 'По Волге до сих пор ходят баржи с песком и щебнем — их ведут буксиры-толкачи.',
      when: all(when.day, when.open) }),
  ],
  samara: [
    mover({ id: 'regata', name: 'Яхты на Волге', layer: 'street', ...SAIL, period: 1600, dur: 90, shift: 300, x0: 60, x1: 420, y: 176,
      hint: 'Летом в выходные по Волге скользят белые паруса.',
      found: 'Яхт-клубы Самары выходят на Волгу под парусами — широкая река здесь как маленькое море.',
      when: all(when.day, when.months(6, 7, 8), when.weekend) }),
  ],
  sochi: [
    mover({ id: 'regata', name: 'Парусная регата', layer: 'street', rows: ['...w.....w.....w...', '..ww....ww....ww...', '.www...www...www...', 'wwww..wwww..wwww...', 'bbbbb.bbbbb.bbbbb..'], pal: { w: '#f4f2ea', b: '#2a4a6a' },
      period: 1800, dur: 100, shift: 600, x0: 480, x1: -30, y: 176,
      hint: 'Иногда по морю идут сразу несколько белых парусов — друг за другом.',
      found: 'В Сочи проходят парусные регаты — яхты выходят в море прямо от Морского порта.',
      when: all(when.day, when.months(5, 6, 7, 8, 9, 10)) }),
    still({ id: 'sneg', name: 'Снег на пальмах', layer: 'sky', x: 30, y: 140, rows: ['w.w.w..w.w.w', 'gggg...gggg.', '.ww.....ww..', '..k......k..', '..k......k..'], pal: { w: '#f4f6fa', g: '#3a7a4a', k: '#6a5040' },
      hint: 'Изредка зимой на пальмах лежит что-то белое.',
      found: 'Снег в Сочи — редкость: выпадает раз в несколько лет и обычно тает за день.',
      when: (e) => e.weather.kind === 'snow' || (e.winter && e.weather.temp < 1) }),
  ],
  vladimir: [
    still({ id: 'svetlyaki', name: 'Светлячки', layer: 'street', glow: true, x: 110, y: 188, rows: ['..y.......y....', 'y.....y......y.', '....y.....y....'], rows2: ['....y.....y....', '..y.......y....', 'y.....y......y.'], pal: { y: '#d8ff7a' },
      hint: 'В тёплые июньские ночи у самой земли мерцают зелёные искорки.',
      found: 'В июне в тёплые ночи над травой загораются светлячки — так жуки находят друг друга.',
      when: all(when.night, when.months(6, 7)) }),
    perseids(),
  ],
  vladivostok: [
    still({ id: 'kalmar', name: 'Огни кальмароловов', layer: 'street', glow: true, x: 300, y: 172, rows: ['y.y.y.y.y......y.y.y.y', 'wwwwwwwww......wwwwwww', '.kkkkkkk........kkkkk.'], pal: { y: '#fffbe0', w: '#f8e890', k: '#3a4050' },
      hint: 'Ночью далеко в море горит цепочка очень ярких огней.',
      found: 'Ночью в море видны огни кальмароловных судов: кальмара ловят на свет мощных ламп.',
      when: all(when.night, when.months(8, 9, 10, 11)) }),
    still({ id: 'koryushka', name: 'Рыбаки на льду Амурского залива', x: 120, y: 182, rows: ['..a....a....a....a..', '..b....r....g....b..', '.kk...kk...kk...kk..', 'iiiiiiiiiiiiiiiiiiii', '.iiiiiiiiiiiiiiiiii.'], pal: { ...P_PEOPLE, i: '#e8eef4' },
      hint: 'Зимой днём на льду залива сидят сотни тёмных точек.',
      found: 'Зимой на лёд Амурского залива выходят тысячи рыбаков — за корюшкой.',
      when: all(when.day, when.months(1, 2, 3)) }),
  ],
  vnovgorod: [
    mover({ id: 'sadko', name: 'Ладья Садко', layer: 'street', rows: ['......r.......', '.....rrr......', '....rrrrr.....', '......k.......', 'g.bbbbbbbbbb.g', '.gbbbbbbbbbbg.'], pal: { r: '#c8423a', k: '#5a3a2a', b: '#8a5a2a', g: '#d8a83a' },
      period: 2400, dur: 90, shift: 1500, x0: -30, x1: 490, y: 176,
      hint: 'Летним вечером по Волхову иногда проходит ладья с красным парусом.',
      found: 'Садко — гусляр и купец из новгородских былин: по легенде, он плавал по Волхову и Ильменю и играл самому Морскому царю.',
      when: all(when.dusk, when.months(6, 7, 8)) }),
  ],
  vologda: [perseids()],
  yaroslavl: [perseids()],
  ekaterinburg: [perseids()],
};

// Подмешать дополнительные секреты в массив города один раз (модули городов кэшируются при переходах)
export function addExtraSecrets(cityId, skyline) {
  const list = skyline?.SECRETS, extra = X[cityId];
  if (!list || !extra || list.__extra) return;
  list.push(...extra);
  try { Object.defineProperty(list, '__extra', { value: true }); } catch {}
}
export const EXTRA = X;
