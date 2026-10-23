// Подсказки по расписанию: не сразу и не все сразу — по времени на сайте и по действиям
// («кликнул лампу — потом подсказка про кота»), не чаще раза в GAP, без повторов (lg:hintsShown),
// не в режимах Фокус/Сон (body.calm) и не в скрытой вкладке. Правила и таблица — docs/plans/hints-timing.md.
export function createHints(ctx) {
  const { store, toast, highlight, params, busy, isTouch, canPan, secretsPending, placeSpots, skip = [] } = ctx;
  const fast = params.get('hints') === 'fast'; // ручная и автопроверка: всё на секундах
  // Вкусовые величины — крутить здесь: after (с) от старта страницы, delay (с) после действия,
  // пауза между подсказками GAP. В fast: after → 2 с, delay → 3 с, GAP → 8 с.
  const AFTER = (s) => (fast ? 2 : s) * 1000;
  const DELAY = fast ? 3000 : undefined;
  const GAP = fast ? 8000 : 3 * 60e3;
  const quiet = params.has('obs') || params.has('freeze'); // стрим и стоп-кадр: подсказок нет вовсе
  const seen = new Set(store.get('hintsShown', []));
  if (store.get('introSeen', false)) seen.add('intro'); // миграция старых флагов первого захода
  if (store.get('panHint', false)) seen.add('pan');
  const t0 = Date.now();
  const acted = {}; // id → время действия (клик по лампе, коту, креслу…)
  let muted = false, lastAt = store.get('hintLast', 0);
  const HINTS = [
    { id: 'intro', after: 5, spotMs: 6000,
      text: (touch) => touch ? 'Касайтесь зданий за окном, кота и проигрывателя — у каждого своя история. ▶ внизу — эфир.'
        : 'Нажимайте на здания за окном, кота и проигрыватель — у каждого своя история. Пробел — эфир.',
      spots: () => [...placeSpots, 'cat', 'player', 'curtain'] },
    { id: 'pan', after: 30, when: () => isTouch() && canPan(),
      text: () => 'Проведите пальцем по окну ← → — за краями ещё полгорода.' },
    { id: 'cat', after: 240, act: ['lamp', 'chair'], delay: 25, spots: ['cat'],
      text: () => 'На подоконнике дремлет кот — кликните, чтобы погладить.' },
    { id: 'tea', after: 360, act: ['cat'], delay: 40, spots: ['tea'],
      text: () => 'На столе чай в подстаканнике — клик по стакану подольёт кипятка.' },
    { id: 'secrets', after: 480, when: secretsPending,
      text: () => 'В этом городе спрятаны мелочи-секреты — присмотритесь к деталям за окном.' },
    { id: 'geranium', after: 900, when: () => Date.now() - store.get('wateredAt', 0) > 600e3, spots: ['geranium'],
      text: () => 'Герань на подоконнике просит полива.' },
    { id: 'curtain', after: 1200, when: () => store.get('curtain', null) === null, // шторами ни разу не трогали
      text: () => 'Клик по краю окна задёргивает шторы.' },
  ];
  // Готовность: прошло after от старта ИЛИ (для подсказок с act) действие было и после него прошёл delay
  const ready = (h) => Date.now() - t0 >= AFTER(h.after)
    || (!!h.act && h.act.some((a) => acted[a]) && Date.now() - Math.max(...h.act.map((a) => acted[a] || 0)) >= (DELAY ?? h.delay * 1000));
  const show = (h) => {
    toast(h.text(isTouch()));
    const spots = typeof h.spots === 'function' ? h.spots() : h.spots;
    if (spots) highlight(spots, h.spotMs || 5000);
    seen.add(h.id); lastAt = Date.now();
    store.set('hintsShown', [...seen]); store.set('hintLast', lastAt);
  };
  setInterval(() => { // тик раз в 1 с (как у корги); занято (тост, панель, фокус/сон, скрытая вкладка) — просто ждать, ничего не помечать
    if (muted || quiet || document.hidden || document.body.classList.contains('calm') || busy()) return;
    const cands = HINTS.filter((h) => !seen.has(h.id) && !skip.includes(h.id) && (!h.when || h.when()) && ready(h));
    const h = cands.find((x) => x.act?.some((a) => acted[a] && Date.now() - acted[a] >= (DELAY ?? x.delay * 1000))) || cands[0]; // сначала сработавшие по действию
    if (!h || Date.now() - lastAt < GAP) return;
    show(h);
  }, 1000);
  return {
    act: (id) => (acted[id] = Date.now()), // клик по месту сцены — событие для триггеров
    markSeen: (id) => { seen.add(id); store.set('hintsShown', [...seen]); },
    mute: () => (muted = true), unmute: () => (muted = false),
    state: () => ({ seen: [...seen], lastAt }),
  };
}
