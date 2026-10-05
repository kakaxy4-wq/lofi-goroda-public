// Мини-игра «Монетка на постамент»: Чижик-Пыжик на Фонтанке и Заяц у Иоанновского моста.
// Маркер прицела качается влево-вправо, клик — бросок. Попал на постамент — желание сбудется.

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('lg:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lg:' + k, JSON.stringify(v)); } catch {} },
};

// kind — ключ цели (для счётчиков), targets — цели города: { title, ledge, y, draw(g, t) }
export function openCoinGame(kind, { sfx, onClose, live, targets }) {
  if (document.querySelector('.modal')) return; // одна игра за раз
  const T = targets[kind];
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card game px">
    <div class="modal-head"><b>${T.title}</b><button class="x" aria-label="Закрыть">×</button></div>
    <canvas class="game-canvas" width="160" height="100"></canvas>
    <p class="game-msg">Нажмите, когда стрелка над постаментом</p>
    <div class="game-foot"><button class="btn primary throw">Бросить монетку</button><span class="game-stat"></span></div>
  </div>`;
  document.body.appendChild(wrap);
  const cv = wrap.querySelector('canvas'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const msg = wrap.querySelector('.game-msg'), stat = wrap.querySelector('.game-stat');
  const key = 'coins:' + kind;
  let s = store.get(key, { thrown: 0, won: 0 });
  const showStat = () => {
    const g = live?.stats?.coins?.[kind];
    stat.textContent = `вы: ${s.won} из ${s.thrown}` + (g ? ` · сегодня все: ${g.won} из ${g.thrown}` : '');
  };
  showStat();
  let coin = null, stuck = [], raf, t0 = performance.now();
  const aimX = (t) => 80 + Math.sin(t * 1.5) * 58; // медленнее — попасть реально, но не даром

  function frame(now) {
    const t = (now - t0) / 1000;
    T.draw(g, t);
    for (const [x, y] of stuck) { g.fillStyle = '#e8c860'; g.fillRect(x, y, 2, 1); }
    if (!coin) { const x = Math.round(aimX(t)); g.fillStyle = '#ffffff'; g.fillRect(x, 90, 1, 6); g.fillRect(x - 1, 91, 3, 1); }
    else {
      const k = Math.min(1, (t - coin.t) / 0.7);
      const x = 80 + (coin.x - 80) * k, y = 96 - (96 - T.y) * k - Math.sin(k * Math.PI) * 40;
      g.fillStyle = '#ffd860'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
      if (k >= 1) finish(coin.x);
    }
    raf = requestAnimationFrame(frame);
  }
  function finish(x) {
    const [lx, lw] = T.ledge;
    const win = x >= lx && x <= lx + lw;
    s.thrown++; if (win) { s.won++; stuck.push([Math.round(x), T.y - 1]); }
    store.set(key, s); showStat();
    msg.textContent = win ? 'Осталась на постаменте — загадывайте желание ✨' : 'Бульк. Монетка в воде, попробуйте ещё';
    sfx('coin', win);
    live?.coin(kind, win);
    coin = null;
  }
  const throwIt = () => { if (coin) return; coin = { x: aimX((performance.now() - t0) / 1000), t: (performance.now() - t0) / 1000 }; };
  wrap.querySelector('.throw').onclick = throwIt;
  cv.onclick = throwIt;
  const close = () => { cancelAnimationFrame(raf); wrap.remove(); onClose?.(); };
  wrap.querySelector('.x').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  raf = requestAnimationFrame(frame);
  wrap.querySelector('.throw').focus();
}
