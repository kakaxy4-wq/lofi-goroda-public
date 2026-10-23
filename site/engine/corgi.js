// Корги в гостях: время от времени запрыгивает в кресло-качалку, спит на вязаной подушке,
// иногда поднимает голову и виляет «пушистыми штанами». Клик по креслу — погладить.
// Здесь же клубок ниток у кота: клик — клубок катится, кот следит и бьёт хвостом.

const COL = { fur: '#d4843a', hi: '#eaa458', dark: '#a85e26', white: '#f2eadc', whiteSh: '#d8ccbc', ear: '#c06850', line: '#2a1810', nose: '#1a1010', tongue: '#e0707a' };

// v — визит { arrive, leave } в секундах; petAt — когда гладили. Возвращает null, если корги нет.
export function corgiState(t, v, petAt) {
  if (!v || t < v.arrive || t > v.leave + 1.2) return null;
  const k = t < v.arrive + 1.2 ? (t - v.arrive) / 1.2 : t > v.leave ? 1 - (t - v.leave) / 1.2 : 1; // запрыгнула / спрыгнула
  const hop = k < 1 ? { dx: -Math.round((1 - k) * 46), dy: -Math.round(Math.sin(k * Math.PI) * 12) } : { dx: 0, dy: 0 };
  if (t - petAt < 5) return { ...hop, mode: 'pet', wag: true };
  if (k < 1 || t - v.arrive < 6) return { ...hop, mode: 'awake', look: 1, wag: true }; // огляделась на новом месте
  const slot = Math.floor((t - v.arrive) / 20), r = ((Math.sin(slot * 127.1 + v.arrive) * 43758.5453) % 1 + 1) % 1, ph = (t - v.arrive) % 20;
  if (r < 0.3 && ph > 6 && ph < 13) return { ...hop, mode: 'awake', look: ph < 9.5 ? 1 : 0, blink: ph % 3 < 0.15, wag: ph > 10 };
  if (r > 0.85 && ph > 4 && ph < 6.5) return { ...hop, mode: 'yawn', k: (ph - 4) / 2.5 };
  return { ...hop, mode: 'sleep', ear: r > 0.6 && ph > 3 && ph < 3.4 };
}

// x0, yBase — левый край и низ (лежит на подушке), mul — освещение комнаты.
// Рисуем в маленький холст и обводим тёмным контуром — иначе рыжая собака сливается с подушкой
const SPR = { c: null, o: null };
export function drawCorgi(g, x0, yBase, st, t, mul) {
  if (!SPR.c) for (const k of ['c', 'o']) { SPR[k] = document.createElement('canvas'); SPR[k].width = 64; SPR[k].height = 40; }
  const sg = SPR.c.getContext('2d'), og = SPR.o.getContext('2d');
  sg.clearRect(0, 0, 64, 40);
  paint(sg, 4, 34, st, t, mul);
  og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, 64, 40); og.drawImage(SPR.c, 0, 0);
  og.globalCompositeOperation = 'source-in'; og.fillStyle = mul('#5a2e14'); og.fillRect(0, 0, 64, 40);
  const X = x0 + st.dx - 4, Y = yBase + st.dy - 34;
  g.globalAlpha = 0.45; g.drawImage(SPR.o, X + 1, Y + 1); g.globalAlpha = 1; // мягкая тень, не обводка
  g.drawImage(SPR.c, X, Y);
}
function paint(g, x0, yBase, st, t, mul) {
  const C = {}; for (const k in COL) C[k] = mul(COL[k]);
  const P = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x0 + x, yBase + y, w, h); };
  const breath = st.mode === 'sleep' && Math.sin(t * 1.2) > 0 ? 1 : 0;
  const wag = st.wag ? (Math.sin(t * 16) > 0 ? 1 : 0) : 0;
  // тело-«батон»
  const rows = [[10, 24], [7, 28], [5, 30], [4, 31], [3, 32], [3, 32], [3, 32], [3, 32], [3, 32], [3, 32], [4, 31], [5, 30], [6, 29]];
  rows.forEach(([a, b], i) => P(i < 2 ? C.hi : i > 10 ? C.dark : C.fur, a, -13 + i - (i < 3 ? breath : 0), b - a, 1));
  // пушистые белые «штаны» и хвостик — виляют
  P(C.white, 1 + wag, -9, 4, 6); P(C.whiteSh, 1 + wag, -4, 4, 1); P(C.fur, 2 + wag, -12, 3, 3);
  // белая грудка и вытянутые передние лапы
  P(C.white, 21, -6, 9, 5); P(C.white, 28, -2, 12, 2); P(C.whiteSh, 28, -1, 12, 1); P(C.line, 39, -2, 1, 1); P(C.line, 35, -1, 1, 1);
  P(C.white, 5, -1, 7, 1); // задняя лапка
  // голова «лисичкой»: широкий лоб, морда сужается к чёрному носу; лежит на лапах, когда спит
  const hx = 22, hy = -19 - (st.mode === 'sleep' ? 0 : 2);
  const head = [[3, 10], [2, 12], [1, 13], [1, 14], [1, 15], [1, 17], [2, 18], [2, 18], [3, 17], [4, 15], [6, 12]];
  head.forEach(([a, b], i) => P(i < 2 ? C.hi : C.fur, hx + a, hy + i, b - a, 1));
  P(C.white, hx + 9, hy + 1, 2, 4); P(C.white, hx + 8, hy + 4, 4, 1);          // белая проточина
  P(C.white, hx + 10, hy + 5, 7, 3); P(C.whiteSh, hx + 10, hy + 8, 6, 1);       // светлая морда
  P(C.white, hx + 3, hy + 7, 7, 3); P(C.white, hx + 6, hy + 10, 6, 1);          // белые щёки и подбородок
  P(C.nose, hx + 16, hy + 5, 2, 2); P('#4a3a34', hx + 16, hy + 5, 1, 1);        // нос с бликом
  // большие уши, широко посаженные и чуть разведённые в стороны
  const ear = (bx, dir, tw) => { // широкий треугольник: основание 6 px, высота 7, кончик чуть наружу
    for (let i = 0; i < 7; i++) {
      const w = Math.max(1, 6 - i), x = bx + (dir > 0 ? Math.floor(i / 3) : -Math.floor(i / 3)) + (6 - w) * (dir > 0 ? 1 : 0) * 0.5 | 0;
      P(i === 6 ? C.dark : C.fur, x, hy - 1 - i + tw, w, 1);
      if (i > 0 && i < 5 && w > 2) P(C.ear, x + 1, hy - 1 - i + tw, w - 2, 1);
    }
  };
  ear(hx + 1, -1, 0); ear(hx + 8, 1, st.ear ? 1 : 0);
  // глаза: тёмные, миндалевидные
  const ex = hx + 6, ex2 = hx + 11, ey = hy + 3;
  if (st.mode === 'awake' && !st.blink) { const lk = st.look > 0 ? 1 : 0; for (const x of [ex, ex2]) { P(C.line, x + lk, ey, 2, 2); P('#ffffff', x + lk, ey, 1, 1); } }
  else if (st.mode === 'pet') { for (const x of [ex - 1, ex2 - 1]) { P(C.line, x, ey + 1, 1, 1); P(C.line, x + 1, ey, 1, 1); P(C.line, x + 2, ey + 1, 1, 1); } }
  else { P(C.line, ex - 1, ey + 1, 3, 1); P(C.line, ex2, ey + 1, 3, 1); }
  P(C.line, hx + 12, hy + 8, 5, 1); // линия рта
  if (st.mode === 'pet' || (st.mode === 'awake' && st.wag)) { P(C.tongue, hx + 13, hy + 9, 2, 2 + (Math.sin(t * 8) > 0 ? 1 : 0)); } // язычок — улыбается
  if (st.mode === 'yawn') { const o = Math.round(Math.sin(st.k * Math.PI) * 2); if (o > 0) { P(C.line, hx + 11, hy + 9, 6, o); P(C.tongue, hx + 12, hy + 8 + o, 3, 1); } }
}

// Клубок ниток справа от кота. at — когда толкнули; возвращает смещение клубка и реакцию кота
export function yarnState(t, at) {
  const rel = t - at;
  if (rel < 0 || rel > 4) return { dx: 0, rot: 0, cat: null };
  const dx = Math.round(Math.sin(Math.min(1, rel / 3.2) * Math.PI) * 16);
  return { dx, rot: rel * 6, cat: { mode: 'awake', look: 1, blink: false, lift: Math.min(1, rel * 4, (4 - rel) * 3), tail: rel / 1.3 } };
}
export function drawYarn(g, x, y, ys, mul) {
  const X = x + ys.dx;
  const P = (c, px, py, w = 1, h = 1) => { g.fillStyle = mul(c); g.fillRect(X + px, y + py, w, h); };
  // нитка от клубка тянется к краю стола
  g.fillStyle = mul('#b84a5a'); for (let i = 0; i < 10; i++) g.fillRect(x + 8 + i + Math.max(0, ys.dx - i), y - 1 + (i > 6 ? 1 : 0), 1, 1);
  P('#c85868', 1, -6, 5, 1); P('#c85868', 0, -5, 7, 4); P('#c85868', 1, -1, 5, 1);
  P('#a03848', 0, -2, 7, 1);
  const r = Math.floor(ys.rot) % 3; // витки «бегут», когда катится
  P('#e88898', 1 + r, -5, 1, 3); P('#e88898', 4 - (r === 2 ? 1 : 0), -4, 1, 3); P('#f0a8b4', 2, -6, 2, 1);
}
