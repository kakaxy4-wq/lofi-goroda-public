import { CITY, cityClock } from './config.js';

const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

function inSeason(d) {
  const { from, to } = CITY.bridge.season;
  const md = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  return md >= from[0] * 100 + from[1] && md <= to[0] * 100 + to[1];
}

// Состояние моста: open — 0..1 (0 — сведён, 1 — полностью разведён),
// label — строка для эфира.
export function bridgeState(ms) {
  const d = cityClock(ms);
  const b = CITY.bridge;
  if (!inSeason(d)) return { open: 0, season: false, windowIdx: -1, next: null };
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const mv = b.moveMinutes;
  let open = 0, windowIdx = -1;
  b.windows.forEach(([a, z], i) => {
    const s = toMin(a), e = toMin(z);
    if (mins >= s && mins <= e) {
      windowIdx = i;
      open = Math.min(1, (mins - s) / mv, (e - mins) / mv);
    }
  });
  // ближайшее событие
  let next = null;
  for (const [a, z] of b.windows) {
    for (const [t, kind] of [[toMin(a), 'open'], [toMin(z), 'close']]) {
      let delta = t - mins;
      if (delta < 0) delta += 1440;
      if (!next || delta < next.inMin) next = { kind, at: kind === 'open' ? a : z, inMin: delta };
    }
  }
  const k = Math.max(0, open);
  return { open: k * k * (3 - 2 * k), season: true, windowIdx, next }; // плавный разгон и торможение
}
