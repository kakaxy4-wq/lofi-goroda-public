// Анадырь: вид из окна квартиры во двор, по схеме, записанной со слов местного жителя.
// Дальний план: сопка Дионисия на горизонте, ближе — ТЭЦ с двумя трубами. Перед ТЭЦ — ТЦ
// «Новомариинский», перед ним салатовое здание бывшего детсада «Солнышко». Слева двухэтажки,
// справа пятиэтажка. Из-за ТЦ к нам идёт тепляк (теплотрасса в железобетонных плитах с ушками)
// и кончается колодцем с люком. Ближе: дорога, забор, ряд 20-футовых контейнеров, квадрат
// на асфальте для игры с мячом, слева две помойки с бакланами. Всё стоит на сваях — мерзлота.

import { rng, mixHex, canvas } from '../../engine/util.js';
import { W, HORIZON, SILL } from '../../engine/const.js';
import { drawPerson } from '../../engine/street.js';
import { drawAurora } from '../murmansk/skyline.js';
import { rocketSecret } from '../../engine/rocket.js';

// ---------- палитры дальнего плана (сопки и ТЭЦ) ----------
const DAY = {
  far: '#93a0b4', farDark: '#7f8ca2', snow: '#eef2f6', hill: '#8a9078', hillDark: '#747a64',
  tec: '#b8b4ac', tecDark: '#8e8a82', pipe: '#a8a8ae', pipeDark: '#7e7e86', red: '#c8423a', white: '#eeeae4', win: '#5a6070',
};
const NIGHT = {
  far: '#1e2438', farDark: '#181d30', snow: '#4a5470', hill: '#151a26', hillDark: '#11151f',
  tec: '#2a2c36', tecDark: '#20222a', pipe: '#2c2e38', pipeDark: '#22242c', red: '#5a2a2a', white: '#4a4a52', win: '#14141c',
};
const AUTUMN = { day: { hill: '#a07a48', hillDark: '#86643a' }, night: {} };
const WINTER = { day: { hill: '#e6ecf2', hillDark: '#cfd8e2', far: '#c8d2de', farDark: '#b4c0ce' }, night: { hill: '#3a4258', hillDark: '#323a4e', far: '#2e3650', farDark: '#283048' } };
export const PALETTE = { DAY, NIGHT, AUTUMN, WINTER };

// Сопка Дионисия: две вершины с провалом — «сломанное острие» (чукотское Темлян)
export const DIONISY = { x: 132, top: 116 };
const ridge = (x) => {
  const d = (x - DIONISY.x) / 70;
  let y = 150 - 6 * Math.sin(x * 0.021) - 4 * Math.sin(x * 0.057 + 1.3);
  y -= 30 * Math.exp(-d * d * 1.6);                                  // массив сопки: далеко, 20 км — невысокий и широкий
  y += 4 * Math.exp(-(((x - DIONISY.x) / 3) ** 2));                  // провал между вершинами — «сломанное острие»
  return Math.round(y);
};
export const TEC = { x0: 214, x1: 300, roof: 122, pipes: [[232, 58], [264, 66]] };

export function drawFar({ g, P, winter, L, R }) {
  // дальние сопки за лиманом
  for (let x = 0; x < W; x++) {
    const y = ridge(x);
    R('far', x, y, 1, HORIZON - y);
    if (winter) R('snow', x, y, 1, Math.max(1, (136 - y) >> 1));      // зимой сопки белые
    if ((x * 7) % 11 === 0) R('farDark', x, y + 4, 1, HORIZON - y - 4);
  }
  // ближние пологие холмы
  for (let x = 0; x < W; x++) { const y = 152 + Math.round(3 * Math.sin(x * 0.03) + 2 * Math.sin(x * 0.11)); R('hill', x, y, 1, HORIZON - y); R('hillDark', x, y + 3, 1, 1); }
  // ТЭЦ: главный корпус, котельная, две трубы с красно-белой маркировкой
  R('tec', TEC.x0, TEC.roof, TEC.x1 - TEC.x0, HORIZON - TEC.roof);
  R('tecDark', TEC.x0, TEC.roof, TEC.x1 - TEC.x0, 2);
  R('tec', TEC.x0 + 50, TEC.roof - 12, 30, 12); R('tecDark', TEC.x0 + 50, TEC.roof - 12, 30, 1);
  for (let x = TEC.x0 + 4; x < TEC.x1 - 4; x += 7) for (let y = TEC.roof + 6; y < HORIZON - 4; y += 9) { R('win', x, y, 3, 4); L(x + 1, y + 1, 'win'); }
  for (const [px, top] of TEC.pipes) {
    for (let y = top; y < TEC.roof; y++) { const w = 10 + Math.round((y - top) / 10); R('pipe', px - (w >> 1), y, w, 1); R('pipeDark', px + (w >> 1) - 2, y, 2, 1); } // толстые, к низу шире
    for (let k = 0; k < 4; k++) R(k % 2 ? 'white' : 'red', px - 5, top + k * 3, 10, 3);
    L(px, top - 1, 'red', '#ff3a2a');
  }
  if (winter) R('snow', TEC.x0, TEC.roof - 1, TEC.x1 - TEC.x0, 1);
}

// Дым ТЭЦ: клубы уходят по ветру, зимой гуще и белее
export function drawAbove(b, env, dayF, t) {
  const w = Math.max(1, env.weather.wind), thick = env.winter ? 1 : 0.55;
  for (const [px, top] of TEC.pipes) {
    for (let i = 0; i < 26; i++) {
      const age = ((t * 0.12 + i / 26 + px) % 1), x = px + age * (30 + w * 14) + Math.sin(t * 0.3 + i) * 2, y = top - 3 - age * (26 - Math.min(18, w * 2));
      const r = 2 + age * 9;
      b.globalAlpha = (1 - age) * 0.32 * thick;
      b.fillStyle = mixHex('#3a3e4a', '#f2f2f0', dayF);
      b.beginPath(); b.arc(Math.round(x), Math.round(y), r, 0, 6.283); b.fill();
    }
  }
  b.globalAlpha = 1;
}

// ---------- ближний план: дома, тепляк, двор (своя заготовка день/ночь по сезону) ----------
const SEASON = (env) => (env.winter ? 'w' : env.autumn ? 'a' : 's');
const NEAR = {}; // сезон → { day, night, wins }

const NP = {
  day: {
    ground: { w: '#e4eaf0', a: '#8a7444', s: '#7a7c58' }, groundDark: { w: '#cdd6e0', a: '#74603a', s: '#66684a' },
    asphalt: { w: '#d2d8de', a: '#5a5a62', s: '#5a5a62' }, road: { w: '#c4cad2', a: '#4e4e56', s: '#4e4e56' },
    piles: '#3a3a40', roofDark: '#4a4e58', snowRoof: '#f2f4f8',
    ochre: '#c89a6a', ochreDark: '#a87e52', blueGrey: '#a8b8c8', blueGreyDark: '#8a9aac',
    five: '#d8e4ee', fiveAccent: '#e0904a', fiveDark: '#b8c6d4',
    tc: '#e8e0d0', tcDark: '#c8bea8', glass: '#5a7a9a', sign: '#c83a3a',
    salad: '#aac884', saladDark: '#8eae6c', saladBand: '#9dbb78', plinth: '#7e8a70', frame: '#efe3c6', win: '#4a5468', sill: '#6a6458',
    roofRed: '#8a4a3a', roofRedDark: '#6e3a2e', roofGreen: '#4e6a58', roofGreenDark: '#3e5646', pipeGrey: '#8a8e96',
    slab: '#b8b4aa', slabSide: '#8a867c', slabJoint: '#6a665e',
    fence: '#6a7a6a', fenceDark: '#56645a', cont: ['#a8442e', '#2f5a8a', '#4a7a4a'], contDark: ['#86361f', '#24486e', '#3a6038'],
    bin: '#3a6a4a', binLid: '#2e5a3e', mesh: '#7a8a7a', paint: '#ece8dc', bag: '#2a2a30', lamp: '#5a5e68',
  },
};
// Ночью — те же формы, приглушённые и холодные; окна подсвечиваются отдельно
const nightOf = (c) => mixHex('#0e1018', c, 0.26);

function buildNear(season) {
  const out = {}, wins = [];
  for (const mode of ['day', 'night']) {
    const [c, gBack] = canvas(W, SILL), [cf, gFront] = canvas(W, SILL);
    let g = gBack; // до дороги рисуем в задний слой, двор — в передний: машины проезжают между ними
    const col = (v) => { const seasonal = typeof v === 'object' && !Array.isArray(v), x = seasonal ? v[season] : v; return mode === 'day' ? x : seasonal && season === 'w' ? mixHex('#0e1018', x, 0.42) : nightOf(x); }; // снег ночью светлее всего вокруг
    const R = (v, x, y, w, h) => { g.fillStyle = col(v); g.fillRect(x, y, w, h); };
    const D = NP.day, snow = season === 'w', collect = mode === 'day';
    const win = (x, y, w, h, frame) => { R(D.win, x, y, w, h); if (frame) { R(frame, x, y, w, 1); R(frame, x + (w >> 1), y, 1, h); } if (collect) wins.push([x, y, w, h]); };

    // земля двора и за домами
    R(D.ground, 0, 156, W, SILL - 156); R(D.groundDark, 0, 156, W, 2);

    // Дома стоят торцом к нам, длинной стороной вглубь двора: торец — прямоугольник,
    // бок уходит к точке схода у салатового дома; окна на боку сужаются с глубиной
    const VP = { x: 250, y: 150 };
    const side = (fx, top, base, depth, wall, floors, perRow, gableTop, roof, roofDark) => {
      const xb = fx + (VP.x - fx) * depth, dir = Math.sign(xb - fx), n = Math.abs(Math.round(xb - fx));
      const at = (u) => ({ top: top + (VP.y - top) * depth * u, base: base + (VP.y - base) * depth * u, ridge: gableTop == null ? null : gableTop + (VP.y - gableTop) * depth * u });
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = Math.round(fx + dir * i), c = at(u), h = c.base - c.top;
        R(wall, x, Math.round(c.top), 1, Math.round(h));
        if (c.ridge != null) { // скат крыши вдоль бока: профнастил, зимой под снегом; свес темнее
          const ry = Math.round(c.ridge) - 1, rh = Math.max(2, Math.round(c.top - c.ridge) + 2);
          R(snow ? D.snowRoof : roof, x, ry, 1, rh); R(roofDark, x, ry + rh - 1, 1, 1);
          if (!snow && i % 3 === 0) R(roofDark, x, ry, 1, rh - 1);
        }
        else R(snow ? D.snowRoof : D.fiveDark, x, Math.round(c.top), 1, 1);
        const k = (u * perRow) % 1;
        if (k > 0.3 && k < 0.7 && u < 0.97) for (let fl = 0; fl < floors; fl++) {
          const y0 = c.top + h * (0.12 + fl / floors * 0.86), y1 = y0 + h / floors * 0.45;
          R(D.win, x, Math.round(y0), 1, Math.max(1, Math.round(y1 - y0)));
          if (collect && Math.abs(k - 0.5) < 0.5 / n * perRow) wins.push([x - 1, Math.round(y0), 2, Math.max(1, Math.round(y1 - y0))]);
        }
      }
      R(D.piles, Math.round(Math.min(fx, xb)), Math.round(base), Math.round(Math.abs(xb - fx)), 2);
    };
    const gableEnd = (x0, x1, top, base, apex, wall, dark, roof, roofDark) => { // торец двухэтажки с треугольным фронтоном
      R(wall, x0, top, x1 - x0, base - top); R(dark, x0, top, 2, base - top);
      const cx = (x0 + x1) / 2;
      for (let y = apex; y < top; y++) { const hw = Math.round((x1 - x0) / 2 * (y - apex) / (top - apex)); R(wall, Math.round(cx - hw), y, hw * 2, 1); }
      for (let y = apex - 1; y <= top; y++) { // скаты со свесом: кромка шире фронтона и выступает за углы,
        const hw = Math.round((x1 - x0) / 2 * Math.max(0, y - apex) / (top - apex)) + 3; // но ниже карниза не сползает
        R(snow ? D.snowRoof : roof, Math.round(cx - hw), y, 3, 1); R(snow ? D.snowRoof : roof, Math.round(cx + hw) - 3, y, 3, 1);
        if (y < top) { R(roofDark, Math.round(cx - hw) + 2, y + 1, 1, 1); R(roofDark, Math.round(cx + hw) - 3, y + 1, 1, 1); }
      }
      R(snow ? D.snowRoof : roof, Math.round(cx) - 2, apex - 2, 5, 1); // конёк — планка на стыке скатов
      R(D.win, Math.round(cx) - 2, apex + Math.round((top - apex) * 0.45), 4, 3); // чердачное окошко
      for (let fl = 0; fl < 2; fl++) for (const wx of [x0 + 6, x1 - 12]) win(wx, top + 4 + fl * 15, 6, 8, D.frame);
      R(D.piles, x0, base, x1 - x0, 3); for (let x = x0 + 2; x < x1; x += 8) R(D.groundDark, x + 2, base, 5, 3);
    };

    // ТЦ «Новомариинский»: светлый фасад, лента витрин, красная вывеска
    const t0 = 186, t1 = 332, tt = 128;
    R(D.tc, t0, tt, t1 - t0, 150 - tt); R(D.tcDark, t0, tt, t1 - t0, 2);
    if (snow) R(D.snowRoof, t0, tt - 1, t1 - t0, 1);
    R(D.glass, t0 + 6, tt + 12, t1 - t0 - 12, 8); if (collect) wins.push([t0 + 6, tt + 12, t1 - t0 - 12, 8, 'shop']);
    for (let x = t0 + 6; x < t1 - 6; x += 12) R(D.tcDark, x, tt + 12, 1, 8);
    R(D.sign, t0 + 40, tt + 3, 66, 7);
    for (let i = 0; i < 9; i++) R(D.paint, t0 + 44 + i * 7, tt + 5, 4, 3);                   // буквы вывески — пиксельные штрихи

    // дальняя двухэтажка слева (голубая): бок вглубь, торец к нам
    side(144, 148, 174, 0.32, D.blueGreyDark, 2, 3, 139, D.roofGreen, D.roofGreenDark);
    gableEnd(116, 144, 148, 174, 138, D.blueGrey, D.blueGreyDark, D.roofGreen, D.roofGreenDark);

    // тепляк слева: выходит из-за ТЦ, идёт к нам вдоль салатового дома, плиты с ушками
    const A = { x: 155, y: 157, w: 3, h: 2 }, B = { x: 146, y: 176, w: 10, h: 4 };
    const n = 10;
    for (let i = 0; i < n; i++) {
      const u = i / n, v = (i + 1) / n;
      const x = Math.round(A.x + (B.x - A.x) * u), y = Math.round(A.y + (B.y - A.y) * u), w = Math.round(A.w + (B.w - A.w) * u), h = Math.round(A.h + (B.h - A.h) * u);
      const x2 = Math.round(A.x + (B.x - A.x) * v), y2 = Math.round(A.y + (B.y - A.y) * v);
      const xl = Math.min(x, x2), ww = Math.abs(x - x2) + w;
      R(D.slabSide, xl, y + 1, ww, y2 - y + h);
      R(snow ? '#9a968c' : D.slab, xl, y, ww, Math.max(1, y2 - y));                      // верх плит: зимой без снега — тёплый
      R(D.slabJoint, xl, y2, ww, 1);
      R(D.piles, xl + 1, y, 1, 1); R(D.piles, xl + ww - 2, y, 1, 1);                     // монтажные петли — «ушки»
    }

    // салатовый бывший детсад «Солнышко»: мягкий салатовый, цоколь, карниз с парапетом, водостоки,
    // тёплые рамы с подоконниками, крыльцо под козырьком, прогулочная веранда и низкий забор
    const s0 = 158, s1 = 296, st = 146, sb = 178;
    R(D.salad, s0, st, s1 - s0, sb - st);
    R(D.saladBand, s0, st + 15, s1 - s0, 1);                                            // межэтажный пояс
    for (let x = s1 - 12; x < s1; x++) for (let y = st; y < sb; y++) if ((x + y) % 2 === 0 || x > s1 - 5) R(D.saladDark, x, y, 1, 1); // тень на правом крае, дизеринг
    R(D.plinth, s0, sb - 4, s1 - s0, 4);                                                 // цоколь
    R(D.roofDark, s0 - 2, st - 3, s1 - s0 + 4, 3); R(D.saladDark, s0 - 2, st, s1 - s0 + 4, 1); // карниз
    if (snow) R(D.snowRoof, s0 - 2, st - 4, s1 - s0 + 4, 2);
    for (const px of [s0 + 1, s1 - 2]) R(D.pipeGrey, px, st, 1, sb - st);               // водостоки
    for (let fl = 0; fl < 2; fl++) for (let x = s0 + 8; x < s1 - 12; x += 14) {
      if (Math.abs(x - 220) < 8) continue;                                                // над крыльцом — без окна
      const y = st + 4 + fl * 15;
      R(D.frame, x - 1, y - 1, 9, 10); win(x, y, 7, 8, D.frame); R(D.sill, x - 1, y + 9, 9, 1);
    }
    R(D.roofDark, 210, 160, 22, 2); R(D.frame, 214, 162, 14, 12); R(D.win, 216, 164, 10, 10); R(D.plinth, 212, sb - 2, 18, 2); // крыльцо и козырёк
    // прогулочная веранда бывшего детсада и низкий забор перед домом
    R(D.roofGreen, 262, 167, 26, 3); R(D.roofGreenDark, 262, 169, 26, 1);
    R(D.saladDark, 263, 170, 2, 8); R(D.saladDark, 285, 170, 2, 8); R(D.frame, 265, 172, 20, 1);
    if (snow) R(D.snowRoof, 262, 166, 26, 1);
    for (let x = s0 - 4; x < s1 + 4; x += 3) R(D.plinth, x, sb + 1, 1, 3);
    R(D.plinth, s0 - 4, sb + 1, s1 - s0 + 8, 1);

    // колодец тепляка у салатового дома: квадрат из плит чуть выше короба, люк посередине
    const kx = 140, ky = 174;
    R(D.slabSide, kx, ky + 3, 22, 8); R(snow ? '#a29e94' : D.slab, kx, ky, 22, 4); R(D.slabJoint, kx + 11, ky, 1, 4); R(D.slabJoint, kx, ky + 4, 22, 1);
    R('#4a4a52', kx + 7, ky + 1, 8, 2); R('#6a6a72', kx + 7, ky + 1, 8, 1);
    R(D.piles, kx + 2, ky, 1, 1); R(D.piles, kx + 19, ky, 1, 1);

    // ближняя двухэтажка слева (охристая)
    side(86, 144, 182, 0.16, D.ochreDark, 2, 2, 130, D.roofRed, D.roofRedDark);
    gableEnd(42, 86, 144, 182, 130, D.ochre, D.ochreDark, D.roofRed, D.roofRedDark);

    // пятиэтажка справа: торец к нам, длинный бок с подъездами смотрит во двор
    const f0 = 420, f1 = 478, ft = 98, fb = 184;
    side(f0, ft, fb, 0.3, D.fiveDark, 5, 7, null);
    for (const u of [0.35, 0.7]) { const x = Math.round(f0 + (VP.x - f0) * 0.3 * u), b0 = fb + (VP.y - fb) * 0.3 * u; R(D.fiveAccent, x - 2, Math.round(b0) - 12, 4, 12); } // подъезды на боку
    R(D.five, f0, ft, f1 - f0, fb - ft); R(D.fiveAccent, f0, ft, 3, fb - ft);
    if (snow) R(D.snowRoof, f0, ft - 1, f1 - f0, 1); else R(D.fiveDark, f0, ft, f1 - f0, 2);
    for (let fl = 0; fl < 5; fl++) for (const wx of [f0 + 12, f0 + 38]) win(wx, ft + 7 + fl * 16, 8, 8, D.frame);
    R(D.piles, f0, fb, f1 - f0, 4); for (let x = f0 + 2; x < f1; x += 9) R(D.groundDark, x + 2, fb, 6, 4);

    // дорога
    R(D.road, 0, 182, W, 7); R(D.groundDark, 0, 182, W, 1);
    // фонари вдоль дороги
    for (const x of [146, 344, 448]) { R(D.lamp, x, 158, 1, 25); R(D.lamp, x - 4, 158, 5, 1); R(D.lamp, x - 5, 159, 2, 1); }

    g = gFront;
    // забор из профлиста за контейнерами
    R(D.fence, 190, 187, W - 190, 9);
    for (let x = 190; x < W; x += 2) R(D.fenceDark, x, 187, 1, 9);
    for (let x = 192; x < W; x += 30) R(D.piles, x, 186, 2, 10);
    if (snow) R(D.snowRoof, 190, 186, W - 190, 1);

    // двор
    R(D.asphalt, 0, 196, W, SILL - 196);
    // 20-футовые контейнеры: рёбра профиля, двери с запорными штангами на торце
    D.cont.forEach((cc, i) => {
      const x = 196 + i * 58, y = 184;
      R(cc, x, y, 56, 15); R(D.contDark[i], x, y + 13, 56, 2);
      for (let k = x + 2; k < x + 52; k += 3) R(D.contDark[i], k, y + 2, 1, 11);
      R(D.contDark[i], x + 48, y + 1, 1, 13); for (const bx of [x + 50, x + 53]) R('#2a2a30', bx, y + 2, 1, 11);
      if (snow) R(D.snowRoof, x, y - 1, 56, 2);
    });
    // квадрат на асфальте: поле на четыре части, круг в середине (зимой под снегом едва виден)
    const qc = 283, qy = 202, paint = snow ? '#c4c8ce' : D.paint;
    for (let y = 0; y <= 10; y++) { const hw = 17 + Math.round(y * 0.5); if (y === 0 || y === 10) R(paint, qc - hw, qy + y, hw * 2, 1); else { R(paint, qc - hw, qy + y, 1, 1); R(paint, qc + hw - 1, qy + y, 1, 1); R(paint, qc, qy + y, 1, 1); } }
    R(paint, qc - 19, qy + 5, 38, 1);
    for (let a = 0; a < 28; a++) { const an = a / 28 * 6.283; R(paint, Math.round(qc + Math.cos(an) * 6), Math.round(qy + 5 + Math.sin(an) * 2.2), 1, 1); }

    // две помойки слева (правее кресла у окна): стенки из профлиста, по три бака, пакеты рядом
    for (const p0 of [84, 138]) {
      R(D.mesh, p0, 188, 50, 3); R(D.mesh, p0, 188, 2, 20); R(D.mesh, p0 + 48, 188, 2, 20);
      for (let x = p0; x < p0 + 50; x += 3) R(D.fenceDark, x, 188, 1, 3);
      for (let k = 0; k < 3; k++) { const bx = p0 + 4 + k * 15; R(D.bin, bx, 196, 12, 11); R(D.binLid, bx - 1, 194, 14, 2); R(D.piles, bx + 1, 207, 2, 1); R(D.piles, bx + 9, 207, 2, 1); if (snow) R(D.snowRoof, bx - 1, 193, 14, 1); }
      R(D.bag, p0 + 2, 206, 4, 3); R(D.bag, p0 + 44, 205, 5, 4);
    }
    out[mode] = { back: c, front: cf };
  }
  out.wins = wins.map(([x, y, w, h, kind], i) => ({ x, y, w, h, kind, thr: rng(i * 97 + 3)(), warm: rng(i * 31 + 7)() < 0.8 }));
  return out;
}

// Бакланы летом (большие чайки), зимой — вороны: сидят на помойках, иногда перелетают
const PERCH = [[88, 193], [102, 193], [116, 192], [142, 193], [158, 193], [172, 192], [132, 187]];
function drawBirds(ctx, env, dayF, t) {
  const mo = env.local.getUTCMonth() + 1, gulls = mo >= 5 && mo <= 10;
  const body = gulls ? mixHex('#3a3e48', '#eceae4', dayF) : mixHex('#08080c', '#1e1e24', dayF), wing = gulls ? mixHex('#2a2e38', '#9aa0aa', dayF) : body;
  const n = gulls ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const [px, py] = PERCH[(i * 3) % PERCH.length], slot = Math.floor(t / 23 + i * 0.37), r = rng(slot * 13 + i)();
    const fly = r < 0.25 ? ((t / 23 + i * 0.37) % 1) : -1;
    if (fly >= 0 && fly < 0.5) { // перелёт: дуга к соседней помойке и обратно
      const k = Math.sin(fly * Math.PI * 2), x = px + k * 40, y = py - Math.sin(fly * Math.PI * 2) ** 2 * 18 - 4, up = Math.sin(t * 14 + i) > 0;
      ctx.fillStyle = wing; ctx.fillRect(Math.round(x) - 3, Math.round(y) + (up ? -1 : 1), 3, 1); ctx.fillRect(Math.round(x) + 2, Math.round(y) + (up ? -1 : 1), 3, 1);
      ctx.fillStyle = body; ctx.fillRect(Math.round(x), Math.round(y), 3, 2);
      continue;
    }
    const bob = Math.sin(t * 2 + i * 3) > 0.7 ? 1 : 0;
    ctx.fillStyle = body; ctx.fillRect(px, py - 3, 5, 3); ctx.fillRect(px + (i % 2 ? 0 : 4), py - 5 + bob, 2, 2);
    ctx.fillStyle = wing; ctx.fillRect(px + 1, py - 3, 3, 1);
    if (gulls) { ctx.fillStyle = mixHex('#5a4a2a', '#e8b030', dayF); ctx.fillRect(px + (i % 2 ? -1 : 6), py - 4 + bob, 1, 1); }
  }
}

export function drawGround(ctx, env, dayF, t) {
  const s = SEASON(env), near = NEAR[s] || (NEAR[s] = buildNear(s)), nightF = 1 - dayF;
  ctx.drawImage(near.night.back, 0, 0);
  ctx.globalAlpha = dayF; ctx.drawImage(near.day.back, 0, 0); ctx.globalAlpha = 1;
  // окна и витрины вечером
  if (nightF > 0.05) {
    const h = env.local.getUTCHours() + env.local.getUTCMinutes() / 60;
    const occ = h >= 17 ? 0.7 : h < 1 ? 0.5 : h < 5 ? 0.15 : h < 9 ? 0.4 : 0.3;
    for (const w of near.wins) {
      if (w.kind === 'shop') { if (h >= 9 && h < 22) { ctx.globalAlpha = nightF * 0.9; ctx.fillStyle = '#ffe2a8'; ctx.fillRect(w.x, w.y, w.w, w.h); } continue; }
      if (w.thr > occ) continue;
      ctx.globalAlpha = nightF * (0.8 + 0.2 * Math.sin(t * 0.3 + w.thr * 9));
      ctx.fillStyle = w.warm ? '#ffcf7a' : '#a8c8ff'; ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    // фонари и вывеска ТЦ
    for (const x of [146, 344, 448]) {
      const gr = ctx.createRadialGradient(x - 3, 160, 0, x - 3, 172, 26);
      gr.addColorStop(0, `rgba(255,200,120,${0.4 * nightF})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(x - 30, 150, 54, 46);
      ctx.fillStyle = '#ffe0a0'; ctx.fillRect(x - 5, 159, 3, 1);
    }
    if (h >= 9 && h < 23) { ctx.globalAlpha = nightF; ctx.fillStyle = '#ff5a4a'; ctx.fillRect(226, 131, 66, 7); ctx.fillStyle = '#fff0e0'; for (let i = 0; i < 9; i++) ctx.fillRect(230 + i * 7, 133, 4, 3); }
    ctx.globalAlpha = 1;
  }
  // пар над колодцем тепляка в мороз
  if (env.weather.temp < 0 || env.winter) {
    for (let i = 0; i < 10; i++) {
      const ph = (t * 0.18 + i / 10) % 1, x = 151 + Math.sin(t * 0.7 + i * 2) * 2 + ph * env.weather.wind * 2, y = 172 - ph * 22;
      ctx.globalAlpha = 0.28 * (1 - ph); ctx.fillStyle = mixHex('#5a6070', '#f4f6f8', dayF);
      ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), 2 + ph * 5, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawRoadLife(ctx, env, dayF, t);
  ctx.drawImage(near.night.front, 0, 0);
  ctx.globalAlpha = dayF; ctx.drawImage(near.day.front, 0, 0); ctx.globalAlpha = 1;
  drawYardLife(ctx, env, dayF, t);
  drawBirds(ctx, env, dayF, t);
}


// ---------- жизнь двора ----------
const hourOf = (env) => env.local.getUTCHours() + env.local.getUTCMinutes() / 60;
const dim = (c, dayF) => mixHex('#141018', c, 0.3 + dayF * 0.7);
// Событие раз в period секунд, длится dur: доля пройденного 0..1 или -1
const episode = (t, period, dur, seed) => { const k = Math.floor(t / period), r = rng(k * 7 + seed)(), st = r * (period - dur), ph = (t - k * period - st) / dur; return ph >= 0 && ph < 1 ? { ph, r, k } : null; };

// Машин мало: изредка проезжает УАЗ, «крузак» или грузовик; зимой утром трактор чистит дорогу
const CARS = [['#5a6a4a', '#465438', 9], ['#e8e8e4', '#b8bcc4', 10], ['#d87a2a', '#a85a1a', 13]];
function vehicle(ctx, x, y, dir, kind, dayF, nightF) {
  const [c, d, len] = CARS[kind];
  ctx.fillStyle = dim(c, dayF); ctx.fillRect(x, y - 4, len, 3); ctx.fillRect(x + (dir > 0 ? 1 : len - 6), y - 6, 5, 2);
  ctx.fillStyle = dim('#3a4a5a', dayF); ctx.fillRect(x + (dir > 0 ? 2 : len - 5), y - 5, 3, 1);
  ctx.fillStyle = dim(d, dayF); ctx.fillRect(x, y - 2, len, 1);
  ctx.fillStyle = '#1a1a20'; ctx.fillRect(x + 1, y - 1, 2, 1); ctx.fillRect(x + len - 3, y - 1, 2, 1);
  if (nightF > 0.2) { ctx.globalAlpha = nightF; ctx.fillStyle = '#fff4c8'; ctx.fillRect(dir > 0 ? x + len : x - 1, y - 3, 1, 1); ctx.fillStyle = '#ff3a2a'; ctx.fillRect(dir > 0 ? x - 1 : x + len, y - 3, 1, 1); ctx.globalAlpha = 1; }
}
function drawRoadLife(ctx, env, dayF, t) {
  const h = hourOf(env), nightF = 1 - dayF, y = 185;
  const e = episode(t, h >= 7 && h < 23 ? 110 : 320, 26, 3);
  if (e) { const dir = e.r < 0.5 ? 1 : -1, x = dir > 0 ? -16 + e.ph * 512 : 496 - e.ph * 512; vehicle(ctx, Math.round(x), y, dir, (e.k % 7) < 4 ? (e.k % 2) : 2, dayF, nightF); }
  if (env.winter && h >= 8 && h < 10) { // трактор с отвалом: медленно, раз в полчаса
    const p = episode(t, 1800, 120, 9);
    if (p) { const x = Math.round(-20 + p.ph * 520); ctx.fillStyle = dim('#e0a020', dayF); ctx.fillRect(x, y - 5, 10, 4); ctx.fillRect(x + 2, y - 8, 5, 3); ctx.fillStyle = dim('#5a5e68', dayF); ctx.fillRect(x + 10, y - 4, 3, 3); ctx.fillStyle = '#1a1a20'; ctx.fillRect(x + 1, y - 1, 3, 1); ctx.fillRect(x + 6, y - 1, 3, 1);
      ctx.fillStyle = dim('#f4f6f8', dayF); ctx.fillRect(x + 13, y - 3, 2, 2); if (nightF > 0.3) { ctx.fillStyle = '#ffb030'; ctx.fillRect(x + 4, y - 9, 1, 1); } }
  }
  // прохожие за забором; весной — рыбаки на лиман с ящиками и ледобурами
  const mo = env.local.getUTCMonth() + 1, fishing = (mo === 4 || mo === 5) && h >= 6 && h < 12;
  const n = h < 6 ? 0 : h < 9 ? 2 : h < 22 ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const r = rng(i * 53 + 11)(), dir = r < 0.5 ? 1 : -1, x = Math.round(((r * 600 + dir * t * (5 + r * 4)) % 600 + 600) % 600 - 60);
    drawPerson(ctx, x, y - 1, r, dayF, t, false, env.winter, true);
    if (fishing && i < 2) { ctx.fillStyle = dim('#c8c4bc', dayF); ctx.fillRect(x - 1, y - 6, 4, 3); ctx.fillStyle = dim('#5a5e68', dayF); ctx.fillRect(x + (dir > 0 ? -2 : 3), y - 9, 1, 8); }
  }
}

function drawYardLife(ctx, env, dayF, t) {
  const h = hourOf(env), nightF = 1 - dayF, winter = env.winter;
  // собака: зимой спит на тёплом люке тепляка, летом иногда пробегает по двору
  if (winter) {
    const breathe = Math.sin(t * 1.4) > 0 ? 1 : 0;
    ctx.fillStyle = dim('#8a6a48', dayF); ctx.fillRect(145, 171 - breathe, 8, 3); ctx.fillRect(152, 170, 3, 3); ctx.fillStyle = dim('#5a4430', dayF); ctx.fillRect(153, 169, 1, 1); ctx.fillRect(144, 172, 2, 1);
  } else {
    const d = episode(t, 240, 14, 21);
    if (d) { const x = Math.round(490 - d.ph * 520), leg = Math.sin(t * 16) > 0 ? 1 : 0; ctx.fillStyle = dim('#8a6a48', dayF); ctx.fillRect(x, 207, 8, 3); ctx.fillRect(x - 2, 205, 3, 3); ctx.fillRect(x + 8, 206, 2, 1); ctx.fillStyle = dim('#5a4430', dayF); ctx.fillRect(x + 1, 210, 1, 1 + leg); ctx.fillRect(x + 6, 210, 1, 2 - leg); }
  }
  // кто-то выносит мусор: от подъезда справа к помойкам и обратно; зимой — санки с ребёнком
  if (h >= 7 && h < 23) {
    const e = episode(t, 200, 60, 31);
    if (e) {
      const go = e.ph < 0.5, u = go ? e.ph * 2 : (1 - e.ph) * 2, x = Math.round(470 - u * 280);
      drawPerson(ctx, x, 211, e.r, dayF, t, env.weather.kind === 'rain', winter, true);
      if (go) { ctx.fillStyle = dim('#2a2a30', dayF); ctx.fillRect(x - 3, 206, 3, 3); } // пакет в руке
    }
    if (winter) {
      const sl = episode(t, 260, 40, 41);
      if (sl) { const x = Math.round(-10 + sl.ph * 500); drawPerson(ctx, x + 10, 212, 0.3, dayF, t, false, true, true); ctx.fillStyle = dim('#c8423a', dayF); ctx.fillRect(x - 2, 211, 8, 1); ctx.fillRect(x - 3, 210, 1, 1); drawPerson(ctx, x + 1, 210, 0.7, dayF, t, false, true, false); ctx.fillStyle = dim('#5a5e68', dayF); ctx.fillRect(x + 6, 208, 4, 1); }
    }
  }
  // снегоход через двор, со снежным шлейфом
  if (winter) {
    const sm = episode(t, 230, 9, 51);
    if (sm) {
      const x = Math.round(500 - sm.ph * 540);
      ctx.fillStyle = dim('#2f5a8a', dayF); ctx.fillRect(x, 207, 9, 3); ctx.fillRect(x - 2, 209, 3, 1);
      ctx.fillStyle = dim('#2a2a30', dayF); ctx.fillRect(x + 3, 204, 3, 3); ctx.fillStyle = dim('#e8b030', dayF); ctx.fillRect(x + 3, 203, 3, 1);
      ctx.fillStyle = mixHex('#5a6070', '#f4f6f8', dayF);
      for (let i = 0; i < 8; i++) { ctx.globalAlpha = 0.5 - i * 0.06; ctx.fillRect(x + 10 + i * 3, 208 - (i % 3), 2, 2); }
      ctx.globalAlpha = 1;
      if (nightF > 0.3) { ctx.fillStyle = '#fff4c8'; ctx.fillRect(x - 3, 207, 1, 1); }
    }
  }
  // контейнер-гараж: вечером и в выходные двери открыты, внутри свет и хозяин
  const wd = env.local.getUTCDay(), garage = (h >= 17 && h < 21) || ((wd === 0 || wd === 6) && h >= 11 && h < 18);
  if (garage) {
    const gx = 302;
    ctx.fillStyle = nightF > 0.3 ? '#3a2a18' : dim('#1e1e24', dayF); ctx.fillRect(gx, 186, 9, 12);
    if (nightF > 0.2) { const gr = ctx.createRadialGradient(gx + 4, 192, 0, gx + 4, 194, 24); gr.addColorStop(0, `rgba(255,190,110,${0.45 * nightF})`); gr.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = gr; ctx.fillRect(gx - 20, 176, 50, 36); ctx.fillStyle = '#ffd890'; ctx.fillRect(gx + 2, 187, 5, 1); }
    ctx.fillStyle = dim('#24486e', dayF); ctx.fillRect(gx + 9, 185, 3, 13); // распахнутая створка
    drawPerson(ctx, gx + 4, 198, 0.15, dayF, t, false, winter, Math.sin(t * 0.5) > 0.6);
  }
  // позёмка: в ветер снег струится по двору
  if (winter && env.weather.wind >= 6) {
    const w = env.weather.wind, sp = 30 + w * 8;
    ctx.fillStyle = mixHex('#6a7488', '#f6f8fa', dayF);
    for (let i = 0; i < 40; i++) {
      const r = rng(i * 17 + 3), x = ((r() * 560 + t * sp * (0.7 + r() * 0.6)) % 560) - 40, y = 196 + r() * 17;
      ctx.globalAlpha = 0.25 + r() * 0.3; ctx.fillRect(Math.round(x), Math.round(y), 4 + Math.round(r() * 8), 1);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- секреты Анадыря ----------
const secT = (env) => env.ms / 1000;
const month = (env) => env.local.getUTCMonth() + 1;
const inWin = (env, period, dur, shift = 0) => env.forced || ((secT(env) + shift) % period) < dur;
const clearSky = (env, maxCloud) => env.weather.cloud <= maxCloud && !['rain', 'storm', 'snow', 'fog'].includes(env.weather.kind);
const nightIdx = (env) => Math.floor((env.ms / 1000 - 12 * 3600) / 86400);

export const SECRETS = [
  {
    id: 'cats', name: 'Кошки на тепляке', layer: 'street',
    hint: 'В мороз на плитах теплотрассы кто-то пушистый занимает лучшие места.',
    found: 'Зимой тепляк — самое тёплое место во дворе: под плитами идут горячие трубы, и кошки греются прямо на бетоне.',
    state(env) {
      if (!env.forced && !(env.winter && inWin(env, 1500, 600))) return null;
      return { x: 148, y: 158, w: 10, h: 10 }; // только на видимой части плит: правее x=158 — стена салатового дома
    },
    draw(ctx, env, st, dayF) {
      const t = secT(env), c1 = mixHex('#1a1612', '#e09048', dayF), c2 = mixHex('#141418', '#4a4a52', dayF);
      // кошки строго на плитах (x<158, плиты сужаются к ТЦ); дальше вправо — стена салатового дома, кот был бы «сквозь» неё
      ctx.fillStyle = c1; ctx.fillRect(150, 165, 4, 2); ctx.fillRect(153, 164, 2, 2); ctx.fillRect(149, 166 + (Math.sin(t) > 0.8 ? -1 : 0), 1, 1);
      ctx.fillStyle = c2; ctx.fillRect(153, 160, 3, 2); ctx.fillRect(155, 159, 2, 2);
    },
  },
  {
    id: 'square', name: 'Игра в квадрат', layer: 'street',
    hint: 'Летними вечерами во дворе у контейнеров что-то стучит о асфальт и слышны крики «аут!».',
    found: 'Квадрат: поле делят на четыре части, в середине круг. Мяч отбивают со своей части через круг в чужую — и не дают ему коснуться своей.',
    state(env) {
      const mo = month(env), h = env.local.getUTCHours();
      if (!env.forced && !(mo >= 6 && mo <= 9 && h >= 17 && h < 23 && !['rain', 'storm'].includes(env.weather.kind))) return null;
      return { x: 261, y: 198, w: 44, h: 16 };
    },
    draw(ctx, env, st, dayF) {
      const t = secT(env), slot = Math.floor(t / 1.2), r = rng(slot)(), from = slot % 4, to = (from + 1 + Math.floor(r * 3)) % 4;
      const P = [[267, 205], [299, 205], [269, 212], [297, 212]];
      P.forEach(([x, y], i) => drawPerson(ctx, x, y, i / 4 + 0.1, dayF, t, false, false, i === from));
      const u = (t % 1.2) / 1.2, [ax, ay] = P[from], [bx, by] = P[to];
      ctx.fillStyle = mixHex('#3a2a20', '#e84a3a', dayF);
      ctx.fillRect(Math.round(ax + (bx - ax) * u), Math.round(ay - 4 + (by - ay) * u - Math.sin(u * Math.PI) * 6), 2, 2);
    },
  },
  {
    id: 'fox', name: 'Лиса у помоек', layer: 'street',
    hint: 'Поздними зимними ночами у баков мелькает рыжий хвост.',
    found: 'Лисы на Чукотке заходят в посёлки и города: ночью, когда двор пуст, они проверяют помойки.',
    state(env) {
      const h = env.local.getUTCHours();
      if (!env.forced && !(env.winter && (h >= 0 && h < 5) && inWin(env, 1200, 300, 400))) return null;
      return { x: 190, y: 200, w: 10, h: 6 };
    },
    draw(ctx, env, st, dayF) {
      const t = secT(env), c = mixHex('#5a2a14', '#d86a2a', Math.max(dayF, 0.35)), x = 190 + Math.round(Math.sin(t * 0.5) * 3);
      ctx.fillStyle = c; ctx.fillRect(x, 202, 6, 3); ctx.fillRect(x + 5, 200, 3, 3); ctx.fillRect(x - 3, 202 + (Math.sin(t * 3) > 0 ? 0 : 1), 3, 2);
      ctx.fillStyle = '#f4f0e8'; ctx.fillRect(x - 3, 203, 1, 1); ctx.fillStyle = '#1a1414'; ctx.fillRect(x + 1, 205, 1, 1); ctx.fillRect(x + 4, 205, 1, 1); ctx.fillRect(x + 7, 199, 1, 1);
    },
  },
  {
    id: 'aurora', name: 'Северное сияние', layer: 'sky',
    hint: 'Изредка ясной зимней ночью небо над сопками начинает зеленеть.',
    found: 'Сияние над Анадырем видно реже, чем в Мурманске: город дальше от аврорального овала. Тем ценнее ночь, когда небо зеленеет над сопкой Дионисия.',
    state(env) {
      if (!env.forced) {
        const mo = month(env);
        if (!(mo >= 9 || mo <= 4) || env.sun.alt > -12 || !clearSky(env, 30)) return null;
        const n = nightIdx(env);
        if (rng(n * 7919 + 91)() > 0.15) return null; // примерно каждая седьмая ясная ночь
        if (!inWin(env, 3000, 1400, (n * 613) % 3000)) return null;
      }
      const ph = env.forced ? 0.5 : (((secT(env) + (nightIdx(env) * 613) % 3000) % 3000) / 1400);
      return { x: 20, y: 6, w: 440, h: 44, p: env.forced ? 1 : Math.min(1, ph * 6, (1 - ph) * 6) };
    },
    draw: drawAurora,
  },
  // Сумеречный пуск с «Восточного»: редко, по расписанию от даты (engine/rocket.js)
  rocketSecret('Восточный', 51.9, 128.3),
];
