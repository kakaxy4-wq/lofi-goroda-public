// Живой слой: сколько людей слушают, реакции, общий счётчик монеток.
// Сервер — server/live.py. Если он недоступен, сайт работает как раньше, без счётчиков.

const url = () => {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return local ? `ws://${location.hostname}:8766/live` : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/live`;
};

function clientId() {
  try {
    let id = localStorage.getItem('lg:id');
    if (!id) { id = crypto.randomUUID?.() || String(Math.random()).slice(2); localStorage.setItem('lg:id', id); }
    return id;
  } catch { return String(Math.random()).slice(2); }
}

// Метка источника из ссылки (?from=pablik1): запоминаем последнюю, чтобы она пережила переход между городами.
function source() {
  const v = (new URLSearchParams(location.search).get('from') || '').toLowerCase();
  try {
    if (/^[a-z0-9_-]{1,32}$/.test(v)) localStorage.setItem('lg:from', v);
    return localStorage.getItem('lg:from') || '';
  } catch { return /^[a-z0-9_-]{1,32}$/.test(v) ? v : ''; }
}

export function connectLive({ city, onStats, onReact }) {
  let ws = null, tries = 0, alive = true;
  const last = { stats: null };
  const queue = []; // события до открытия соединения
  function open() {
    try { ws = new WebSocket(url()); } catch { return retry(); }
    ws.onopen = () => {
      tries = 0; ws.send(JSON.stringify({ t: 'hello', id: clientId(), city, from: source() }));
      while (queue.length) ws.send(JSON.stringify({ t: 'ev', e: queue.shift() }));
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'stats') { last.stats = m; onStats(m); }
      if (m.t === 'react') onReact(m.k);
    };
    ws.onclose = retry;
    ws.onerror = () => ws.close();
  }
  function retry() {
    ws = null;
    if (!alive || ++tries > 8) return;
    setTimeout(open, Math.min(60000, 1500 * 2 ** tries));
  }
  const send = (o) => { if (ws?.readyState === 1) ws.send(JSON.stringify(o)); };
  setInterval(() => send({ t: 'ping' }), 30000);
  open();
  return {
    react: (k) => send({ t: 'react', k }),
    coin: (target, win) => send({ t: 'coin', target, win }),
    // анонимная статистика нажатий: только имя события, сервер считает их по дням и городам
    ev(name) {
      const e = String(name).toLowerCase().replace(/[^a-z0-9_:.-]/g, '').slice(0, 40);
      if (!e) return;
      if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'ev', e }));
      else if (queue.length < 30) queue.push(e);
    },
    get stats() { return last.stats; },
    close() { alive = false; ws?.close(); },
  };
}

// «слушают» / «слушает» / «слушают»
export function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
