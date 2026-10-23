// Радио Марсохода ловит местные волны: эфир зависит от участка дороги, на котором машина.
// Плейлисты — те же, что у окон городов (src в них от корня сайта, играют с любой страницы).

export const WAVES = [
  { from: 0, to: 700, id: 'vladivostok', gen: 'Владивостока', playlist: 'cities/vladivostok/music/playlist.json' },
  { from: 700, to: 3400, id: 'bam', gen: 'тайги', playlist: 'cities/bam/music/playlist.json' },
  { from: 3400, to: 4500, id: 'irkutsk', gen: 'Иркутска', playlist: 'cities/irkutsk/music/playlist.json' },
  { from: 4500, to: 7300, id: 'transsib', gen: 'Сибири', playlist: 'cities/transsib/music/playlist.json' },
  { from: 7300, to: 8100, id: 'ekaterinburg', gen: 'Екатеринбурга', playlist: 'cities/ekaterinburg/music/playlist.json' },
  { from: 8100, to: 8700, id: 'kazan', gen: 'Казани', playlist: 'cities/kazan/music/playlist.json' },
  { from: 8700, to: 9000, id: 'nnovgorod', gen: 'Нижнего Новгорода', playlist: 'cities/nnovgorod/music/playlist.json' },
  { from: 9000, to: Infinity, id: 'vladimir', gen: 'Владимира', playlist: 'cities/vladimir/music/playlist.json' },
];

// Волна по env: до старта — Владивосток, после финиша — Владимир (последняя волна перед Москвой)
export function waveFor(env) {
  const c = env && env.car;
  if (!c || c.status === 'soon') return WAVES[0];
  if (c.status === 'done') return WAVES[WAVES.length - 1];
  const km = Number.isFinite(c.km) ? c.km : 0;
  return WAVES.find((w) => km >= w.from && km < w.to) || WAVES[WAVES.length - 1];
}

export const playlistFor = (env) => waveFor(env).playlist;

export const radioLine = (env) => `Радио Марсохода поймало волну ${waveFor(env).gen}`;
