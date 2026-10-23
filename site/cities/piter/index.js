// Петербург — модуль города для движка (engine/app.js).
// Всё питерское собрано здесь: силуэт, звуки, места, мост, «Зенит», реплики ведущего.

import { CITY, cityClock, hhmm } from './config.js';
import * as skyline from './skyline.js';
import * as sounds from './sounds.js';
import { bridgeState } from './bridges.js';
import { HOTSPOTS, ROOM_HOTSPOTS, PLACES, PLACE_ORDER } from './places.js';
import { TARGETS } from './games.js';

// ---------- «Зенит»: расписание матчей ----------
let zenitMatches = [];
fetch('cities/piter/data/zenit.json', { cache: 'no-store' }).then((r) => r.json()).then((d) => (zenitMatches = d.matches || [])).catch(() => {});
// Флаг с утра дня матча до 6 утра следующего; Лахта и телебашня в клубных цветах ±3 ч от начала.
function zenitState(ms) {
  for (const m of zenitMatches) {
    const [y, mo, d] = m.date.split('-').map(Number), [h, mi] = m.time.split(':').map(Number);
    const dayStart = Date.UTC(y, mo - 1, d) - CITY.utcOffset * 3600e3;
    const ko = dayStart + (h * 60 + mi) * 60e3, flagEnd = dayStart + 30 * 3600e3;
    if (ms < dayStart + 6 * 3600e3 || ms > flagEnd) continue;
    return { match: m, flag: true, glow: ms >= ko - 3 * 3600e3 && ms < ko + 3 * 3600e3, live: ms >= ko && ms < ko + 115 * 60e3, after: ms >= ko + 115 * 60e3 };
  }
  return null;
}

// Доп. поля окружения кадра
function env(ms, local) {
  const mo = local.getUTCMonth() + 1, day = local.getUTCDate();
  return {
    bridge: bridgeState(ms),
    winter: mo === 12 || mo <= 3 || (mo === 11 && day >= 25),
    frozen: mo === 1 || mo === 2 || (mo === 3 && day <= 25) || (mo === 12 && day >= 15),
    autumn: (mo === 9 && day >= 10) || mo === 10 || (mo === 11 && day < 25),
    zenit: zenitState(ms),
  };
}

// Разовые звуковые события между тиками: пушка в полдень, гудок при проходе судна
function audioEvents(e, prevMs) {
  const noon = (m) => { const l = cityClock(m); return l.getUTCHours() * 3600 + l.getUTCMinutes() * 60 + l.getUTCSeconds(); };
  return {
    cannonNow: noon(prevMs) < 43200 && noon(e.ms) >= 43200 && e.ms - prevMs < 5000,
    shipHorn: e.bridge.open > 0.8 && Math.floor(prevMs / 660000) !== Math.floor(e.ms / 660000) && e.ms - prevMs < 5000,
  };
}

// Городские реплики ведущего (движок добавит погоду, рассвет/закат, трек и подсказку)
function ticker(e) {
  const l = e.local, lines = [];
  const b = e.bridge;
  if (e.frozen) lines.push('Нева подо льдом — мосты не разводят до весны.');
  else if (b.open > 0) lines.push(`Дворцовый разведён до ${CITY.bridge.windows[b.windowIdx][1]}. Суда идут вверх по Неве.`);
  else if (b.season && b.next && b.next.kind === 'open' && b.next.inMin < 240 && bridgeState(e.ms + b.next.inMin * 60e3 + 60e3).season) {
    const m = Math.round(b.next.inMin);
    lines.push(`До разводки Дворцового ${m >= 60 ? `${Math.floor(m / 60)} ч ` : ''}${m % 60} мин.`);
  }
  const mo = l.getUTCMonth() + 1;
  if (mo >= 5 && mo <= 7 && e.sun.alt < 0 && e.sun.alt > -10) lines.push(e.sun.alt > -1 ? 'Белые ночи: солнце у самого горизонта.' : `Белые ночи: солнце всего на ${Math.abs(e.sun.alt).toFixed(0)}° под горизонтом.`);
  if (l.getUTCHours() === 11) lines.push('В полдень — выстрел пушки с Нарышкина бастиона.');
  if (e.zenit) {
    const m = e.zenit.match, pair = `«${m.home}» — «${m.away}»`;
    if (e.zenit.live) lines.push(`Идёт матч ${pair}. Лахта светится сине-бело-голубым.`);
    else if (e.zenit.after) lines.push(`Сегодня играл «Зенит»: ${pair}. Шарф на окне до утра.`);
    else lines.push(`Сегодня играет «Зенит»: ${pair}, ${m.time}${m.home === 'Зенит' ? ', дома, на Крестовском' : ''}. Флаг уже на окне.`);
  }
  return lines;
}

// Ближайшие события для строки «Что сейчас» (app.js)
function moments(e) {
  const out = [], b = e.bridge;
  if (b.season && b.next) out.push({ title: b.next.kind === 'open' ? 'развод Дворцового' : 'наведение Дворцового', atMs: e.ms + b.next.inMin * 60e3 });
  const l = e.local, hm = l.getUTCHours() * 60 + l.getUTCMinutes() + l.getUTCSeconds() / 60;
  if (hm < 720) out.push({ title: 'полуденная пушка', atMs: e.ms + (720 - hm) * 60e3 });
  return out;
}

export default {
  config: CITY,
  skyline,
  sounds,
  env,
  audioEvents,
  ticker,
  moments,
  bridgeState, // «Показать разводку» проверяет навигацию
  places: { HOTSPOTS, ROOM_HOTSPOTS, PLACES, PLACE_ORDER, games: TARGETS },
  labels: { cat: 'Кот Елисей — погладить', chizhikfig: 'Чижик-сувенир — бросить монетку', scarf: 'Шарф болельщика — сегодня играет «Зенит»', books: 'Путеводитель по Санкт-Петербургу' },
  toasts: {
    cat: 'Елисей мурчит. Назван в честь кота с Малой Садовой.',
    tea: 'Чай с чабрецом, в подстаканнике — как в поезде.',
    chair: 'Кресло-качалка поскрипывает. Плед — из маминого шкафа.',
  },
  hotspotOn: (id, env) => id !== 'scarf' || !!env?.zenit?.flag, // шарф висит только в день матча
  onHotspot(id, api) {
    if (id === 'chizhikfig') { api.openGame('chizhik'); return true; }
    if (id === 'scarf' && api.env?.zenit) {
      const m = api.env.zenit.match, pair = `«${m.home}» — «${m.away}»`;
      api.toast(api.env.zenit.live ? `Идёт матч ${pair}. Шарф на карнизе — за своих.` : api.env.zenit.after ? `Сегодня играл «Зенит»: ${pair}. Шарф повисит до утра.` : `Сегодня матч ${pair} в ${m.time} по Москве — шарф уже на карнизе.`);
      return true;
    }
    return false;
  },
  placesIntro: 'Нажмите на здание в кадре или выберите здесь. Монетки — Чижику и Зайцу.',
  about: `<p>Лофи-города — живые окна в города России. Всё в кадре настоящее: время и погода Санкт-Петербурга, развод Дворцового моста по графику, куранты Петропавловки каждые 15 минут и пушка в полдень.</p>
      <p>Радио Санкт-Петербург — общий эфир: все слушатели слышат одно и то же в один момент. Между треками звучат живые вставки — их сочиняет браузер, каждый раз новые.</p>`,
  timeIntro: 'По умолчанию всё настоящее: время Санкт-Петербурга, погода с Open-Meteo, мосты по графику. Здесь можно заглянуть в другое время.',
};
