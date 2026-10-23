// «Окно дня» (cities/okno-dnya): угадать город за задёрнутой шторой. Подсказки открываются по шагам —
// свет сквозь штору, звуки, погода на стекле, часы, градусник, щёлочка; каждая ошибка открывает следующую,
// а кот говорит, в какую сторону и как далеко город дня. Угадали — шторы разъезжаются, штамп в паспорт.
// Всё хранится у человека (localStorage): прогресс дня, журнал по датам — из него серия и паспорт.
// Счётчик угадавших — событие day:solved на live-сервере (stats.daySolved).

import { WEATHER_WORDS } from './weather.js';

const MAX = 6;
const RAD = Math.PI / 180;
function distBearing(a, b) {
  const [la1, lo1, la2, lo2] = [a.lat, a.lon, b.lat, b.lon].map((v) => v * RAD);
  const d = 2 * 6371 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
  const y = Math.sin(lo2 - lo1) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return { km: Math.round(d), deg: (Math.atan2(y, x) / RAD + 360) % 360 };
}
const SIDES = ['к северу', 'к северо-востоку', 'к востоку', 'к юго-востоку', 'к югу', 'к юго-западу', 'к западу', 'к северо-западу'];
const side = (deg) => SIDES[Math.round(deg / 45) % 8];
const ord = (n) => `${n}-й`;
const tz = (n) => (n === 0 ? 'то же время, что в Москве' : `${n > 0 ? '+' : '−'}${Math.abs(n)} ч от Москвы`);

export function createDay({ CITYMOD, store, toast, trackEv, live, getAudio, cityClock, hhmm, onSolve }) {
  const D = CITYMOD.day, R = D.real, ans = { name: R.name, gen: R.nameGen, lat: R.config.lat, lon: R.config.lon };
  const LOG = 'day:log', CUR = 'day:cur';
  const log = store.get(LOG, {});
  let cur = store.get(CUR, null);
  if (!cur || cur.date !== D.date) cur = { date: D.date, hints: 1, guesses: [] };
  const done = log[D.date]; // сегодня уже отвечали — сразу открытое окно
  D.state.solved = !!done;
  let env = null, solvedCount = null, open = true;
  const save = () => store.set(CUR, cur);

  // ---------- подсказки ----------
  const HINTS = [
    ['Свет сквозь штору', (e) => (e.sun.alt > 12 ? 'Сквозь штору бьёт яркий дневной свет.' : e.sun.alt > 0 ? 'Свет сквозь штору тёплый и низкий — у окна утро или вечер.' : e.sun.alt > -8 ? 'За шторой сумерки — едва сереет.' : 'За шторой темно — у окна ночь.')],
    ['Звуки за окном', () => 'Звуки за окном стали слышнее — прислушайтесь.'],
    ['Погода на стекле', (e) => `На стекле: ${WEATHER_WORDS[e.weather.kind]}${e.weather.kind === 'snow' ? ', снежинки липнут к раме' : e.weather.kind === 'rain' ? ', капли бегут по стеклу' : ''}.`],
    ['Часы', (e) => `Часы у окна: ${hhmm(e.local)} — ${tz(R.config.utcOffset - 3)}.`],
    ['Градусник', (e) => { const t = Math.round(e.weather.temp); return `Градусник за окном: ${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t)} °C.`; }],
    ['Щёлочка', () => 'Шторы чуть разошлись — загляните в щёлочку.'],
  ];

  // ---------- карточка ----------
  const card = document.createElement('div');
  card.className = 'day-card px'; card.id = 'dayCard'; card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Окно дня');
  document.body.appendChild(card);
  const opts = [...D.pool].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  const lastCity = (() => { try { const id = JSON.parse(localStorage.getItem('lg:lastCity')); return D.pool.find((c) => c.id === id) || null; } catch { return null; } })();
  const stats = () => {
    const days = Object.keys(log).sort();
    let streak = 0;
    for (let d = new Date(D.date + 'T00:00:00Z'); log[d.toISOString().slice(0, 10)]?.ok; d = new Date(d - 864e5)) streak++;
    const stamps = new Set(days.filter((k) => log[k].ok).map((k) => log[k].id)).size;
    return { streak, stamps };
  };
  function render() {
    if (!open) { card.className = 'day-card day-mini px'; card.innerHTML = `<button type="button" data-a="open">Окно дня №${D.number} ${D.state.solved ? '✓' : '▸'}</button>`; return; }
    card.className = 'day-card px';
    const head = `<div class="day-h"><b>Окно дня №${D.number}</b><button type="button" class="day-x" data-a="min" aria-label="Свернуть">×</button></div>`;
    if (D.state.solved) {
      const r = log[D.date] || {}, { streak, stamps } = stats();
      card.innerHTML = head + `<p class="day-res">${r.ok ? `Это ${ans.name}! Угадано с ${ord(r.tries)} попытки.` : `Ответ: ${ans.name}.`}</p>
        <p class="day-meta">${r.ok ? `Серия: ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} · ` : ''}Штампов в паспорте: ${stamps} из ${D.pool.length}${solvedCount != null ? ` · сегодня угадали: ${solvedCount}` : ''}</p>
        <p class="day-meta">Новое окно — завтра в полночь по Москве.</p>
        <div class="day-row"><button type="button" class="btn primary" data-a="share">Поделиться</button><a class="btn" href="/${R.id}/">Окно ${ans.gen} →</a></div>`;
      return;
    }
    const hints = HINTS.slice(0, cur.hints).map(([t, f]) => `<li><b>${t}.</b> ${env ? f(env) : ''}</li>`).join('');
    const tried = cur.guesses.length ? `<p class="day-meta">Мимо: ${cur.guesses.map((id) => D.pool.find((c) => c.id === id)?.name).join(', ')}</p>` : '';
    card.innerHTML = head + `<p class="day-q">Какой город за шторой? Попыток: ${MAX - cur.guesses.length} из ${MAX}.</p>
      <ul class="day-hints">${hints}</ul>${tried}
      <div class="day-row"><select id="dayPick" aria-label="Город"><option value="">— выберите город —</option>${opts}</select><button type="button" class="btn primary" data-a="go">Это он!</button></div>
      <div class="day-row small">${cur.hints < HINTS.length ? '<button type="button" class="btn" data-a="hint">Ещё подсказка</button>' : ''}<button type="button" class="btn" data-a="give">Сдаюсь</button>
      <a class="btn" href="/${lastCity ? lastCity.id : 'piter'}/">Просто слушать →</a></div>${solvedCount ? `<p class="day-meta">Сегодня угадали: ${solvedCount}</p>` : ''}`;
    for (const id of cur.guesses) card.querySelector(`#dayPick option[value="${id}"]`)?.setAttribute('disabled', '');
  }

  function finish(ok) {
    D.state.solved = true;
    log[D.date] = { id: R.id, ok, tries: cur.guesses.length + (ok ? 1 : 0), hints: cur.hints };
    store.set(LOG, log);
    trackEv(ok ? 'day:solved' : 'day:gaveup');
    getAudio()?.setMuffle?.(0);
    document.body.classList.remove('day-locked', 'day-clock');
    onSolve(ok);
    render();
  }
  function guess(id) {
    if (!id || D.state.solved) return;
    if (id === R.id) { finish(true); toast(`Это ${ans.name}! Шторы открываются.`); return; }
    cur.guesses.push(id); save();
    const g = D.pool.find((c) => c.id === id), { km, deg } = distBearing(g, ans);
    const temp = km < 400 ? 'Тепло!' : km < 1200 ? 'Теплее.' : 'Холодно.';
    if (cur.guesses.length >= MAX) { finish(false); toast(`Попытки кончились. Ответ: ${ans.name} — шторы открываются.`); return; }
    if (cur.hints < HINTS.length) cur.hints++;
    save();
    toast(`Кот мотает хвостом: не ${g.name}. ${temp} Город дня ${side(deg)}, примерно в ${km.toLocaleString('ru')} км от ${g.nameGen}.`);
    trackEv('day:guess');
    render();
  }
  card.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'go') guess(card.querySelector('#dayPick')?.value);
    if (a === 'hint' && cur.hints < HINTS.length) { cur.hints++; save(); trackEv('day:hint'); render(); }
    if (a === 'give') finish(false);
    if (a === 'min') { open = false; render(); }
    if (a === 'open') { open = true; render(); }
    if (a === 'share') share();
  });
  async function share() {
    const r = log[D.date] || {}, marks = r.ok ? '🟥'.repeat(Math.max(0, r.tries - 1)) + '🟩' : '🟥'.repeat(MAX);
    const text = `Окно дня №${D.number}: ${r.ok ? `угадано с ${ord(r.tries)} попытки` : 'не угадано'}, подсказок ${r.hints || 1}\n${marks}\nhttps://lofi-goroda.ru/okno-dnya/`;
    trackEv('day:share');
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(text); toast('Результат скопирован — без названия города, чтобы не испортить другим.'); } catch { toast(text); }
  }

  if (done) queueMicrotask(() => onSolve(done.ok)); // сегодня уже отвечали — шапка с настоящим городом
  let lastHints = -1;
  return {
    get solved() { return D.state.solved; },
    // шторы: до ответа задёрнуты внахлёст, на шаге «щёлочка» — узкий просвет; после ответа — открыты
    curtain: () => (D.state.solved ? 0 : 1),
    closedPx: () => (D.state.solved ? 205 : cur.hints >= 6 ? 226 : 244),
    maskTitle: (t) => (D.state.solved ? null : t.kind === 'gen' ? '«Живая вставка»' : `Трек ${t.index + 1}`),
    update(e) {
      env = e;
      getAudio()?.setMuffle?.(D.state.solved ? 0 : cur.hints >= 2 ? 0.45 : 0.85);
      document.body.classList.toggle('day-locked', !D.state.solved);
      document.body.classList.toggle('day-clock', !D.state.solved && cur.hints >= 4);
      if (cur.hints !== lastHints && open) { lastHints = cur.hints; render(); }
    },
    onStats(m) { if (typeof m.daySolved === 'number' && m.daySolved !== solvedCount) { solvedCount = m.daySolved; render(); } },
    render,
  };
}
