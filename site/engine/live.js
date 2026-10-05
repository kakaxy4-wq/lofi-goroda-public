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

export function connectLive({ city, onStats, onReact }) {
  let ws = null, tries = 0, alive = true;
  const last = { stats: null };
  function open() {
    try { ws = new WebSocket(url()); } catch { return retry(); }
    ws.onopen = () => { tries = 0; ws.send(JSON.stringify({ t: 'hello', id: clientId(), city })); };
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
