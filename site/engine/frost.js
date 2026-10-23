// Морозные узоры на стекле: комната откликается на погоду за окном. С −5 °C в нижних углах стекла
// проступают ледяные «ветки», к −25 °C они затягивают углы до трети высоты окна (и чуть-чуть сверху).
// Узор один на город (зерно — id), рисуется поверх вида и под шторами; ночью светлее от лампы не становится.

import { rng, clamp } from './util.js';

const cache = new Map();
// Ветвистый кристалл из точки (x, y) в направлении ang: ствол и боковые веточки под 60°, всё по 1 px
function branch(pts, r, x, y, ang, len, depth) {
  for (let i = 0; i < len; i++) {
    x += Math.cos(ang); y += Math.sin(ang);
    pts.push([Math.round(x), Math.round(y), depth]);
    if (depth < 3 && i > 2 && r() < 0.18) branch(pts, r, x, y, ang + (r() < 0.5 ? -1 : 1) * (Math.PI / 3), len * (0.35 + r() * 0.25), depth + 1);
    ang += (r() - 0.5) * 0.12;
  }
}
// Узор целиком: список точек [x, y, глубина] для окна W×H; угол — где начинается рост
function pattern(seed, W, H) {
  const r = rng(seed), pts = [];
  const corners = [[2, H - 2, -Math.PI / 4, 1], [W - 3, H - 2, -3 * Math.PI / 4, 1], [2, 2, Math.PI / 4, 0.45], [W - 3, 2, 3 * Math.PI / 4, 0.45]];
  for (const [cx, cy, a0, size] of corners) {
    for (let k = 0; k < 14; k++) {
      const a = a0 + (r() - 0.5) * 1.4, len = (18 + r() * 52) * size;
      branch(pts, r, cx + (r() - 0.5) * 30 * size * (cx < W / 2 ? 1 : -1), cy, a, len, 0);
    }
  }
  return pts.map(([x, y, d]) => {
    // «сила» точки: чем дальше от угла, тем позже она проступает
    const dx = Math.min(x, W - x), dy = Math.min(H - y, y * 2.2);
    return [x, y, d, Math.hypot(dx, dy)];
  });
}

// k: 0 — нет, 1 — сильный мороз. Окно стекла — прямоугольник (gx, gy, gw, gh) в координатах сцены
export function frostK(temp) { return clamp((-5 - temp) / 20, 0, 1); }
export function drawFrost(ctx, temp, seed, gx, gy, gw, gh) {
  const k = frostK(temp);
  if (k <= 0) return;
  const key = `${seed}:${gw}x${gh}`;
  if (!cache.has(key)) cache.set(key, pattern(seed, gw, gh));
  const reach = 30 + k * 130; // радиус от угла, докуда дорос узор
  for (const [x, y, d, dist] of cache.get(key)) {
    if (dist > reach) continue;
    const fade = 1 - dist / reach;
    ctx.globalAlpha = (0.25 + 0.55 * fade) * (d ? 0.75 : 1) * (0.5 + k * 0.5);
    ctx.fillStyle = d ? '#e8f2ff' : '#ffffff';
    ctx.fillRect(gx + x, gy + y, 1, 1);
  }
  // иней по нижней кромке стекла
  ctx.globalAlpha = 0.18 + 0.3 * k; ctx.fillStyle = '#eef6ff';
  ctx.fillRect(gx, gy + gh - 2, gw, 2);
  ctx.globalAlpha = 1;
}
