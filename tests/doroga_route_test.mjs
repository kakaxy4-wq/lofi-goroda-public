// Тест модели позиции окна «Дорога»: node tests/doroga_route_test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// route.js грузит stops.json через fetch — подменяем его файлом с диска
const stopsPath = new URL('../site/cities/doroga/stops.json', import.meta.url);
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(stopsPath, 'utf8')) });

const R = await import('../site/cities/doroga/route.js');
const { carAt, segmentAt, whereLine, tzAt, placeAt, railAt, KM1, DEFAULT_STATE } = R;

const H = 3600e3, START = DEFAULT_STATE.start; // 19.10 08:00 по Владивостоку = 22:00 UTC 18.10
const run = (km, ts) => ({ status: 'run', start: START, cps: [{ km: 0, ts: START, label: 'Владивосток' }, { km, ts, label: 'x' }] });

// soon: до старта стоит во Владивостоке
let c = carAt(START - 5 * H, DEFAULT_STATE);
assert.equal(c.status, 'soon'); assert.equal(c.km, 0); assert.ok(c.parked); assert.equal(c.speed, 0);
assert.match(whereLine(c), /Старт 19 октября в 08:00 из Владивостока/);

// run, день: точка в Чите (км 2925, пояс +9) в 10:00 местного = 01:00 UTC; через 3 часа проехал ~210 км
const ts = Date.UTC(2026, 9, 20, 1, 0);
let s = run(2925, ts);
c = carAt(ts + 3 * H, s);
assert.ok(Math.abs(c.km - (2925 + 210)) < 1, `км ${c.km}`); assert.equal(c.speed, 70); assert.ok(!c.parked && !c.night);
assert.equal(c.segFrom.name, 'Чита'); assert.equal(c.segTo.name, 'Улан-Удэ');
assert.equal(whereLine(c), 'Давид едет между Читой и Улан-Удэ');

// run, ночь: 21:00 местного в Чите = 12:00 UTC — стоит
c = carAt(Date.UTC(2026, 9, 20, 12, 30), run(2925, Date.UTC(2026, 9, 20, 11, 30)));
assert.ok(c.parked && c.night); assert.equal(c.speed, 0);
assert.equal(whereLine(c), 'Давид спит у Читы — рядом бело-голубой Казанский собор');
// ночь в глуши (км 2300, до Читы 625): достопримечательности нет — стела региона
c = carAt(Date.UTC(2026, 9, 20, 12, 30), run(2300, Date.UTC(2026, 9, 20, 11, 30)));
assert.match(whereLine(c), /спит где-то между .* — у стелы «(Амурская область|Забайкальский край)»/);

// не дальше cp + 450: за ночь и следующий день
const ts2 = Date.UTC(2026, 9, 20, 0, 0); // 09:00 в Чите
c = carAt(ts2 + 24 * H, run(2925, ts2));
assert.ok(c.km <= 2925 + 450 + 1e-6, `км ${c.km}`); assert.ok(c.km > 2925 + 400);

// stale после 30 ч: стоит на cp + 450, подпись «давно не было вестей»
c = carAt(ts2 + 31 * H, run(2925, ts2));
assert.equal(c.km, 2925 + 450); assert.ok(c.parked); assert.ok(c.staleH >= 30);
assert.equal(whereLine(c), 'Давно не было вестей — последний раз у Читы');

// не дальше Москвы
c = carAt(Date.UTC(2026, 9, 30, 5, 0), run(9200, Date.UTC(2026, 9, 30, 4, 0)));
assert.ok(c.km <= KM1);

// pause: стоит на последней точке
c = carAt(ts + 5 * H, { ...s, status: 'pause' });
assert.equal(c.km, 2925); assert.ok(c.parked); assert.match(whereLine(c), /на паузе у Читы/);

// done: Москва
c = carAt(ts, { ...s, status: 'done' });
assert.equal(c.km, KM1); assert.equal(c.rail, 0); assert.equal(c.next.name, 'Москва'); assert.equal(whereLine(c), 'Доехали до Москвы!');

// segmentAt, пояс, карта, rail
const seg = segmentAt(3000);
assert.equal(seg.from.name, 'Чита'); assert.equal(seg.to.name, 'Улан-Удэ');
assert.equal(segmentAt(0).from.name, 'Владивосток'); assert.equal(segmentAt(KM1).to.name, 'Москва');
assert.equal(tzAt(50), 10); assert.equal(tzAt(3000), 9); assert.equal(tzAt(9000), 3);
assert.ok(Math.abs(placeAt(2925).lat - 52.03) < 1e-9);
assert.ok(Math.abs(railAt(50) - (9288 + 9175) / 2) < 1e-9);

// «Вечерний привал»: сводка дня с 20:00 до 23:00 местного
const { eveningInfo, eveningWord, tempText, nextMorning } = R;
const chita8 = Date.UTC(2026, 9, 20, 23, 0); // 08:00 21 октября в Чите (+9) = 23:00 UTC 20-го
const day = run(2925, chita8);
let ev = eveningInfo(chita8 + 13 * H, day); // 21:00 местного
assert.equal(ev.kind, 'run'); assert.equal(ev.km, 450); // потолок cp+450
assert.equal(ev.summary, 'Привал. За сегодня — 450 км: от Читы до участка между Читой и Улан-Удэ.');
assert.equal(ev.tomorrow, 'Завтра впереди: Улан-Удэ.');
assert.equal(eveningInfo(chita8 + 11 * H, day), null, '19:00 — ещё едем, сводки нет');
assert.equal(eveningInfo(chita8 + 15.5 * H, day), null, '23:30 — окно сводки закрыто');
// точка пришла в 16:00 → утро считаем назад от неё: 8 ч × 70 = 560 до точки + 4 ч × 70 = 280 после
ev = eveningInfo(chita8 + 13 * H, run(2925, chita8 + 8 * H));
assert.equal(ev.km, 840);
// до старта — зовём на старт завтра, а не сводку
const evS = eveningInfo(START - 11 * H, DEFAULT_STATE); // 21:00 18 октября по Владивостоку
assert.deepEqual(evS, { kind: 'soon', text: 'Завтра в 08:00 — старт из Владивостока.' });
assert.equal(eveningInfo(START - 35 * H, DEFAULT_STATE), null, 'старт не завтра — молчим');
assert.equal(eveningInfo(chita8 + 13 * H, { ...day, status: 'pause' }), null);
assert.equal(eveningInfo(chita8 + 13 * H, { ...day, status: 'done' }), null);
// слова
assert.equal(eveningWord(18), 'тёплый'); assert.equal(eveningWord(-8), 'морозный'); assert.equal(eveningWord(0), 'свежий');
assert.equal(tempText(12.4), '+12°'); assert.equal(tempText(-7.6), '−8°'); assert.equal(tempText(0), '0°');
// утро следующих суток: 08:00 местного
assert.equal(nextMorning(chita8 + 13 * H, 3375), chita8 + 24 * H);
assert.equal(nextMorning(chita8 + 20 * H, 3375), chita8 + 24 * H); // 04:00 — тот же рассвет

console.log('doroga route: ok');
