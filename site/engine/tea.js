// Мини-игра «Чай из титана»: держите кнопку — кипяток льётся в гранёный стакан.
// Отпустить надо у чёрточки: недолил — можно долить, перелил — горячо, новый стакан.
// Потом — лимон, сахар или просто чёрный; стакан звенит ложечкой.

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('lg:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lg:' + k, JSON.stringify(v)); } catch {} },
};
const LO = 0.78, HI = 0.95, RATE = 0.32; // «в самый раз» — между LO и HI; RATE — доля стакана в секунду
const GX = 92, GY = 50, GW = 22, GH = 36; // стакан на холсте 160×100

export function openTeaGame({ sfx, toast, title = 'Чай из титана' }) {
  if (document.querySelector('.modal')) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal-card game px">
    <div class="modal-head"><b>${title}</b><button class="x" aria-label="Закрыть">×</button></div>
    <canvas class="game-canvas" width="160" height="100"></canvas>
    <p class="game-msg">Держите кнопку — кипяток льётся. Отпустите у чёрточки.</p>
    <div class="game-foot tea-foot"><button class="btn primary pour">Наливать</button><span class="game-stat"></span></div>
  </div>`;
  document.body.appendChild(wrap);
  const cv = wrap.querySelector('canvas'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const msg = wrap.querySelector('.game-msg'), stat = wrap.querySelector('.game-stat'), foot = wrap.querySelector('.tea-foot');
  let s = store.get('tea', { cups: 0, spilled: 0 });
  const showStat = () => (stat.textContent = s.cups ? `стаканов за дорогу: ${s.cups}` : '');
  showStat();

  // phase: fill → choose → brew → done
  let phase = 'fill', level = 0, pouring = false, spill = 0, brew = 0, extra = null, raf, last = performance.now(), t = 0, settle = 0;

  function drawTitan() {
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, 160, 100); // стенка коридора
    g.fillStyle = '#3a3028'; for (let y = 4; y < 100; y += 8) g.fillRect(0, y, 160, 1);
    // корпус титана: медь и заклёпки
    g.fillStyle = '#8a5a32'; g.fillRect(14, 6, 54, 80);
    g.fillStyle = '#a8703e'; g.fillRect(18, 6, 8, 80);
    g.fillStyle = '#6a4224'; g.fillRect(60, 6, 8, 80);
    g.fillStyle = '#c89058'; for (let y = 12; y < 84; y += 12) { g.fillRect(16, y, 1, 1); g.fillRect(65, y, 1, 1); }
    // термометр-окошко
    g.fillStyle = '#e8e0c8'; g.fillRect(34, 16, 14, 14); g.fillStyle = '#2a2420'; g.fillRect(35, 17, 12, 12);
    g.fillStyle = '#e04030'; g.fillRect(41, 19, 1, 9); g.fillStyle = '#e8e0c8'; g.fillRect(36, 22, 2, 1); g.fillRect(44, 22, 2, 1);
    // кран и ручка
    g.fillStyle = '#b0b4b8'; g.fillRect(68, 40, 34, 5); g.fillRect(98, 40, 5, 9);
    g.fillStyle = '#d0d4d8'; g.fillRect(68, 40, 34, 1);
    g.fillStyle = '#202020'; g.fillRect(84, pouring ? 30 : 34, 4, pouring ? 10 : 6); // ручка поднята, когда льётся
    g.fillStyle = '#c03828'; g.fillRect(83, pouring ? 28 : 32, 6, 3);
    // поддон
    g.fillStyle = '#5a5a5e'; g.fillRect(80, GY + GH + 2, 46, 4); g.fillStyle = '#7a7a80'; g.fillRect(80, GY + GH + 2, 46, 1);
  }
  function drawGlass() {
    const top = GY + Math.round(GH * (1 - Math.min(1, level)));
    // жидкость: кипяток → чай темнеет при заварке
    if (level > 0) {
      const k = Math.min(1, brew);
      const r = Math.round(200 - 50 * k), gg = Math.round(220 - 150 * k), b = Math.round(230 - 205 * k); // янтарный чай
      g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(GX + 2, top, GW - 4, GY + GH - top);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(GX + 2, top, GW - 4, 1);
    }
    // гранёный стакан: грани
    g.fillStyle = 'rgba(220,235,240,0.35)'; for (let x = GX + 1; x < GX + GW; x += 4) g.fillRect(x, GY + 4, 1, GH - 6);
    g.fillStyle = '#d8e8ee'; g.fillRect(GX, GY - 1, 1, GH + 1); g.fillRect(GX + GW - 1, GY - 1, 1, GH + 1); g.fillRect(GX, GY + 3, GW, 1);
    // подстаканник
    g.fillStyle = '#9a9488'; g.fillRect(GX - 1, GY + GH - 12, GW + 2, 13);
    g.fillStyle = '#c8c0b0'; for (let x = GX + 1; x < GX + GW; x += 3) g.fillRect(x, GY + GH - 10, 1, 8);
    g.fillStyle = '#7a7468'; g.fillRect(GX + GW + 1, GY + GH - 10, 4, 2); g.fillRect(GX + GW + 4, GY + GH - 10, 2, 8); g.fillRect(GX + GW + 1, GY + GH - 4, 4, 2);
    // чёрточка «до сюда»
    const mark = GY + Math.round(GH * (1 - (LO + HI) / 2));
    g.fillStyle = '#ffd860'; g.fillRect(GX - 5, mark, 4, 1); g.fillRect(GX + GW + 7, mark, 3, 1);
    if (extra === 'lemon' && brew > 0.3) { g.fillStyle = '#f8e050'; g.fillRect(GX + 6, top - 1, 9, 2); g.fillStyle = '#fff8b0'; g.fillRect(GX + 8, top - 1, 5, 1); }
    if (extra === 'sugar' && brew < 0.6) { g.fillStyle = '#f8f8f0'; g.fillRect(GX + 8, Math.min(GY + GH - 3, top + Math.round(brew * 40)), 3, 3); }
    if (phase === 'brew' || phase === 'done') { g.fillStyle = '#c8c8cc'; g.fillRect(GX + 14 + Math.round(Math.sin(t * 9) * (phase === 'brew' ? 2 : 0)), GY - 10, 1, GH - 2); } // ложечка
  }
  function drawSteamAndStream() {
    if (pouring) {
      g.fillStyle = 'rgba(210,230,240,0.9)'; g.fillRect(100, 49, 2, Math.max(0, GY + Math.round(GH * (1 - level)) - 49));
      if ((t * 20 | 0) % 2) { g.fillStyle = '#ffffff'; g.fillRect(100, 52 + ((t * 60) % 20 | 0), 1, 2); }
    }
    if (level > 0.2) {
      g.fillStyle = 'rgba(235,240,245,0.45)';
      for (let i = 0; i < 4; i++) { const p = (t * 0.5 + i / 4) % 1; g.fillRect(GX + 6 + i * 3 + Math.round(Math.sin(t * 2 + i) * 2), GY - 4 - Math.round(p * 22), 2, 2); }
    }
    if (spill > 0) { g.fillStyle = `rgba(200,220,230,${spill})`; g.fillRect(GX - 6, GY + GH, GW + 14, 2); }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (phase === 'fill') {
      if (pouring) { level += RATE * dt; if (level > 1.02) overflow(); }
      else if (level >= LO && level <= HI && (settle += dt) > 0.5) chooseStep();
    }
    if (phase === 'brew') { brew += dt * 0.5; if (brew >= 1) done(); }
    spill = Math.max(0, spill - dt * 0.4);
    drawTitan(); drawGlass(); drawSteamAndStream();
    raf = requestAnimationFrame(frame);
  }
  function start(e) { if (phase !== 'fill' || pouring) return; e?.preventDefault?.(); pouring = true; settle = 0; sfx?.('pour'); msg.textContent = 'Льётся… отпустите у чёрточки'; }
  function stop() {
    if (!pouring) return; pouring = false;
    if (phase !== 'fill') return;
    msg.textContent = level < LO ? 'Ещё немного — долейте' : level <= HI ? 'В самый раз!' : 'Почти до краёв — горячо держать';
    if (level > HI) setTimeout(() => phase === 'fill' && !pouring && chooseStep(), 600);
  }
  function overflow() {
    pouring = false; spill = 1; level = 0; s.spilled++; store.set('tea', s);
    msg.textContent = 'Перелили — кипяток через край. Новый стакан, ещё раз!';
  }
  function chooseStep() {
    phase = 'choose';
    msg.textContent = 'Заварка есть. Что добавить?';
    foot.innerHTML = '<button class="btn" data-x="lemon">🍋 С лимоном</button><button class="btn" data-x="sugar">Два кусочка сахара</button><button class="btn" data-x="plain">Просто чёрный</button>';
    foot.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => { extra = b.dataset.x; phase = 'brew'; sfx?.('clink'); msg.textContent = 'Завариваем, ложечка звенит…'; foot.innerHTML = ''; }));
    foot.querySelector('button').focus();
  }
  function done() {
    phase = 'done'; brew = 1; s.cups++; store.set('tea', s);
    const say = { lemon: 'Чай с лимоном, как в поезде положено.', sugar: 'Сладкий, с двумя кусочками — как в детстве.', plain: 'Крепкий чёрный — самое то под стук колёс.' }[extra];
    msg.textContent = say;
    foot.innerHTML = '<button class="btn primary again">Ещё стакан</button><span class="game-stat"></span>';
    foot.querySelector('.game-stat').textContent = `стаканов за дорогу: ${s.cups}`;
    foot.querySelector('.again').onclick = reset;
    foot.querySelector('.again').focus();
    sfx?.('clink');
  }
  function reset() {
    phase = 'fill'; level = 0; brew = 0; extra = null; settle = 0;
    msg.textContent = 'Держите кнопку — кипяток льётся. Отпустите у чёрточки.';
    foot.innerHTML = '<button class="btn primary pour">Наливать</button><span class="game-stat"></span>';
    bindPour();
  }
  function bindPour() {
    const b = foot.querySelector('.pour');
    b.onpointerdown = start; b.onpointerup = stop; b.onpointerleave = stop; b.onpointercancel = stop;
    b.onkeydown = (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); };
    b.onkeyup = (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); };
    b.oncontextmenu = (e) => e.preventDefault();
    b.focus();
  }
  cv.onpointerdown = start; cv.onpointerup = stop; cv.onpointerleave = stop;
  bindPour();
  const close = () => { cancelAnimationFrame(raf); wrap.remove(); if (s.cups) toast?.(`Стаканов чая за дорогу: ${s.cups}.`); };
  wrap.querySelector('.x').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.onkeydown = (e) => { if (e.key === 'Escape') close(); };
  raf = requestAnimationFrame(frame);
  // для тестов
  wrap.__tea = { get level() { return level; }, set level(v) { level = v; }, get phase() { return phase; }, start, stop };
}
