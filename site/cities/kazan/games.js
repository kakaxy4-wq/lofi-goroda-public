// Мини-игра Казани «Башня из чак-чака» — своя механика вместо монетки Чижику.
// Кусочек чак-чака качается над вершиной, клик — уронить. Ложится туда, куда упал:
// ровно — башня растёт прямо; со сдвигом — кренится, и если перевесит, верх осыпается на стол.
// Спокойно: без таймера и проигрыша, только рекорд высоты.

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('lg:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lg:' + k, JSON.stringify(v)); } catch {} },
};

const PW = 14, PH = 5, HALF = PW / 2; // кусочек: ширина и высота, полширины — предел опоры
const TABLE = 80;                     // поверхность стола (мировые координаты, y вниз)
const BASE_Y = TABLE - 4 - PH;        // первый кусочек лежит на блюде
const TOUCH = PW - 1;                 // дальше по горизонтали — мимо башни

// стена комнаты, стол, блюдо и стакан чая; cam — насколько вид поднялся вслед за башней
function drawRoom(g, t, cam) {
  g.fillStyle = '#4a3426'; g.fillRect(0, 0, 160, 100);
  for (let x = 6; x < 160; x += 16) { g.fillStyle = '#523a2b'; g.fillRect(x, 0, 6, 100); } // обои в полоску
  const ty = TABLE + cam;
  if (ty < 100) {
    g.fillStyle = '#7a4a2c'; g.fillRect(0, ty, 160, 3);           // кромка стола
    g.fillStyle = '#5e3620'; g.fillRect(0, ty + 3, 160, 100);
    g.fillStyle = '#4a2a18'; for (let x = 10; x < 160; x += 31) g.fillRect(x, ty + 5, 14, 1);
    // блюдо
    g.fillStyle = '#3a2014'; g.fillRect(56, ty, 48, 1);
    g.fillStyle = '#b8b0a0'; g.fillRect(58, ty - 3, 44, 3);
    g.fillStyle = '#e8e2d4'; g.fillRect(56, ty - 4, 48, 1);
    // стакан чая — чак-чак к чаю
    g.fillStyle = '#9ab0bc'; g.fillRect(138, ty - 15, 1, 15); g.fillRect(146, ty - 15, 1, 15);
    g.fillStyle = '#a8501a'; g.fillRect(139, ty - 12, 7, 12); g.fillStyle = '#c86824'; g.fillRect(139, ty - 12, 7, 1);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 3; i++) g.fillRect(140 + i * 2, ty - 20 + Math.sin(t * 1.2 + i * 2) * 2 - ((t * 4 + i * 9) % 6), 1, 2);
  }
}

// кусочек чак-чака: медовый брусок из обжаренных палочек теста
function drawPiece(g, x, y, seed = 0) {
  const l = Math.round(x - HALF), top = Math.round(y);
  g.fillStyle = '#a86a22'; g.fillRect(l, top + 1, PW, PH - 1);
  g.fillStyle = '#d89a3a'; g.fillRect(l + 1, top, PW - 2, PH - 1);
  g.fillStyle = '#f4cc7a';
  for (let i = 0; i < 4; i++) { const sx = l + 1 + ((seed * 7 + i * 5) % (PW - 3)); g.fillRect(sx, top + 1 + (i % 2), 2, 1); }
  g.fillStyle = 'rgba(255,230,160,0.5)'; g.fillRect(l + 2, top, PW - 6, 1); // блеск мёда
}

// «3 кусочка», «5 кусочков»
const pieces = (n) => `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'кусочка' : 'кусочков'}`;

// уровень, с которого башня перевешивает: центр масс всего, что выше, ушёл за край опоры
function topple(tower) {
  for (let i = 0; i < tower.length - 1; i++) {
    let sum = 0;
    for (let j = i + 1; j < tower.length; j++) sum += tower[j];
    if (Math.abs(sum / (tower.length - 1 - i) - tower[i]) > HALF) return i;
  }
  return -1;
}

export function openChakChakGame({ sfx, live }) {
  if (document.querySelector('.modal')) return; // одна игра за раз
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card game px">
    <div class="modal-head"><b>Башня из чак-чака</b><button class="x" aria-label="Закрыть">×</button></div>
    <canvas class="game-canvas" width="160" height="100"></canvas>
    <p class="game-msg">Кусочек качается над башней — клик, чтобы уронить. Кладите ровно: криво — башня накренится.</p>
    <div class="game-foot"><button class="btn primary throw">Уронить кусочек</button><span class="game-stat"></span></div>
  </div>`;
  document.body.appendChild(wrap);
  const cv = wrap.querySelector('canvas'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const msg = wrap.querySelector('.game-msg'), stat = wrap.querySelector('.game-stat');
  const s = store.get('chakchak', {});
  s.best = s.best || 0;

  let tower = [80];  // x центров кусочков снизу вверх; нижний лежит на блюде
  let drop = null, crumbs = [], raf, t0 = performance.now(), cam = 0, swingT = 0, last = 0;
  const height = () => tower.length - 1;
  const topY = () => BASE_Y - (tower.length - 1) * PH;     // верх последнего кусочка
  const hangY = () => topY() - PH - 18;                    // где качается новый
  const speed = () => 1.2 + Math.min(1.0, height() * 0.06);  // выше — качается быстрее
  const swingX = () => 80 + Math.sin(swingT) * (34 + Math.min(20, height() * 1.5)); // и шире
  const showStat = () => { stat.textContent = `башня: ${height()} · рекорд: ${s.best}`; };
  showStat();

  function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(0.05, t - last); last = t;
    swingT += dt * speed();
    cam += (Math.max(0, 14 - hangY()) - cam) * Math.min(1, dt * 4); // вид плавно поднимается за вершиной
    drawRoom(g, t, cam);
    tower.forEach((x, i) => drawPiece(g, x, BASE_Y - i * PH + cam, i));
    // осыпавшиеся кусочки и промахи
    for (const c of crumbs) {
      c.vy += 260 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.y > TABLE - PH) { c.y = TABLE - PH; c.vy = 0; c.vx *= 0.8; }
      drawPiece(g, c.x, c.y + cam, c.seed);
    }
    crumbs = crumbs.filter((c) => t - c.t < 2.5);
    if (!drop) { // кусочек на «нитке мёда»
      const x = Math.round(swingX()), y = Math.round(hangY() + cam);
      g.fillStyle = '#e8c860'; g.fillRect(x, 0, 1, Math.max(0, y));
      drawPiece(g, x, y, tower.length);
    } else {
      const k = Math.min(1, (t - drop.t) / 0.35), y = drop.y0 + (topY() - PH - drop.y0) * k * k;
      drawPiece(g, drop.x, y + cam, tower.length);
      if (k >= 1) land(drop.x, t);
    }
    raf = requestAnimationFrame(frame);
  }

  function land(x, t) {
    drop = null;
    const dx = x - tower[tower.length - 1];
    if (Math.abs(dx) > TOUCH) { // мимо башни — падает на стол, башня цела
      crumbs.push({ x, y: topY() - PH, vx: Math.sign(dx) * 10, vy: 30, t, seed: tower.length });
      msg.textContent = 'Мимо — кусочек упал на стол. Башня стоит, пробуйте ещё.';
      sfx('coin', false);
      return;
    }
    const exact = Math.abs(dx) <= 1;
    tower.push(exact ? tower[tower.length - 1] : x); // почти ровно — встаёт ровно
    const i = topple(tower);
    if (i >= 0) { // перевесило: всё выше уровня i осыпается в сторону крена
      const fallen = tower.splice(i + 1);
      const dir = Math.sign(fallen.reduce((a, b) => a + b, 0) / fallen.length - tower[i]) || 1;
      fallen.forEach((fx, j) => crumbs.push({ x: fx, y: BASE_Y - (i + 1 + j) * PH, vx: dir * (18 + j * 6), vy: -10 - j * 4, t, seed: i + 1 + j }));
      msg.textContent = fallen.length > 1
        ? `Башня накренилась — ${pieces(fallen.length)} осыпались. Осталось ${height()}, достраивайте.`
        : 'Слишком с краю — кусочек соскользнул. Кладите ближе к середине.';
      sfx('coin', false);
    } else {
      msg.textContent = exact ? `Ровно! Башня: ${height()} ✨` : `Легло с креном. Башня: ${height()}`;
      if (height() > s.best) { s.best = height(); store.set('chakchak', s); }
      if (height() % 5 === 0) {
        live?.coin('chakchak', true);
        if (height() >= 10) msg.textContent = `Башня в ${height()} кусочков — настоящий праздничный чак-чак!`;
      }
      sfx('coin', true);
    }
    showStat();
  }

  wrap.__game = { swingX, tower: () => tower, height }; // для тестов
  const dropIt = () => { if (drop) return; drop = { x: Math.round(swingX()), y0: hangY(), t: (performance.now() - t0) / 1000 }; };
  wrap.querySelector('.throw').onclick = dropIt;
  cv.onclick = dropIt;
  const close = () => { cancelAnimationFrame(raf); wrap.remove(); };
  wrap.querySelector('.x').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  raf = requestAnimationFrame(frame);
  wrap.querySelector('.throw').focus();
}
