// Сумеречный пуск ракеты — редкое событие-секрет для окон, откуда видны космодромы.
// Над горизонтом медленно поднимается светящийся след с расходящимся шлейфом: Солнце
// уже сошло за горизонт (−4…−12°), но ещё подсвечивает след ракеты — так пуски
// «Плесецка» и «Восточного» выглядят с земли. Расписание детерминированное от даты и
// одно для всех слушателей окна: раз в 10–14 дней, вечером, когда Солнце опускается
// через −8°. Города подключают секрет: rocketSecret('Плесецк', 62.9, 40.6) в SECRETS.

import { W, HORIZON } from './const.js';
import { azToX } from './scene.js';
import { nextSunCross } from './astro.js';
import { rng } from './util.js';

const DAY = 86400e3;
const DUR = 80; // секунд — подъём следа (реальные сумеречные пуски видны 60–90 с)
const RISE = 62; // пикселей над горизонтом (~18° — голова уходит высоко в сумерки)
const COLS = ['#fffbe8', '#ffeec2', '#ffd9a8', '#f2b4a8', '#c89cc0', '#8e96cc']; // ядро → рассеянный шлейф

// стабильный hash строки: у каждого космодрома свои период и сдвиг расписания
function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// начальный азимут на космодром из точки (lat, lon) — по дуге большого круга
function bearing(lat, lon, plat, plon) {
  const R = Math.PI / 180, f1 = lat * R, f2 = plat * R, dl = (plon - lon) * R;
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) / R + 360) % 360;
}

// pad — название космодрома (и сид расписания), (plat, plon) — его точка на карте
export function rocketSecret(pad, plat, plon) {
  const h = strHash(pad), period = 10 + (h % 5), phase = (h >>> 8) % period; // пуск раз в 10–14 дней
  const memo = { k: null, start: null }; // старт пуска дня ищем один раз (шаг поиска 2 мин — не для каждого кадра)
  function launchAt(env) {
    const day = Math.floor(env.local.getTime() / DAY);
    if (((day % period) + period) % period !== phase) return null;
    const k = `${day}@${env.lat.toFixed(1)},${env.lon.toFixed(1)}`; // у поезда пункт едет — кэш с ключом
    if (memo.k === k) return memo.start;
    const midnight = day * DAY + (env.ms - env.local.getTime()); // местная полночь в UTC
    const cross = nextSunCross(midnight, env.lat, env.lon, -8, false); // вечер: Солнце уходит ниже −8°
    memo.k = k; memo.start = cross != null && cross < midnight + DAY ? cross : null;
    return memo.start;
  }
  return {
    id: 'rocket', name: 'Запуск ракеты', layer: 'sky',
    hint: 'Очень редко, ясным вечером в сумерках, над горизонтом медленно поднимается светящийся след.',
    found: `Так выглядят сумеречные пуски с космодрома «${pad}»: Солнце уже сошло за горизонт, но ещё подсвечивает след ракеты — он разгорается, расходится веером и через пару минут гаснет.`,
    state(env) {
      let p;
      if (env.forced || env.rocket) { // ?rocket=1, «Подсмотреть», ?secret=rocket — пуск по кругу, без расписания
        p = ((env.ms / 1000) % DUR) / DUR;
      } else {
        const start = launchAt(env);
        if (start == null || env.ms < start || env.ms > start + DUR * 1000) return null;
        const sun = env.sun.alt; // сумерки: Солнце от −4° до −12°; в непогоду след не виден
        if (sun < -12 || sun > -4 || !['clear', 'cloudy'].includes(env.weather.kind) || env.weather.cloud > 92) return null;
        p = (env.ms - start) / (DUR * 1000);
      }
      // космодром часто вне кадра (окно смотрит в другую сторону) — след ставим в видимую часть окна, у той стороны,
      // где космодром ближе; края сцены закрыты подвязанными шторами (~20–38 px), поэтому отступ 48 px (было 16 — след прятался за шторой)
      const ax = azToX(bearing(env.lat, env.lon, plat, plon)), M = 48;
      const cx = Math.round(ax >= M && ax <= W - M ? ax : ax < W / 2 ? M : W - M);
      const y = Math.round(HORIZON - 3 - p * RISE); // голова следа
      return { x: cx - 16, y, w: 32, h: HORIZON - 3 - y, cx, p };
    },
    draw(b, env, st) {
      const { cx, p } = st, base = HORIZON - 3, total = Math.max(1, base - st.y);
      for (let d = 0; d <= total; d++) { // d — расстояние от основания следа: стабильный сид строки
        const y = base - d, age = p * (1 - d / total); // сколько «живёт» эта часть следа
        const r = rng(d * 131 + 7);
        const w = 1 + Math.round(age * age * 16 + (r() - 0.5) * age * 6); // шлейф расходится веером
        const dx = Math.round((r() - 0.5) * age * 20); // и его помаленьку сносит
        b.globalAlpha = Math.max(0.05, Math.min(0.95, 0.9 - age));
        b.fillStyle = COLS[Math.min(COLS.length - 1, Math.floor(age * 7))];
        b.fillRect(cx + dx - (w >> 1), y, Math.max(1, w), 1);
      }
      const g = b.createRadialGradient(cx + 0.5, st.y + 0.5, 0, cx + 0.5, st.y + 0.5, 10); // голова: ореол и ядро
      g.addColorStop(0, `rgba(255,246,214,${0.55 * (1 - p * 0.35)})`); g.addColorStop(1, 'rgba(255,246,214,0)');
      b.fillStyle = g; b.fillRect(cx - 10, st.y - 10, 21, 21);
      b.fillStyle = '#ffffff'; b.fillRect(cx - 1, st.y, 2, 2);
      if (p < 0.25) { // стартовая вспышка над горизонтом
        const k = 1 - p / 0.25, g2 = b.createRadialGradient(cx + 0.5, base + 1.5, 0, cx + 0.5, base + 1.5, 18);
        g2.addColorStop(0, `rgba(255,214,150,${0.5 * k})`); g2.addColorStop(1, 'rgba(255,214,150,0)');
        b.fillStyle = g2; b.fillRect(cx - 18, base - 17, 37, 38);
      }
      b.globalAlpha = 1;
    },
  };
}
