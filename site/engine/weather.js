// Реальная погода — Open-Meteo, без ключа. Пока нет сети — средняя по сезону и ясно.
import { rng, clamp } from './util.js';

let URL = '';
export function configureWeather(lat, lon) {
  URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,precipitation,snowfall,snow_depth,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,visibility&wind_speed_unit=ms';
  weather.afterRain = 0; // переезд в другой город — радуга не переезжает
}

const SEASON_TEMP = [-5, -5, 0, 6, 13, 17, 20, 18, 13, 6, 1, -3]; // средняя по месяцам — пока нет сети
export const weather = {
  source: 'default', // 'live' | 'default' | 'manual'
  temp: SEASON_TEMP[new Date().getMonth()], code: 0, cloud: 20, wind: 3, precip: 0,
  snow: 0, gust: 4.5, vis: 20000, afterRain: 0, freezing: false, // нюансы: без сети просто молчат
  snowDepth: null, // снежный покров, м (Open-Meteo); null — не знаем
  kind: 'clear', // clear | cloudy | rain | snow | fog | storm
};

export function kindFromCode(code, cloud) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  return cloud > 70 ? 'cloudy' : 'clear';
}

let liveSnap = null; // последние настоящие данные — вернуть их после ручного режима
export async function refreshWeather() {
  if (weather.source === 'manual' || !URL) return;
  try {
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 10000);
    const r = await fetch(URL, { cache: 'no-store', signal: ac.signal }); clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const c = (await r.json()).current;
    const live = { source: 'live', temp: c.temperature_2m, code: c.weather_code, cloud: c.cloud_cover, wind: c.wind_speed_10m, precip: c.precipitation, kind: kindFromCode(c.weather_code, c.cloud_cover),
      snow: c.snowfall, snowDepth: c.snow_depth ?? null, gust: c.wind_gusts_10m, vis: c.visibility, freezing: [56, 57, 66, 67].includes(c.weather_code), afterRain: weather.afterRain };
    if (['rain', 'storm'].includes(weather.kind) && !['rain', 'storm'].includes(live.kind)) live.afterRain = Date.now(); // дождь кончился — окно для радуги
    liveSnap = live;
    // пока шёл запрос, включили ручную погоду (дождь, подаренное настроение) — её не трогаем, берём только температуру и ветер
    if (weather.source === 'manual') Object.assign(weather, { temp: live.temp, wind: live.wind });
    else Object.assign(weather, live);
  } catch (e) {
    console.warn('weather unavailable', e);
  }
}

// Ручной режим для чипа «Погода» и для ?wx= в адресе.
export const WEATHER_KINDS = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'];
export function setManual(kind) {
  if (!kind || !WEATHER_KINDS.includes(kind)) {
    if (weather.source === 'manual') Object.assign(weather, liveSnap || { cloud: 20, precip: 0, kind: 'clear', wind: 3, snow: 0, gust: 4.5, vis: 20000, freezing: false }, { source: liveSnap ? 'live' : 'default' });
    refreshWeather(); return;
  }
  weather.source = 'manual';
  weather.kind = kind;
  weather.cloud = { clear: 10, cloudy: 90, rain: 95, snow: 90, fog: 100, storm: 100 }[kind];
  weather.precip = { rain: 1.5, storm: 4, snow: 1 }[kind] || 0;
  weather.freezing = false; // у ручной погоды нет WMO-кода — гололёда не обещаем
  // правдоподобные значения для нюансов: метель летит вбок, туман — стена
  weather.snow = kind === 'snow' ? 1 : 0;
  if (kind === 'snow') weather.wind = 5;
  weather.gust = { storm: 22, snow: 11 }[kind] ?? 4.5;
  weather.vis = { storm: 12000, fog: 350, rain: 25000, clear: 15000, cloudy: 25000 }[kind] ?? 20000;
}

// Дымка по видимости: 0 — чистый воздух, 1 — стена. В пойме кодов не-туманных видов — не выше 0.45.
export function fogK(kind = weather.kind, vis = weather.vis) {
  if (kind === 'fog') return clamp(1.5 - vis / 3000, 0.6, 1);
  return vis < 7000 && kind !== 'storm' ? clamp((7000 - vis) / 6000, 0, 0.45) : 0;
}

// Расписание молний: одно для картинки (scene.js) и звука (audio.js), слот 6 с — как catState.
// Гром звучит через delay после начала слота: свет опережает звук.
export function lightning(t) {
  const slot = Math.floor(t / 6), r = rng(slot * 17);
  const has = r() < 0.4, x = 40 + r() * 400, flashes = 1 + ((r() * 2) | 0);
  const delay = 1.2 + r() * 5, near = r() < 0.45;
  return { slot, has, x, flashes, delay, near, ph: t - slot * 6 };
}

export const WEATHER_WORDS = {
  clear: 'ясно', cloudy: 'облачно', rain: 'дождь', snow: 'снег', fog: 'туман', storm: 'гроза',
};
