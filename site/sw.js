// Офлайн: оболочка сайта из кэша, сеть — в приоритете. Музыку не кэшируем (Range-запросы),
// без сети эфир сам переходит на генеративные вставки.
const CACHE = 'lg-v15'; // поднимать с каждым релизом; HTML, JSON и скрипты — network-first (сеть в приоритете, кэш только офлайн)
const SHELL = ['/', 'index.html', 'piter/index.html', 'css/app.css', 'fonts/caveat-cyr.woff2', 'fonts/caveat-lat.woff2', 'fonts/pangolin-cyr.woff2', 'fonts/pangolin-lat.woff2', 'fonts/handjet-cyr.woff2', 'fonts/handjet-lat.woff2', 'fonts/pressstart-cyr.woff2', 'fonts/pressstart-lat.woff2', 'manifest.webmanifest', 'cities/index.json',
  'engine/boot.js', 'engine/app.js', 'engine/scene.js', 'engine/const.js', 'engine/audio.js', 'engine/astro.js', 'engine/weather.js', 'engine/util.js',
  'engine/games.js', 'engine/icons.js', 'engine/live.js',
  'cities/piter/index.js', 'cities/piter/config.js', 'cities/piter/skyline.js', 'cities/piter/sounds.js', 'cities/piter/places.js',
  'cities/piter/bridges.js', 'cities/piter/games.js', 'cities/piter/music/playlist.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || /\.mp3$/.test(u.pathname) || u.pathname.startsWith('/live')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
