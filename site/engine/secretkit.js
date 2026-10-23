// Заготовки секретов окна: «пролетает/проплывает» (mover), «появляется на месте» (still), метеоры (perseids).
// Секрет — { id, name, hint, found, layer, state(env) → прямоугольник или null, draw(g, env, st, dayF) }:
// layer 'sky' рисуется в буфер над горизонтом (и отражается в воде), 'street' — поверх воды и набережной.
// Расписание — от времени, одно для всех слушателей; env.forced (?secret=id) показывает секрет сразу.

import { sprite, tinted, mixHex, rng } from './util.js';

const T = (env) => env.ms / 1000;
export const inWin = (env, period, dur, shift = 0) => env.forced || ((T(env) + shift) % period) < dur;
export const phase = (env, period, dur, shift = 0) => (env.forced ? 0.5 : (((T(env) + shift) % period) / dur));
const mo = (env) => env.local.getUTCMonth() + 1, hr = (env) => env.local.getUTCHours(), day = (env) => env.local.getUTCDate();
// условия «когда бывает»: складываются через all(...)
export const when = {
  day: (e) => e.sun.alt > 2,
  night: (e) => e.sun.alt < -6,
  dusk: (e) => e.sun.alt < 4 && e.sun.alt > -8,
  months: (...ms) => (e) => ms.includes(mo(e)),
  hours: (a, b) => (e) => (a <= b ? hr(e) >= a && hr(e) < b : hr(e) >= a || hr(e) < b),
  winter: (e) => !!e.winter, frozen: (e) => !!e.frozen, open: (e) => !e.frozen,
  weekend: (e) => [0, 6].includes(e.local.getUTCDay()),
  dates: (m1, d1, m2, d2) => (e) => { const v = mo(e) * 100 + day(e), a = m1 * 100 + d1, b = m2 * 100 + d2; return a <= b ? v >= a && v <= b : v >= a || v <= b; },
};
export const all = (...fs) => (e) => fs.every((f) => f(e));

const cache = new Map();
// спрайт под свет кадра: днём как есть, к ночи темнее (glow — светится сам: огни, звёзды)
function img(key, rows, pal, dayF, glow) {
  const step = glow ? 10 : Math.round(dayF * 5) * 2, k = key + ':' + step;
  if (!cache.has(k)) { const sp = sprite(rows, pal); cache.set(k, step >= 10 ? sp : tinted(sp, mixHex('#4a4458', '#ffffff', step / 10))); }
  return cache.get(k);
}
const size = (rows) => [rows[0].length, rows.length];

// Пролетает / проплывает / проходит: от x0 до x1 за dur секунд раз в period; y — число или функция от доли пути
export function mover({ id, name, hint, found, layer = 'sky', rows, rows2, pal, glow = false, period = 1800, dur = 20, shift = 0, x0 = -20, x1 = 500, y, bob = 0, when: w = () => true, wake }) {
  const [sw, sh] = size(rows);
  return {
    id, name, hint, found, layer,
    state(env) {
      if (!env.forced && !w(env)) return null;
      if (!inWin(env, period, dur, shift)) return null;
      const p = phase(env, period, dur, shift);
      return { x: Math.round(x0 + (x1 - x0) * p), y: Math.round(typeof y === 'function' ? y(p) : y), w: sw, h: sh, p };
    },
    draw(g, env, st, dayF) {
      const alt = rows2 && Math.floor(env.ms / 250) % 2;
      g.drawImage(img(id + (alt ? '2' : ''), alt ? rows2 : rows, pal, dayF, glow), st.x, st.y + Math.round(Math.sin(env.ms / 400) * bob));
      wake?.(g, env, st, dayF);
    },
  };
}
// Появляется на месте (x, y) на dur секунд раз в period; blink — мигает
export function still({ id, name, hint, found, layer = 'street', rows, rows2, pal, glow = false, x, y, period = 0, dur = 0, shift = 0, blink = 0, when: w = () => true, extra }) {
  const [sw, sh] = size(rows);
  return {
    id, name, hint, found, layer,
    state(env) {
      if (!env.forced && !w(env)) return null;
      if (period && !inWin(env, period, dur, shift)) return null;
      return { x, y, w: sw, h: sh };
    },
    draw(g, env, st, dayF) {
      if (blink && Math.floor(env.ms / blink) % 2) return;
      const alt = rows2 && Math.floor(env.ms / 500) % 2;
      g.drawImage(img(id + (alt ? '2' : ''), alt ? rows2 : rows, pal, dayF, glow), st.x, st.y);
      extra?.(g, env, st, dayF);
    },
  };
}
// Персеиды: в ночи 10–14 августа по небу чиркают метеоры (общий секрет для окон с тёмным небом)
export function perseids({ id = 'perseids', name = 'Персеиды', hint = 'В середине августа ночью небо иногда чиркают светлые чёрточки.', found = 'Метеорный поток Персеиды: в середине августа Земля проходит через пыль кометы Свифта — Туттля, и за час можно увидеть десятки «падающих звёзд».', area = [40, 10, 400, 80] } = {}) {
  return {
    id, name, hint, found, layer: 'sky',
    state(env) {
      if (!env.forced && !(env.sun.alt < -10 && mo(env) === 8 && day(env) >= 10 && day(env) <= 14)) return null;
      if (!inWin(env, 90, 14)) return null;
      return { x: area[0], y: area[1], w: area[2], h: area[3] };
    },
    draw(g, env, st) {
      const slot = Math.floor(T(env) / 3), r = rng(slot), ph = (T(env) % 3) / 0.6;
      if (ph > 1) return;
      const x = st.x + r() * st.w, y = st.y + r() * st.h * 0.6, len = 10 + r() * 14;
      for (let i = 0; i < len; i++) { g.globalAlpha = (1 - i / len) * (1 - ph * 0.5); g.fillStyle = '#ffffff'; g.fillRect(Math.round(x - i * 1.4 - ph * 20), Math.round(y + i * 0.6 + ph * 9), 1, 1); }
      g.globalAlpha = 1;
    },
  };
}
