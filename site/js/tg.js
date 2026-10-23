// Telegram Mini App: вся логика внутри Telegram в одном месте. Грузится из boot.js только при ?tg=1 или tgWebAppData в адресе.
// raw — исходные addEventListener/setInterval (загрузчик их подменяет, чтобы снимать города; наши обработчики должны жить всегда).
export async function init(raw) {
  await new Promise((ok) => {
    const s = document.createElement('script');
    s.src = '/js/telegram-web-app.js'; // копия SDK со своего сервера: CSP не пускает telegram.org
    s.onload = s.onerror = ok;
    document.head.appendChild(s);
  });
  const W = window.Telegram?.WebApp;
  console.log('Telegram SDK:', !!W, W?.version);
  if (!W) return;
  const ge = (v) => { try { return W.isVersionAtLeast(v); } catch { return false; } };
  const safe = (v, fn) => { if (ge(v)) try { fn(); } catch {} }; // каждый вызов новее 6.0 — за версией и try/catch
  try { W.ready(); W.expand(); } catch {}
  safe('7.7', () => W.disableVerticalSwipes()); // свайп по окну у нас — панорама и листание городов, закрывать приложение не должен
  safe('6.1', () => { W.setHeaderColor('#140e12'); W.setBackgroundColor('#140e12'); });
  safe('7.10', () => W.setBottomBarColor('#1c1214'));

  // Кнопка «экран»: в Telegram — настоящий fullscreen клиента; на старых клиентах кнопки нет
  if (!ge('8.0')) document.documentElement.classList.add('tg-nofs');
  else {
    try { W.onEvent?.('fullscreenFailed', () => { try { W.expand(); } catch {} }); } catch {} // тихо: просто раскрыть
    raw.addEL.call(document, 'click', (e) => {
      if (!e.target.closest?.('#fs')) return;
      e.stopPropagation(); // не доходит до обработчика сайта (document.requestFullscreen)
      try { W.isFullscreen ? W.exitFullscreen() : W.requestFullscreen(); } catch {}
    }, true);
  }

  // Внешние ссылки (поделиться, контакты) открываем средствами Telegram
  raw.addEL.call(document, 'click', (e) => {
    const a = e.target.closest?.('a[target=_blank]');
    if (!a || !a.href) return;
    let u; try { u = new URL(a.href); } catch { return; }
    const tme = /^(t|telegram)\.me$/.test(u.hostname);
    if (tme && ge('6.1')) W.openTelegramLink(a.href);
    else if (!tme && ge('6.4')) W.openLink(a.href);
    else return;
    e.preventDefault();
  }, true);

  // Статистика: live.js поднимается позже загрузчика — подождать и отправить один раз
  let n = 0;
  const iv = raw.sI(() => { if (window.__live?.ev) { window.__live.ev('tg:open'); clearInterval(iv); } else if (++n > 20) clearInterval(iv); }, 500);
}
