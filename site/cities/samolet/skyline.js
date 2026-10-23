// Окно самолёта: иллюминатор левого борта. Небо и солнце движок считает по месту самолёта (route.js),
// облака — под крылом (S.NO_CLOUDS: выше облаков ясно), земля внизу бежит влево: поля, тайга, реки, снег,
// ночью огни городов. На стоянке — перрон аэропорта. Крыло с красным огнём на законцовке, салон вокруг окна.

import { rng, mixHex, clamp } from '../../engine/util.js';
import { W, H, HORIZON } from '../../engine/const.js';
import { flightAt, cityBelow } from './route.js';

export const PALETTE = { DAY: {}, NIGHT: {}, AUTUMN: { day: {}, night: {} }, WINTER: { day: {}, night: {} } };
export const NO_GULLS = true, NO_CLOUDS = true, NO_GARLAND = true, NO_CURTAINS = true, NO_GERANIUM = true;
export const CAT_AT = [30, 244];   // кот спит на соседнем кресле
export const YARN_AT = [-60, 262]; // клубка в самолёте нет
export const STEAM_AT = [396, 214]; // чай на откидном столике
export const LAMP_AT = [400, 196];  // лампочка для чтения над столиком
export function drawFar() {}

// иллюминатор: скруглённый прямоугольник
const PX = 158, PY = 26, PW = 160, PH = 184, PR = 46;
const inPort = (x, y) => {
  const cx = Math.max(PX + PR, Math.min(PX + PW - PR, x)), cy = Math.max(PY + PR, Math.min(PY + PH - PR, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= PR * PR && x >= PX && x < PX + PW && y >= PY && y < PY + PH;
};
let wall = null;
function buildWall() { // маска стены салона: всё, кроме иллюминатора (пиксельно, без сглаживания)
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (inPort(x, y)) continue;
    // светлый пластик стены, к краям темнее; вокруг окна — рамка с фаской
    const ring = [1, 2, 3, 4, 5, 6].find((d) => inPort(x + d, y) || inPort(x - d, y) || inPort(x, y + d) || inPort(x, y - d));
    const shade = 214 - Math.abs(x - 240) * 0.12 - (y > 214 ? 30 : 0) - (Math.floor(y / 54) % 2 ? 0 : 4); // панели обшивки
    const v = ring ? [150, 165, 178, 196, 206, 210][ring - 1] - (y < PY + PH / 2 ? 0 : 8) : shade; // фаска: тень внутрь окна
    img.data[i] = v; img.data[i + 1] = v - 4; img.data[i + 2] = v - 10; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // шторка иллюминатора приподнята — видна её нижняя кромка у верха окна
  g.fillStyle = '#e8e4dc'; for (let x = PX; x < PX + PW; x++) for (let y = PY; y < PY + 10; y++) if (inPort(x, y)) g.fillRect(x, y, 1, 1);
  g.fillStyle = '#a8a49c'; for (let x = PX; x < PX + PW; x++) if (inPort(x, PY + 10)) g.fillRect(x, PY + 10, 1, 1);
  // спинка соседнего кресла слева, подлокотник, откидной столик справа
  g.fillStyle = '#3a4a6a'; g.fillRect(0, 196, 92, 74); g.fillStyle = '#2e3c58'; g.fillRect(0, 196, 92, 6); g.fillStyle = '#5a6a8a'; g.fillRect(8, 206, 76, 2);
  g.fillStyle = '#6a6460'; g.fillRect(92, 236, 60, 8); g.fillStyle = '#4a4440'; g.fillRect(92, 244, 60, 26);
  g.fillStyle = '#8a847c'; g.fillRect(352, 220, 128, 6); g.fillStyle = '#6a645c'; g.fillRect(352, 226, 128, 3);
  g.fillStyle = '#5a5450'; g.fillRect(352, 229, 128, 41);
  // панель над окном: значки «пристегните ремни», вентиляция
  g.fillStyle = '#c8c4bc'; g.fillRect(372, 8, 70, 18); g.fillStyle = '#5a5a60'; g.fillRect(380, 12, 10, 10); g.fillRect(398, 12, 10, 10);
  g.fillStyle = '#f4f0e8'; g.fillRect(384, 14, 2, 6); g.fillRect(402, 14, 2, 6); g.fillRect(400, 16, 6, 2);
  return c;
}

// ---------- земля под крылом ----------
const H0 = HORIZON;
function groundColors(env, fl, dayF) {
  const lon = fl.lon, mo = env.local.getUTCMonth() + 1, snow = env.winter;
  const field = snow ? '#e8eef4' : env.autumn ? '#b8a052' : lon > 60 && lon < 85 ? '#9aa85a' : '#6e8a4a';
  const forest = snow ? '#7a8a8a' : env.autumn ? '#8a6a2a' : lon > 85 ? '#2f5a3a' : '#3e6b3d';
  const d = (c) => mixHex('#0c1018', c, 0.12 + dayF * 0.88);
  return { field: d(field), forest: d(forest), river: d(snow ? '#c8d8e8' : '#5a8ab8'), haze: d('#c8d8ec'), mo };
}
export function drawGround(ctx, env, dayF, t) {
  const fl = env.flight;
  if (fl.kind === 'gate') return drawApron(ctx, env, dayF, t, fl);
  const C = groundColors(env, fl, dayF), alt = 0.25 + 0.75 * fl.alt, speed = 6 + 30 * (1 - fl.alt); // у земли бежит быстрее
  const cloudy = env.weather.cloud;
  // земля полосами: дальше — медленнее и мельче
  for (let y = H0; y < 214; y++) {
    const depth = (y - H0 + 1) / (214 - H0), scale = (0.3 + depth * 1.6) / alt;
    const off = t * speed * scale + fl.km * 6 * scale;
    for (let x = 0; x < W; x += 2) {
      const n = Math.sin((x + off) * 0.045 / scale) + Math.sin((x + off) * 0.017 / scale + y * 0.3) * 1.3 + Math.sin(y * 0.9 + (x + off) * 0.003);
      ctx.fillStyle = n > 1.1 ? C.forest : n < -2.35 ? C.river : C.field;
      ctx.fillRect(x, y, 2, 1);
    }
  }
  // облака под крылом: по облачности у земли; плотные — сплошной ковёр с просветами
  if (cloudy > 20) {
    const k = clamp((cloudy - 20) / 70, 0, 1), r = rng(17);
    for (let i = 0; i < 70; i++) {
      const depth = r(), y = Math.round(H0 + 2 + depth * 40), w = 18 + r() * 60 * (0.4 + depth), sp = (0.4 + depth * 1.6) * (8 + 20 * (1 - fl.alt));
      if (r() > k) continue;
      const x = Math.round(((r() * 700 - t * sp - fl.km * 4) % 700 + 700) % 700 - 110);
      ctx.fillStyle = mixHex('#2a3040', '#f4f6fa', 0.15 + dayF * 0.85);
      for (let j = 0; j < 4; j++) ctx.fillRect(x + j * w / 5, y - 2 - (j % 2) * 2, w / 2, 4 + (j % 2) * 2);
      ctx.fillStyle = mixHex('#1c2230', '#d8dee8', 0.15 + dayF * 0.85); ctx.fillRect(x, y + 3, w, 2);
    }
  }
  // ночью — огни: редкие деревни и большие россыпи над городами
  if (dayF < 0.5) {
    const city = cityBelow(fl, 140), r = rng(Math.floor(fl.km / 40));
    ctx.fillStyle = '#ffcf7a';
    for (let i = 0; i < (city ? 120 : 18); i++) {
      const depth = r(), y = Math.round(H0 + 3 + depth * 40), sp = (0.4 + depth * 1.6) * 6;
      const cx = city ? 200 + (city.d - 0) * 0.8 : r() * 700;
      const x = Math.round(((cx + (r() - 0.5) * (city ? 120 : 600) - t * sp) % 700 + 700) % 700 - 110);
      ctx.globalAlpha = (0.5 + r() * 0.5) * (1 - dayF * 2); ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  // дымка у горизонта
  const g = ctx.createLinearGradient(0, H0 - 6, 0, H0 + 16);
  g.addColorStop(0, C.haze + '00'); g.addColorStop(0.4, C.haze + 'cc'); g.addColorStop(1, C.haze + '00');
  ctx.fillStyle = g; ctx.fillRect(0, H0 - 6, W, 22);
  drawWing(ctx, env, dayF, t, fl);
}

// крыло: уходит из левого нижнего угла иллюминатора назад, законцовка загнута вверх; на ней красный огонь
function drawWing(ctx, env, dayF, t, fl) {
  const bump = fl.alt > 0.95 ? Math.round(Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.7) * 0.4) : Math.round(Math.sin(t * 5) * 1.2); // турбулентность
  const top = mixHex('#2a2e38', '#dfe3ea', 0.2 + dayF * 0.8), mid = mixHex('#22252e', '#c4c8d0', 0.2 + dayF * 0.8), under = mixHex('#14161c', '#8a8e98', 0.2 + dayF * 0.8);
  // плоскость крыла: у фюзеляжа толстая (передняя кромка выше), к законцовке сужается и уходит к горизонту
  for (let x = PX - 2; x < 286; x++) {
    const k = (x - (PX - 2)) / (286 - PX + 2), lead = Math.round(186 - k * 18) + bump, chord = Math.round(30 - k * 24);
    ctx.fillStyle = top; ctx.fillRect(x, lead, 1, Math.max(2, Math.round(chord * 0.55)));
    ctx.fillStyle = mid; ctx.fillRect(x, lead + Math.round(chord * 0.55), 1, Math.max(1, chord - Math.round(chord * 0.55)));
    ctx.fillStyle = under; ctx.fillRect(x, lead + chord, 1, 2);
    if (k < 0.75 && x % 22 === 0) { ctx.fillStyle = under; ctx.fillRect(x, lead + Math.round(chord * 0.6), 1, Math.round(chord * 0.4)); } // стыки закрылков
  }
  ctx.fillStyle = under; for (let x = PX; x < 270; x += 2) { const k = (x - PX) / (286 - PX); ctx.fillRect(x, Math.round(186 - k * 18) + bump - 1, 1, 1); } // кромка
  // винглет — загнутая вверх законцовка с полосой
  const wx = 282, wy = 168 + bump;
  ctx.fillStyle = top; ctx.fillRect(wx, wy - 18, 5, 20); ctx.fillStyle = mid; ctx.fillRect(wx + 4, wy - 18, 1, 20);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = top; ctx.fillRect(wx + 1 + Math.round(i * 0.5), wy - 18 - i, 3, 1); }
  ctx.fillStyle = '#c8423a'; ctx.fillRect(wx + 1, wy - 12, 3, 4);
  if (dayF < 0.7) { // аэронавигационный огонь (левый — красный) и вспышка строба
    ctx.fillStyle = '#ff3a3a'; ctx.globalAlpha = 0.9; ctx.fillRect(wx + 1, wy, 2, 2);
    if ((t % 1.6) < 0.08) { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1; ctx.fillRect(wx - 2, wy - 2, 7, 7); }
    ctx.globalAlpha = 1;
  }
}

// перрон аэропорта: бетон с разметкой, терминал вдали, хвост соседнего самолёта, огни
function drawApron(ctx, env, dayF, t, fl) {
  const d = (c) => mixHex('#10121a', c, 0.2 + dayF * 0.8);
  ctx.fillStyle = d('#7a7c84'); ctx.fillRect(0, H0, W, H - H0);
  ctx.fillStyle = d('#e8c040'); for (let x = 0; x < W; x += 40) ctx.fillRect(x, 196, 24, 2);
  ctx.fillStyle = d('#8a96a8'); ctx.fillRect(0, H0 - 22, W, 22); ctx.fillStyle = d('#5a6a80'); for (let x = 4; x < W; x += 10) ctx.fillRect(x, H0 - 18, 6, 12); // стекло терминала
  ctx.fillStyle = '#ffd88a'; if (dayF < 0.6) for (let x = 6; x < W; x += 14) { ctx.globalAlpha = 0.8; ctx.fillRect(x, H0 - 14, 3, 3); } ctx.globalAlpha = 1;
  // хвост соседнего борта
  ctx.fillStyle = d('#f2f2ee'); ctx.fillRect(200, H0 - 40, 50, 22); for (let i = 0; i < 26; i++) ctx.fillRect(236 - Math.round(i * 0.5), H0 - 40 - i, 10, 1);
  ctx.fillStyle = d('#3a6ab0'); ctx.fillRect(230, H0 - 60, 8, 14);
  // тягач и человек в жилете
  ctx.fillStyle = d('#e8b030'); ctx.fillRect(170 + Math.round(Math.sin(t * 0.2) * 20), 186, 14, 6);
  ctx.fillStyle = d('#f08a2a'); ctx.fillRect(290, 182, 2, 5); ctx.fillStyle = d('#e0b090'); ctx.fillRect(290, 180, 2, 2);
  drawWing(ctx, env, dayF, t, { ...fl, alt: 1 });
}

// ---------- салон: стена с иллюминатором поверх вида ----------
export function drawDesk(ctx, env, dayF) {
  if (!wall) wall = buildWall();
  ctx.drawImage(wall, 0, 0);
  // освещение салона: днём ровно, ночью приглушено (на ночных рейсах свет в салоне выключают)
  const night = 1 - dayF, dim = env.flight.kind === 'fly' && env.flight.alt > 0.9 ? 0.55 : 0.35;
  if (night > 0.05) { ctx.globalAlpha = night * dim; ctx.fillStyle = '#0a0c18'; ctx.fillRect(0, 0, PX, H); ctx.fillRect(PX + PW, 0, W - PX - PW, H); ctx.fillRect(PX, 0, PW, PY); ctx.fillRect(PX, PY + PH, PW, H - PY - PH); ctx.globalAlpha = 1; }
  // стакан чая в подстаканнике на столике
  ctx.fillStyle = '#c8ccd4'; ctx.fillRect(390, 214, 12, 8); ctx.fillStyle = '#8a3a1a'; ctx.fillRect(392, 212, 8, 4); ctx.fillStyle = '#e8e4dc'; ctx.fillRect(402, 216, 3, 3);
}
export function drawSeat() {}

// ---------- секреты рейса ----------
const secT = (env) => env.ms / 1000;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
export const SECRETS = [
  {
    id: 'counter', name: 'Встречный борт', layer: 'sky',
    hint: 'Днём высоко в небе иногда проходит белая полоса — и быстро тает.',
    found: 'Встречные самолёты расходятся по высоте — обычно на 300 метров и больше; издалека виден только инверсионный след.',
    state(env) {
      if (env.flight.kind !== 'fly' || (!env.forced && env.sun.alt < 3)) return null;
      if (!inWin(env, 600, 9, 120)) return null;
      const p = env.forced ? 0.5 : ((secT(env) + 120) % 600) / 9; return { x: Math.round(PX + PW + 10 - p * (PW + 40)), y: 70, w: 10, h: 4 };
    },
    draw(b, env, st) {
      b.fillStyle = '#e8ecf4'; b.fillRect(st.x, st.y, 4, 2); b.fillStyle = '#c8ccd4'; b.fillRect(st.x + 1, st.y + 2, 2, 1);
      b.globalAlpha = 0.6; b.fillStyle = '#ffffff'; b.fillRect(st.x + 4, st.y, 40, 1); b.globalAlpha = 1;
    },
  },
  {
    id: 'aurora', name: 'Северное сияние с борта', layer: 'sky',
    hint: 'Ночью над Сибирью небо на севере иногда зеленеет.',
    found: 'С высоты 10 км северное сияние видно чаще, чем с земли: облака остаются внизу.',
    state(env) {
      if (env.flight.kind !== 'fly' || (!env.forced && (env.sun.alt > -12 || env.flight.lat < 53))) return null;
      if (!inWin(env, 3600, 600, 900)) return null;
      return { x: PX, y: PY + 12, w: PW, h: 50 };
    },
    draw(b, env, st) {
      for (let x = st.x; x < st.x + st.w; x++) {
        const h = 20 + Math.round(Math.sin(x * 0.07 + env.ms / 3000) * 10 + Math.sin(x * 0.19) * 5);
        const g = b.createLinearGradient(0, st.y + 40 - h, 0, st.y + 40);
        g.addColorStop(0, 'rgba(120,255,170,0)'); g.addColorStop(1, 'rgba(120,255,170,0.35)');
        b.fillStyle = g; b.fillRect(x, st.y + 40 - h, 1, h);
      }
    },
  },
  {
    id: 'baikal', name: 'Байкал под крылом', layer: 'street',
    hint: 'Где-то за Иркутском днём под крылом блестит что-то огромное и синее.',
    found: 'Трасса на Дальний Восток проходит над Байкалом — сверху видно, какой он длинный: больше 600 километров.',
    state(env) {
      const fl = env.flight;
      if (!env.forced && (fl.kind !== 'fly' || env.sun.alt < 2 || Math.abs(fl.lon - 106) > 2.5)) return null;
      return { x: PX + 10, y: H0 + 6, w: PW - 20, h: 16 };
    },
    draw(ctx, env, st, dayF) {
      ctx.fillStyle = mixHex('#101828', env.winter ? '#dfe8f0' : '#3a7ab8', 0.2 + dayF * 0.8);
      for (let y = 0; y < st.h; y++) { const w = Math.round(st.w * (0.5 + 0.5 * Math.sin(y / st.h * Math.PI))); ctx.fillRect(st.x + ((st.w - w) >> 1) + y * 2 - st.h, st.y + y, w, 1); }
    },
  },
];
export { inPort as _inPort, flightAt as _flightAt };
