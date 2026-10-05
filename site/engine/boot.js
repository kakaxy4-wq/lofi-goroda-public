// Загрузчик: город по адресу (/piter/, /kazan/…), иначе первый включённый (Петербург).
const CITIES = await (await fetch('cities/index.json', { cache: 'no-store' })).json();
const seg = location.pathname.split('/').filter(Boolean)[0];
const entry = CITIES.find((c) => c.id === seg && c.enabled) || CITIES.find((c) => c.enabled);
const [{ default: city }, { start }] = await Promise.all([import(`../cities/${entry.id}/index.js`), import('./app.js')]);
start(city, CITIES);
