// Проверка «Окна дня» в браузере: открыть /okno-dnya/, очистить lg:* и перезагрузить, затем в консоли
//   const m = await import('/tests/day_test.js'); await m.run()
// Город до ответа нигде не выдан, ошибка открывает подсказку, верный ответ открывает шторы и пишет журнал.
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hiddenEl = (s) => { const e = $(s); return !e || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden'; };

export async function run() {
  const out = [], t = (name, ok, info = '') => out.push([name, !!ok, ok ? '' : String(info)]);
  const errs = []; addEventListener('error', (e) => errs.push(e.message));
  const m = await import('/cities/okno-dnya/index.js'), D = m.default.day, real = D.real;
  await sleep(1500);
  t('карточка «Окно дня» на месте', $('#dayCard') && /Окно дня №\d+/.test($('#dayCard').innerText));
  t('в шапке не настоящий город', !$('h1').innerText.includes(real.name), $('h1').innerText);
  t('погода, открытка, места спрятаны до ответа', hiddenEl('#wx') && hiddenEl('#sendBtn') && hiddenEl('[data-panel="places"]') && hiddenEl('[data-panel="time"]'));
  t('часы спрятаны до подсказки «часы»', hiddenEl('#clock'));
  t('шторы задёрнуты внахлёст', window.__lofiDay.closedPx() > 240 && window.__lofiDay.curtain() === 1);
  t('название трека не выдаёт город', !/·|«/.test($('#npTitle').textContent) || /Окно дня|Трек|Живая/.test($('#npTitle').textContent), $('#npTitle').textContent);
  t('в списке ответов все города пула', $('#dayPick').options.length === D.pool.length + 1, $('#dayPick').options.length);
  // неверный ответ
  const wrong = D.pool.find((c) => c.id !== real.id);
  $('#dayPick').value = wrong.id; $('[data-a=go]').click(); await sleep(300);
  t('ошибка: кот говорит направление и километры', /км от/.test($('#toast').textContent) && /к (северу|югу|востоку|западу|северо|юго)/.test($('#toast').textContent), $('#toast').textContent);
  t('ошибка открывает вторую подсказку', document.querySelectorAll('.day-hints li').length === 2);
  t('ошибочный город больше не выбрать', $(`#dayPick option[value="${wrong.id}"]`).disabled);
  // верный ответ
  $('#dayPick').value = real.id; $('[data-a=go]').click(); await sleep(400);
  t('верный ответ: город открыт', window.__lofiDay.solved && $('h1').innerText.includes(real.name), $('h1').innerText);
  t('шторы открываются', window.__lofiDay.curtain() === 0);
  t('результат: со 2-й попытки', /со? 2-й попытки/.test($('#dayCard').innerText), $('#dayCard').innerText);
  const log = JSON.parse(localStorage.getItem('lg:day:log') || '{}');
  t('журнал дня записан', log[D.date]?.ok === true && log[D.date]?.id === real.id, JSON.stringify(log));
  t('после ответа погода видна', !hiddenEl('#wx'));
  t('нет ошибок JS', !errs.length, errs.join('; '));
  return out;
}
