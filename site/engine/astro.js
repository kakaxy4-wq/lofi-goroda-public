// Положение Солнца и Луны для города. Упрощённые формулы (точность ~0.5°),
// для неба на экране больше не нужно.

const RAD = Math.PI / 180;
const J2000 = 946728000000; // 2000-01-01 12:00 UTC

function eqToHorizontal(ra, dec, ms, lat, lon) {
  const d = (ms - J2000) / 86400000;
  const gmst = (280.46061837 + 360.98564736629 * d) % 360;
  const H = (gmst + lon) * RAD - ra;
  const la = lat * RAD;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
  // азимут от севера по часовой
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) + Math.PI;
  return { alt: alt / RAD, az: (az / RAD) % 360 };
}

export function sunPosition(ms, lat, lon) {
  const d = (ms - J2000) / 86400000;
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  return eqToHorizontal(ra, dec, ms, lat, lon);
}

export function moonPosition(ms, lat, lon) {
  const d = (ms - J2000) / 86400000;
  const L = (218.316 + 13.176396 * d) * RAD;
  const M = (134.963 + 13.064993 * d) * RAD;
  const F = (93.272 + 13.22935 * d) * RAD;
  const lng = L + 6.289 * RAD * Math.sin(M);
  const b = 5.128 * RAD * Math.sin(F);
  const e = 23.4397 * RAD;
  const ra = Math.atan2(Math.sin(lng) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(lng));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(lng));
  return eqToHorizontal(ra, dec, ms, lat, lon);
}

// 0 — новолуние, 0.5 — полнолуние
export function moonPhase(ms) {
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const p = ((ms - ref) / 86400000 / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

// Время ближайшего перехода высоты Солнца через порог (поиск шагом в 2 минуты).
export function nextSunCross(ms, lat, lon, threshold, rising, horizonMs = 36 * 3600e3) {
  let prev = sunPosition(ms, lat, lon).alt - threshold;
  for (let t = ms + 120e3; t < ms + horizonMs; t += 120e3) {
    const cur = sunPosition(t, lat, lon).alt - threshold;
    if (rising ? prev < 0 && cur >= 0 : prev > 0 && cur <= 0) return t;
    prev = cur;
  }
  return null;
}
