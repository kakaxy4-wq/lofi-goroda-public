// 404: подсказка «возможно, вы искали …». Инлайн-скрипты запрещены (CSP script-src 'self') — отдельный файл,
// подключён только на 404.html. Первый сегмент адреса сравниваем с id, названиями и народными
// сокращениями городов; названия и адреса — из /cities/index.json (видимый список на странице ставит tools/build_pages.py).
(function () {
  'use strict';

  // Народные имена и короткие формы → id из site/cities/index.json (латиница — как пишут в адресе,
  // кириллица — как пишут по-русски; ё и регистр не важны, их выравнивает norm()). Опечатки ловит
  // расстояние Дамерау—Левенштейна, сюда — только устоявшиеся имена.
  const ALIAS = {
    spb: 'piter', peterburg: 'piter', speterburg: 'piter', 'sankt-peterburg': 'piter', sanktpeterburg: 'piter',
    'saint-petersburg': 'piter', petersburg: 'piter', leningrad: 'piter', petrograd: 'piter',
    'спб': 'piter', 'питер': 'piter', 'петербург': 'piter', 'ленинград': 'piter', 'петроград': 'piter',
    msk: 'moskva', moscow: 'moskva', 'мск': 'moskva', 'москва': 'moskva',
    kzn: 'kazan',
    izh: 'izhevsk', 'ижевск': 'izhevsk', 'устинов': 'izhevsk',
    vld: 'vladimir',
    yar: 'yaroslavl', yrl: 'yaroslavl',
    vlg: 'vologda',
    krd: 'krasnodar', kuban: 'krasnodar', 'кубань': 'krasnodar',
    nn: 'nnovgorod', nizhny: 'nnovgorod', 'nizhny-novgorod': 'nnovgorod', 'nizhniy-novgorod': 'nnovgorod',
    gorky: 'nnovgorod', gorkiy: 'nnovgorod', 'нижний': 'nnovgorod', 'горький': 'nnovgorod',
    novgorod: 'vnovgorod', 'veliky-novgorod': 'vnovgorod', 'новгород': 'vnovgorod',
    klg: 'kaliningrad', kenig: 'kaliningrad', kenigsberg: 'kaliningrad', konigsberg: 'kaliningrad',
    'кёниг': 'kaliningrad', 'кенигсберг': 'kaliningrad',
    vvo: 'vladivostok',
    mmk: 'murmansk',
    smr: 'samara', kuibyshev: 'samara', 'куйбышев': 'samara',
    ekb: 'ekaterinburg', eburg: 'ekaterinburg', yekaterinburg: 'ekaterinburg', 'екат': 'ekaterinburg', 'екб': 'ekaterinburg',
    irk: 'irkutsk',
  };
  // Крупные города, которые ищут часто, а окна ещё нет: родительный падеж для «… у нас пока нет».
  const NOT_YET = {};

  // Адрес пишут и латиницей, и по-русски, и с %XX: декодируем, нижний регистр, ё → е, пробелы и подчёркивания → дефис.
  const norm = (s) => {
    try { s = decodeURIComponent(s); } catch { /* кривые % — сравниваем как есть */ }
    return s.toLowerCase().replace(/ё/g, 'е').replace(/[\s_]+/g, '-');
  };
  const ALIAS_N = Object.create(null);
  for (const k of Object.keys(ALIAS)) ALIAS_N[norm(k)] = ALIAS[k];
  const NOT_YET_N = Object.create(null);
  for (const k of Object.keys(NOT_YET)) NOT_YET_N[norm(k)] = NOT_YET[k];

  // Расстояние Дамерау—Левенштейна: вставка, удаление, замена, транспозиция соседних букв.
  const edits = (a, b) => {
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  };

  function findCity(seg, cities) {
    if (!seg) return null;
    for (const c of cities) {
      if (seg === c.id || seg === norm(c.name) || ALIAS_N[seg] === c.id) return c;
    }
    if (NOT_YET_N[seg]) return { absent: NOT_YET_N[seg] };
    // Опечатки: единственный кандидат с минимальным расстоянием ≤ 2; короткие ключи не участвуют — шумят.
    let best = null, bestDist = 3, unique = true;
    for (const c of cities) {
      const keys = [c.id, norm(c.name)];
      for (const k in ALIAS_N) if (ALIAS_N[k] === c.id) keys.push(k);
      for (const key of keys) {
        if (seg.length < 4 || key.length < 4) continue;
        const dist = edits(seg, key);
        if (dist > 2) continue;
        if (!best || dist < bestDist) { best = c; bestDist = dist; unique = true; }
        else if (dist === bestDist && c !== best) unique = false;
      }
    }
    return unique ? best : null;
  }

  const seg = location.pathname.split('/').filter(Boolean).map(norm)[0] || '';
  fetch('/cities/index.json').then((r) => r.ok ? r.json() : Promise.reject(r)).then((all) => {
    const hit = findCity(seg, all.filter((c) => c.enabled));
    const hint = document.getElementById('hint');
    if (!hit || !hint) return;
    if (hit.absent) {
      hint.textContent = `${hit.absent} у нас пока нет — выберите окно из списка ниже.`;
    } else {
      hint.textContent = 'Возможно, вы искали ';
      const a = document.createElement('a');
      a.href = `/${hit.id}/`;
      a.textContent = hit.name; // адрес из pathname в разметку не попадает — только через textContent
      hint.append(a, '?');
    }
    hint.hidden = false;
  }).catch(() => { /* без сети или без данных — остаётся список городов */ });
})();
