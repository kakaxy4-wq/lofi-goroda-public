// Дорога: Давид едет на машине из Владивостока в Москву, ~9280 км по трассам.
// Позиция не по расписанию, как у поезда, а по вестям от самого Давида: «контрольные
// точки» приходят с сервера (/live/road), между ними машина едет по модели — 70 км/ч днём,
// ночью стоит. Остановки — в stops.json (его же читает бот). Публично показываем участок
// между соседними крупными городами, а не точку.

export const STOPS = await (await fetch(new URL('./stops.json', import.meta.url))).json();
export const KM0 = 0, KM1 = 9280;
const SPEED = 70;          // км/ч в пути
const DAY_FROM = 8, DAY_TO = 20; // днём (по местному времени) едем, с 20 до 8 — стоянка
const MAX_AHEAD = 450;     // дальше этого от последней точки модель не едет
const STALE_H = 30;        // вестей нет дольше — машина встаёт, подпись «давно не было вестей»

const BIG = STOPS.filter((s) => s.big);

// Часовой пояс — по ближайшей предыдущей остановке
export function tzAt(km) {
  let tz = STOPS[0].tz;
  for (const s of STOPS) { if (s.km <= km) tz = s.tz; else break; }
  return tz;
}

// Индекс остановки: последняя с km <= заданного (не дальше предпоследней, чтобы был next)
function idxAt(km) {
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1].km <= km) i++;
  return i;
}
const lerpAt = (km, f) => {
  const i = idxAt(km), a = STOPS[i], b = STOPS[i + 1];
  const u = Math.min(1, Math.max(0, (km - a.km) / (b.km - a.km)));
  return f(a) + (f(b) - f(a)) * u;
};

// Где машина на карте: линейно между остановками
export function placeAt(km) {
  return { lat: lerpAt(km, (s) => s.lat), lon: lerpAt(km, (s) => s.lon), utcOffset: tzAt(km) };
}
// Эквивалентный километр Транссиба: по нему пейзаж берёт зоны леса и воды
export const railAt = (km) => lerpAt(km, (s) => s.rail);

// Соседние крупные города вокруг км: {from, to}
export function segmentAt(km) {
  let j = 0;
  while (j < BIG.length - 2 && BIG[j + 1].km <= km) j++;
  return { from: BIG[j], to: BIG[j + 1] };
}

// Ближайшая остановка (для подписей «у Читы»)
const nearest = (km, list = STOPS) => list.reduce((best, s) => (Math.abs(s.km - km) < Math.abs(best.km - km) ? s : best), list[0]);

// ---------- состояние поездки ----------
const START_DEFAULT = 1792360800000; // 19.10.2026 08:00 по Владивостоку
export const DEFAULT_STATE = { status: 'soon', start: START_DEFAULT, cps: [{ km: 0, ts: START_DEFAULT, label: 'Владивосток' }] };

// Приводим ответ сервера к виду {status, start, cps}; всё лишнее отбрасываем
function normalize(j) {
  if (!j || typeof j !== 'object') return DEFAULT_STATE;
  const status = ['soon', 'run', 'pause', 'done'].includes(j.status) ? j.status : 'soon';
  const start = Number.isFinite(j.start) ? j.start : START_DEFAULT;
  const cps = (Array.isArray(j.cps) ? j.cps : [])
    .filter((c) => c && Number.isFinite(c.km) && Number.isFinite(c.ts))
    .map((c) => ({ km: Math.min(KM1, Math.max(0, c.km)), ts: c.ts, label: String(c.label || '') }))
    .sort((a, b) => a.ts - b.ts);
  const notes = Number.isFinite(j.notes) && j.notes > 0 ? Math.floor(j.notes) : 0; // «весточек в дорогу» за поездку
  return { status, start, notes, cps: cps.length ? cps : [{ km: 0, ts: start, label: 'Владивосток' }] };
}

// Текущее состояние поездки: сюда пишет index.js (раз в 5 минут), отсюда читает схема маршрута
export const live = { state: DEFAULT_STATE, notes: 0 }; // notes — счётчик весточек: сервер + свои/чужие, что успели проплыть с последнего опроса

// Живое состояние с сервера; не ответил за 3 секунды — состояние по умолчанию
export async function loadState() {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3000);
  try {
    const base = ['localhost', '127.0.0.1'].includes(location.hostname) ? `http://${location.hostname}:8766` : ''; // локально live — на своём порту, как в app.js
    const r = await fetch(base + '/live/road', { signal: ctl.signal });
    if (!r.ok) throw new Error(r.status);
    return normalize(await r.json());
  } catch {
    return DEFAULT_STATE;
  } finally {
    clearTimeout(t);
  }
}

// ---------- где машина ----------
const localHour = (ms, km) => new Date(ms + tzAt(km) * 3600e3).getUTCHours();
const isDay = (ms, km) => { const h = localHour(ms, km); return h >= DAY_FROM && h < DAY_TO; };

export function carAt(ms, state = DEFAULT_STATE) {
  const st = state.cps ? state : normalize(state);
  let cp = st.cps[0];
  for (const c of st.cps) if (c.ts <= ms) cp = c; else break;
  let km = cp.km, speed = 0, parked = true, staleH = 0, status = st.status;

  if (status === 'run' && ms < st.start) status = 'soon'; // старт ещё не наступил
  if (status === 'soon') {
    km = 0;
  } else if (status === 'done') {
    km = KM1;
  } else if (status === 'pause') {
    km = cp.km;
  } else if (status === 'run') {
    const ageH = (ms - cp.ts) / 3600e3, cap = Math.min(KM1, cp.km + MAX_AHEAD);
    if (ageH > STALE_H) {
      km = cap; staleH = Math.round(ageH);
    } else {
      // едем от точки вперёд шагами по 5 минут, считаем только дневное время (пояс — по месту)
      const STEP = 300e3;
      for (let t = cp.ts; t < ms && km < cap; t += STEP) {
        const dt = Math.min(STEP, ms - t);
        if (isDay(t, km)) km = Math.min(cap, km + SPEED * dt / 3600e3);
      }
      parked = !(km < cap && isDay(ms, km));
      if (!parked) speed = SPEED;
    }
  }
  km = Math.min(KM1, Math.max(0, km));
  const i = idxAt(km), seg = segmentAt(km);
  return {
    km, rail: railAt(km), speed, parked, night: !isDay(ms, km), status,
    prev: STOPS[i], next: STOPS[i + 1], segFrom: seg.from, segTo: seg.to,
    cp, staleH, startMs: st.start, ms,
  };
}

// ---------- человеческие строки ----------
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const pad = (n) => String(n).padStart(2, '0');
// Дата и время старта по Владивостоку
export function startText(startMs) {
  const d = new Date(startMs + 10 * 3600e3);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} в ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// «между Читой и Улан-Удэ» — после «между» творительный падеж
const between = (car) => `между ${car.segFrom.ins} и ${car.segTo.ins}`;

// Ближайшая к км остановка с достопримечательностью в пределах within км: {stop, sight, dist} или null
export function sightNear(km, within = 120) {
  let best = null;
  for (const s of STOPS) {
    if (!s.sight) continue;
    const dist = Math.abs(s.km - km);
    if (dist <= within && (!best || dist < best.dist)) best = { stop: s, sight: s.sight, dist };
  }
  return best;
}
// Придорожная стела региона (когда достопримечательности рядом нет): регион ближайшей остановки
export const regionAt = (km) => nearest(km).region || '';

// «рядом …» про достопримечательность: из строки бегущей строки убираем зачин «в Улан-Удэ — »
function sightTail(sn) {
  const line = sn.sight.line;
  if (/^рядом/.test(line)) return line;
  const m = line.match(/^(?:в|во|над|на|у) [^—]{1,25}? — (.+)$/);
  return `${sn.dist <= 60 ? 'рядом' : 'недалеко'} ${m ? m[1] : line}`;
}
// Дописываем к строке стоянки: достопримечательность рядом либо стела региона
function withSight(car, base) {
  const sn = sightNear(car.km);
  if (sn) return `${base} — ${sightTail(sn)}`;
  const region = regionAt(car.km);
  return region ? `${base} — у стелы «${region}»` : base;
}

export function whereLine(car) {
  if (car.status === 'soon') {
    return car.ms < car.startMs
      ? `Старт ${startText(car.startMs)} из Владивостока`
      : 'Давид вот-вот выезжает из Владивостока';
  }
  if (car.status === 'done') return 'Доехали до Москвы!';
  if (car.staleH) return `Давно не было вестей — последний раз у ${nearest(car.cp.km).gen}`;
  if (car.status === 'pause') {
    const n = nearest(car.km), b = Math.abs(n.km - car.km) <= 30 ? n : nearest(car.km, BIG); // стоит прямо у остановки — её и называем
    return withSight(car, Math.abs(b.km - car.km) <= 150 ? `Давид на паузе у ${b.gen}` : `Давид на паузе ${between(car)}`);
  }
  if (car.parked) {
    const sn = sightNear(car.km), verb = car.night ? 'спит' : 'отдыхает';
    const where = sn && sn.dist <= 60 ? `у ${sn.stop.gen}` : `где-то ${between(car)}`;
    return withSight(car, `Давид ${verb} ${where}`);
  }
  return `Давид едет ${between(car)}`;
}

// ---------- «Вечерний привал» ----------
const HR = 3600e3;
// Местная полночь (в мс) суток, к которым относится ms, если пояс — tz
const localMidnight = (ms, tz) => Math.floor((ms + tz * HR) / (24 * HR)) * 24 * HR - tz * HR;

// «у Читы» / «участок между Читой и Улан-Удэ»: ближайшая остановка в пределах 60 км, иначе участок между крупными городами
function placeWord(km, prep) {
  const s = nearest(km);
  if (Math.abs(s.km - km) <= 60) return `${prep} ${s.gen}`;
  const seg = segmentAt(km);
  return `${prep} участка между ${seg.from.ins} и ${seg.to.ins}`;
}

// Ближайшие 08:00 местного, когда машина снова поедет (для «Что сейчас»)
export function nextMorning(ms, km) {
  const tz = tzAt(km), t = localMidnight(ms, tz) + DAY_FROM * HR;
  return t > ms ? t : t + 24 * HR;
}

// Сводка дня для бегущей строки с 20:00 до 23:00 местного: сколько проехали с 08:00 до 20:00 и что завтра.
// null — не время для сводки или ехать было нечего. {kind:'soon', text} до старта, {kind:'run', summary, tomorrow} в пути.
export function eveningInfo(ms, state = DEFAULT_STATE) {
  const c = carAt(ms, state);
  const h = localHour(ms, c.km);
  if (h < DAY_TO || h >= 23) return null;
  if (c.status === 'soon') { // старт завтра — вместо сводки зовём на старт
    const day = (t) => Math.floor((t + 10 * HR) / (24 * HR)); // сутки по Владивостоку
    if (day(c.startMs) - day(ms) !== 1) return null;
    const d = new Date(c.startMs + 10 * HR);
    return { kind: 'soon', text: `Завтра в ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} — старт из Владивостока.` };
  }
  if (c.status !== 'run' || c.staleH) return null;
  const mid = localMidnight(ms, tzAt(c.km));
  const m8 = mid + DAY_FROM * HR, m20 = mid + DAY_TO * HR;
  const a = carAt(m8, state), b = carAt(m20, state);
  // точка пришла уже днём: утреннее место — назад от неё по модели (70 км/ч), а не старая оценка от прошлой точки
  const cpDay = state.cps ? state.cps.find((p) => p.ts > m8 && p.ts <= m20) : null;
  const km8 = cpDay ? Math.max(a.km, cpDay.km - SPEED * (cpDay.ts - m8) / HR) : a.km;
  const dist = Math.round((b.km - km8) / 10) * 10; // как и в публичных вестях — до десятков км
  if (dist < 10) return null;
  const next = STOPS.find((s) => s.big && s.km > b.km + 5);
  return {
    kind: 'run', km: dist,
    summary: `Привал. За сегодня — ${dist} км: ${placeWord(km8, 'от')} ${placeWord(b.km, 'до')}.`,
    tomorrow: next ? `Завтра впереди: ${next.name}.` : '',
  };
}

// «тёплый вечер» по температуре у Давида
export function eveningWord(temp) {
  return temp >= 25 ? 'жаркий' : temp >= 15 ? 'тёплый' : temp >= 6 ? 'прохладный' : temp >= -2 ? 'свежий'
    : temp >= -14 ? 'морозный' : 'лютый морозный';
}
export const tempText = (temp) => { const t = Math.round(temp); return `${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t)}°`; };
