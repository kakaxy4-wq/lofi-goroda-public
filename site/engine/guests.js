// Гости на подоконнике и сезонная вещица на полке — комната откликается на окно.
// Гость: днём, раз в несколько минут, на внешний карниз садится птица — у всех слушателей одна и та же
// (слот по времени, как у секретов). Кто прилетает — по городу и сезону: у моря чайки, зимой снегири и синицы.
// Сезонная вещица — первая на полке сувениров: ёлочка на Новый год, тюльпаны к 8 Марта, вентилятор в жару.

import { rng, sprite, tinted, mixHex } from './util.js';

const BIRDS = {
  pigeon: { name: 'сизый голубь', fact: 'Сизый голубь живёт рядом с человеком уже тысячи лет — карнизы для него как скалы.', rows: ['..gg..', '.gkgg.', '.ggggg', 'ggwggg', '.gggg.', '..o.o.'], pal: { g: '#8a92a0', k: '#1a1a20', w: '#6a9a8a', o: '#c8603a' } },
  sparrow: { name: 'воробей', fact: 'Домовый воробей держится стайками у жилья и зимой никуда не улетает.', rows: ['.bb...', 'bkbb..', 'bbbbbt', '.wbbbt', '.www..', '..o.o.'], pal: { b: '#8a6040', k: '#1a1410', w: '#d8c8b0', t: '#5a4030', o: '#c89060' } },
  tit: { name: 'большая синица', fact: 'Большая синица к холодам перебирается в город — её выдаёт жёлтая грудка с чёрным «галстуком».', rows: ['.kk...', 'kwkk..', 'kkggt.', '.ykyt.', '.yky..', '..o.o.'], pal: { k: '#1a1a20', w: '#f4f4f0', g: '#5a8a5a', y: '#f0d040', t: '#4a5a6a', o: '#6a6a70' } },
  bullfinch: { name: 'снегирь', fact: 'Снегири прилетают в города с первым снегом; красная грудка — у самцов.', rows: ['.kk...', 'kkkk..', 'kggggt', '.rrrgt', '.rrr..', '..o.o.'], pal: { k: '#1a1a20', g: '#7a8290', r: '#e04a3a', t: '#2a2a30', o: '#3a3a40' } },
  gull: { name: 'чайка', fact: 'Чайки у моря давно стали городскими птицами — гнездятся даже на крышах.', rows: ['.ww....', 'wkwy...', 'wwwww..', '.wwwggg', '.wwww..', '..o.o..'], pal: { w: '#f2f2ee', k: '#1a1a20', y: '#f0c030', g: '#9aa4b0', o: '#e0a040' } },
};
const SEA = new Set(['piter', 'vladivostok', 'murmansk', 'kaliningrad', 'sochi', 'anadyr']);
const SLOT = 420, STAY = 45; // каждые 7 минут гость на 45 секунд
const X = 330, BASE = 215; // сидит на самом подоконнике, правее полки

// Кто сейчас на карнизе: { kind, x, peck } или null
const FORCE = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('guest') : null; // ?guest=bullfinch — проверить птицу
export function guestState(env, cityId) {
  if (FORCE && BIRDS[FORCE]) return { kind: FORCE, x: X + 4, peck: Math.sin(env.ms / 300) > 0.6, hop: false };
  if (env.sun.alt < 2 || ['rain', 'storm'].includes(env.weather.kind) || env.forcedGuest === false) return null;
  const t = env.ms / 1000, slot = Math.floor(t / SLOT), ph = t - slot * SLOT;
  const r = rng(slot * 131 + [...cityId].reduce((a, c) => a + c.charCodeAt(0), 0));
  if (r() < 0.35 || ph > STAY) return null; // не в каждый слот кто-то прилетает
  const mo = env.local.getUTCMonth() + 1, winter = mo >= 11 || mo <= 3, x = r();
  const kind = SEA.has(cityId) && x < 0.35 ? 'gull' : winter ? (x < 0.6 ? 'bullfinch' : x < 0.85 ? 'tit' : 'sparrow') : x < 0.55 ? 'pigeon' : 'sparrow';
  return { kind, x: X + Math.round(r() * 8), peck: Math.sin(ph * 3) > 0.6, hop: ph < 0.6 };
}
const cache = new Map();
const img = (rows, pal, key, tint) => {
  const k = key + ':' + tint;
  if (!cache.has(k)) { const sp = sprite(rows, pal); cache.set(k, tint ? tinted(sp, tint) : sp); }
  return cache.get(k);
};
let last = null; // где гость нарисован в последнем кадре — для клика
export const guestAt = (x, y) => (last && x >= last.rect[0] && x < last.rect[0] + last.rect[2] && y >= last.rect[1] && y < last.rect[1] + last.rect[3] ? last : null);
export function drawGuest(ctx, env, dayF, cityId) {
  const g = guestState(env, cityId);
  last = null;
  if (!g) return null;
  const B = BIRDS[g.kind], sp = img(B.rows, B.pal, g.kind, dayF > 0.9 ? '' : mixHex('#6a6474', '#ffffff', Math.round(dayF * 10) / 10));
  const y = BASE - sp.height - (g.hop ? 2 : 0) + (g.peck ? 1 : 0);
  ctx.drawImage(sp, g.x, y);
  return (last = { ...g, rect: [g.x - 2, y - 2, sp.width + 4, sp.height + 4] });
}
export const birdInfo = (kind) => BIRDS[kind];

// ---------- сезонная вещица ----------
const SEASONAL = {
  tree: { name: 'новогодняя ёлочка', rows: ['...y...', '...g...', '..ggg..', '..grg..', '.ggggg.', '.gbggg.', 'ggggyrg', '...t...', '..ppp..'], pal: { y: '#f0d040', g: '#2f6a3a', r: '#e04a3a', b: '#4a8ae0', t: '#6a4a2a', p: '#b8423a' } },
  tulips: { name: 'тюльпаны к 8 Марта', rows: ['r.y.r', 'r.y.r', '.g.g.', '.ggg.', '..g..', '.www.', '.www.'], pal: { r: '#e0405a', y: '#f0c040', g: '#4a8a3a', w: '#d8e8f0' } },
  fan: { name: 'вентилятор', rows: ['.sss.', 's.c.s', 'sc.cs', 's.c.s', '.sss.', '..s..', '.sss.'], pal: { s: '#b8bcc4', c: '#7a8088' } },
};
// Что сейчас стоит в начале полки (или null): по местной дате и температуре
export function seasonalItem(env) {
  const mo = env.local.getUTCMonth() + 1, d = env.local.getUTCDate();
  if ((mo === 12 && d >= 25) || (mo === 1 && d <= 10)) return 'tree';
  if (mo === 3 && d >= 7 && d <= 9) return 'tulips';
  if (env.weather.temp >= 28) return 'fan';
  return null;
}
const FAN_B = ['.sss.', 'sc.cs', 's.c.s', 'sc.cs', '.sss.', '..s..', '.sss.']; // лопасти повёрнуты
export function seasonalSprite(id, t) {
  const S = SEASONAL[id], spin = id === 'fan' && Math.floor(t * 8) % 2;
  const key = 'season:' + id + (spin ? 'b' : '');
  return { id, key, name: S.name, sp: img(spin ? FAN_B : S.rows, S.pal, key, '') };
}
