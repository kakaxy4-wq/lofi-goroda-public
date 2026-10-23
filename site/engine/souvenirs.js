// Полка сувениров: за каждое окно, где человек побыл (10 минут эфира) или которое угадал в «Окне дня»,
// на подоконнике слева появляется маленькая вещица оттуда — Чижик, чак-чак, янтарь, нерпа… С подписью, откуда
// и когда. Хранится у человека (localStorage lg:souvenirs), комната путешествует вместе с ним по всем окнам.

import { sprite, tinted, mixHex } from './util.js';

// Маленькие спрайты (до 8×10): строки снизу вверх читаются как картинка сверху вниз
const S = {
  piter: { name: 'Чижик-Пыжик', rows: ['..gg..', '.gyyg.', 'gyykyo', '.gyyg.', '..yy..', '.ssss.'], pal: { g: '#5a8a3a', y: '#e0c040', k: '#1a1a20', o: '#e88a2a', s: '#8a8a90' } },
  moskva: { name: 'матрёшка', rows: ['.rr.', 'rffr', 'rffr', '.rr.', 'rwwr', 'rwyr', 'rwwr', 'rrrr'], pal: { r: '#c8423a', f: '#f0d0b0', w: '#f4e8c8', y: '#e8b030' } },
  kazan: { name: 'чак-чак', rows: ['...h...', '..ggg..', '.ggdgg.', 'gdggggd', 'ppppppp'], pal: { g: '#e0a040', d: '#c8862a', h: '#f4c86a', p: '#e8e4dc' } },
  vladimir: { name: 'владимирская вишня', rows: ['..g.', '.g.g', 'g..g', 'r..r', 'rr.rr'], pal: { g: '#3a7a3a', r: '#b8202a' } },
  yaroslavl: { name: 'медвежонок', rows: ['b..b', 'bbbb', 'bkbk', 'bbbb', '.bb.', 'b..b'], pal: { b: '#8a5a32', k: '#1a1410' } },
  vologda: { name: 'вологодское кружево', rows: ['.w.w.w.', 'w.w.w.w', '.wwwww.', 'w.w.w.w', '.w.w.w.'], pal: { w: '#f4f2ea' } },
  krasnodar: { name: 'подсолнух', rows: ['.yyy.', 'yrrry', 'yrrry', '.yyy.', '..g..', '.gg..', '..g..'], pal: { y: '#f0c030', r: '#6a3a1a', g: '#4a8a3a' } },
  sochi: { name: 'морская ракушка', rows: ['..p..', '.ppp.', 'pwpwp', 'ppppp', '.p.p.'], pal: { p: '#f0b8a8', w: '#fff0e8' } },
  nnovgorod: { name: 'хохломская ложка', rows: ['.rr.', 'ryyr', 'rryr', '.rr.', '.g..', '.g..', '.g..'], pal: { r: '#b8202a', y: '#e8b030', g: '#c8902a' } },
  kaliningrad: { name: 'кусочек янтаря', rows: ['.aa.', 'ahaa', 'aaaa', '.aa.'], pal: { a: '#e89a2a', h: '#ffd88a' } },
  vladivostok: { name: 'морская звезда', rows: ['..o..', '..o..', 'ooooo', '.ooo.', '.o.o.', 'o...o'], pal: { o: '#e8702a' } },
  murmansk: { name: 'варенье из морошки', rows: ['wwww', 'oooo', 'oyoo', 'oooo', 'oooo'], pal: { w: '#e8e4dc', o: '#e8902a', y: '#ffc860' } },
  samara: { name: 'модель ракеты', rows: ['.w.', 'www', 'www', 'www', 'wrw', 'www', 'g.g'], pal: { w: '#e8ecf4', r: '#c8423a', g: '#8a909a' } },
  ekaterinburg: { name: 'малахитовая шкатулка', rows: ['.mmmm.', 'mllmlm', 'mmmmmm', 'mlmmlm', 'mmmmmm'], pal: { m: '#1f7a5a', l: '#3fb08a' } },
  irkutsk: { name: 'байкальская нерпа', rows: ['.ss...', 'skss..', 'ssssss', '.sssss'], pal: { s: '#8a929a', k: '#1a1a20' } },
  vnovgorod: { name: 'берестяная грамота', rows: ['bbbbbb', 'bkbkkb', 'bbbbbb', 'bkkbkb', 'bbbbbb'], pal: { b: '#e0c89a', k: '#6a4a2a' } },
  anadyr: { name: 'косточковый кит', rows: ['......w', '.wwww.w', 'wwkwwww', '.wwwww.'], pal: { w: '#f0ece0', k: '#2a2a30' } },
  bam: { name: 'золотое звено БАМа', rows: ['g.....', 'gggggg', 'g.....'], pal: { g: '#e2b23e' } },
  transsib: { name: 'подстаканник', rows: ['.tttt.', '.tttt.', 'sssss.', 'ssssss', 'sssss.', 'ssss..'], pal: { t: '#a85a2a', s: '#b8bcc4' } },
  izhevsk: { name: 'тарелка пельменей', rows: ['..ww..', '.wwww.', 'wwwwww', 'pppppp', '.pppp.'], pal: { w: '#f2ead8', p: '#e8e4dc' } },
  doroga: { name: 'минивэн «Марсохода»', rows: ['.wwwww.', 'wbbwbbw', 'wwwwwwo', '.k...k.'], pal: { w: '#f2f2ee', b: '#5a7a9a', o: '#e88a2a', k: '#1a1a20' } },
};
export const SOUVENIRS = S;

const KEY = 'lg:souvenirs';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
let owned = load();
const cache = new Map(); // id → готовый спрайт

// Положить вещицу города на полку; вернёт true, если её ещё не было
export function collect(id) {
  if (!S[id] || owned[id]) return false;
  const d = new Date();
  owned = { ...load(), [id]: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}` };
  try { localStorage.setItem(KEY, JSON.stringify(owned)); } catch {}
  return true;
}
export const count = () => Object.keys(owned).filter((k) => S[k]).length;
export const total = () => Object.keys(S).length;

// Места на подоконнике: слева направо по порядку получения, шаг 10 px от x0
const X0 = 146, STEP = 10, MAX = 15, BASE = 212;
let lead = null; // сезонная вещица в начале полки (engine/guests.js): ёлочка, тюльпаны, вентилятор
function slots() {
  const own = Object.entries(owned).filter(([k]) => S[k]).slice(lead ? -(MAX - 1) : -MAX).map(([id, date]) => {
    const sp = cache.get(id) || (cache.set(id, sprite(S[id].rows, S[id].pal)), cache.get(id));
    return { id, date, sp };
  });
  return [...(lead ? [{ ...lead, season: true }] : []), ...own].map((s, i) => ({ ...s, x: X0 + i * STEP + ((STEP - s.sp.width) >> 1) }));
}
// Какая вещица под точкой (x, y) сцены — для клика и подсказки
export function souvenirAt(x, y) {
  for (const s of slots()) if (x >= s.x - 1 && x <= s.x + s.sp.width && y >= BASE - s.sp.height - 1 && y <= BASE + 1) return s;
  return null;
}
export function drawShelf(ctx, env, dayF, seasonal = null) {
  lead = seasonal;
  const list = slots();
  if (!list.length) return;
  // свет комнаты: днём как есть, вечером тёплый от лампы, ночью тёмный (как у кота и гитары); копии кэшируем по шагу 0,1
  const step = Math.round(dayF * 10), lamp = env.lampOn && dayF < 0.5;
  const tint = mixHex(lamp ? '#a07a62' : '#5e5468', '#ffffff', step / 10);
  // полочка: доска с кромкой и двумя кронштейнами — чтобы вещицы читались как стоящие в комнате, а не на набережной
  const x0 = X0 - 3, x1 = list[list.length - 1].x + list[list.length - 1].sp.width + 3;
  ctx.fillStyle = mixHex('#2a1c16', '#8a5a34', dayF); ctx.fillRect(x0, BASE, x1 - x0, 2);
  ctx.fillStyle = mixHex('#3a2a20', '#b07a48', dayF); ctx.fillRect(x0, BASE, x1 - x0, 1);
  ctx.fillStyle = mixHex('#1e140f', '#5a3a22', dayF); ctx.fillRect(x0 + 2, BASE + 2, 1, 3); ctx.fillRect(x1 - 3, BASE + 2, 1, 3);
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fillRect(x0, BASE + 2, x1 - x0, 1); ctx.globalAlpha = 1;
  for (const s of list) {
    const key = `${s.key || s.id}:${step}:${lamp}`;
    let img = cache.get(key);
    if (!img) { img = step >= 10 ? s.sp : tinted(s.sp, tint); cache.set(key, img); }
    ctx.drawImage(img, s.x, BASE - s.sp.height);
  }
}
