export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = typeof a === 'string' ? rgb(a) : a, B = typeof b === 'string' ? rgb(b) : b;
  return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];
}
export const mixHex = (a, b, t) => hex(mix(a, b, t));

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// Спрайт из строковой карты: каждый символ — ключ палитры, '.' — прозрачный.
export function sprite(rows, pal) {
  const [c, ctx] = canvas(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row[x];
      if (k === '.' || !pal[k]) continue;
      ctx.fillStyle = pal[k];
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

// Копия холста, перемноженная на цвет (освещение), с сохранением альфы.
export function tinted(src, color) {
  const [c, ctx] = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(src, 0, 0);
  return c;
}
