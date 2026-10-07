// Тесты интерфейса в браузере. Открыть сайт (/site/ при статике из корня репозитория) и выполнить:
//   const m = await import('/tests/ui_test.js'); await m.run()
// Возвращает список [название, пройдено, подробности].

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 480;

function visibleRows() {
  const r = $('#scene').getBoundingClientRect(), s = r.width / W;
  const dock = $('.dock').getBoundingClientRect().top;
  return { top: Math.max(0, -r.top) / s, bottom: (Math.min(dock, r.bottom) - r.top) / s, left: Math.max(0, -r.left) / s, right: (Math.min(innerWidth, r.right) - r.left) / s, s, r };
}
function tapScene(x, y) {
  const { r, s } = visibleRows();
  const cx = r.left + x * s, cy = r.top + y * s;
  const el = $('#scene');
  el.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, pointerType: 'mouse' }));
  el.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true, pointerType: 'mouse' }));
}
const ls = (k) => { try { return localStorage.getItem('lg:' + k); } catch { return null; } };

export async function run() {
  const out = [];
  const t = (name, ok, info = '') => out.push([name, !!ok, ok ? '' : String(info)]);
  const errors = [];
  addEventListener('error', (e) => errors.push(e.message));
  document.body.classList.remove('idle');
  const city = $('h1').textContent.replace('▼', '').trim(), isPiter = city === 'Санкт-Петербург';
  const cityId = location.pathname.split('/').filter(Boolean)[0] || 'piter';
  const LANDMARKS = { piter: [299, 60, 'Петропавловский'], kazan: [193, 104, 'Кул-Шариф'] };
  let landmark = LANDMARKS[cityId];
  if (!landmark) { // другие города: первое место из PLACE_ORDER, у которого есть область в кадре — клик в её центр
    const { places } = (await import(new URL(`cities/${cityId}/index.js`, document.baseURI))).default;
    const id = places.PLACE_ORDER.find((k) => places.HOTSPOTS.some((h) => h.id === k));
    const [x, y, w, h] = places.HOTSPOTS.find((s) => s.id === id).rects[0];
    landmark = [Math.round(x + w / 2), Math.round(y + h / 2), places.PLACES[id].name];
  }

  // раскладка
  const dock = $('.dock').getBoundingClientRect();
  t('полка управления целиком на экране', dock.bottom <= innerHeight + 1 && dock.top > 0, JSON.stringify(dock));
  const qbs = [...document.querySelectorAll('.qb')];
  t('все 9 быстрых кнопок видны', qbs.length === 9 && qbs.every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.width > 20; }), qbs.map((b) => Math.round(b.getBoundingClientRect().right)).join(','));
  t('нет горизонтальной прокрутки', document.documentElement.scrollWidth <= innerWidth + 1, document.documentElement.scrollWidth);
  const v = visibleRows();
  t('гирлянда (верх сцены) в кадре', v.top <= 2, v.top.toFixed(1));
  t('стол и лампа по высоте в кадре', v.bottom >= 242, v.bottom.toFixed(1));
  t(`главное место («${landmark[2]}») по ширине в кадре`, v.left <= landmark[0] && v.right >= landmark[0], `${v.left.toFixed(0)}–${v.right.toFixed(0)} / x=${landmark[0]}`);
  const lampVisible = v.left <= 122 && v.right >= 122;
  t('кнопка плей не меньше 40px (палец)', $('#play').getBoundingClientRect().width >= 40);
  await document.fonts.ready; t('шрифты Pangolin и Press Start загружены', [...document.fonts].some((f) => f.family.includes('Lofi') && f.status === 'loaded') && [...document.fonts].some((f) => f.family.includes('Retro') && f.status === 'loaded'));
  { // «поделиться окном»: панель с картинкой кадра 1200×630 и ссылками с меткой ?from=share
    const sb = $('#shareBtn'), sr = sb?.getBoundingClientRect();
    t('кнопка «поделиться» видна', sb && sr.width > 0 && sr.right <= innerWidth + 1, JSON.stringify(sr));
    const savedCanShare = navigator.canShare; navigator.canShare = undefined; // в тесте без системного меню
    sb.click(); await sleep(1200);
    navigator.canShare = savedCanShare;
    const img = $('#panelBody .share-preview'), tg = $('#panelBody [data-share="tg"]');
    if (img && !img.complete) await new Promise((r) => (img.onload = r));
    t('поделиться: панель с картинкой кадра', !$('#panel').hidden && $('#panel').dataset.kind === 'share' && img?.src.startsWith('data:image/png'));
    t('поделиться: картинка 1200×630', img?.naturalWidth === 1200 && img?.naturalHeight === 630, `${img?.naturalWidth}×${img?.naturalHeight}`);
    t('поделиться: ссылка Telegram с меткой from=share', tg && decodeURIComponent(tg.href).includes('from=share'), tg?.href);
    $('#panelClose').click(); await sleep(50);
  }
  { // выбор города: кнопка у названия открывает список всех городов, текущий отмечен, Esc закрывает
    const pick = $('.city-pick'), menu = $('.city-menu');
    if (pick && menu) {
      pick.click(); await sleep(50);
      const links = [...menu.querySelectorAll('a')], rm = menu.getBoundingClientRect();
      t('список городов открывается и целиком на экране', !menu.hidden && links.length >= 2 && rm.right <= innerWidth + 1 && rm.bottom <= innerHeight + 1, JSON.stringify(rm));
      t('текущий город в списке отмечен', links.filter((a) => a.hasAttribute('aria-current')).length === 1 && menu.querySelector('[aria-current]').textContent.includes(city));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(50);
      t('Esc закрывает список городов', menu.hidden);
    }
  }

  // клики по сцене
  const lampBefore = ls('lamp');
  if (lampVisible) { tapScene(122, 220); await sleep(100); t('клик по лампе переключает свет', ls('lamp') !== lampBefore, `${lampBefore}→${ls('lamp')}`); }
  else t('лампа за краем — доступна кнопкой «лампа»', true);
  $('#qLamp').click(); await sleep(100);
  t('быстрая кнопка «лампа» переключает', ls('lamp') !== null);
  const g0 = $('#qGarland').classList.contains('on'); $('#qGarland').click(); await sleep(50);
  t('быстрая кнопка «гирлянда» переключает', $('#qGarland').classList.contains('on') !== g0); $('#qGarland').click();
  $('#qRain').click(); await sleep(50);
  t('быстрая кнопка «дождь» включает дождь', $('#qRain').classList.contains('on')); $('#qRain').click();
  tapScene(landmark[0], landmark[1]); await sleep(150);
  t(`клик по главному зданию открывает карточку «${landmark[2]}»`, !$('#panel').hidden && $('#panelBody').textContent.includes(landmark[2]));
  $('#panelClose').click();

  // панели
  for (const p of ['places', 'sounds', 'time', 'timer', 'about']) {
    document.querySelector(`[data-panel="${p}"]`).click(); await sleep(80);
    const pr = $('#panel').getBoundingClientRect();
    t(`панель «${p}» открывается и помещается`, !$('#panel').hidden && pr.left >= 0 && pr.right <= innerWidth + 1 && pr.top >= 0, JSON.stringify(pr));
    $('#panelClose').click();
  }
  // таймер сна
  document.querySelector('[data-panel="timer"]').click(); await sleep(80);
  document.querySelector('[data-sleep="15"]').click(); await sleep(900);
  t('таймер сна показывает бейдж', !$('#timerBadge').hidden && $('#timerBadge').textContent.includes('сон'), $('#timerBadge').textContent);
  $('#timerStop').click(); $('#panelClose').click();
  // машина времени
  document.querySelector('[data-panel="time"]').click(); await sleep(80);
  const tm = $('#tm'); tm.value = 90; tm.dispatchEvent(new Event('input')); await sleep(1200);
  t('машина времени: 01:30 на часах', $('#clock').textContent === '01:30' && !$('#timeBadge').hidden, $('#clock').textContent);
  $('#badgeNow').click(); await sleep(1100);
  t('«вернуться» возвращает в сейчас', $('#timeBadge').hidden && $('#clock').textContent !== '01:30');
  $('#panelClose').click();
  // эфир
  if ($('#play').getAttribute('aria-label') === 'Пауза') { $('#play').click(); await sleep(400); } // таймер сна мог включить эфир
  $('#play').click(); await sleep(2500);
  t('плей запускает эфир и показывает трек', $('#play').getAttribute('aria-label') === 'Пауза' && $('#npTitle').textContent !== 'Радио Питер', $('#play').getAttribute('aria-label') + ' / ' + $('#npTitle').textContent);
  $('#play').click(); await sleep(400);
  t('повторный плей ставит на паузу', $('#play').getAttribute('aria-label') === 'Включить эфир');
  // реакции
  document.querySelector('[data-react="heart"]').click(); await sleep(100);
  t('реакция всплывает на экране', document.querySelector('.floaty'));
  // мини-игра
  if (isPiter) {
  document.querySelector('[data-panel="places"]').click(); await sleep(80);
  document.querySelector('[data-game="chizhik"]').click(); await sleep(400);
  const modal = document.querySelector('.modal');
  t('мини-игра открывается поверх всего', modal && modal.getBoundingClientRect().width <= innerWidth + 1);
  modal?.querySelector('.x').click(); await sleep(50);
  t('мини-игра закрывается', !document.querySelector('.modal'));
  }
  // обратная связь и голосование
  document.querySelector('[data-panel="about"]').click(); await sleep(80);
  t('в «О проекте» есть лицензии', $('#panelBody').textContent.includes('Open Font License') && $('#panelBody').textContent.includes('CC BY 4.0'));
  $('#fbText').value = 'Тест UI: хочу Казань'; $('#fbSend').click(); await sleep(900);
  t('форма обратной связи отправляется', $('#fbMsg').textContent.startsWith('Спасибо'), $('#fbMsg').textContent);
  const hadVote = ls('voted');
  const voteBtn = document.querySelector('[data-city]'), voteCity = voteBtn.dataset.city; // первый кандидат — список меняется
  voteBtn.click(); await sleep(900);
  if (hadVote) t('повторный голос не принимается', $('#toast').textContent.includes('уже проголосовали'), $('#toast').textContent);
  else t('голос за город принимается', ls('voted') === JSON.stringify(voteCity), ls('voted'));
  $('#panelClose').click();
  // тап по спящему экрану только будит интерфейс
  const panelWas = $('#panel').hidden;
  document.body.classList.add('idle');
  const { r, s } = visibleRows();
  $('#scene').dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 299 * s, clientY: r.top + 60 * s, bubbles: true }));
  $('#scene').dispatchEvent(new PointerEvent('pointerup', { clientX: r.left + 299 * s, clientY: r.top + 60 * s, bubbles: true }));
  await sleep(100);
  t('тап по спящему экрану не открывает карточку', $('#panel').hidden === panelWas && !document.body.classList.contains('idle'));
  // --- ветки из отчётов QA ---
  const openP = async (k) => { document.querySelector(`[data-panel="${k}"]`).click(); await sleep(120); };
  const closeP = () => { if (!$('#panel').hidden) $('#panelClose').click(); };
  // белые ночи → «вернуться» при открытой панели: подсвечен «сейчас»
  await openP('time');
  const preset = document.querySelector('[data-date]:not([data-date="now"])');
  preset.click(); await sleep(300);
  t(`чип «${preset.textContent}» подсвечен после выбора`, preset.classList.contains('on'));
  $('#badgeNow').click(); await sleep(300);
  t('после «вернуться» подсвечен «сейчас»', document.querySelector('[data-date="now"]')?.classList.contains('on') && $('#timeBadge').hidden);
  // погода из панели синхронизирует кнопку дождя
  document.querySelector('[data-wx="rain"]').click(); await sleep(80);
  t('чип «дождь» включает кнопку дождя', $('#qRain').classList.contains('on'));
  document.querySelector('[data-wx=""]').click(); await sleep(80);
  t('«как сейчас» выключает кнопку дождя и подсвечен', !$('#qRain').classList.contains('on') && document.querySelector('[data-wx=""]').classList.contains('on'));
  // Esc из поля ввода закрывает панель
  $('#tm').focus(); document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); await sleep(80);
  t('Esc закрывает панель даже из ползунка', $('#panel').hidden);
  if (isPiter) {
  // «Показать выстрел»
  tapScene(222, 150); await sleep(150);
  document.querySelector('[data-act="cannon"]')?.click(); await sleep(1100);
  t('«Показать выстрел» → 11:59–12:00', /^(11:59|12:00)$/.test($('#clock').textContent), $('#clock').textContent);
  closeP(); $('#badgeNow').click(); await sleep(200);
  // «Показать разводку» с ускорением ×10
  tapScene(90, 158); await sleep(150);
  document.querySelector('[data-act="bridge"]')?.click(); await sleep(1200); // часы в шапке обновляются раз в секунду
  const c1 = $('#clock').textContent; await sleep(6500); const c2 = $('#clock').textContent;
  const mins = (x) => +x.slice(0, 2) * 60 + +x.slice(3);
  t('разводка: время идёт ×10 (минута за ~6 с)', mins(c2) - mins(c1) >= 1 && mins(c1) >= 69 && mins(c1) <= 72, `${c1} → ${c2}`);
  closeP(); $('#badgeNow').click(); await sleep(200);
  // факелы
  tapScene(28, 120); await sleep(150);
  document.querySelector('[data-act="rostral"]')?.click(); await sleep(100);
  t('«Зажечь факелы» показывает подсказку', $('#toast').textContent.includes('Факелы'));
  closeP();
  }
  // предметы комнаты
  const room = [['cat', 372, 230, () => $('#toast').textContent.includes('мурч')], ['tea', 312, 222, () => $('#toast').textContent.toLowerCase().includes('чай')],
    ['chair', 40, 200, () => $('#toast').textContent.includes('Кресло')], ['books', 338, 230, () => !$('#panel').hidden && $('#panelTitle').textContent.includes('Места')]];
  for (const [id, x, y, ok] of room) {
    const v = visibleRows();
    if (x < v.left || x > v.right) { t(`предмет «${id}» за краем экрана — пропущен`, true); continue; }
    tapScene(x, y); await sleep(200); t(`клик по предмету «${id}»`, ok()); closeP();
  }
  if (isPiter) {
  // мини-игра: вторая не открывается, хоткеи под модалкой молчат
  document.querySelector('[data-panel="places"]').click(); await sleep(100);
  document.querySelector('[data-game="chizhik"]').click(); await sleep(250);
  document.querySelector('[data-game="zayats"]')?.click(); await sleep(250);
  t('вторая мини-игра поверх первой не открывается', document.querySelectorAll('.modal').length === 1);
  const pan0 = $('#panel').hidden;
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })); await sleep(80);
  t('под мини-игрой горячие клавиши молчат', $('#panelTitle').textContent !== 'Время и погода' || pan0);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); await sleep(80);
  t('Esc закрывает мини-игру', !document.querySelector('.modal'));
  closeP();
  }
  // треки плейлиста доступны по адресу, который строит движок (от <base href>, не от /piter/)
  const pl = await (await fetch(new URL(`cities/${location.pathname.split('/').filter(Boolean)[0] || 'piter'}/music/playlist.json`, document.baseURI))).json().catch(() => []);
  const codes = await Promise.all(pl.map((x) => fetch(new URL(x.src, document.baseURI), { method: 'HEAD' }).then((r) => r.status).catch(() => 0)));
  t('все треки плейлиста доступны', codes.every((c) => c === 200), codes.join(','));
  t(`город в шапке: ${city}`, !!city && document.title.startsWith(city));

  // без звука: нота и город
  const vm0 = +$('#volMusic').value;
  $('#muteMusic').click(); await sleep(150);
  t('нота глушит музыку', +$('#volMusic').value === 0 && $('#muteMusic').getAttribute('aria-pressed') === 'true', $('#volMusic').value);
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true })); await sleep(150);
  t('клавиша M возвращает прежнюю громкость', +$('#volMusic').value === (vm0 || 0.7), $('#volMusic').value);
  const mc = $('#muteCity').getBoundingClientRect();
  t('кнопка «город без звука» видна и нажимается', mc.width >= 20 && mc.right <= innerWidth && mc.bottom <= innerHeight, JSON.stringify(mc));
  $('#muteCity').click(); await sleep(150); const vc = +$('#volCity').value; $('#muteCity').click(); await sleep(150);
  t('город глушится и возвращается', vc === 0 && +$('#volCity').value > 0);
  t('нет ошибок JS за прогон', errors.length === 0, errors.join('; '));
  return out;
}
